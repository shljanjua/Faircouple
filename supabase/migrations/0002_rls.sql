-- ============================================================================
-- FairCouples — 0002_rls.sql
-- Row Level Security. Every table is locked by default; access is granted by
-- (a) ownership, (b) couple membership, (c) platform admin role.
-- ============================================================================

-- Enable RLS everywhere ------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'profiles','couples','couple_members','couple_invitations',
    'plans','plan_prices','subscriptions','payments','coupons','webhook_events','usage_counters',
    'fairness_categories','fairness_criteria','fairness_entries','fairness_criteria_responses','fairness_reports',
    'emotion_types','emotion_logs','daily_checkins','assessments','compatibility_scores',
    'cycle_stages','couple_cycle_progress',
    'checklist_templates','checklists','checklist_items',
    'conversations','messages',
    'media_assets','travel_documents',
    'incomes','budgets','budget_categories','expenses','expense_shares','settlements','gifts','wishlist_items',
    'countries','destinations','attractions','trips','itineraries','itinerary_days','itinerary_items',
    'packing_lists','packing_items',
    'blog_categories','blog_posts','pages','seo_meta','redirects','faqs','testimonials',
    'site_settings','payment_gateways','email_templates','email_logs','notifications','audit_logs',
    'contact_messages','newsletter_subscribers','feature_flags','exchange_rates'
  ]
  loop
    execute format('alter table public.%I enable row level security;', t);
  end loop;
end $$;

-- Helper to drop a policy if it exists (keeps this file idempotent)
create or replace function public._drop_policy(p_name text, p_table text)
returns void language plpgsql as $$
begin
  execute format('drop policy if exists %I on public.%I;', p_name, p_table);
end $$;

-- ---------------------------------------------------------------------------
-- PROFILES
-- ---------------------------------------------------------------------------
select public._drop_policy('profiles_select_own', 'profiles');
create policy profiles_select_own on public.profiles
  for select using (
    id = auth.uid()
    or public.is_platform_admin()
    or exists (
      select 1 from public.couple_members m1
      join public.couple_members m2 on m1.couple_id = m2.couple_id
      where m1.user_id = auth.uid() and m2.user_id = public.profiles.id
        and m1.removed_at is null and m2.removed_at is null
    )
  );

select public._drop_policy('profiles_update_own', 'profiles');
create policy profiles_update_own on public.profiles
  for update using (id = auth.uid() or public.is_platform_admin())
  with check (id = auth.uid() or public.is_platform_admin());

select public._drop_policy('profiles_insert_self', 'profiles');
create policy profiles_insert_self on public.profiles
  for insert with check (id = auth.uid() or public.is_platform_admin());

