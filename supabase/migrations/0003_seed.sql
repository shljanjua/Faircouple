-- ============================================================================
-- FairCouples — 0003_seed.sql
-- Reference data: fairness framework, emotions, plans & prices (multi-currency),
-- countries, destinations, attractions, checklist templates, CMS content,
-- email templates and platform settings.
-- Safe to re-run (idempotent upserts).
-- ============================================================================

-- ---------------------------------------------------------------------------
-- 1. FAIRNESS FRAMEWORK — the 10 core relationship areas
-- ---------------------------------------------------------------------------
insert into public.fairness_categories (slug, name, emoji, icon, description, fair_rule, weight, sort_order, is_dealbreaker) values
  ('emotional-connection','Emotional Connection','🤝','heart-handshake',
   'Both partners are equally allowed to be vulnerable, heard and supported.',
   'No one should always be the "strong one" — both get to be vulnerable.', 1.2, 1, false),
  ('communication','Communication System','💬','message-circle',
   'A working system of daily check-ins and deeper weekly conversations.',
   'If one raises a concern, the other must take it seriously — not ignore or delay.', 1.2, 2, false),
  ('respect-boundaries','Respect & Boundaries','❤️','shield-check',
   'Personal space, friendships, hobbies and privacy are mutually respected.',
   'Freedom should be equal — not one controlling the other.', 1.1, 3, false),
  ('trust-loyalty','Trust & Loyalty','🧠','lock',
   'Transparency, consistency and loyalty — physical and emotional.',
   'Trust is built by both — broken by one, but affects both.', 1.3, 4, false),
  ('financial-fairness','Financial Fairness','💸','wallet',
   'Expenses split equally or balanced by income, with no financial pressure.',
   'Effort matters more than money — both contribute fairly.', 1.0, 5, false),
  ('time-attention','Time & Attention','👫','clock',
   'Quality time together without either partner losing their individuality.',
   'No one should feel ignored or like an "option."', 1.0, 6, false),
  ('conflict-management','Conflict Management','⚖️','scale',
   'Disagreements are solved, not won. No blaming, no absolutes.',
   'Problem vs Partner — fight the issue, not each other.', 1.2, 7, false),
  ('affection-care','Affection & Care','💕','heart',
   'Verbal and physical affection, plus emotional support in hard times.',
   'Love should be shown, not just assumed.', 1.1, 8, false),
  ('growth-future','Growth & Future Alignment','🎯','target',
   'Shared goals, supported ambitions and an aligned direction.',
   'Don''t hold each other back — grow together or clearly separate paths.', 1.0, 9, false),
  ('deal-breakers','Deal Breakers','🚫','octagon-alert',
   'Non-negotiable standards that must apply equally to both partners.',
   'Standards apply equally — no double standards.', 1.5, 10, true)
on conflict (slug) do update set
  name = excluded.name, emoji = excluded.emoji, description = excluded.description,
  fair_rule = excluded.fair_rule, weight = excluded.weight, sort_order = excluded.sort_order,
  is_dealbreaker = excluded.is_dealbreaker;

with c as (select id, slug from public.fairness_categories)
insert into public.fairness_criteria (category_id, text, help_text, polarity, sort_order)
select c.id, x.text, x.help_text, 'positive', x.sort_order
from c join (values
  ('emotional-connection','Listen without interrupting','Let your partner finish before you respond.',1),
  ('emotional-connection','Validate feelings (not dismiss or mock)','"That makes sense" beats "you''re overreacting".',2),
  ('emotional-connection','Share personal thoughts openly','Say the real thing, not the safe version.',3),
  ('emotional-connection','Be emotionally available when needed','Present, not distant, when your partner reaches for you.',4),
  ('communication','Daily check-ins ("How was your day?")','Small, consistent contact beats rare big talks.',1),
  ('communication','Weekly deeper conversation (future, issues, plans)','One honest hour a week prevents months of drift.',2),
  ('communication','No silent treatment','Silence is a punishment, not a boundary.',3),
  ('communication','No shouting or abusive language','Volume is not an argument.',4),
  ('respect-boundaries','Respect personal space (time, friends, hobbies)','A life outside the relationship is healthy.',1),
  ('respect-boundaries','No controlling behaviour (phone checking, restrictions)','Monitoring is not love.',2),
  ('respect-boundaries','Privacy is mutual','The same rules apply to both phones.',3),
  ('trust-loyalty','No cheating — physical or emotional','Emotional affairs count.',1),
  ('trust-loyalty','Transparency about important things','No hidden debts, contacts or plans.',2),
  ('trust-loyalty','Consistency between words and actions','Reliability is the proof of trust.',3),
  ('financial-fairness','Expenses split equally or balanced by income','Fair does not always mean identical.',1),
  ('financial-fairness','No financial pressure on one side','Neither partner should feel squeezed.',2),
  ('financial-fairness','Gifts are mutual, not a one-sided expectation','Reciprocity, not scorekeeping.',3),
  ('time-attention','Quality time together (not just texting)','Undivided attention, phones down.',1),
  ('time-attention','Each other prioritised without losing individuality','Together, not merged.',2),
  ('conflict-management','No blaming, no "you always / you never"','Absolutes escalate, specifics resolve.',1),
  ('conflict-management','Focus on solving, not winning','A won argument can lose the relationship.',2),
  ('conflict-management','Take a break when emotions run high','Pause, then return — do not walk out.',3),
  ('affection-care','Verbal affection (compliments, appreciation)','Say it out loud, often.',1),
  ('affection-care','Physical affection (as per comfort)','Consent and comfort first.',2),
  ('affection-care','Emotional support during hard times','Show up when it is inconvenient.',3),
  ('growth-future','Goals discussed openly (career, marriage, lifestyle)','Assumptions about the future cause the biggest breaks.',1),
  ('growth-future','Each other''s ambitions actively supported','Support costs time, not just words.',2),
  ('deal-breakers','No abuse — physical, emotional or verbal','Zero tolerance, both directions.',1),
  ('deal-breakers','No manipulation or gaslighting','Reality is not up for negotiation.',2),
  ('deal-breakers','No repeated dishonesty','A pattern is a decision, not a mistake.',3)
) as x(cat, text, help_text, sort_order) on c.slug = x.cat
on conflict do nothing;

-- Healthy relationship cycle
insert into public.cycle_stages (slug, name, emoji, description, sort_order) values
  ('attraction','Attraction','✨','The initial pull — chemistry, curiosity and interest.',1),
  ('communication','Communication','💬','Learning how to talk, listen and be understood.',2),
  ('trust-building','Trust Building','🔐','Consistency over time turns interest into safety.',3),
  ('conflict-testing','Conflict Testing','⚡','The first real disagreements reveal how you repair.',4),
  ('deeper-bonding','Deeper Bonding','💞','Shared history, shared plans, genuine intimacy.',5),
  ('long-term-stability','Long-Term Stability','🏡','Sustained fairness, effort and direction.',6)
on conflict (slug) do update set name = excluded.name, description = excluded.description;

-- ---------------------------------------------------------------------------
-- 2. EMOTIONS
-- ---------------------------------------------------------------------------
insert into public.emotion_types (slug, label, emoji, valence, category, sort_order) values
  ('loved','Loved','🥰','positive','connection',1),
  ('happy','Happy','😊','positive','core',2),
  ('grateful','Grateful','🙏','positive','connection',3),
  ('secure','Secure','🛡️','positive','trust',4),
  ('excited','Excited','🤩','positive','core',5),
  ('proud','Proud','🌟','positive','growth',6),
  ('playful','Playful','😜','positive','core',7),
  ('affectionate','Affectionate','💕','positive','connection',8),
  ('supported','Supported','🤝','positive','connection',9),
  ('calm','Calm','😌','positive','core',10),
  ('hopeful','Hopeful','🌈','positive','growth',11),
  ('attracted','Attracted','🔥','positive','intimacy',12),
  ('neutral','Neutral','😐','neutral','core',13),
  ('tired','Tired','😴','neutral','core',14),
  ('confused','Confused','😕','neutral','core',15),
  ('distracted','Distracted','🌀','neutral','core',16),
  ('lonely','Lonely','🥺','negative','connection',17),
  ('ignored','Ignored','👻','negative','connection',18),
  ('anxious','Anxious','😰','negative','core',19),
  ('sad','Sad','😢','negative','core',20),
  ('frustrated','Frustrated','😤','negative','conflict',21),
  ('angry','Angry','😠','negative','conflict',22),
  ('hurt','Hurt','💔','negative','conflict',23),
  ('jealous','Jealous','😒','negative','trust',24),
  ('insecure','Insecure','😟','negative','trust',25),
  ('overwhelmed','Overwhelmed','😵','negative','core',26),
  ('disrespected','Disrespected','🚫','negative','respect',27),
  ('unappreciated','Unappreciated','😞','negative','connection',28),
  ('pressured','Pressured','😩','negative','financial',29),
  ('resentful','Resentful','🌩️','negative','conflict',30)
on conflict (slug) do update set label = excluded.label, emoji = excluded.emoji, valence = excluded.valence;

-- ---------------------------------------------------------------------------
-- 3. PLANS & MULTI-CURRENCY PRICING
-- ---------------------------------------------------------------------------
insert into public.plans (slug, name, tagline, description, tier, is_free, is_featured, trial_days, sort_order, badge, features, limits) values
  ('free','Starter','Begin the fairness habit','Track the basics for free — daily emotions, one relationship space and weekly fairness scoring.',
   0, true, false, 0, 1, null,
   '["1 relationship space","Daily emotion check-ins","Weekly fairness score (10 areas)","Basic compatibility snapshot","Private couple chat (200 messages/mo)","1 shared checklist","100 MB secure storage"]'::jsonb,
   '{"couples":1,"emotion_logs":90,"messages":200,"checklists":1,"budgets":1,"trips":1,"itineraries":1,"gifts":5,"documents":5,"storage_mb":100,"history_months":1,"exports":0,"itinerary_generator":false,"advanced_reports":false,"priority_support":false,"remove_ads":false,"custom_categories":false}'::jsonb),
  ('essential','Essential','For couples building the habit','Everything you need to keep effort, respect and loyalty balanced — with full travel planning.',
   1, false, true, 14, 2, 'Most popular',
   '["Everything in Starter","Unlimited emotion logs","Full 10-area fairness reports","Love vs Attraction assessment","Unlimited private messaging + photos","Shared budgeting & fair expense split","Travel planner + itinerary generator","Ticket & booking vault (5 GB)","12 months of history","Ad-free experience"]'::jsonb,
   '{"couples":2,"emotion_logs":-1,"messages":-1,"checklists":25,"budgets":10,"trips":10,"itineraries":20,"gifts":100,"documents":200,"storage_mb":5120,"history_months":12,"exports":10,"itinerary_generator":true,"advanced_reports":true,"priority_support":false,"remove_ads":true,"custom_categories":true}'::jsonb),
  ('premium','Premium','Deep insight and unlimited planning','Advanced fairness analytics, unlimited trips and documents, PDF exports and priority support.',
   2, false, false, 14, 3, 'Best value',
   '["Everything in Essential","Unlimited trips & itineraries","Unlimited ticket & document vault (50 GB)","Advanced fairness analytics & trends","Balance index + risk alerts","Custom fairness categories","Unlimited PDF/CSV exports","Gift planner with surprise mode","Priority email support","Unlimited history"]'::jsonb,
   '{"couples":5,"emotion_logs":-1,"messages":-1,"checklists":-1,"budgets":-1,"trips":-1,"itineraries":-1,"gifts":-1,"documents":-1,"storage_mb":51200,"history_months":-1,"exports":-1,"itinerary_generator":true,"advanced_reports":true,"priority_support":true,"remove_ads":true,"custom_categories":true}'::jsonb),
  ('lifetime','Lifetime','Pay once, keep forever','All Premium features, one payment, no renewals — including every future feature.',
   3, false, false, 0, 4, 'One-time',
   '["Everything in Premium, forever","All future features included","Lifetime ticket vault","Founding member badge","Priority support for life"]'::jsonb,
   '{"couples":-1,"emotion_logs":-1,"messages":-1,"checklists":-1,"budgets":-1,"trips":-1,"itineraries":-1,"gifts":-1,"documents":-1,"storage_mb":102400,"history_months":-1,"exports":-1,"itinerary_generator":true,"advanced_reports":true,"priority_support":true,"remove_ads":true,"custom_categories":true}'::jsonb)
on conflict (slug) do update set
  name = excluded.name, tagline = excluded.tagline, description = excluded.description,
  tier = excluded.tier, is_free = excluded.is_free, is_featured = excluded.is_featured,
  trial_days = excluded.trial_days, sort_order = excluded.sort_order, badge = excluded.badge,
  features = excluded.features, limits = excluded.limits;

-- Prices: USD, GBP, EUR, CAD, AUD × month/year (+ lifetime one-off)
insert into public.plan_prices (plan_id, currency, interval, amount_cents, compare_at_cents)
select p.id, v.currency, v.interval, v.amount, v.compare
from public.plans p
join (values
  ('free','USD','month',0,null::integer),('free','USD','year',0,null),
  ('free','GBP','month',0,null),('free','GBP','year',0,null),
  ('free','EUR','month',0,null),('free','EUR','year',0,null),
  ('free','CAD','month',0,null),('free','CAD','year',0,null),
  ('free','AUD','month',0,null),('free','AUD','year',0,null),

  ('essential','USD','month',999,null),('essential','USD','year',9900,11988),
  ('essential','GBP','month',799,null),('essential','GBP','year',7900,9588),
  ('essential','EUR','month',949,null),('essential','EUR','year',9400,11388),
  ('essential','CAD','month',1349,null),('essential','CAD','year',13400,16188),
  ('essential','AUD','month',1499,null),('essential','AUD','year',14900,17988),

  ('premium','USD','month',1999,null),('premium','USD','year',19900,23988),
  ('premium','GBP','month',1599,null),('premium','GBP','year',15900,19188),
  ('premium','EUR','month',1899,null),('premium','EUR','year',18900,22788),
  ('premium','CAD','month',2699,null),('premium','CAD','year',26900,32388),
  ('premium','AUD','month',2999,null),('premium','AUD','year',29900,35988),

  ('lifetime','USD','lifetime',34900,59900),
  ('lifetime','GBP','lifetime',27900,47900),
  ('lifetime','EUR','lifetime',32900,55900),
  ('lifetime','CAD','lifetime',46900,79900),
  ('lifetime','AUD','lifetime',52900,89900)
) as v(plan_slug, currency, interval, amount, compare) on v.plan_slug = p.slug
on conflict (plan_id, currency, interval) do update set
  amount_cents = excluded.amount_cents, compare_at_cents = excluded.compare_at_cents, is_active = true;

