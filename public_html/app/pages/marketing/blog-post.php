<?php
declare(strict_types=1);

$post = Db::one(
    'SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM blog_posts p
       LEFT JOIN blog_categories c ON c.id = p.category_id
      WHERE p.slug = ? AND p.status = "published"
      LIMIT 1',
    [$params['slug']]
);

if (!$post) {
    Response::notFound('That article does not exist, or it is not published yet.');
}

Db::run('UPDATE blog_posts SET view_count = view_count + 1 WHERE id = ?', [$post['id']]);

$related = Db::all(
    'SELECT slug, title, excerpt, reading_minutes, published_at
       FROM blog_posts
      WHERE status = "published" AND id <> ? AND (category_id = ? OR category_id IS NULL)
      ORDER BY published_at DESC LIMIT 3',
    [$post['id'], $post['category_id']]
);

$tags = Str::json($post['tags']);

Seo::article($post);
Seo::breadcrumbs([
    ['name' => 'Home', 'url' => '/'],
    ['name' => 'Blog', 'url' => '/blog'],
    ['name' => $post['title'], 'url' => '/blog/' . $post['slug']],
]);

View::begin('layouts/public', [
    'title'       => $post['meta_title'] ?: $post['title'],
    'description' => $post['meta_description'] ?: Str::excerpt($post['excerpt'], 155),
    'keywords'    => Str::json($post['keywords']),
    'image'       => $post['og_image'] ?: $post['cover_image'],
    'canonical'   => $post['canonical_url'] ?: null,
    'no_index'    => Str::bool($post['no_index']),
    'type'        => 'article',
    'published'   => $post['published_at'],
    'modified'    => $post['updated_at'],
]);
?>

<article class="section-tight">
  <div class="container container-narrow">
    <nav class="small muted" aria-label="Breadcrumb">
      <a href="/blog">← All articles</a>
    </nav>

    <header class="mt-3">
      <?php if ($post['category_name']): ?>
        <a class="badge badge-primary" href="/blog?category=<?= Str::e($post['category_slug']) ?>">
          <?= Str::e($post['category_name']) ?>
        </a>
      <?php endif; ?>

      <h1 class="mt-2"><?= Str::e($post['title']) ?></h1>

      <?php if ($post['excerpt']): ?>
        <p class="lead muted mt-2"><?= Str::e($post['excerpt']) ?></p>
      <?php endif; ?>

      <p class="small muted mt-3">
        By <?= Str::e($post['author_name'] ?: 'FairCouples Team') ?> ·
        <?= Str::e(Str::date($post['published_at'])) ?> ·
        <?= (int) $post['reading_minutes'] ?> min read
      </p>
    </header>

    <?php if ($post['cover_image']): ?>
      <img class="mt-3" src="<?= Str::e($post['cover_image']) ?>" alt=""
           style="width:100%;aspect-ratio:16/9;object-fit:cover;border-radius:var(--radius)">
    <?php endif; ?>

    <div class="prose mt-4"><?= Str::markdown($post['content']) ?></div>

    <?php if ($tags !== []): ?>
      <p class="row mt-4">
        <?php foreach ($tags as $tag): ?>
          <span class="badge"><?= Str::e($tag) ?></span>
        <?php endforeach; ?>
      </p>
    <?php endif; ?>

    <div class="card card-accent mt-4">
      <div class="card-body">
        <h2 style="font-size:1.15rem">Measure this in your own relationship</h2>
        <p class="small mt-2">
          Both partners log their own side. The report compares the two and tells you where effort is
          drifting. Free plan, no card.
        </p>
        <a class="btn mt-3" href="/signup">Create a free account</a>
      </div>
    </div>
  </div>
</article>

<?php if ($related !== []): ?>
<section class="section-tight">
  <div class="container">
    <h2 style="font-size:1.3rem">Keep reading</h2>
    <div class="grid grid-3 mt-3">
      <?php foreach ($related as $item): ?>
        <a class="card" href="/blog/<?= Str::e($item['slug']) ?>" style="color:inherit">
          <div class="card-body">
            <p class="bold"><?= Str::e($item['title']) ?></p>
            <p class="small muted mt-1"><?= Str::e(Str::excerpt($item['excerpt'], 110)) ?></p>
            <p class="tiny muted mt-2"><?= (int) $item['reading_minutes'] ?> min read</p>
          </div>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<?php View::end(); ?>
