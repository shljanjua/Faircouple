<?php
declare(strict_types=1);

/** A CMS page written in Admin -> Pages (privacy policy, terms, about, …). */

$page = Db::one('SELECT * FROM pages WHERE slug = ? AND status = "published" LIMIT 1', [$params['slug']]);

if (!$page) {
    Response::notFound();
}

Seo::breadcrumbs([
    ['name' => 'Home', 'url' => '/'],
    ['name' => $page['title'], 'url' => '/' . $page['slug']],
]);

View::begin('layouts/public', [
    'title'       => $page['meta_title'] ?: $page['title'],
    'description' => $page['meta_description'] ?: Str::excerpt($page['content'], 155),
    'keywords'    => Str::json($page['keywords']),
    'canonical'   => $page['canonical_url'] ?: null,
    'no_index'    => Str::bool($page['no_index']),
    'modified'    => $page['updated_at'],
]);
?>

<section class="section-tight">
  <div class="container container-narrow">
    <h1><?= Str::e($page['title']) ?></h1>
    <p class="small muted mt-2">Last updated <?= Str::e(Str::date($page['updated_at'])) ?></p>

    <div class="prose mt-4"><?= Str::markdown($page['content']) ?></div>

    <hr class="divider">

    <p class="small muted">
      Questions about this page? Email
      <a href="mailto:<?= Str::e(Settings::text('support_email')) ?>"><?= Str::e(Settings::text('support_email')) ?></a>.
    </p>
  </div>
</section>

<?php View::end(); ?>