-- ---------------------------------------------------------------------------
-- 4. COUNTRIES (Tier-1 focus + full Europe + honeymoon favourites)
-- ---------------------------------------------------------------------------
insert into public.countries (code, code3, name, slug, region, continent, capital, currency_code, currency_symbol,
                              flag_emoji, is_schengen, is_tier1, best_season, avg_daily_cost_usd, summary, is_featured, sort_order) values
  ('US','USA','United States','united-states','North America','North America','Washington, D.C.','USD','$','🇺🇸',false,true,'Apr–Jun, Sep–Oct',210,'Fifty states of coastlines, canyons, cities and road trips — the widest range of honeymoon styles anywhere.',true,1),
  ('GB','GBR','United Kingdom','united-kingdom','Northern Europe','Europe','London','GBP','£','🇬🇧',false,true,'May–Sep',195,'Historic cities, dramatic coastline and countryside escapes within a few hours of each other.',true,2),
  ('CA','CAN','Canada','canada','North America','North America','Ottawa','CAD','C$','🇨🇦',false,true,'Jun–Sep, Dec–Mar',185,'Rocky Mountain lakes, island coastlines and northern lights — nature at an enormous scale.',true,3),
  ('AU','AUS','Australia','australia','Oceania','Oceania','Canberra','AUD','A$','🇦🇺',false,true,'Sep–Nov, Mar–May',190,'Reef, rainforest, wine country and world-class city beaches.',true,4),
  ('FR','FRA','France','france','Western Europe','Europe','Paris','EUR','€','🇫🇷',true,true,'Apr–Jun, Sep–Oct',175,'The benchmark romantic destination — Paris, Provence, the Riviera and the Loire.',true,5),
  ('IT','ITA','Italy','italy','Southern Europe','Europe','Rome','EUR','€','🇮🇹',true,true,'Apr–Jun, Sep–Oct',165,'Amalfi cliffs, Venetian canals, Tuscan hills and the best food on the continent.',true,6),
  ('ES','ESP','Spain','spain','Southern Europe','Europe','Madrid','EUR','€','🇪🇸',true,true,'Apr–Jun, Sep–Oct',140,'Islands, tapas culture, Moorish palaces and long warm evenings.',true,7),
  ('DE','DEU','Germany','germany','Western Europe','Europe','Berlin','EUR','€','🇩🇪',true,true,'May–Sep, Dec',150,'Fairytale castles, Alpine lakes, Christmas markets and effortless rail travel.',true,8),
  ('GR','GRC','Greece','greece','Southern Europe','Europe','Athens','EUR','€','🇬🇷',true,false,'May–Jun, Sep–Oct',145,'Whitewashed islands, caldera sunsets and 6,000 years of history.',true,9),
  ('PT','PRT','Portugal','portugal','Southern Europe','Europe','Lisbon','EUR','€','🇵🇹',true,false,'Apr–Jun, Sep–Oct',125,'Atlantic coastline, tiled cities and Europe''s best value for couples.',true,10),
  ('CH','CHE','Switzerland','switzerland','Western Europe','Europe','Bern','CHF','CHF','🇨🇭',true,true,'Jun–Sep, Dec–Mar',280,'Alpine railways, glacier lakes and the most photogenic mountains in Europe.',true,11),
  ('AT','AUT','Austria','austria','Western Europe','Europe','Vienna','EUR','€','🇦🇹',true,true,'May–Sep, Dec–Feb',165,'Imperial Vienna, Alpine villages and the classic Christmas-market winter.',true,12),
  ('NL','NLD','Netherlands','netherlands','Western Europe','Europe','Amsterdam','EUR','€','🇳🇱',true,true,'Apr–May, Sep',170,'Canal cities, tulip season and cycling distances between everything.',true,13),
  ('BE','BEL','Belgium','belgium','Western Europe','Europe','Brussels','EUR','€','🇧🇪',true,true,'May–Sep',155,'Medieval Bruges, chocolate, beer and easy rail links to the rest of Europe.',false,14),
  ('IE','IRL','Ireland','ireland','Northern Europe','Europe','Dublin','EUR','€','🇮🇪',false,true,'May–Sep',170,'Cliffs, castles, coastal drives and famously warm hospitality.',true,15),
  ('NO','NOR','Norway','norway','Northern Europe','Europe','Oslo','NOK','kr','🇳🇴',true,true,'Jun–Aug, Jan–Mar',230,'Fjords in summer, northern lights in winter — the most dramatic scenery in Europe.',true,16),
  ('SE','SWE','Sweden','sweden','Northern Europe','Europe','Stockholm','SEK','kr','🇸🇪',true,true,'Jun–Aug, Dec–Feb',205,'Archipelago summers, design-led cities and Lapland ice hotels.',false,17),
  ('DK','DNK','Denmark','denmark','Northern Europe','Europe','Copenhagen','DKK','kr','🇩🇰',true,true,'May–Sep',210,'Hygge, harbour swimming and one of the world''s best food scenes.',false,18),
  ('FI','FIN','Finland','finland','Northern Europe','Europe','Helsinki','EUR','€','🇫🇮',true,true,'Jun–Aug, Dec–Mar',195,'Glass igloos, aurora nights, saunas and a thousand lakes.',true,19),
  ('IS','ISL','Iceland','iceland','Northern Europe','Europe','Reykjavík','ISK','kr','🇮🇸',true,true,'Jun–Aug, Sep–Mar',245,'Waterfalls, black beaches, hot springs and the aurora — a honeymoon on another planet.',true,20),
  ('CZ','CZE','Czechia','czechia','Central Europe','Europe','Prague','CZK','Kč','🇨🇿',true,false,'Apr–Jun, Sep–Oct',110,'Prague''s spires and cobbles at a fraction of Western European prices.',true,21),
  ('HU','HUN','Hungary','hungary','Central Europe','Europe','Budapest','HUF','Ft','🇭🇺',true,false,'Apr–Jun, Sep–Oct',100,'Thermal baths, Danube views and Europe''s best-value romantic city break.',false,22),
  ('PL','POL','Poland','poland','Central Europe','Europe','Warsaw','PLN','zł','🇵🇱',true,false,'May–Sep',95,'Restored old towns, Baltic beaches and Tatra mountains.',false,23),
  ('HR','HRV','Croatia','croatia','Southern Europe','Europe','Zagreb','EUR','€','🇭🇷',true,false,'May–Jun, Sep',125,'Adriatic islands, walled cities and warm turquoise water.',true,24),
  ('SI','SVN','Slovenia','slovenia','Central Europe','Europe','Ljubljana','EUR','€','🇸🇮',true,false,'May–Sep',115,'Lake Bled, alpine valleys and a compact, walkable capital.',false,25),
  ('RO','ROU','Romania','romania','Eastern Europe','Europe','Bucharest','RON','lei','🇷🇴',true,false,'May–Sep',85,'Carpathian castles, painted monasteries and dramatic mountain roads.',false,26),
  ('BG','BGR','Bulgaria','bulgaria','Eastern Europe','Europe','Sofia','BGN','лв','🇧🇬',true,false,'May–Sep',80,'Black Sea coast, ski resorts and Roman ruins on a small budget.',false,27),
  ('SK','SVK','Slovakia','slovakia','Central Europe','Europe','Bratislava','EUR','€','🇸🇰',true,false,'May–Sep',95,'High Tatras hiking and a compact riverside capital.',false,28),
  ('EE','EST','Estonia','estonia','Northern Europe','Europe','Tallinn','EUR','€','🇪🇪',true,false,'Jun–Aug, Dec',105,'A perfectly preserved medieval old town and Baltic forests.',false,29),
  ('LV','LVA','Latvia','latvia','Northern Europe','Europe','Riga','EUR','€','🇱🇻',true,false,'Jun–Aug',100,'Art nouveau architecture and long white-sand Baltic beaches.',false,30),
  ('LT','LTU','Lithuania','lithuania','Northern Europe','Europe','Vilnius','EUR','€','🇱🇹',true,false,'Jun–Aug',95,'Baroque Vilnius and the dunes of the Curonian Spit.',false,31),
  ('LU','LUX','Luxembourg','luxembourg','Western Europe','Europe','Luxembourg City','EUR','€','🇱🇺',true,true,'May–Sep',185,'A fortress city in a green valley, at the crossroads of Europe.',false,32),
  ('MT','MLT','Malta','malta','Southern Europe','Europe','Valletta','EUR','€','🇲🇹',true,false,'Apr–Jun, Sep–Oct',130,'Honey-coloured limestone, blue lagoons and year-round sun.',false,33),
  ('CY','CYP','Cyprus','cyprus','Southern Europe','Europe','Nicosia','EUR','€','🇨🇾',false,false,'Apr–Jun, Sep–Nov',125,'Mediterranean beaches, mountain villages and the longest summer in Europe.',false,34),
  ('NZ','NZL','New Zealand','new-zealand','Oceania','Oceania','Wellington','NZD','NZ$','🇳🇿',false,true,'Nov–Apr',180,'Fiords, glaciers, vineyards and empty roads — an adventure honeymoon classic.',true,35),
  ('JP','JPN','Japan','japan','East Asia','Asia','Tokyo','JPY','¥','🇯🇵',false,true,'Mar–May, Oct–Nov',175,'Cherry blossom, ryokan onsen and a culture unlike anywhere else.',true,36),
  ('MV','MDV','Maldives','maldives','South Asia','Asia','Malé','MVR','Rf','🇲🇻',false,false,'Nov–Apr',420,'Overwater villas and private sandbanks — the definitive honeymoon island.',true,37),
  ('TH','THA','Thailand','thailand','Southeast Asia','Asia','Bangkok','THB','฿','🇹🇭',false,false,'Nov–Mar',85,'Island beaches, temples and outstanding value for long honeymoons.',true,38),
  ('ID','IDN','Indonesia','indonesia','Southeast Asia','Asia','Jakarta','IDR','Rp','🇮🇩',false,false,'Apr–Oct',75,'Bali''s rice terraces, cliff resorts and Gili island water.',true,39),
  ('AE','ARE','United Arab Emirates','united-arab-emirates','Middle East','Asia','Abu Dhabi','AED','د.إ','🇦🇪',false,false,'Nov–Mar',215,'Desert luxury, sky-high dining and beach resorts a short flight from Europe.',false,40),
  ('MX','MEX','Mexico','mexico','North America','North America','Mexico City','MXN','$','🇲🇽',false,false,'Nov–Apr',110,'Caribbean cenotes, colonial cities and all-inclusive Riviera Maya resorts.',true,41),
  ('CR','CRI','Costa Rica','costa-rica','Central America','North America','San José','CRC','₡','🇨🇷',false,false,'Dec–Apr',130,'Cloud forests, volcanoes and two coastlines in one small country.',false,42),
  ('ZA','ZAF','South Africa','south-africa','Southern Africa','Africa','Cape Town','ZAR','R','🇿🇦',false,false,'Oct–Apr',115,'Safari plus wine country plus coastline — three honeymoons in one.',false,43),
  ('MU','MUS','Mauritius','mauritius','East Africa','Africa','Port Louis','MUR','₨','🇲🇺',false,false,'May–Dec',210,'Lagoon resorts, hiking peaks and reliable winter sun.',false,44),
  ('SG','SGP','Singapore','singapore','Southeast Asia','Asia','Singapore','SGD','S$','🇸🇬',false,true,'Feb–Apr',180,'A garden city of rooftop pools, hawker food and effortless logistics.',false,45)
on conflict (code) do update set
  name = excluded.name, region = excluded.region, currency_code = excluded.currency_code,
  summary = excluded.summary, is_featured = excluded.is_featured, is_tier1 = excluded.is_tier1;

update public.countries set meta_title = name || ' Travel Guide for Couples 2026 — Honeymoon Ideas & Costs',
  meta_description = coalesce(summary, 'Plan a romantic trip to ' || name) || ' Compare costs, best months and itineraries with FairCouples.'
where meta_title is null;

