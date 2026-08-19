<?php
/**
 * Marketing and analytics tags. Every id is entered in Admin -> Settings, and
 * a tag only renders when its id has actually been filled in.
 *
 * Consent: when the cookie banner is switched on, nothing that profiles a
 * visitor runs until they accept. Google tags use Consent Mode v2 — they load
 * with every storage type denied and are updated on acceptance. The other
 * pixels are not loaded at all until then: their init is queued through
 * `fcOnConsent()` in assets/js/app.js, which fires on acceptance and on later
 * page loads once the choice is remembered.
 */

$ga4        = Settings::text('analytics_ga4_id');
$gtm        = Settings::text('analytics_gtm_id');
$metaPixel  = Settings::text('analytics_meta_pixel_id');
$googleAds  = Settings::text('analytics_google_ads_id');
$adsense    = Settings::text('analytics_adsense_client');
$clarity    = Settings::text('analytics_clarity_id');
$hotjar     = Settings::text('analytics_hotjar_id');
$tiktok     = Settings::text('analytics_tiktok_pixel_id');
$pinterest  = Settings::text('analytics_pinterest_tag_id');
$linkedin   = Settings::text('analytics_linkedin_partner_id');

// Nothing is loaded for signed-in members inside the app, to keep the private
// areas free of third-party scripts.
$isPrivate = str_starts_with(Request::path(), '/dashboard') || str_starts_with(Request::path(), '/admin');
if ($isPrivate) {
    return;
}

// With the banner off there is nothing to wait for, so tags fire immediately.
$needsConsent = Settings::bool('cookie_banner_enabled', true);
?>
<script>
  /* Consent plumbing. Defined before any tag so every tag can rely on it. */
  window.fcConsentRequired = <?= $needsConsent ? 'true' : 'false' ?>;
  window.fcConsentQueue = window.fcConsentQueue || [];
  window.fcConsentGranted = !window.fcConsentRequired;

  try {
    if (window.localStorage.getItem('fc-consent') === 'granted') {
      window.fcConsentGranted = true;
    }
  } catch (e) { /* private browsing — treat as not granted */ }

  window.fcOnConsent = function (fn) {
    if (window.fcConsentGranted) { fn(); return; }
    window.fcConsentQueue.push(fn);
  };

  window.dataLayer = window.dataLayer || [];
  function gtag(){ dataLayer.push(arguments); }

<?php if ($needsConsent): ?>
  /* Consent Mode v2: deny everything up front, then update on acceptance. */
  gtag('consent', 'default', {
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied',
    analytics_storage: 'denied',
    functionality_storage: 'granted',
    security_storage: 'granted',
    wait_for_update: 500
  });
  if (window.fcConsentGranted) {
    gtag('consent', 'update', {
      ad_storage: 'granted',
      ad_user_data: 'granted',
      ad_personalization: 'granted',
      analytics_storage: 'granted'
    });
  }
<?php endif; ?>
</script>

<?php if ($gtm !== ''): ?>
<script>(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});
var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;
j.src='https://www.googletagmanager.com/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})
(window,document,'script','dataLayer','<?= Str::e($gtm) ?>');</script>
<?php endif; ?>

<?php if ($ga4 !== '' || $googleAds !== ''): ?>
<script async src="https://www.googletagmanager.com/gtag/js?id=<?= Str::e($ga4 !== '' ? $ga4 : $googleAds) ?>"></script>
<script>
  gtag('js', new Date());
  <?php if ($ga4 !== ''): ?>gtag('config', <?= json_encode($ga4) ?>, { anonymize_ip: true });<?php endif; ?>
  <?php if ($googleAds !== ''): ?>gtag('config', <?= json_encode($googleAds) ?>);<?php endif; ?>
</script>
<?php endif; ?>

<?php if ($metaPixel !== ''): ?>
<script>window.fcOnConsent(function(){
!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?
n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;
n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;
t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script',
'https://connect.facebook.net/en_US/fbevents.js');fbq('init','<?= Str::e($metaPixel) ?>');fbq('track','PageView');
});</script>
<?php endif; ?>