select public._drop_policy('profiles_delete_admin', 'profiles');
create policy profiles_delete_admin on public.profiles
  for delete using (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- COUPLES & MEMBERSHIP
-- ---------------------------------------------------------------------------
select public._drop_policy('couples_select', 'couples');
create policy couples_select on public.couples
  for select using (public.is_couple_member(id) or owner_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('couples_insert', 'couples');
create policy couples_insert on public.couples
  for insert with check (owner_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('couples_update', 'couples');
create policy couples_update on public.couples
  for update using (public.is_couple_member(id) or public.is_platform_admin())
  with check (public.is_couple_member(id) or public.is_platform_admin());

select public._drop_policy('couples_delete', 'couples');
create policy couples_delete on public.couples
  for delete using (owner_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('couple_members_select', 'couple_members');
create policy couple_members_select on public.couple_members
  for select using (user_id = auth.uid() or public.is_couple_member(couple_id) or public.is_platform_admin());

select public._drop_policy('couple_members_insert', 'couple_members');
create policy couple_members_insert on public.couple_members
  for insert with check (
    user_id = auth.uid()
    or exists (select 1 from public.couples c where c.id = couple_id and c.owner_id = auth.uid())
    or public.is_platform_admin()
  );

select public._drop_policy('couple_members_update', 'couple_members');
create policy couple_members_update on public.couple_members
  for update using (
    user_id = auth.uid()
    or exists (select 1 from public.couples c where c.id = couple_id and c.owner_id = auth.uid())
    or public.is_platform_admin()
  );

select public._drop_policy('couple_members_delete', 'couple_members');
create policy couple_members_delete on public.couple_members
  for delete using (
    user_id = auth.uid()
    or exists (select 1 from public.couples c where c.id = couple_id and c.owner_id = auth.uid())
    or public.is_platform_admin()
  );

select public._drop_policy('invitations_select', 'couple_invitations');
create policy invitations_select on public.couple_invitations
  for select using (
    public.is_couple_member(couple_id)
    or lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    or public.is_platform_admin()
  );

select public._drop_policy('invitations_write', 'couple_invitations');
create policy invitations_write on public.couple_invitations
  for all using (public.is_couple_member(couple_id) or public.is_platform_admin())
  with check (public.is_couple_member(couple_id) or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- BILLING
-- ---------------------------------------------------------------------------
select public._drop_policy('plans_public_read', 'plans');
create policy plans_public_read on public.plans for select using (is_active or public.is_platform_admin());

select public._drop_policy('plans_admin_write', 'plans');
create policy plans_admin_write on public.plans for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('plan_prices_public_read', 'plan_prices');
create policy plan_prices_public_read on public.plan_prices for select using (is_active or public.is_platform_admin());

select public._drop_policy('plan_prices_admin_write', 'plan_prices');
create policy plan_prices_admin_write on public.plan_prices for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('subscriptions_select', 'subscriptions');
create policy subscriptions_select on public.subscriptions
  for select using (
    user_id = auth.uid()
    or (couple_id is not null and public.is_couple_member(couple_id))
    or public.is_platform_admin()
  );

select public._drop_policy('subscriptions_admin_write', 'subscriptions');
create policy subscriptions_admin_write on public.subscriptions for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('payments_select', 'payments');
create policy payments_select on public.payments
  for select using (user_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('payments_admin_write', 'payments');
create policy payments_admin_write on public.payments for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('coupons_admin', 'coupons');
create policy coupons_admin on public.coupons for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('coupons_read_active', 'coupons');
create policy coupons_read_active on public.coupons for select
  using (is_active and (expires_at is null or expires_at > now()));

select public._drop_policy('webhook_admin', 'webhook_events');
create policy webhook_admin on public.webhook_events for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('usage_select', 'usage_counters');
create policy usage_select on public.usage_counters
  for select using (user_id = auth.uid() or (couple_id is not null and public.is_couple_member(couple_id)) or public.is_platform_admin());

select public._drop_policy('usage_write', 'usage_counters');
create policy usage_write on public.usage_counters
  for all using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- REFERENCE CONTENT readable by everyone, writable by admins
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fairness_categories','fairness_criteria','emotion_types','cycle_stages',
    'checklist_templates','countries','destinations','attractions',
    'blog_categories','faqs','testimonials','feature_flags','exchange_rates','redirects','seo_meta'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_public_read', t);
    execute format('create policy %I on public.%I for select using (true);', t || '_public_read', t);
    execute format('drop policy if exists %I on public.%I;', t || '_admin_write', t);
    execute format(
      'create policy %I on public.%I for all using (public.is_platform_admin()) with check (public.is_platform_admin());',
      t || '_admin_write', t);
  end loop;
end $$;

-- Blog & pages: public sees published only
select public._drop_policy('blog_posts_public_read', 'blog_posts');
create policy blog_posts_public_read on public.blog_posts
  for select using (status = 'published' or public.is_platform_admin());

select public._drop_policy('blog_posts_admin_write', 'blog_posts');
create policy blog_posts_admin_write on public.blog_posts for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('pages_public_read', 'pages');
create policy pages_public_read on public.pages
  for select using (status = 'published' or public.is_platform_admin());

select public._drop_policy('pages_admin_write', 'pages');
create policy pages_admin_write on public.pages for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- ---------------------------------------------------------------------------
-- COUPLE-SCOPED DATA
-- Generic rule: member of the couple can read/write; admin can read/write.
-- Private rows (is_private = true) stay visible only to their author.
-- ---------------------------------------------------------------------------
do $$
declare t text;
begin
  foreach t in array array[
    'fairness_reports','compatibility_scores','couple_cycle_progress',
    'checklists','conversations','media_assets','travel_documents',
    'budgets','expenses','settlements','gifts','wishlist_items',
    'trips','itineraries','packing_lists'
  ]
  loop
    execute format('drop policy if exists %I on public.%I;', t || '_member_all', t);
    execute format(
      'create policy %I on public.%I for all '
      'using (public.is_couple_member(couple_id) or public.is_platform_admin()) '
      'with check (public.is_couple_member(couple_id) or public.is_platform_admin());',
      t || '_member_all', t);
  end loop;
end $$;

-- Entries with privacy flags: partner sees shared rows, author sees everything.
select public._drop_policy('fairness_entries_select', 'fairness_entries');
create policy fairness_entries_select on public.fairness_entries
  for select using (
    user_id = auth.uid()
    or (public.is_couple_member(couple_id) and is_private = false)
    or public.is_platform_admin()
  );

select public._drop_policy('fairness_entries_write', 'fairness_entries');
create policy fairness_entries_write on public.fairness_entries
  for all using (user_id = auth.uid() or public.is_platform_admin())
  with check ((user_id = auth.uid() and public.is_couple_member(couple_id)) or public.is_platform_admin());

select public._drop_policy('fairness_responses_select', 'fairness_criteria_responses');
create policy fairness_responses_select on public.fairness_criteria_responses
  for select using (
    exists (
      select 1 from public.fairness_entries e
      where e.id = entry_id
        and (e.user_id = auth.uid() or (public.is_couple_member(e.couple_id) and e.is_private = false))
    ) or public.is_platform_admin()
  );

select public._drop_policy('fairness_responses_write', 'fairness_criteria_responses');
create policy fairness_responses_write on public.fairness_criteria_responses
  for all using (
    exists (select 1 from public.fairness_entries e where e.id = entry_id and e.user_id = auth.uid())
    or public.is_platform_admin()
  )
  with check (
    exists (select 1 from public.fairness_entries e where e.id = entry_id and e.user_id = auth.uid())
    or public.is_platform_admin()
  );

select public._drop_policy('emotion_logs_select', 'emotion_logs');
create policy emotion_logs_select on public.emotion_logs
  for select using (
    user_id = auth.uid()
    or (couple_id is not null and public.is_couple_member(couple_id) and is_private = false)
    or public.is_platform_admin()
  );

select public._drop_policy('emotion_logs_write', 'emotion_logs');
create policy emotion_logs_write on public.emotion_logs
  for all using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('emotion_logs_ack', 'emotion_logs');
create policy emotion_logs_ack on public.emotion_logs
  for update using (couple_id is not null and public.is_couple_member(couple_id))
  with check (couple_id is not null and public.is_couple_member(couple_id));

select public._drop_policy('daily_checkins_select', 'daily_checkins');
create policy daily_checkins_select on public.daily_checkins
  for select using (public.is_couple_member(couple_id) or public.is_platform_admin());

select public._drop_policy('daily_checkins_write', 'daily_checkins');
create policy daily_checkins_write on public.daily_checkins
  for all using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('assessments_select', 'assessments');
create policy assessments_select on public.assessments
  for select using (
    user_id = auth.uid()
    or (couple_id is not null and public.is_couple_member(couple_id))
    or public.is_platform_admin()
  );

select public._drop_policy('assessments_write', 'assessments');
create policy assessments_write on public.assessments
  for all using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('incomes_select', 'incomes');
create policy incomes_select on public.incomes
  for select using (
    user_id = auth.uid()
    or (public.is_couple_member(couple_id) and is_private = false)
    or public.is_platform_admin()
  );

select public._drop_policy('incomes_write', 'incomes');
create policy incomes_write on public.incomes
  for all using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

-- Child tables scoped through their parent -----------------------------------
select public._drop_policy('checklist_items_all', 'checklist_items');
create policy checklist_items_all on public.checklist_items
  for all using (
    exists (select 1 from public.checklists c where c.id = checklist_id and public.is_couple_member(c.couple_id))
    or public.is_platform_admin()
  )
  with check (
    exists (select 1 from public.checklists c where c.id = checklist_id and public.is_couple_member(c.couple_id))
    or public.is_platform_admin()
  );

select public._drop_policy('budget_categories_all', 'budget_categories');
create policy budget_categories_all on public.budget_categories
  for all using (
    exists (select 1 from public.budgets b where b.id = budget_id and public.is_couple_member(b.couple_id))
    or public.is_platform_admin()
  )
  with check (
    exists (select 1 from public.budgets b where b.id = budget_id and public.is_couple_member(b.couple_id))
    or public.is_platform_admin()
  );

select public._drop_policy('expense_shares_all', 'expense_shares');
create policy expense_shares_all on public.expense_shares
  for all using (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_couple_member(e.couple_id))
    or public.is_platform_admin()
  )
  with check (
    exists (select 1 from public.expenses e where e.id = expense_id and public.is_couple_member(e.couple_id))
    or public.is_platform_admin()
  );

select public._drop_policy('itinerary_days_all', 'itinerary_days');
create policy itinerary_days_all on public.itinerary_days
  for all using (
    exists (select 1 from public.itineraries i where i.id = itinerary_id and public.is_couple_member(i.couple_id))
    or public.is_platform_admin()
  )
  with check (
    exists (select 1 from public.itineraries i where i.id = itinerary_id and public.is_couple_member(i.couple_id))
    or public.is_platform_admin()
  );

select public._drop_policy('itinerary_items_all', 'itinerary_items');
create policy itinerary_items_all on public.itinerary_items
  for all using (
    exists (
      select 1 from public.itinerary_days d
      join public.itineraries i on i.id = d.itinerary_id
      where d.id = day_id and public.is_couple_member(i.couple_id)
    ) or public.is_platform_admin()
  )
  with check (
    exists (
      select 1 from public.itinerary_days d
      join public.itineraries i on i.id = d.itinerary_id
      where d.id = day_id and public.is_couple_member(i.couple_id)
    ) or public.is_platform_admin()
  );

select public._drop_policy('packing_items_all', 'packing_items');
create policy packing_items_all on public.packing_items
  for all using (
    exists (select 1 from public.packing_lists l where l.id = list_id and public.is_couple_member(l.couple_id))
    or public.is_platform_admin()
  )
  with check (
    exists (select 1 from public.packing_lists l where l.id = list_id and public.is_couple_member(l.couple_id))
    or public.is_platform_admin()
  );

-- Messaging -----------------------------------------------------------------
select public._drop_policy('messages_select', 'messages');
create policy messages_select on public.messages
  for select using (public.is_couple_member(couple_id) or public.is_platform_admin());

select public._drop_policy('messages_insert', 'messages');
create policy messages_insert on public.messages
  for insert with check (sender_id = auth.uid() and public.is_couple_member(couple_id));

select public._drop_policy('messages_update', 'messages');
create policy messages_update on public.messages
  for update using (sender_id = auth.uid() or public.is_couple_member(couple_id) or public.is_platform_admin())
  with check (public.is_couple_member(couple_id) or public.is_platform_admin());

select public._drop_policy('messages_delete', 'messages');
create policy messages_delete on public.messages
  for delete using (sender_id = auth.uid() or public.is_platform_admin());

-- Notifications / logs -------------------------------------------------------
select public._drop_policy('notifications_own', 'notifications');
create policy notifications_own on public.notifications
  for all using (user_id = auth.uid() or public.is_platform_admin())
  with check (user_id = auth.uid() or public.is_platform_admin());

select public._drop_policy('audit_admin', 'audit_logs');
create policy audit_admin on public.audit_logs for select using (public.is_platform_admin());

select public._drop_policy('audit_insert', 'audit_logs');
create policy audit_insert on public.audit_logs for insert with check (true);

select public._drop_policy('email_logs_admin', 'email_logs');
create policy email_logs_admin on public.email_logs for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('email_templates_admin', 'email_templates');
create policy email_templates_admin on public.email_templates for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Settings -------------------------------------------------------------------
select public._drop_policy('settings_public_read', 'site_settings');
create policy settings_public_read on public.site_settings
  for select using ((is_public and not is_secret) or public.is_platform_admin());

select public._drop_policy('settings_admin_write', 'site_settings');
create policy settings_admin_write on public.site_settings for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('gateways_admin', 'payment_gateways');
create policy gateways_admin on public.payment_gateways for all
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Public forms ---------------------------------------------------------------
select public._drop_policy('contact_insert', 'contact_messages');
create policy contact_insert on public.contact_messages for insert with check (true);

select public._drop_policy('contact_admin', 'contact_messages');
create policy contact_admin on public.contact_messages for select using (public.is_platform_admin());

select public._drop_policy('contact_admin_write', 'contact_messages');
create policy contact_admin_write on public.contact_messages for update
  using (public.is_platform_admin()) with check (public.is_platform_admin());

select public._drop_policy('newsletter_insert', 'newsletter_subscribers');
create policy newsletter_insert on public.newsletter_subscribers for insert with check (true);

select public._drop_policy('newsletter_admin', 'newsletter_subscribers');
create policy newsletter_admin on public.newsletter_subscribers for select using (public.is_platform_admin());

select public._drop_policy('newsletter_admin_write', 'newsletter_subscribers');
create policy newsletter_admin_write on public.newsletter_subscribers for update
  using (public.is_platform_admin()) with check (public.is_platform_admin());

-- Grants ---------------------------------------------------------------------
grant usage on schema public to anon, authenticated;
grant select on public.public_settings to anon, authenticated;
grant execute on function public.create_couple(text, text, text) to authenticated;
grant execute on function public.accept_invitation(text) to authenticated;
grant execute on function public.bump_usage(uuid, text, integer) to authenticated;
grant execute on function public.compute_fairness(uuid, date) to authenticated;
grant execute on function public.active_subscription(uuid) to authenticated;
grant execute on function public.is_couple_member(uuid, uuid) to authenticated;
grant execute on function public.partner_id(uuid, uuid) to authenticated;
grant execute on function public.my_couple_ids(uuid) to authenticated;

-- Realtime publication for live chat / presence
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    execute 'alter publication supabase_realtime add table public.messages';
    execute 'alter publication supabase_realtime add table public.notifications';
    execute 'alter publication supabase_realtime add table public.emotion_logs';
  end if;
exception when duplicate_object then
  null;
end $$;

drop function if exists public._drop_policy(text, text);

commit;