-- ---------------------------------------------------------------------------
-- 5. DESTINATIONS
-- ---------------------------------------------------------------------------
insert into public.destinations (country_code, name, slug, city, destination_type, summary, hero_image,
  latitude, longitude, best_months, avg_daily_cost_usd, honeymoon_score, romance_score, budget_level,
  ideal_days, rating, popularity, tags, highlights, is_honeymoon, is_featured) values
  ('FR','Paris','paris','Paris','city','The original romantic city — river walks, rooftop views and a café on every corner.','https://images.unsplash.com/photo-1502602898657-3e91760cbb34',48.856600,2.352200,'{April,May,June,September,October}',195,97,99,'premium',5,4.80,1000,'{romantic,city,food,art,honeymoon}','{"Eiffel Tower at golden hour","Seine river dinner cruise","Louvre & Musée d''Orsay","Montmartre at sunrise","Day trip to Versailles"}',true,true),
  ('FR','Nice & the French Riviera','nice-french-riviera','Nice','beach','Mediterranean blue, old-town markets and Monaco half an hour away.','https://images.unsplash.com/photo-1491166617655-0723a0999cfc',43.710200,7.262000,'{May,June,September,October}',185,92,94,'premium',5,4.70,820,'{beach,riviera,romantic,honeymoon}','{"Promenade des Anglais","Èze village","Monaco day trip","Antibes old town","Coastal train to Menton"}',true,true),
  ('FR','Provence & Lavender Route','provence','Aix-en-Provence','countryside','Lavender fields, hilltop villages and long lunches under plane trees.','https://images.unsplash.com/photo-1499002238440-d264edd596ec',43.529700,5.447400,'{June,July,September}',160,90,93,'moderate',4,4.70,540,'{countryside,romantic,wine,honeymoon}','{"Valensole lavender fields","Gordes & Roussillon","Pont du Gard","Wine tasting in Châteauneuf"}',true,false),
  ('IT','Amalfi Coast','amalfi-coast','Positano','beach','Cliffside villages stacked above turquoise water — Italy at its most cinematic.','https://images.unsplash.com/photo-1533165850316-ac4ee2c48c04',40.634000,14.602600,'{May,June,September}',210,98,98,'luxury',5,4.90,960,'{beach,romantic,honeymoon,italy}','{"Positano beach clubs","Path of the Gods hike","Capri boat day","Ravello gardens","Limoncello tasting"}',true,true),
  ('IT','Venice','venice','Venice','historic','Canals, gondolas and a city that empties beautifully after sunset.','https://images.unsplash.com/photo-1523906834658-6e24ef2386f9',45.440800,12.315500,'{April,May,September,October}',190,94,97,'premium',3,4.60,880,'{romantic,historic,honeymoon}','{"Gondola through back canals","St Mark''s Basilica","Murano & Burano","Sunset on the Zattere"}',true,true),
  ('IT','Tuscany','tuscany','Florence','countryside','Renaissance cities surrounded by vineyards and cypress roads.','https://images.unsplash.com/photo-1543429776-2782fc8e1acd',43.769600,11.255800,'{May,June,September,October}',175,93,95,'premium',6,4.80,790,'{wine,countryside,art,honeymoon}','{"Uffizi Gallery","Val d''Orcia drive","Chianti wine tour","Siena & San Gimignano"}',true,true),
  ('IT','Lake Como','lake-como','Como','lake','Villas, ferries and mountains dropping straight into the water.','https://images.unsplash.com/photo-1527668752968-14dc70a27c95',45.985300,9.257400,'{May,June,September}',205,95,96,'luxury',4,4.80,610,'{lake,romantic,honeymoon}','{"Villa del Balbianello","Bellagio ferry hop","Varenna sunset","Funicular to Brunate"}',true,false),
  ('GR','Santorini','santorini','Oia','island','Caldera sunsets, blue domes and infinity pools above the Aegean.','https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff',36.393200,25.461500,'{May,June,September,October}',215,99,99,'luxury',4,4.90,990,'{island,honeymoon,romantic,sunset}','{"Oia sunset","Caldera catamaran cruise","Assyrtiko wine tasting","Red Beach","Ancient Akrotiri"}',true,true),
  ('GR','Mykonos','mykonos','Mykonos Town','island','Whitewashed lanes by day, the Aegean''s best beach clubs by night.','https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a',37.445100,25.328700,'{June,July,September}',225,88,90,'luxury',4,4.50,700,'{island,nightlife,beach}','{"Little Venice","Delos ruins","Psarou beach","Windmills at dusk"}',true,false),
  ('GR','Crete','crete','Chania','island','Greece''s biggest island — gorges, pink beaches and the best food in the Aegean.','https://images.unsplash.com/photo-1601581875309-fafbf2d3ed3a',35.513800,24.018000,'{May,June,September,October}',140,85,86,'moderate',7,4.60,520,'{island,beach,food,hiking}','{"Balos lagoon","Samaria gorge","Chania old harbour","Elafonissi pink sand"}',true,false),
  ('ES','Barcelona','barcelona','Barcelona','city','Gaudí architecture, tapas crawls and a city beach ten minutes from the old town.','https://images.unsplash.com/photo-1583422409516-2895a77efded',41.385100,2.173400,'{April,May,September,October}',150,86,88,'moderate',4,4.60,910,'{city,beach,food,architecture}','{"Sagrada Família","Park Güell","El Born tapas","Montjuïc cable car"}',false,true),
  ('ES','Seville & Andalusia','seville','Seville','historic','Moorish palaces, orange trees and flamenco in candlelit courtyards.','https://images.unsplash.com/photo-1558642084-fd07fae5282e',37.389200,-5.984500,'{March,April,May,October}',130,88,91,'moderate',4,4.70,480,'{historic,romantic,culture}','{"Real Alcázar","Plaza de España","Flamenco in Triana","Day trip to Córdoba"}',true,false),
  ('ES','Mallorca','mallorca','Palma','island','Cove beaches, mountain villages and one of the Med''s best cycling coasts.','https://images.unsplash.com/photo-1571003123894-1f0594d2b5d9',39.569600,2.650200,'{May,June,September}',160,84,85,'premium',5,4.50,430,'{island,beach,hiking}','{"Serra de Tramuntana drive","Cala Deià","Palma cathedral","Sóller train"}',false,false),
  ('PT','Lisbon','lisbon','Lisbon','city','Tiled hills, tram 28 and Atlantic sunsets from a hundred miradouros.','https://images.unsplash.com/photo-1585208798174-6cedd86e019a',38.722300,-9.139300,'{April,May,September,October}',125,87,89,'moderate',4,4.70,760,'{city,food,coast,budget}','{"Alfama & Fado night","Belém tower & pastéis","Sintra palaces","Cascais coast"}',true,true),
  ('PT','Madeira','madeira','Funchal','island','Levada walks, cliff pools and flowers all year round.','https://images.unsplash.com/photo-1580323956656-26bbb1206e34',32.660900,-16.908100,'{April,May,September,October}',135,86,87,'moderate',6,4.70,320,'{island,hiking,nature}','{"Pico do Arieiro sunrise","Levada do Caldeirão Verde","Porto Moniz pools","Cable car to Monte"}',true,false),
  ('PT','Algarve','algarve','Lagos','beach','Golden cliffs, sea caves and Europe''s most reliable beach summer.','https://images.unsplash.com/photo-1555881400-74d7acaacd8b',37.102000,-8.674100,'{May,June,September}',120,85,86,'moderate',5,4.60,470,'{beach,honeymoon,budget}','{"Benagil cave","Ponta da Piedade","Praia da Marinha","Sagres cliffs"}',true,false),
  ('CH','Interlaken & Jungfrau','interlaken','Interlaken','mountain','Two lakes, one valley and the most famous mountain railway in the world.','https://images.unsplash.com/photo-1530122037265-a5f1f91d3b99',46.686300,7.863200,'{June,July,August,September}',260,93,92,'luxury',4,4.80,600,'{mountain,adventure,honeymoon}','{"Jungfraujoch railway","Lauterbrunnen valley","Schilthorn revolving restaurant","Lake Brienz boat"}',true,true),
  ('CH','Zermatt','zermatt','Zermatt','ski','Car-free village beneath the Matterhorn — skiing in winter, hiking in summer.','https://images.unsplash.com/photo-1531210483974-4f8c1f33fd35',46.020700,7.749100,'{January,February,July,August}',285,91,90,'luxury',4,4.80,430,'{ski,mountain,luxury}','{"Gornergrat railway","Matterhorn Glacier Paradise","Five Lakes walk"}',true,false),
  ('DE','Bavarian Alps & Neuschwanstein','bavarian-alps','Füssen','mountain','Fairytale castles, alpine lakes and beer gardens with a mountain backdrop.','https://images.unsplash.com/photo-1595867818082-083862f3d630',47.557600,10.749800,'{May,June,September,December}',150,88,89,'moderate',4,4.70,560,'{castle,mountain,romantic}','{"Neuschwanstein Castle","Lake Eibsee","Zugspitze summit","Linderhof palace"}',true,true),
  ('DE','Berlin','berlin','Berlin','city','History on every block, a food scene that never stops and the best nightlife in Europe.','https://images.unsplash.com/photo-1560969184-10fe8719e047',52.520000,13.405000,'{May,June,September,December}',140,74,76,'moderate',4,4.50,690,'{city,history,nightlife}','{"Museum Island","Brandenburg Gate","East Side Gallery","Christmas markets"}',false,false),
  ('AT','Hallstatt & Salzkammergut','hallstatt','Hallstatt','lake','A lakeside village under sheer cliffs — the most photographed spot in Austria.','https://images.unsplash.com/photo-1516550893923-42d28e5677af',47.561200,13.648300,'{May,June,September}',155,89,91,'moderate',3,4.70,510,'{lake,romantic,village}','{"Hallstatt Skywalk","Salt mine tour","Lake boat trip","Gosausee reflection"}',true,false),
  ('AT','Vienna','vienna','Vienna','city','Imperial palaces, coffee houses and a waltz-worthy winter.','https://images.unsplash.com/photo-1516550893923-42d28e5677af',48.208200,16.373800,'{April,May,September,December}',160,84,88,'premium',3,4.70,580,'{city,culture,christmas}','{"Schönbrunn Palace","State Opera night","Naschmarkt","Christmas markets"}',false,false),
  ('NL','Amsterdam','amsterdam','Amsterdam','city','Canal rings, museums and tulip season an hour away.','https://images.unsplash.com/photo-1534351590666-13e3e96b5017',52.367600,4.904100,'{April,May,September}',175,82,85,'premium',3,4.60,720,'{city,canals,museums}','{"Canal cruise at dusk","Van Gogh Museum","Keukenhof tulips","Jordaan district"}',false,false),
  ('IS','Reykjavík & the Golden Circle','iceland-golden-circle','Reykjavík','countryside','Waterfalls, geysers and hot springs within a day of the capital.','https://images.unsplash.com/photo-1504829857797-ddff29c27927',64.146600,-21.942600,'{June,July,August,September,February}',245,94,93,'luxury',6,4.80,650,'{nature,aurora,honeymoon,adventure}','{"Blue Lagoon","Northern lights hunt","Gullfoss & Geysir","Jökulsárlón ice lagoon","Diamond Beach"}',true,true),
  ('NO','Norwegian Fjords','norwegian-fjords','Bergen','mountain','Sognefjord, Flåm railway and the deepest fjord scenery on earth.','https://images.unsplash.com/photo-1516483638261-f4dbaf036963',60.391300,5.322100,'{June,July,August}',235,90,91,'luxury',6,4.80,470,'{fjord,nature,honeymoon}','{"Flåm railway","Nærøyfjord cruise","Bergen Bryggen","Trolltunga hike"}',true,true),
  ('NO','Tromsø & the Arctic','tromso','Tromsø','mountain','Aurora season, husky sledding and whale watching above the Arctic Circle.','https://images.unsplash.com/photo-1483347756197-71ef80e95f73',69.649200,18.956300,'{November,December,January,February,March}',230,92,92,'luxury',4,4.80,380,'{aurora,winter,adventure,honeymoon}','{"Northern lights chase","Husky sledding","Whale safari","Cable car to Storsteinen"}',true,false),
  ('FI','Finnish Lapland','finnish-lapland','Rovaniemi','countryside','Glass igloos, reindeer sleighs and the aurora directly overhead.','https://images.unsplash.com/photo-1483347756197-71ef80e95f73',66.503900,25.729400,'{December,January,February,March}',225,95,96,'luxury',4,4.80,520,'{aurora,winter,honeymoon,igloo}','{"Glass igloo night","Santa Claus Village","Husky & reindeer safari","Ice floating"}',true,true),
  ('GB','London','london','London','city','Theatre, parks, markets and a thousand years of history in one square mile.','https://images.unsplash.com/photo-1513635269975-59663e0ac1ad',51.507400,-0.127800,'{May,June,July,September,December}',210,83,85,'premium',5,4.70,950,'{city,culture,shopping}','{"Tower of London","West End show","Borough Market","Thames sunset walk","Day trip to Bath"}',false,true),
  ('GB','Scottish Highlands','scottish-highlands','Inverness','mountain','Lochs, glens and single-track roads to castles nobody else has found.','https://images.unsplash.com/photo-1506905925346-21bda4d32df4',57.477200,-4.224700,'{May,June,September}',165,89,91,'moderate',6,4.80,420,'{nature,roadtrip,castle,honeymoon}','{"Isle of Skye","Glencoe","Loch Ness & Urquhart Castle","Jacobite steam train"}',true,true),
  ('GB','Lake District','lake-district','Windermere','lake','Fells, lakes and stone villages — England''s most romantic countryside.','https://images.unsplash.com/photo-1533130061792-64b345e4a833',54.380900,-2.906700,'{May,June,September}',150,86,88,'moderate',4,4.70,340,'{lake,hiking,countryside}','{"Lake Windermere cruise","Scafell Pike","Beatrix Potter''s Hill Top","Derwentwater"}',true,false),
  ('IE','Ring of Kerry & Dingle','ring-of-kerry','Killarney','countryside','Atlantic cliffs, green peninsulas and pubs with live music every night.','https://images.unsplash.com/photo-1590089415225-401ed6f9db8e',52.059900,-9.506800,'{May,June,September}',165,88,90,'moderate',5,4.70,390,'{roadtrip,coast,honeymoon}','{"Slea Head Drive","Cliffs of Moher","Killarney National Park","Skellig ring"}',true,false),
  ('CA','Banff & Lake Louise','banff','Banff','mountain','Turquoise glacier lakes ringed by the Canadian Rockies.','https://images.unsplash.com/photo-1609825488888-3a766db05542',51.178400,-115.570800,'{June,July,August,September}',195,94,94,'premium',6,4.90,780,'{mountain,lake,honeymoon,nature}','{"Lake Louise canoe","Moraine Lake sunrise","Icefields Parkway","Banff Gondola","Johnston Canyon"}',true,true),
  ('CA','Vancouver & Whistler','vancouver-whistler','Vancouver','city','Ocean, mountains and rainforest inside one metropolitan area.','https://images.unsplash.com/photo-1560814304-4f05b62af116',49.282700,-123.120700,'{June,July,August,December}',190,85,86,'premium',5,4.60,540,'{city,mountain,ski}','{"Stanley Park seawall","Sea-to-Sky Highway","Peak 2 Peak gondola","Granville Island"}',false,false),
  ('CA','Quebec City','quebec-city','Quebec City','historic','A walled French old town that turns into a snow globe in December.','https://images.unsplash.com/photo-1519832979-6fa011b87667',46.813900,-71.208000,'{June,July,September,December}',165,87,90,'moderate',3,4.70,360,'{historic,romantic,winter}','{"Château Frontenac","Petit-Champlain","Montmorency Falls","Ice hotel"}',true,false),
  ('US','Maui, Hawaii','maui','Lahaina','island','Road to Hana, volcano sunrises and the most reliable US honeymoon beaches.','https://images.unsplash.com/photo-1542259009477-d625272157b7',20.798000,-156.331900,'{April,May,September,October}',320,96,96,'luxury',7,4.80,880,'{island,beach,honeymoon,usa}','{"Road to Hana","Haleakalā sunrise","Molokini snorkel","Kaanapali beach"}',true,true),
  ('US','New York City','new-york-city','New York','city','Skyline dinners, Broadway and Central Park in every season.','https://images.unsplash.com/photo-1496442226666-8d4d0e62e6e9',40.712800,-74.006000,'{April,May,September,October,December}',280,84,86,'luxury',5,4.70,970,'{city,usa,shopping,food}','{"Top of the Rock","Broadway show","Central Park rowboat","Brooklyn Bridge walk","MoMA"}',false,true),
  ('US','California Coast (PCH)','california-coast','San Francisco','countryside','Highway 1 from San Francisco to Big Sur — the great American road trip.','https://images.unsplash.com/photo-1449034446853-66c86144b0ad',36.270300,-121.807400,'{May,June,September,October}',250,90,91,'premium',8,4.80,620,'{roadtrip,coast,usa,honeymoon}','{"Bixby Bridge","Big Sur cliffs","Napa Valley wine","17-Mile Drive","Golden Gate at sunset"}',true,true),
  ('US','Napa Valley','napa-valley','Napa','countryside','Wine country mornings in a hot air balloon, tastings all afternoon.','https://images.unsplash.com/photo-1506377247377-2a5b3b417ebb',38.297500,-122.286900,'{April,May,September,October}',290,91,93,'luxury',3,4.70,410,'{wine,romantic,usa,honeymoon}','{"Hot air balloon sunrise","Castello di Amorosa","Wine train","Calistoga spa"}',true,false),
  ('US','Charleston','charleston','Charleston','historic','Cobblestones, antebellum architecture and low-country cooking.','https://images.unsplash.com/photo-1568393691622-c7ba131d63b4',32.776600,-79.930900,'{March,April,October,November}',195,86,89,'premium',3,4.70,300,'{historic,romantic,usa,food}','{"Rainbow Row","Carriage tour","Boone Hall plantation","Folly Beach"}',true,false),
  ('AU','Sydney','sydney','Sydney','city','Harbour, headlands and beaches you can reach by ferry.','https://images.unsplash.com/photo-1506973035872-a4ec16b8e8d9',-33.868800,151.209300,'{October,November,March,April}',200,86,87,'premium',5,4.70,720,'{city,beach,australia}','{"Opera House tour","Bondi to Coogee walk","Harbour Bridge climb","Blue Mountains day trip"}',false,true),
  ('AU','Great Barrier Reef','great-barrier-reef','Cairns','island','The largest reef system on earth, plus rainforest at its doorstep.','https://images.unsplash.com/photo-1559827260-dc66d52bef19',-16.918600,145.778100,'{June,July,August,September}',225,93,92,'luxury',5,4.80,560,'{reef,diving,honeymoon,australia}','{"Outer reef snorkel","Whitehaven Beach","Daintree rainforest","Scenic heli flight"}',true,true),
  ('NZ','Queenstown','queenstown','Queenstown','mountain','Adventure capital wrapped around a lake, with vineyards next door.','https://images.unsplash.com/photo-1507699622108-4be3abd695ad',-45.031200,168.662600,'{December,January,February,March}',195,92,92,'premium',5,4.80,520,'{adventure,mountain,honeymoon}','{"Milford Sound day trip","Skyline gondola","Central Otago wine","Glenorchy drive"}',true,true),
  ('JP','Kyoto','kyoto','Kyoto','historic','Temples, bamboo groves and ryokan evenings in kimono.','https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e',35.011600,135.768100,'{March,April,October,November}',175,91,93,'premium',5,4.80,640,'{culture,romantic,honeymoon,japan}','{"Fushimi Inari at dawn","Arashiyama bamboo","Gion evening walk","Kiyomizu-dera","Ryokan & onsen"}',true,true),
  ('MV','Maldives','maldives-atolls','Malé','island','Overwater villas, house reefs and complete privacy.','https://images.unsplash.com/photo-1514282401047-d79a71a590e8',3.202800,73.220700,'{November,December,January,February,March,April}',430,100,100,'luxury',7,4.90,940,'{island,honeymoon,luxury,beach}','{"Overwater villa stay","Sandbank picnic","Manta ray snorkel","Sunset dolphin cruise","Underwater dining"}',true,true),
  ('TH','Phuket & Phi Phi','phuket','Phuket','island','Limestone islands, longtail boats and world-class value resorts.','https://images.unsplash.com/photo-1552465011-b4e21bf6e79a',7.878900,98.398100,'{November,December,January,February,March}',95,88,88,'budget',6,4.50,600,'{island,beach,budget,honeymoon}','{"Phi Phi island hopping","Phang Nga Bay","Big Buddha","Old Phuket Town"}',true,false),
  ('ID','Bali','bali','Ubud','island','Rice terraces, clifftop temples and villas with private pools.','https://images.unsplash.com/photo-1537996194471-e657df975ab4',-8.409500,115.188900,'{April,May,June,September,October}',85,94,95,'budget',8,4.70,910,'{island,honeymoon,budget,wellness}','{"Tegallalang rice terraces","Uluwatu sunset & kecak","Nusa Penida day trip","Floating breakfast villa","Mount Batur sunrise"}',true,true),
  ('MX','Riviera Maya','riviera-maya','Tulum','beach','Caribbean water, cenotes and Mayan ruins on the beach.','https://images.unsplash.com/photo-1518105779142-d975f22f1b0a',20.211400,-87.465400,'{November,December,January,February,March,April}',150,90,91,'moderate',6,4.60,700,'{beach,honeymoon,ruins}','{"Tulum ruins","Cenote Dos Ojos","Chichén Itzá","Isla Mujeres day trip"}',true,true),
  ('AE','Dubai','dubai','Dubai','city','Desert dinners, record-breaking towers and winter beach weather.','https://images.unsplash.com/photo-1512453979798-5ea266f8880c',25.204800,55.270800,'{November,December,January,February,March}',215,85,86,'luxury',4,4.60,610,'{city,luxury,desert}','{"Burj Khalifa","Desert safari dinner","Palm Jumeirah","Old Dubai souks"}',true,false),
  ('HR','Dubrovnik','dubrovnik','Dubrovnik','historic','City walls above the Adriatic and islands a ferry ride away.','https://images.unsplash.com/photo-1555990538-1e0d5c0d9dd7',42.650700,18.094400,'{May,June,September}',150,89,91,'premium',4,4.70,480,'{historic,coast,honeymoon}','{"City walls walk","Lokrum island","Cable car sunset","Elafiti island hop"}',true,false),
  ('CZ','Prague','prague','Prague','historic','Gothic spires, riverside walks and Europe''s best-value romantic weekend.','https://images.unsplash.com/photo-1519677100203-a0e668c92439',50.075500,14.437800,'{April,May,September,October,December}',115,86,90,'budget',3,4.70,660,'{historic,budget,romantic,christmas}','{"Charles Bridge at dawn","Prague Castle","Vltava river cruise","Christmas markets"}',true,true),
  ('HU','Budapest','budapest','Budapest','historic','Thermal baths, Danube panoramas and ruin bars after dark.','https://images.unsplash.com/photo-1541849546-216549ae216d',47.497900,19.040400,'{April,May,September,October}',105,85,88,'budget',3,4.60,540,'{budget,romantic,spa}','{"Széchenyi baths","Fisherman''s Bastion","Danube night cruise","Parliament tour"}',true,false),
  ('SI','Lake Bled','lake-bled','Bled','lake','An island church in an alpine lake, with a castle above it.','https://images.unsplash.com/photo-1533929736458-ca588d08c8be',46.363800,14.094400,'{May,June,September}',125,90,93,'moderate',3,4.80,420,'{lake,romantic,honeymoon}','{"Pletna boat to the island","Bled Castle","Vintgar Gorge","Bled cream cake"}',true,true),
  ('ZA','Cape Town & the Winelands','cape-town','Cape Town','city','Table Mountain, penguins, wine estates and two oceans.','https://images.unsplash.com/photo-1580060839134-75a5edca2e99',-33.924900,18.424100,'{November,December,January,February,March}',125,89,90,'moderate',7,4.70,450,'{city,wine,safari,honeymoon}','{"Table Mountain cable car","Cape Point drive","Stellenbosch wine tour","Boulders penguin beach"}',true,false),
  ('MU','Mauritius','mauritius-island','Port Louis','island','Lagoon resorts, waterfalls and a mountain to climb before breakfast.','https://images.unsplash.com/photo-1544551763-46a013bb70d5',-20.348400,57.552200,'{May,June,September,October,November}',215,93,93,'luxury',7,4.70,380,'{island,honeymoon,beach,luxury}','{"Le Morne beach","Chamarel coloured earth","Île aux Cerfs","Black River Gorges"}',true,false)