<?php if ($adsense !== ''): ?>
<script async src="https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=<?= Str::e($adsense) ?>" crossorigin="anonymous"></script>
<?php endif; ?>

<?php if ($clarity !== ''): ?>
<script>window.fcOnConsent(function(){
(function(c,l,a,r,i,t,y){c[a]=c[a]||function(){(c[a].q=c[a].q||[]).push(arguments)};
t=l.createElement(r);t.async=1;t.src="https://www.clarity.ms/tag/"+i;
y=l.getElementsByTagName(r)[0];y.parentNode.insertBefore(t,y)})(window,document,"clarity","script","<?= Str::e($clarity) ?>");
});</script>
<?php endif; ?>

<?php if ($hotjar !== ''): ?>
<script>window.fcOnConsent(function(){
(function(h,o,t,j,a,r){h.hj=h.hj||function(){(h.hj.q=h.hj.q||[]).push(arguments)};
h._hjSettings={hjid:<?= (int) $hotjar ?>,hjsv:6};a=o.getElementsByTagName('head')[0];
r=o.createElement('script');r.async=1;r.src=t+h._hjSettings.hjid+j;a.appendChild(r);})
(window,document,'https://static.hotjar.com/c/hotjar-','.js?sv=');
});</script>
<?php endif; ?>

<?php if ($tiktok !== ''): ?>
<script>window.fcOnConsent(function(){
!function(w,d,t){w.TiktokAnalyticsObject=t;var ttq=w[t]=w[t]||[];
ttq.methods=["page","track","identify","instances","debug","on","off","once","ready","alias","group","enableCookie","disableCookie"];
ttq.setAndDefer=function(e,n){e[n]=function(){e.push([n].concat(Array.prototype.slice.call(arguments,0)))}};
for(var i=0;i<ttq.methods.length;i++)ttq.setAndDefer(ttq,ttq.methods[i]);
ttq.load=function(e){var n="https://analytics.tiktok.com/i18n/pixel/events.js";ttq._i=ttq._i||{};
ttq._i[e]=[];ttq._i[e]._u=n;ttq._t=ttq._t||{};ttq._t[e]=+new Date;ttq._o=ttq._o||{};ttq._o[e]={};
var o=d.createElement("script");o.type="text/javascript";o.async=!0;o.src=n+"?sdkid="+e+"&lib="+t;
var a=d.getElementsByTagName("script")[0];a.parentNode.insertBefore(o,a)};
ttq.load('<?= Str::e($tiktok) ?>');ttq.page();}(window,document,'ttq');
});</script>
<?php endif; ?>

<?php if ($pinterest !== ''): ?>
<script>window.fcOnConsent(function(){
!function(e){if(!window.pintrk){window.pintrk=function(){window.pintrk.queue.push(Array.prototype.slice.call(arguments))};
var n=window.pintrk;n.queue=[],n.version="3.0";var t=document.createElement("script");t.async=!0,t.src=e;
var r=document.getElementsByTagName("script")[0];r.parentNode.insertBefore(t,r)}}("https://s.pinimg.com/ct/core.js");
pintrk('load','<?= Str::e($pinterest) ?>');pintrk('page');
});</script>
<?php endif; ?>

<?php if ($linkedin !== ''): ?>
<script>window.fcOnConsent(function(){
_linkedin_partner_id="<?= Str::e($linkedin) ?>";window._linkedin_data_partner_ids=window._linkedin_data_partner_ids||[];
window._linkedin_data_partner_ids.push(_linkedin_partner_id);
(function(l){if(!l){window.lintrk=function(a,b){window.lintrk.q.push([a,b])};window.lintrk.q=[]}
var s=document.getElementsByTagName("script")[0];var b=document.createElement("script");
b.type="text/javascript";b.async=true;b.src="https://snap.licdn.com/li.lms-analytics/insight.min.js";
s.parentNode.insertBefore(b,s);})(window.lintrk);
});</script>
<?php endif; ?>