on conflict (slug) do update set
  summary = excluded.summary, hero_image = excluded.hero_image, honeymoon_score = excluded.honeymoon_score,
  avg_daily_cost_usd = excluded.avg_daily_cost_usd, highlights = excluded.highlights,
  is_honeymoon = excluded.is_honeymoon, is_featured = excluded.is_featured, popularity = excluded.popularity;

update public.destinations set
  meta_title = name || ' Honeymoon Guide 2026 — Costs, Best Time & Itinerary',
  meta_description = coalesce(summary,'') || ' Plan it with FairCouples: day-by-day itinerary, shared budget and packing checklist.',
  keywords = array[lower(name) || ' honeymoon', lower(name) || ' itinerary', lower(name) || ' couples trip',
                   'romantic ' || lower(name), lower(name) || ' travel cost']
where meta_title is null;

-- Sample attractions for the flagship destinations
insert into public.attractions (destination_id, name, slug, category, description, ticket_price_usd, duration_minutes, is_must_see, is_romantic, sort_order)
select d.id, a.name, a.slug, a.category, a.description, a.price, a.mins, a.must_see, a.romantic, a.sort_order
from public.destinations d
join (values
  ('paris','Eiffel Tower Summit','eiffel-tower','sightseeing','Book the last slot before sunset for the best light and shortest queues.',32.0,150,true,true,1),
  ('paris','Seine Dinner Cruise','seine-dinner-cruise','romantic','Two hours past every lit monument in the city.',95.0,120,false,true,2),
  ('paris','Musée du Louvre','louvre','museum','Enter through the Porte des Lions to skip the pyramid queue.',22.0,210,true,false,3),
  ('paris','Montmartre & Sacré-Cœur','montmartre','sightseeing','Arrive before 9am to have the steps to yourselves.',0.0,120,false,true,4),
  ('paris','Palace of Versailles','versailles','historic','A full day — gardens first, palace after 2pm.',32.0,420,true,true,5),
  ('santorini','Oia Sunset Point','oia-sunset','romantic','Claim a spot at the castle ruins 90 minutes early, or book a terrace table.',0.0,90,true,true,1),
  ('santorini','Caldera Catamaran Cruise','caldera-cruise','adventure','Hot springs, Red Beach and dinner on deck.',135.0,300,true,true,2),
  ('santorini','Ancient Akrotiri','akrotiri','museum','A Bronze Age town preserved under volcanic ash.',14.0,90,false,false,3),
  ('amalfi-coast','Path of the Gods','path-of-the-gods','nature','Walk Bomerano to Nocelle downhill — 3 hours, all view.',0.0,180,true,true,1),
  ('amalfi-coast','Capri Boat Day','capri-boat','adventure','Private boat with the Blue Grotto at opening time.',180.0,480,true,true,2),
  ('amalfi-coast','Villa Rufolo, Ravello','villa-rufolo','romantic','The terrace with the most famous view on the coast.',10.0,60,false,true,3),
  ('maldives-atolls','Sandbank Picnic','sandbank-picnic','romantic','Private sandbank drop-off with lunch and snorkelling gear.',210.0,240,true,true,1),
  ('maldives-atolls','Manta & Turtle Snorkel','manta-snorkel','nature','Best November to April on the western atolls.',95.0,180,true,false,2),
  ('bali','Tegallalang Rice Terraces','tegallalang','nature','Go at 7am — before the tour buses and the heat.',2.0,90,true,true,1),
  ('bali','Uluwatu Temple & Kecak Fire Dance','uluwatu','religious','Clifftop temple, sunset performance at 6pm.',8.0,150,true,true,2),
  ('bali','Mount Batur Sunrise Trek','mount-batur','adventure','2am start, breakfast cooked in volcanic steam at the summit.',45.0,420,false,true,3),
  ('banff','Moraine Lake Sunrise','moraine-lake','nature','Shuttle reservations required — book 60 days ahead.',12.0,180,true,true,1),
  ('banff','Lake Louise Canoe','lake-louise-canoe','romantic','Rent for an hour on the turquoise water below Victoria Glacier.',115.0,60,true,true,2),
  ('banff','Icefields Parkway Drive','icefields-parkway','nature','230 km of glaciers between Lake Louise and Jasper.',0.0,480,true,false,3),
  ('kyoto','Fushimi Inari at Dawn','fushimi-inari','religious','Ten thousand torii gates — arrive by 6:30am for empty paths.',0.0,120,true,true,1),
  ('kyoto','Arashiyama Bamboo Grove','arashiyama','nature','Combine with the Sagano railway and monkey park.',0.0,90,true,true,2),
  ('kyoto','Gion Evening Walk','gion','sightseeing','Lantern-lit lanes; be respectful, no photos of geiko.',0.0,90,false,true,3),
  ('iceland-golden-circle','Blue Lagoon','blue-lagoon','romantic','Pre-book the Retreat slot for fewer crowds.',95.0,180,true,true,1),
  ('iceland-golden-circle','Northern Lights Hunt','northern-lights','nature','September to March, clear nights, small-group jeep tours.',110.0,300,true,true,2),
  ('iceland-golden-circle','Jökulsárlón Ice Lagoon','jokulsarlon','nature','Icebergs drifting to Diamond Beach — worth the long drive.',0.0,240,true,true,3),
  ('finnish-lapland','Glass Igloo Night','glass-igloo','romantic','Sleep under the aurora with the heating on.',420.0,600,true,true,1),
  ('finnish-lapland','Husky Safari','husky-safari','adventure','Drive your own team through frozen forest.',180.0,240,true,false,2),
  ('venice','Back-Canal Gondola','gondola','romantic','Book from a quieter side canal, not Rialto — same price, better ride.',95.0,35,true,true,1),
  ('venice','Murano & Burano','murano-burano','sightseeing','Glass furnaces and painted fishermen''s houses by vaporetto.',10.0,300,false,true,2),
  ('london','Tower of London','tower-of-london','historic','Yeoman Warder tour first, Crown Jewels at opening.',40.0,180,true,false,1),
  ('london','West End Show','west-end','nightlife','Day seats released at 10am for the best price.',75.0,180,false,true,2),
  ('new-york-city','Top of the Rock','top-of-the-rock','sightseeing','The only observation deck with the Empire State in the shot.',44.0,90,true,true,1),
  ('new-york-city','Central Park Rowboat','central-park-rowboat','romantic','Loeb Boathouse, April to October.',25.0,60,false,true,2)
) as a(dest_slug, name, slug, category, description, price, mins, must_see, romantic, sort_order)
  on a.dest_slug = d.slug
on conflict (destination_id, slug) do nothing;

-- ---------------------------------------------------------------------------
-- 6. CHECKLIST & PACKING TEMPLATES
-- ---------------------------------------------------------------------------
insert into public.checklist_templates (slug, name, description, category, emoji, climate, trip_type, is_premium, sort_order, items) values
  ('essential-documents','Travel Documents & Money','Never leave these behind — the list that ruins a trip if you miss one.','travel','🛂',null,'any',false,1,
   '[{"name":"Passports (6+ months validity)","category":"Documents","essential":true},{"name":"Visa / ESTA / ETA approval","category":"Documents","essential":true},{"name":"Printed & digital flight tickets","category":"Documents","essential":true},{"name":"Hotel booking confirmations","category":"Documents","essential":true},{"name":"Travel insurance policy","category":"Documents","essential":true},{"name":"Driving licence + IDP","category":"Documents"},{"name":"Vaccination certificates","category":"Documents"},{"name":"Two payment cards (different networks)","category":"Money","essential":true},{"name":"Local currency cash","category":"Money"},{"name":"Emergency contact card","category":"Documents"},{"name":"Copies stored in the FairCouples vault","category":"Documents","essential":true}]'::jsonb),
  ('carry-on-essentials','Carry-On Essentials','What must stay with you, not in the hold.','packing','🎒',null,'any',false,2,
   '[{"name":"Passports & wallet","category":"Carry-on","essential":true},{"name":"Phone + charging cable","category":"Electronics","essential":true},{"name":"Power bank (under 100Wh)","category":"Electronics","essential":true},{"name":"Noise-cancelling headphones","category":"Electronics"},{"name":"Medication in original packaging","category":"Health","essential":true},{"name":"Change of underwear & t-shirt","category":"Clothing"},{"name":"Toothbrush & travel toothpaste","category":"Toiletries"},{"name":"Neck pillow & eye mask","category":"Comfort"},{"name":"Refillable water bottle (empty)","category":"Comfort"},{"name":"Snacks","category":"Comfort"},{"name":"Pen for landing cards","category":"Documents"}]'::jsonb),
  ('beach-honeymoon','Beach Honeymoon Packing','Maldives, Bali, Caribbean — hot, humid and photogenic.','packing','🏝️','tropical','honeymoon',false,3,
   '[{"name":"Swimwear ×3 each","category":"Clothing","essential":true},{"name":"Reef-safe SPF 50","category":"Health","essential":true},{"name":"After-sun / aloe","category":"Health"},{"name":"Wide-brim hat & sunglasses","category":"Clothing","essential":true},{"name":"Light cover-ups / sarong","category":"Clothing"},{"name":"Water shoes","category":"Footwear"},{"name":"Snorkel mask","category":"Gear"},{"name":"Dry bag","category":"Gear"},{"name":"Waterproof phone case","category":"Gear"},{"name":"Insect repellent (DEET 30%+)","category":"Health","essential":true},{"name":"Two smart outfits for dinners","category":"Clothing"},{"name":"Underwater / action camera","category":"Electronics"},{"name":"Portable fan","category":"Comfort"},{"name":"Rehydration sachets","category":"Health"}]'::jsonb),
  ('europe-city-break','Europe City Break Packing','Paris, Rome, Prague — walking, weather changes and dinner reservations.','packing','🏛️','temperate','city',false,4,
   '[{"name":"Broken-in walking shoes","category":"Footwear","essential":true},{"name":"Compact umbrella","category":"Gear"},{"name":"Layerable jacket","category":"Clothing","essential":true},{"name":"One smart outfit each","category":"Clothing"},{"name":"EU/UK travel adapter","category":"Electronics","essential":true},{"name":"Crossbody anti-theft bag","category":"Gear","essential":true},{"name":"Reusable water bottle","category":"Gear"},{"name":"Museum passes / city card","category":"Documents"},{"name":"Blister plasters","category":"Health"},{"name":"Scarf (for churches)","category":"Clothing"},{"name":"Offline maps downloaded","category":"Electronics","essential":true}]'::jsonb),
  ('winter-aurora','Winter & Northern Lights Gear','Lapland, Iceland, Tromsø — the sub-zero kit that actually matters.','packing','❄️','arctic','winter',false,5,
   '[{"name":"Thermal base layers ×3","category":"Clothing","essential":true},{"name":"Insulated waterproof parka","category":"Clothing","essential":true},{"name":"Snow trousers","category":"Clothing","essential":true},{"name":"Waterproof insulated boots","category":"Footwear","essential":true},{"name":"Wool socks ×5","category":"Clothing","essential":true},{"name":"Balaclava / neck gaiter","category":"Clothing"},{"name":"Waterproof gloves + liner gloves","category":"Clothing","essential":true},{"name":"Hand & toe warmers","category":"Gear"},{"name":"Crampons / ice grips","category":"Gear","essential":true},{"name":"Tripod for aurora shots","category":"Electronics"},{"name":"Spare camera batteries (cold drains them)","category":"Electronics","essential":true},{"name":"Lip balm & heavy moisturiser","category":"Health"},{"name":"Sunglasses (snow glare)","category":"Clothing"},{"name":"Thermos flask","category":"Gear"}]'::jsonb),
  ('hiking-adventure','Hiking & Adventure Gear','Alps, Rockies, Highlands — day hikes and multi-day treks.','packing','🥾','mountain','adventure',false,6,
   '[{"name":"Hiking boots (broken in)","category":"Footwear","essential":true},{"name":"25–35L daypack","category":"Gear","essential":true},{"name":"Waterproof shell jacket","category":"Clothing","essential":true},{"name":"Trekking poles","category":"Gear"},{"name":"2L water / hydration bladder","category":"Gear","essential":true},{"name":"Head torch + spare batteries","category":"Gear","essential":true},{"name":"First aid & blister kit","category":"Health","essential":true},{"name":"Offline trail maps (AllTrails/OS)","category":"Electronics","essential":true},{"name":"Energy bars","category":"Food"},{"name":"Emergency bivvy / foil blanket","category":"Gear","essential":true},{"name":"Sun cream & cap","category":"Health"},{"name":"Quick-dry towel","category":"Gear"},{"name":"Whistle","category":"Gear"}]'::jsonb),
  ('electronics-kit','Electronics & Photo Kit','Everything with a battery, plus the cables you always forget.','packing','🔌',null,'any',false,7,
   '[{"name":"Phones + cables","category":"Electronics","essential":true},{"name":"Universal travel adapter","category":"Electronics","essential":true},{"name":"20,000mAh power bank","category":"Electronics","essential":true},{"name":"Camera + spare batteries","category":"Electronics"},{"name":"SD cards & card reader","category":"Electronics"},{"name":"Compact tripod","category":"Electronics"},{"name":"E-reader / tablet","category":"Electronics"},{"name":"Multi-port USB charger","category":"Electronics"},{"name":"Headphone splitter (share a film)","category":"Electronics"},{"name":"eSIM or local SIM plan","category":"Electronics","essential":true}]'::jsonb),
  ('health-toiletries','Health & Toiletries','Both partners'' medical and personal-care list.','packing','💊',null,'any',false,8,
   '[{"name":"Prescription medication + copy of prescription","category":"Health","essential":true},{"name":"Painkillers & anti-inflammatories","category":"Health"},{"name":"Anti-diarrhoeal & rehydration","category":"Health"},{"name":"Motion sickness tablets","category":"Health"},{"name":"Antihistamines","category":"Health"},{"name":"Plasters & antiseptic","category":"Health"},{"name":"Contraception","category":"Health"},{"name":"Contact lenses + spare glasses","category":"Health"},{"name":"Toothbrushes & paste","category":"Toiletries","essential":true},{"name":"Deodorant","category":"Toiletries"},{"name":"Shampoo/conditioner (100ml)","category":"Toiletries"},{"name":"Razor & shaving cream","category":"Toiletries"},{"name":"Hairbrush & ties","category":"Toiletries"},{"name":"Nail clippers & tweezers","category":"Toiletries"}]'::jsonb),
  ('honeymoon-extras','Honeymoon Extras','The details that make it a honeymoon and not just a holiday.','honeymoon','💍',null,'honeymoon',false,9,
   '[{"name":"Marriage certificate copy (for upgrades)","category":"Documents","essential":true},{"name":"Tell every hotel it is your honeymoon","category":"Planning","essential":true},{"name":"Two special-occasion outfits","category":"Clothing"},{"name":"Rings insured & documented","category":"Documents"},{"name":"Surprise gift for your partner","category":"Romance"},{"name":"Printed photo of you both","category":"Romance"},{"name":"Handwritten letters to open mid-trip","category":"Romance"},{"name":"Book the sunset dinner in advance","category":"Planning","essential":true},{"name":"Couples spa treatment booked","category":"Planning"},{"name":"Photographer session booked","category":"Planning"}]'::jsonb),
  ('pre-departure','72 Hours Before Departure','The admin that stops trips going wrong.','travel','⏰',null,'any',false,10,
   '[{"name":"Online check-in completed","category":"Admin","essential":true},{"name":"Seats selected together","category":"Admin"},{"name":"Boarding passes in the vault","category":"Admin","essential":true},{"name":"Airport transfer booked","category":"Admin","essential":true},{"name":"Bank travel notification","category":"Admin"},{"name":"Roaming / eSIM activated","category":"Admin"},{"name":"Home: bins, plants, heating, locks","category":"Home"},{"name":"Someone has your itinerary","category":"Safety","essential":true},{"name":"Bags weighed","category":"Admin"},{"name":"Liquids under 100ml bagged","category":"Admin","essential":true},{"name":"Devices charged","category":"Admin"},{"name":"Currency exchanged","category":"Money"}]'::jsonb),
  ('weekly-fairness-ritual','Weekly Fairness Ritual','The 20-minute conversation that keeps effort balanced.','relationship','⚖️',null,null,false,11,
   '[{"name":"Both partners complete this week''s fairness entry","category":"Ritual","essential":true},{"name":"Read each other''s notes without replying yet","category":"Ritual","essential":true},{"name":"Each names one thing the other did well","category":"Ritual"},{"name":"Each names one thing they need more of","category":"Ritual","essential":true},{"name":"Check the balance index together","category":"Ritual"},{"name":"Agree one concrete action for next week","category":"Ritual","essential":true},{"name":"Book the next date night","category":"Ritual"},{"name":"Review shared spending","category":"Ritual"}]'::jsonb),
  ('date-night-ideas','Date Night Rotation','Alternate who plans it — that is the point.','date_night','🌹',null,null,false,12,
   '[{"name":"Cook a new recipe together","category":"At home"},{"name":"Phone-free dinner","category":"At home","essential":true},{"name":"Recreate your first date","category":"Out"},{"name":"Sunrise or sunset walk","category":"Out"},{"name":"Live music or comedy","category":"Out"},{"name":"Museum or gallery","category":"Out"},{"name":"Board game & dessert night","category":"At home"},{"name":"Plan the next trip together","category":"At home"},{"name":"Couples massage","category":"Out"},{"name":"Write each other a letter","category":"At home"}]'::jsonb),
  ('conflict-repair','Conflict Repair Checklist','Work through this before the argument restarts.','relationship','🛠️',null,null,true,13,
   '[{"name":"Both agree the topic (one issue only)","category":"Repair","essential":true},{"name":"No absolutes: no ''always'' or ''never''","category":"Repair","essential":true},{"name":"Each speaks for 3 minutes uninterrupted","category":"Repair","essential":true},{"name":"Each repeats back what they heard","category":"Repair","essential":true},{"name":"Name the need behind the complaint","category":"Repair"},{"name":"Take a 20-minute break if either is flooded","category":"Repair"},{"name":"Agree one change each","category":"Repair","essential":true},{"name":"Set a date to review it","category":"Repair"},{"name":"Repair gesture (not a purchase)","category":"Repair"}]'::jsonb),
  ('money-talk','Monthly Money Talk','Financial fairness needs a scheduled conversation.','finance','💸',null,null,false,14,
   '[{"name":"Review last month''s shared expenses","category":"Money","essential":true},{"name":"Settle who owes whom","category":"Money","essential":true},{"name":"Check the split still matches incomes","category":"Money","essential":true},{"name":"Agree next month''s budget","category":"Money"},{"name":"Review subscriptions","category":"Money"},{"name":"Update travel savings goal","category":"Money"},{"name":"Flag any financial pressure honestly","category":"Money","essential":true}]'::jsonb)
on conflict (slug) do update set
  name = excluded.name, description = excluded.description, items = excluded.items,
  category = excluded.category, emoji = excluded.emoji, sort_order = excluded.sort_order;

-- ---------------------------------------------------------------------------
-- 7. PLATFORM SETTINGS
-- ---------------------------------------------------------------------------
insert into public.site_settings (key, value, group_name, label, description, is_public, is_secret) values
  ('site_name','"FairCouples"','general','Site name','Shown in the header, emails and page titles.',true,false),
  ('site_tagline','"Fair love, measured."','general','Tagline',null,true,false),
  ('site_description','"FairCouples is the relationship fairness platform for couples and families — track emotions, balance effort, split budgets fairly and plan trips together."','general','Meta description','Default meta description for SEO.',true,false),
  ('site_url','"https://faircouples.com"','general','Site URL','Canonical base URL.',true,false),
  ('support_email','"support@faircouples.com"','general','Support email',null,true,false),
  ('contact_phone','""','general','Contact phone',null,true,false),
  ('company_name','"FairCouples Ltd"','general','Legal company name',null,true,false),
  ('company_address','"71-75 Shelton Street, London, WC2H 9JQ, United Kingdom"','general','Registered address',null,true,false),
  ('default_currency','"USD"','general','Default currency','Fallback when the country cannot be detected.',true,false),
  ('supported_currencies','["USD","GBP","EUR","CAD","AUD"]','general','Supported currencies',null,true,false),
  ('default_locale','"en"','general','Default locale',null,true,false),
  ('maintenance_mode','false','general','Maintenance mode','Takes the public site offline for non-admins.',true,false),
  ('signup_enabled','true','general','Allow new signups',null,true,false),
  ('require_email_verification','true','general','Require email verification','New accounts must confirm their email before using the app.',true,false),
  ('trial_days','14','general','Default trial length (days)',null,true,false),

  ('social_twitter','"https://x.com/faircouples"','social','X / Twitter',null,true,false),
  ('social_instagram','"https://instagram.com/faircouples"','social','Instagram',null,true,false),
  ('social_facebook','"https://facebook.com/faircouples"','social','Facebook',null,true,false),
  ('social_pinterest','"https://pinterest.com/faircouples"','social','Pinterest',null,true,false),
  ('social_linkedin','"https://linkedin.com/company/faircouples"','social','LinkedIn',null,true,false),
  ('social_tiktok','""','social','TikTok',null,true,false),
  ('social_youtube','""','social','YouTube',null,true,false),

  ('seo_default_title','"FairCouples — Relationship Fairness, Emotions, Budget & Travel Planner for Couples"','seo','Default title tag',null,true,false),
  ('seo_title_template','"%s | FairCouples"','seo','Title template',null,true,false),
  ('seo_keywords','["relationship app for couples","fairness in relationships","couples emotion tracker","relationship compatibility test","couples budget app","honeymoon itinerary planner","couples travel checklist","love vs attraction test","shared expense splitter for couples","couples private messaging app"]','seo','Global keywords',null,true,false),
  ('seo_og_image','"/og"','seo','Default OG image',null,true,false),
  ('seo_twitter_handle','"@faircouples"','seo','Twitter handle',null,true,false),
  ('seo_robots','"index,follow,max-image-preview:large,max-snippet:-1,max-video-preview:-1"','seo','Default robots directive',null,true,false),
  ('seo_google_verification','""','seo','Google Search Console token',null,true,false),
  ('seo_bing_verification','""','seo','Bing Webmaster token',null,true,false),
  ('seo_yandex_verification','""','seo','Yandex verification token',null,true,false),
  ('seo_pinterest_verification','""','seo','Pinterest verification token',null,true,false),
  ('seo_sitemap_enabled','true','seo','Generate sitemap.xml',null,true,false),
  ('seo_noindex_site','false','seo','No-index the whole site','Emergency switch — blocks all indexing.',true,false),

  ('analytics_ga4_id','""','integrations','Google Analytics 4 ID','e.g. G-XXXXXXXXXX',true,false),
  ('analytics_gtm_id','""','integrations','Google Tag Manager ID','e.g. GTM-XXXXXXX',true,false),
  ('analytics_meta_pixel_id','""','integrations','Meta (Facebook) Pixel ID',null,true,false),
  ('analytics_google_ads_id','""','integrations','Google Ads conversion ID','e.g. AW-XXXXXXXXX',true,false),
  ('analytics_google_ads_label','""','integrations','Google Ads conversion label',null,true,false),
  ('analytics_adsense_client','""','integrations','AdSense publisher ID','e.g. ca-pub-XXXXXXXXXXXXXXXX',true,false),
  ('analytics_adsense_enabled','false','integrations','Enable AdSense',null,true,false),
  ('analytics_adsense_auto_ads','true','integrations','AdSense auto ads',null,true,false),
  ('analytics_clarity_id','""','integrations','Microsoft Clarity ID',null,true,false),
  ('analytics_hotjar_id','""','integrations','Hotjar site ID',null,true,false),
  ('analytics_tiktok_pixel','""','integrations','TikTok Pixel ID',null,true,false),
  ('analytics_pinterest_tag','""','integrations','Pinterest Tag ID',null,true,false),
  ('analytics_linkedin_partner','""','integrations','LinkedIn Partner ID',null,true,false),
  ('cookie_banner_enabled','true','integrations','Cookie consent banner',null,true,false),

  ('smtp_host','""','email','SMTP host','e.g. smtp.hostinger.com',false,true),
  ('smtp_port','587','email','SMTP port',null,false,true),
  ('smtp_secure','false','email','Use TLS/SSL (port 465)',null,false,true),
  ('smtp_user','""','email','SMTP username',null,false,true),
  ('smtp_password','""','email','SMTP password',null,false,true),
  ('smtp_from_email','"no-reply@faircouples.com"','email','From address',null,false,true),
  ('smtp_from_name','"FairCouples"','email','From name',null,false,true),
  ('smtp_reply_to','"support@faircouples.com"','email','Reply-to address',null,false,true),
  ('email_enabled','true','email','Email sending enabled',null,false,true),
  ('email_admin_notifications','true','email','Notify admins of new signups & payments',null,false,true),

  ('billing_tax_enabled','false','billing','Collect tax / VAT',null,false,false),
  ('billing_tax_rate','0','billing','Default tax rate (%)',null,false,false),
  ('billing_invoice_prefix','"FC"','billing','Invoice number prefix',null,false,false),
  ('billing_currency_lock','false','billing','Lock currency after signup','Prevents users changing currency once subscribed.',true,false),

  ('feature_ads_on_free','true','features','Show ads on the free plan',null,true,false),
  ('feature_blog_enabled','true','features','Blog enabled',null,true,false),
  ('feature_referrals_enabled','true','features','Referral programme',null,true,false)
on conflict (key) do update set
  label = excluded.label, description = excluded.description,
  group_name = excluded.group_name, is_public = excluded.is_public, is_secret = excluded.is_secret;

insert into public.payment_gateways (provider, display_name, is_enabled, mode, credentials, supported_currencies, sort_order, instructions) values
  ('stripe','Stripe (Cards, Apple Pay, Google Pay)', false, 'test',
   '{"publishable_key":"","secret_key":"","webhook_secret":""}'::jsonb,
   '{USD,GBP,EUR,CAD,AUD}', 1, 'Add your keys from dashboard.stripe.com → Developers → API keys. Webhook endpoint: /api/webhooks/stripe'),
  ('paypal','PayPal', false, 'sandbox_to_live',
   '{"client_id":"","client_secret":"","webhook_id":""}'::jsonb,
   '{USD,GBP,EUR,CAD,AUD}', 2, 'Create a REST app at developer.paypal.com. Webhook endpoint: /api/webhooks/paypal'),
  ('manual','Bank transfer / manual', false, 'live',
   '{"instructions":""}'::jsonb, '{USD,GBP,EUR,CAD,AUD}', 3,
   'Admin marks the subscription active after receiving payment.')
on conflict (provider) do update set display_name = excluded.display_name, instructions = excluded.instructions;

update public.payment_gateways set mode = 'test' where mode not in ('test','live');

insert into public.exchange_rates (base_currency, quote_currency, rate) values
  ('USD','USD',1),('USD','GBP',0.79),('USD','EUR',0.92),('USD','CAD',1.36),('USD','AUD',1.52),
  ('USD','CHF',0.88),('USD','NZD',1.64),('USD','SEK',10.5),('USD','NOK',10.7),('USD','DKK',6.9)
on conflict (base_currency, quote_currency) do update set rate = excluded.rate, updated_at = now();

-- ---------------------------------------------------------------------------
-- 8. EMAIL TEMPLATES
-- ---------------------------------------------------------------------------
insert into public.email_templates (slug, name, subject, description, variables, html_body, text_body) values
  ('welcome','Welcome / verify email','Confirm your email and start your FairCouples journey',
   'Sent immediately after signup with the confirmation link.',
   '{name,confirm_url,site_name}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1 style="color:#e11d48">Welcome to {{site_name}}, {{name}} 💗</h1><p>You are one click away from a fairer relationship. Confirm your email address to activate your account.</p><p style="margin:32px 0"><a href="{{confirm_url}}" style="background:#e11d48;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Confirm my email</a></p><p style="color:#64748b;font-size:14px">If the button does not work, paste this link into your browser:<br>{{confirm_url}}</p><p style="color:#64748b;font-size:13px">You are receiving this because an account was created with this address. If it was not you, ignore this email.</p></div>',
   'Welcome to {{site_name}}, {{name}}. Confirm your email: {{confirm_url}}'),
  ('partner-invite','Partner invitation','{{inviter_name}} invited you to their FairCouples space',
   'Sent when a member invites their partner.',
   '{inviter_name,invite_url,relationship_type,message}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1 style="color:#e11d48">{{inviter_name}} invited you 💌</h1><p>You have been invited to join a private FairCouples space. Both of you log your own entries — and both of you see the fairness report.</p><blockquote style="border-left:3px solid #e11d48;padding-left:16px;color:#475569">{{message}}</blockquote><p style="margin:32px 0"><a href="{{invite_url}}" style="background:#e11d48;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Accept the invitation</a></p><p style="color:#64748b;font-size:13px">This invitation expires in 14 days.</p></div>',
   '{{inviter_name}} invited you to FairCouples: {{invite_url}}'),
  ('password-reset','Password reset','Reset your FairCouples password',
   'Sent when a user requests a password reset.',
   '{name,reset_url}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>Reset your password</h1><p>Hi {{name}}, click below to choose a new password. The link expires in 60 minutes.</p><p style="margin:32px 0"><a href="{{reset_url}}" style="background:#0f172a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Set a new password</a></p><p style="color:#64748b;font-size:13px">If you did not request this, no action is needed.</p></div>',
   'Reset your password: {{reset_url}}'),
  ('subscription-active','Subscription activated','Your {{plan_name}} plan is active 🎉',
   'Sent after a successful payment.',
   '{name,plan_name,amount,currency,next_billing_date,invoice_url}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1 style="color:#e11d48">You are on {{plan_name}}</h1><p>Thanks {{name}} — your payment of {{amount}} {{currency}} was successful.</p><ul><li>Plan: <strong>{{plan_name}}</strong></li><li>Next billing date: <strong>{{next_billing_date}}</strong></li></ul><p><a href="{{invoice_url}}">View your invoice</a></p><p>Your partner automatically gets full access on your plan — invite them from Settings → Partner.</p></div>',
   'Your {{plan_name}} plan is active. Next billing: {{next_billing_date}}'),
  ('payment-failed','Payment failed','Action needed: your FairCouples payment failed',
   'Sent when a recurring charge fails.',
   '{name,plan_name,retry_url}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>We could not take your payment</h1><p>Hi {{name}}, the charge for your {{plan_name}} plan did not go through. Update your payment method to keep your history and shared data.</p><p style="margin:32px 0"><a href="{{retry_url}}" style="background:#e11d48;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Update payment method</a></p></div>',
   'Payment failed for {{plan_name}}. Update: {{retry_url}}'),
  ('weekly-report','Weekly fairness report','Your fairness report for this week',
   'Weekly digest of both partners'' entries.',
   '{name,partner_name,balance_index,overall_score,verdict,report_url}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>This week with {{partner_name}}</h1><p style="font-size:40px;margin:8px 0;color:#e11d48"><strong>{{balance_index}}</strong><span style="font-size:16px;color:#64748b">/100 balance</span></p><p>Overall fairness score: <strong>{{overall_score}}</strong></p><p>{{verdict}}</p><p style="margin:32px 0"><a href="{{report_url}}" style="background:#0f172a;color:#fff;padding:14px 28px;border-radius:10px;text-decoration:none;font-weight:600">Open the full report</a></p></div>',
   'Balance index {{balance_index}}/100. Report: {{report_url}}'),
  ('partner-entry','Partner logged an entry','{{partner_name}} added a new entry',
   'Notifies a member when their partner submits emotions or fairness entries.',
   '{name,partner_name,entry_type,link}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>{{partner_name}} just logged {{entry_type}}</h2><p>Open FairCouples to read it and add your side.</p><p><a href="{{link}}">View entry</a></p></div>',
   '{{partner_name}} logged {{entry_type}}: {{link}}'),
  ('trip-reminder','Trip reminder','Your trip to {{destination}} starts in {{days}} days',
   'Pre-departure reminder with the checklist link.',
   '{name,destination,days,checklist_url}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h1>{{destination}} in {{days}} days ✈️</h1><p>Your documents are in the vault and your packing checklist is waiting.</p><p><a href="{{checklist_url}}">Open the checklist</a></p></div>',
   '{{destination}} in {{days}} days. Checklist: {{checklist_url}}'),
  ('account-removed','Removed from a couple','You were removed from a FairCouples space',
   'Sent when an owner or admin removes a partner.',
   '{name,couple_name}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>Access to {{couple_name}} has ended</h2><p>Hi {{name}}, you no longer have access to that shared space. Your own private entries remain in your account.</p></div>',
   'You were removed from {{couple_name}}.'),
  ('contact-received','Contact form received','We received your message',
   'Auto-reply for the contact form.',
   '{name}',
   '<div style="font-family:Inter,Arial,sans-serif;max-width:560px;margin:auto;color:#0f172a"><h2>Thanks {{name}}, we have your message</h2><p>Our team replies within one business day.</p></div>',
   'Thanks {{name}}, we received your message.')
on conflict (slug) do update set
  subject = excluded.subject, html_body = excluded.html_body, text_body = excluded.text_body,
  description = excluded.description, variables = excluded.variables;

-- ---------------------------------------------------------------------------
-- 9. LEGAL & MARKETING PAGES
-- ---------------------------------------------------------------------------
insert into public.pages (slug, title, page_type, status, show_in_footer, sort_order, meta_title, meta_description, content) values
  ('privacy-policy','Privacy Policy','legal','published',true,1,
   'Privacy Policy — FairCouples',
   'How FairCouples collects, uses, stores and protects your personal and relationship data, including GDPR, UK GDPR and CCPA rights.',
   '## 1. Who we are
FairCouples ("we", "us") operates faircouples.com. We are the data controller for the personal data described in this policy. Contact: privacy@faircouples.com.

## 2. Data we collect
- **Account data:** name, email, password hash, country, currency, locale, timezone.
- **Relationship data:** emotion logs, fairness entries, check-ins, assessments, notes, checklists.
- **Shared content:** messages, photos, uploaded booking documents and tickets.
- **Financial data:** budgets, expenses and settlements you enter. Card details are never stored on our servers — they are handled by Stripe and PayPal.
- **Technical data:** IP address, device, browser, pages viewed, referral source.

## 3. How we use it
To provide the service, compute fairness and compatibility reports, process subscriptions, send transactional email, prevent abuse, and improve the product. We do not sell personal data.

## 4. Legal bases (UK/EU)
Contract (providing the service), legitimate interests (security, product improvement), consent (marketing email, non-essential cookies), and legal obligation (tax and accounting records).

## 5. Sharing with your partner
Entries you mark **private** are never shown to your partner. Everything else in a shared space is visible to both members by design. Removing a partner ends their access immediately.

## 6. Processors
Supabase (database, authentication, storage), Stripe and PayPal (payments), our SMTP provider (email), and analytics providers you have consented to.

## 7. International transfers
Data may be processed in the EU, UK and US under Standard Contractual Clauses or an adequacy decision.

## 8. Retention
Account data is kept while your account is active and for 30 days after deletion. Financial records are kept for 7 years where legally required.

## 9. Your rights
Access, rectification, erasure, restriction, portability, objection, and withdrawal of consent. California residents have the right to know, delete, correct and opt out of sale/sharing (we do not sell). Email privacy@faircouples.com — we respond within 30 days.

## 10. Security
Encryption in transit and at rest, row-level security isolating every couple''s data, hashed passwords, audited admin access.

## 11. Children
The service is not directed at anyone under 16. We delete such accounts on discovery.

## 12. Changes
Material changes will be announced by email and in-app 14 days before taking effect.'),
  ('terms-of-service','Terms of Service','legal','published',true,2,
   'Terms of Service — FairCouples',
   'The terms governing your use of FairCouples, including subscriptions, cancellations, acceptable use and liability.',
   '## 1. Agreement
By creating an account you agree to these Terms. If you do not agree, do not use the service.

## 2. Eligibility
You must be at least 16 years old and able to form a binding contract.

## 3. Accounts
You are responsible for your credentials and for all activity under your account. One person, one account.

## 4. Shared spaces
A relationship space holds two members. The space owner may remove a partner at any time; removal is immediate and revokes access to shared content. Content created by a removed member remains in the space unless they request deletion.

## 5. Subscriptions and billing
Plans are billed monthly, annually or once (Lifetime), in the currency selected at signup. Prices are shown inclusive of any applicable tax at checkout. Subscriptions renew automatically until cancelled. A paid plan covers both members of a space.

## 6. Trials
Where offered, a free trial converts to a paid subscription at the end of the trial unless cancelled beforehand.

## 7. Cancellation and refunds
Cancel any time from Settings → Billing; access continues until the end of the paid period. We offer a 14-day refund on first purchases. Lifetime purchases are refundable within 14 days of purchase.

## 8. Acceptable use
No harassment, abuse, illegal content, scraping, reverse engineering, or attempts to access another couple''s data. We may suspend accounts that break these rules.

## 9. Not professional advice
FairCouples provides self-reported measurement and educational content. It is not therapy, counselling, legal or financial advice. If you are in danger, contact your local emergency service.

## 10. Intellectual property
We own the platform, brand and content. You own the data you enter, and grant us a licence to process it to run the service.

## 11. Liability
To the maximum extent permitted by law, our aggregate liability is limited to the amount you paid in the 12 months before the claim.

## 12. Governing law
England and Wales, without prejudice to mandatory consumer rights in your country of residence.'),
  ('cookie-policy','Cookie Policy','legal','published',true,3,
   'Cookie Policy — FairCouples',
   'The cookies and similar technologies FairCouples uses, and how to control them.',
   '## Essential cookies
Authentication session, CSRF protection, currency and theme preference. These cannot be disabled.

## Analytics cookies
Google Analytics 4 — aggregated usage, set only after consent.

## Marketing cookies
Meta Pixel, Google Ads and Pinterest tags — set only after consent, used to measure campaigns.

## Advertising
Google AdSense may serve ads on free-plan pages. Paid plans are ad-free.

## Managing cookies
Use the cookie banner or your browser settings. Blocking essential cookies will sign you out.'),
  ('refund-policy','Refund Policy','legal','published',true,4,
   'Refund Policy — FairCouples',
   'Our 14-day money-back guarantee and how to request a refund.',
   '## 14-day guarantee
If FairCouples is not right for you, email billing@faircouples.com within 14 days of your first payment for a full refund.

## Renewals
Renewal charges are refundable within 7 days if the plan was unused in that period.

## Lifetime plans
Refundable within 14 days of purchase.

## Processing
Refunds return to the original payment method within 5–10 business days. PayPal refunds may take longer.'),
  ('gdpr','GDPR & Data Requests','legal','published',true,5,
   'GDPR Compliance — FairCouples',
   'How to exercise your GDPR and UK GDPR rights with FairCouples.',
   '## Your rights
Access, rectification, erasure, restriction, portability, objection and withdrawal of consent.

## Export your data
Settings → Privacy → Export gives you a machine-readable archive of everything you have entered.

## Delete your account
Settings → Privacy → Delete account. Shared entries are anonymised; your private entries are erased. Financial records required by law are retained.

## Data Protection Officer
dpo@faircouples.com'),
  ('acceptable-use','Acceptable Use Policy','legal','published',true,6,
   'Acceptable Use Policy — FairCouples',
   'What is and is not allowed on FairCouples.',
   '## Not allowed
Harassment or abuse of a partner through the platform, uploading illegal content, impersonation, sharing another person''s private data, automated scraping, security testing without written permission, or reselling access.

## Enforcement
We investigate reports and may warn, suspend or terminate accounts. Serious cases are reported to the relevant authorities.

## Reporting
abuse@faircouples.com'),
  ('disclaimer','Disclaimer','legal','published',true,7,
   'Disclaimer — FairCouples',
   'FairCouples provides measurement and education, not therapy or professional advice.',
   'FairCouples scores are generated from self-reported answers. They describe patterns; they do not diagnose relationships or predict outcomes. Nothing on this site is therapy, medical, legal or financial advice.

If you are experiencing abuse, contact your local emergency number or a domestic abuse helpline immediately.'),
  ('about','About FairCouples','marketing','published',true,8,
   'About FairCouples — Why fairness beats guesswork',
   'FairCouples was built on one idea: relationships fail on imbalance long before they fail on love. Here is how we measure it.',
   '## Why we built this
Most couples argue about the same thing in different words: **effort that stopped being equal**. One person plans, remembers, apologises and pays more often than the other — and nobody notices until resentment has already set in.

FairCouples turns that invisible imbalance into something both people can see. Each partner answers for themselves, privately. The platform compares the two sides and shows where effort, respect and loyalty are drifting apart.

## The fairness formula
> Effort (Partner A) ≈ Effort (Partner B)
> Respect (A) = Respect (B)
> Loyalty (A) = Loyalty (B)

A perfect 50/50 does not exist on any given day. Some days one gives 70% and the other 30%. Over weeks, it should average out. If one person is *always* giving more, that is the signal we surface.

## Not just for couples
Any two-person relationship works: partners, spouses, a mother and son, siblings, close friends. Both people enter their own view, even from opposite sides of the world, and both see the same report.

## Love or attraction?
Our assessment separates the two: attraction is intensity, love is consistency. The report tells you which one your data actually describes.')
on conflict (slug) do update set
  title = excluded.title, content = excluded.content,
  meta_title = excluded.meta_title, meta_description = excluded.meta_description;

-- ---------------------------------------------------------------------------
-- 10. BLOG
-- ---------------------------------------------------------------------------
insert into public.blog_categories (slug, name, description, sort_order) values
  ('relationships','Relationships','Fairness, effort and the mechanics of staying together.',1),
  ('emotions','Emotions','Naming, tracking and communicating what you feel.',2),
  ('money','Money & Fairness','Splitting expenses without splitting up.',3),
  ('travel','Couples Travel','Honeymoons, itineraries and packing that does not start a fight.',4),
  ('guides','Guides','Step-by-step playbooks for couples.',5)
on conflict (slug) do update set name = excluded.name, description = excluded.description;

insert into public.blog_posts (slug, title, excerpt, category_id, author_name, status, is_featured, reading_minutes, tags, keywords, meta_title, meta_description, published_at, content)
select v.slug, v.title, v.excerpt, c.id, 'FairCouples Team', 'published', v.featured, v.minutes,
       v.tags::text[], v.keywords::text[], v.meta_title, v.meta_desc, now() - (v.age || ' days')::interval, v.content
from (values
  ('is-it-love-or-attraction','Love or Attraction? The 9 Signals That Tell You Apart',
   'Attraction is intensity. Love is consistency. Here is how to tell which one you are actually in — using evidence, not feelings.',
   'relationships',true,9,'{love,attraction,compatibility}','{love vs attraction,is it love or just attraction,signs of real love,attraction vs love test}',
   'Love or Attraction? 9 Signals That Tell Them Apart (2026 Guide)',
   'Attraction is intensity; love is consistency. Nine evidence-based signals — plus a free test — to tell whether your relationship is love or just chemistry.',
   2,
'Attraction arrives instantly and asks nothing of you. Love arrives slowly and asks for everything. Most people cannot tell them apart in the first year, because the early symptoms are identical: obsession, energy, the phone in your hand at 2am.

Here is the practical difference. **Attraction is measured in peaks. Love is measured in averages.**

## 1. What happens when it is boring
Attraction needs stimulation — new places, new tension, the chase. Love survives a Tuesday with nothing planned.

## 2. Who you are when they are inconvenient
Attraction disappears the week your partner is ill, stressed or unattractive. Love shows up anyway, without an audience.

## 3. Whether effort is mutual
Attraction happily runs one-sided for months. Love notices imbalance and corrects it. This is the single most predictive signal, and the reason FairCouples measures effort on both sides separately.

## 4. How conflict ends
Attraction ends conflict by winning or by silence. Love ends conflict by repairing.

## 5. Whether you can be unimpressive
If you cannot be tired, wrong or plain in front of them, it is performance — not intimacy.

## 6. The future test
Attraction avoids concrete plans. Love makes them: dates, money, cities, timelines.

## 7. Jealousy vs security
Attraction guards. Love trusts and verifies through consistency, not surveillance.

## 8. What they do with your bad news
Attraction changes the subject. Love asks a second question.

## 9. The 12-week average
Track how you both actually behaved for twelve weeks. Attraction shows spikes and collapses. Love shows a stable line that recovers fast after dips.

## Measure it instead of guessing
Log your own entries for six weeks. Have your partner do the same, independently. Then compare the two curves. If effort, respect and loyalty are within roughly 15 points of each other and recover after conflict — that is love with structure. If one line is permanently higher, you have found the problem before it found you.'),

  ('fair-relationship-checklist','The Fair Relationship Checklist: 10 Areas Both Partners Must Score',
   'The complete fairness framework — ten areas, thirty behaviours, and the rule that keeps each one honest.',
   'guides',true,12,'{fairness,checklist,framework}','{fair relationship checklist,relationship fairness,equal relationship rules,relationship balance}',
   'The Fair Relationship Checklist — 10 Areas Both Partners Must Score',
   'A complete, printable fairness framework: emotional connection, communication, respect, trust, money, time, conflict, affection, growth and deal breakers.',
   5,
'A healthy relationship is not just love and it is not just attraction. It is **structure + effort + respect + consistency**. Here is the structure, in ten areas. Score each one honestly — and have your partner score it separately, without seeing your answers first.

## 1. 🤝 Emotional Connection
Listen without interrupting. Validate feelings instead of dismissing them. Share real thoughts. Stay emotionally available.
**Fair rule:** no one should always be the "strong one" — both get to be vulnerable.

## 2. 💬 Communication System
Daily check-ins. One deeper conversation a week. No silent treatment. No shouting.
**Fair rule:** if one raises a concern, the other must take it seriously — not ignore or delay.

## 3. ❤️ Respect & Boundaries
Personal space, friends and hobbies respected. No phone checking, no restrictions. Privacy is mutual.
**Fair rule:** freedom should be equal — not one controlling the other.

## 4. 🧠 Trust & Loyalty
No cheating, physical or emotional. Transparency about what matters. Consistency between words and actions.
**Fair rule:** trust is built by both — broken by one, but it affects both.

## 5. 💸 Financial Fairness
Split expenses equally, or balance them by income. No financial pressure on one side. Gifts are mutual, not expected in one direction.
**Fair rule:** effort matters more than money — both contribute fairly.

## 6. 👫 Time & Attention
Quality time, not just texting. Prioritise each other without losing individuality.
**Fair rule:** no one should feel ignored or like an option.

## 7. ⚖️ Conflict Management
No blaming, no "you always" or "you never". Solve, do not win. Take a break when emotions are high.
**Fair rule:** problem vs partner — fight the issue, not each other.

## 8. 💕 Affection & Care
Compliments and appreciation out loud. Physical affection at a comfortable level for both. Support in hard times.
**Fair rule:** love should be shown, not assumed.

## 9. 🎯 Growth & Future Alignment
Career, marriage and lifestyle goals discussed openly. Ambitions actively supported.
**Fair rule:** do not hold each other back — grow together, or separate clearly.

## 10. 🚫 Deal Breakers
No abuse of any kind. No manipulation or gaslighting. No repeated dishonesty.
**Fair rule:** standards apply equally — no double standards.

## The reality check
A perfect 50/50 does not exist daily. Some days one gives 70% and the other 30% — over time it should average out. If one person is *always* giving more, it stops being a relationship and becomes a service.'),

  ('splitting-money-fairly','Splitting Money Fairly When You Earn Different Amounts',
   'Equal is not always fair. The proportional split, the three-account system, and how to run a money talk that does not become an argument.',
   'money',false,8,'{budget,money,fairness}','{splitting bills by income,couples budget split,proportional expense split,fair money split couples}',
   'Splitting Money Fairly When You Earn Different Amounts (Calculator Inside)',
   'Equal splits punish the lower earner. Learn the proportional method, the three-account system and a monthly money-talk script that prevents resentment.',
   9,
'Two people earning £2,000 and £5,000 a month splitting rent 50/50 are not splitting fairly — they are splitting identically, which is a different thing.

## The proportional method
Add both incomes. Work out each person''s share of the total. Apply that percentage to shared costs.

- Partner A: £2,000 → 28.6%
- Partner B: £5,000 → 71.4%
- Rent £1,400 → A pays £400, B pays £1,000

Both are left with the same *proportion* of free income, which is what fairness actually means.

## The three-account system
1. **Joint account** — rent, bills, food, shared travel. Both pay in by percentage.
2. **Personal accounts** — whatever is left is yours, unquestioned.
3. **Shared savings** — trips and goals, also by percentage.

No permission-asking, no scorekeeping, no resentment.

## Gifts are not expenses
Gift expectations should be mutual and roughly symmetrical in *effort*, not in price. A £30 gift from the lower earner is worth more than a £150 gift from the higher earner.

## The monthly money talk
Twenty minutes, same day each month:
1. Review last month''s shared spending together.
2. Settle who owes whom.
3. Check the split still matches current incomes.
4. Each person names one financial pressure honestly.
5. Agree next month''s number.

Track it, do not remember it. Memory is biased toward the person doing the remembering.'),

  ('honeymoon-destinations-2026','25 Best Honeymoon Destinations for 2026, Ranked by Season and Budget',
   'Where to go, when to go and what a week actually costs — from £900 in Portugal to £6,000 in the Maldives.',
   'travel',true,14,'{honeymoon,destinations,travel}','{best honeymoon destinations 2026,honeymoon ideas,cheap honeymoon destinations,europe honeymoon}',
   '25 Best Honeymoon Destinations 2026 — Ranked by Season & Budget',
   'The 25 best honeymoon destinations for 2026 with real daily costs, best months to travel and a ready-made itinerary for each.',
   14,
'The best honeymoon is the one that matches your season, your budget and your energy level — in that order.

## Luxury island (Nov–Apr)
**Maldives** — overwater villas, house reefs, total privacy. ~$430/day.
**Mauritius** — lagoons plus hiking, better value than the Maldives. ~$215/day.
**Bora Bora** — the benchmark, if the budget allows.

## Europe in shoulder season (May–Jun, Sep–Oct)
**Santorini** — caldera sunsets and infinity pools. ~$215/day.
**Amalfi Coast** — cliffside villages, boat days to Capri. ~$210/day.
**Lake Como** — villas and ferries under the Alps. ~$205/day.
**Paris** — still the best three days in Europe. ~$195/day.
**Lake Bled** — an island church in an alpine lake, half the price. ~$125/day.
**Algarve, Portugal** — cliffs and caves from ~$120/day.
**Prague & Budapest** — the best-value romantic weekends on the continent, under $115/day.

## Adventure honeymoons
**Iceland** — waterfalls, ice lagoons, aurora. ~$245/day.
**Norwegian fjords** — Flåm railway, Nærøyfjord. ~$235/day.
**Banff & Lake Louise** — turquoise glacier lakes. ~$195/day.
**Queenstown, New Zealand** — adventure plus vineyards. ~$195/day.
**Scottish Highlands** — castles and single-track roads. ~$165/day.

## Winter and aurora (Dec–Mar)
**Finnish Lapland** — glass igloos and husky safaris. ~$225/day.
**Tromsø, Norway** — the most reliable aurora latitude. ~$230/day.
**Quebec City** — a walled French old town in snow. ~$165/day.

## Long-haul value (Nov–Mar)
**Bali** — rice terraces, cliff temples, private-pool villas from ~$85/day.
**Phuket & Phi Phi** — limestone islands from ~$95/day.
**Riviera Maya** — cenotes, ruins and Caribbean water from ~$150/day.

## Classic USA
**Maui** — Road to Hana and volcano sunrises. ~$320/day.
**California Coast** — Highway 1, Big Sur, Napa. ~$250/day.
**Charleston** — the most romantic small city in America. ~$195/day.

## Culture-first
**Kyoto** — ryokan evenings and temples at dawn. ~$175/day.
**Cape Town & the Winelands** — safari, wine and coast in one trip. ~$125/day.

## Then build the itinerary
Pick the destination, set the dates, and let the itinerary generator lay out each day around your pace. Upload the flight and hotel confirmations to the vault so both of you have them offline — and split the cost fairly in the shared budget.'),

  ('travel-packing-checklist-couples','The Complete Couples Travel Checklist (Documents, Gear, Every Climate)',
   'Eleven checklists covering documents, carry-on, beach, city, winter, hiking, electronics, health and the 72-hour pre-departure admin.',
   'travel',false,11,'{packing,checklist,travel}','{couples packing list,travel checklist,honeymoon packing list,what to pack for europe}',
   'The Complete Couples Travel Checklist 2026 — Every Climate & Trip Type',
   'Eleven ready-to-use packing and travel checklists for couples: documents, carry-on, beach, city, winter aurora, hiking, electronics, health and pre-departure.',
   18,
'Packing arguments are almost never about the packing. They are about one person carrying the mental load of remembering. Assign items to each partner instead — that is what these checklists do.

## Non-negotiable documents
Passports with six months validity, visa or ESTA/ETA, printed **and** digital tickets, hotel confirmations, insurance policy, two cards on different networks, and copies of all of it stored in a shared vault you can reach without signal.

## Carry-on
Passports, phone and cable, power bank under 100Wh, medication in original packaging, one change of clothes, toothbrush, neck pillow, empty water bottle, and a pen for landing cards.

## Beach and tropical
Three swimwear sets each, reef-safe SPF 50, after-sun, wide-brim hat, cover-ups, water shoes, dry bag, waterproof phone case, DEET 30%+ repellent, two smart dinner outfits, rehydration sachets.

## Europe city break
Broken-in walking shoes, layerable jacket, compact umbrella, one smart outfit each, EU/UK adapter, anti-theft crossbody bag, blister plasters, a scarf for churches, offline maps downloaded.

## Winter and aurora
Thermal base layers, insulated waterproof parka, snow trousers, insulated boots, wool socks, liner + outer gloves, hand warmers, ice grips, tripod, **spare camera batteries** (cold kills them), thermos.

## Hiking
Boots, 25–35L daypack, shell jacket, poles, 2L water, head torch, first aid and blister kit, offline trail maps, emergency bivvy, whistle.

## 72 hours before
Check in online, pick seats together, save boarding passes offline, book the airport transfer, notify your bank, activate roaming or eSIM, sort the house, send your itinerary to someone at home, weigh the bags.

Assign every line to one partner. The person who packs the chargers is not automatically the person who packs the passports.'),

  ('weekly-relationship-check-in','The 20-Minute Weekly Check-In That Prevents 80% of Arguments',
   'A structured script both partners can follow — including what to do when one of you does not want to talk.',
   'guides',false,7,'{communication,ritual,checkin}','{weekly relationship check in,couples communication exercise,relationship check in questions}',
   'The 20-Minute Weekly Relationship Check-In (Script Included)',
   'A proven 20-minute weekly check-in script for couples: appreciation, one concern each, fairness review and a concrete action for the week.',
   22,
'Most couples do not need more communication. They need *scheduled* communication, so problems are raised at 8pm on Sunday instead of 1am mid-argument.

## The script
**Minutes 0–3 — Appreciation.** Each person names one specific thing the other did this week. Specific. "You handled the call with my mother" beats "you were nice".

**Minutes 3–8 — One concern each.** One only. No absolutes, no "you always". Format: *"When X happened, I felt Y, and what I need is Z."*

**Minutes 8–12 — Repeat it back.** Each person summarises what the other said before responding. If the summary is wrong, the other tries again.

**Minutes 12–16 — Fairness review.** Open the balance index. Who carried more this week? Was that fair given circumstances, or is it becoming a pattern?

**Minutes 16–20 — One action each, plus the calendar.** One concrete change each, and the next date night booked in the calendar before you stand up.

## When one partner refuses
Do not chase. Say: "I''m doing mine at 8pm Sunday. It''s open if you want it." Then log your own entry anyway. A one-sided record is still evidence — and after four weeks, the pattern is no longer deniable by either of you.

## Why the timer matters
Twenty minutes is short enough that neither of you dreads it, and long enough to reach the real thing. Long enough to fix; short enough to repeat every week for a decade.')
) as v(slug, title, excerpt, cat, featured, minutes, tags, keywords, meta_title, meta_desc, age, content)
join public.blog_categories c on c.slug = v.cat
on conflict (slug) do update set
  title = excluded.title, excerpt = excluded.excerpt, content = excluded.content,
  meta_title = excluded.meta_title, meta_description = excluded.meta_description;

-- ---------------------------------------------------------------------------
-- 11. FAQ & TESTIMONIALS
-- ---------------------------------------------------------------------------
insert into public.faqs (question, answer, category, page_path, sort_order) values
  ('What exactly does FairCouples measure?','Ten areas of a relationship — emotional connection, communication, respect and boundaries, trust and loyalty, financial fairness, time and attention, conflict management, affection and care, growth and future alignment, and deal breakers. Each partner scores themselves and their partner separately, and the platform compares the two.','product','/',1),
  ('Do both partners need their own account?','Yes, and that is the point. Each person logs their own entries privately, from anywhere in the world. The reports combine both sides — one person cannot fill in the relationship for two.','product','/',2),
  ('Can my partner see everything I write?','No. Any entry marked private stays visible only to you, while still counting in your own trend data. Everything else in a shared space is visible to both of you by design.','privacy','/',3),
  ('Does one subscription cover both partners?','Yes. When one partner subscribes, both members of the space get the full plan features. You never pay twice.','billing','/pricing',4),
  ('Which currencies can I pay in?','US dollars, British pounds, euros, Canadian dollars and Australian dollars. You choose your currency at signup and prices are shown in it everywhere.','billing','/pricing',5),
  ('What payment methods do you accept?','All major cards, Apple Pay and Google Pay through Stripe, plus PayPal. Payment details never touch our servers.','billing','/pricing',6),
  ('Is there a free plan?','Yes. The Starter plan is free forever and includes daily emotion check-ins, weekly fairness scoring, one relationship space and a shared checklist.','billing','/pricing',7),
  ('Can I cancel any time?','Yes, from Settings → Billing. You keep access until the end of your paid period, and there is a 14-day money-back guarantee on first purchases.','billing','/pricing',8),
  ('Does this work for relationships that are not romantic?','Yes. A space works for any two people — partners, spouses, a mother and son, siblings or close friends. The fairness framework applies to any relationship where effort should be balanced.','product','/',9),
  ('Can we use it long-distance?','That is the most common use. Both partners log entries independently from different countries and time zones; both see the same report.','product','/',10),
  ('Is my data secure?','Every couple''s data is isolated at the database level with row-level security. Data is encrypted in transit and at rest, and admin access is fully audited.','privacy','/',11),
  ('Is this therapy?','No. FairCouples is a measurement and planning tool, not therapy or counselling. It helps you see patterns clearly — what you do with them is your decision.','product','/',12),
  ('What happens if we break up?','You can remove your partner from the space at any time; their access ends immediately. You can also export or permanently delete your data from Settings → Privacy.','privacy','/',13),
  ('How does the travel planner work?','Pick a destination from our guides, set your dates and pace, and the itinerary generator lays out each day. Upload flight, hotel and attraction tickets to the vault so both of you have them offline, and split the costs fairly in the shared budget.','travel','/features',14)
on conflict do nothing;

insert into public.testimonials (author_name, author_role, author_location, quote, rating, is_featured, sort_order) values
  ('Sarah & James','Married 6 years','Manchester, UK','We stopped arguing about who does more and started looking at the chart instead. Turns out we were both right about different weeks.',5,true,1),
  ('Michael & Ana','Long-distance','Toronto → Lisbon','Two countries, six hours apart. The weekly report is the only place we both see the same version of our relationship.',5,true,2),
  ('Priya & Dev','Engaged','Austin, USA','The money split feature ended a two-year argument in one evening. Proportional, not equal — that was the whole fix.',5,true,3),
  ('Elena & Marco','Together 3 years','Milan, Italy','The Love vs Attraction assessment was uncomfortable and completely accurate. We needed that.',5,true,4),
  ('Hannah & Tom','Honeymoon planning','Sydney, Australia','Planned a 14-day Italy honeymoon in one sitting, with every booking in one place and the costs split fairly.',5,true,5),
  ('Grace & her mother Ruth','Family space','Vancouver, Canada','We use it as mother and daughter. Being able to write our own entries separately and then read each other''s changed how we talk.',5,true,6)
on conflict do nothing;

-- ---------------------------------------------------------------------------
-- 12. SEO metadata for key routes
-- ---------------------------------------------------------------------------
insert into public.seo_meta (path, title, description, keywords, priority, changefreq) values
  ('/','FairCouples — Relationship Fairness, Emotions, Budget & Travel Planner for Couples',
   'Measure fairness in your relationship. Both partners log emotions and effort separately, then see one shared report — plus fair budgeting, gift planning and full honeymoon travel planning.',
   '{relationship app for couples,fairness in relationships,couples emotion tracker,couples budget app,honeymoon planner}',1.0,'daily'),
  ('/pricing','Pricing — FairCouples Plans in USD, GBP, EUR, CAD & AUD',
   'Simple pricing for couples. One subscription covers both partners. Free forever plan, 14-day trial on paid plans, cancel any time.',
   '{couples app pricing,relationship app subscription,faircouples pricing}',0.9,'weekly'),
  ('/features','Features — Fairness Scoring, Emotions, Messaging, Budgets & Travel',
   'Every FairCouples feature: the 10-area fairness framework, emotion tracking for both partners, private messaging, fair expense splitting, gift planner, ticket vault and itinerary generator.',
   '{couples app features,relationship tracker,fair expense split,couples itinerary generator}',0.9,'weekly'),
  ('/destinations','Honeymoon & Couples Travel Destinations — Costs, Seasons and Itineraries',
   'Browse honeymoon and couples destinations across Europe, the USA, Canada, Australia and beyond, with daily costs, best months and ready-made itineraries.',
   '{honeymoon destinations,couples travel guide,best places for couples,europe honeymoon}',0.9,'weekly'),
  ('/fairness','The Fairness Framework — 10 Areas Every Relationship Is Measured On',
   'The complete fairness framework used by FairCouples: ten areas, thirty behaviours and the fair rule that keeps each one honest.',
   '{relationship fairness,fair relationship checklist,equal relationship}',0.8,'monthly'),
  ('/love-or-attraction','Love or Attraction Test — Free Assessment for Couples',
   'Take the free Love vs Attraction assessment. Answer independently from your partner and see whether your relationship is built on consistency or intensity.',
   '{love vs attraction test,is it love or attraction,relationship test free}',0.8,'monthly'),
  ('/blog','FairCouples Blog — Fairness, Emotions, Money and Couples Travel',
   'Guides on relationship fairness, emotional communication, splitting money without resentment and planning trips as a couple.',
   '{relationship blog,couples advice,fair relationship guides}',0.7,'daily')
on conflict (path) do update set title = excluded.title, description = excluded.description, keywords = excluded.keywords;

insert into public.feature_flags (key, name, description, is_enabled) values
  ('itinerary_generator','Itinerary generator','Day-by-day itinerary builder from destination attractions.',true),
  ('love_assessment','Love vs Attraction assessment','Free public assessment plus in-app version.',true),
  ('referrals','Referral programme','Give a month, get a month.',false),
  ('ai_insights','AI insights','Narrative summaries on fairness reports.',false),
  ('public_blog','Public blog','Marketing blog on the public site.',true)
on conflict (key) do update set name = excluded.name, description = excluded.description;

commit;
