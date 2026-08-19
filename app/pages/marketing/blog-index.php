<?php
declare(strict_types=1);

$page     = max(1, (int) ($_GET['page'] ?? 1));
$perPage  = 9;
$search   = trim((string) ($_GET['q'] ?? ''));
$category = trim((string) ($_GET['category'] ?? ''));

$where = ['p.status = "published"', 'p.published_at <= UTC_TIMESTAMP()'];
$params = [];

if ($search !== '') {
    $where[] = '(p.title LIKE ? OR p.excerpt LIKE ?)';
    $params[] = '%' . $search . '%';
    $params[] = '%' . $search . '%';
}
if ($category !== '') {
    $where[] = 'c.slug = ?';
    $params[] = $category;
}

$clause = implode(' AND ', $where);

$total = (int) Db::value(
    "SELECT COUNT(*) FROM blog_posts p LEFT JOIN blog_categories c ON c.id = p.category_id WHERE {$clause}",
    $params,
    0
);

$offset = ($page - 1) * $perPage;
$posts = Db::all(
    "SELECT p.*, c.name AS category_name, c.slug AS category_slug
       FROM blog_posts p
       LEFT JOIN blog_categories c ON c.id = p.category_id
      WHERE {$clause}
      ORDER BY p.is_featured DESC, p.published_at DESC
      LIMIT {$perPage} OFFSET {$offset}",
    $params
);

$categories = Db::all('SELECT * FROM blog_categories WHERE is_active = 1 ORDER BY sort_order ASC');

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Blog', 'url' => '/blog']]);

View::begin('layouts/public', [
    'title'       => 'Blog — Fairness, Emotions, Money and Couples Travel',
    'description' => 'Guides on relationship fairness, emotional communication, splitting money without resentment and planning trips as a couple.',
    'no_index'    => $page > 1 || $search !== '',
]);
?>

<section class="section-tight">
  <div class="container">
    <p class="eyebrow">Blog</p>
    <h1>Fairness, feelings, money and travel</h1>
    <p class="muted mt-2" style="max-width:60ch">
      Practical guides, written the same way the product works: evidence first, feelings second.
    </p>

    <form method="get" class="toolbar mt-3">
      <div class="field" style="flex:1 1 16rem">
        <label class="sr-only" for="q">Search articles</label>
        <input class="input" type="search" id="q" name="q" value="<?= Str::e($search) ?>" placeholder="Search articles…">
      </div>
      <button class="btn" type="submit">Search</button>
      <?php if ($search !== '' || $category !== ''): ?>
        <a class="btn btn-ghost" href="/blog">Clear</a>
      <?php endif; ?>
    </form>

    <?php if ($categories !== []): ?>
      <div class="tabs">
        <a href="/blog" class="<?= $category === '' ? 'is-active' : '' ?>">All</a>
        <?php foreach ($categories as $row): ?>
          <a href="/blog?category=<?= Str::e($row['slug']) ?>"
             class="<?= $category === $row['slug'] ? 'is-active' : '' ?>"><?= Str::e($row['name']) ?></a>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </div>
</section>

<section class="section-tight">
  <div class="container">
    <?php if ($posts === []): ?>
      <div class="card"><div class="card-body empty">
        <p class="empty-emoji">📝</p>
        <p class="bold">Nothing matches that</p>
        <p>Try a different search, or browse every article.</p>
        <a class="btn btn-outline mt-3" href="/blog">All articles</a>
      </div></div>
    <?php else: ?>
      <div class="grid grid-3">
        <?php foreach ($posts as $post): ?>
          <article class="card">
            <?php if ($post['cover_image']): ?>
              <a href="/blog/<?= Str::e($post['slug']) ?>">
                <img src="<?= Str::e($post['cover_image']) ?>" alt="" loading="lazy"
                     style="aspect-ratio:16/9;object-fit:cover;width:100%;border-radius:var(--radius) var(--radius) 0 0">
              </a>
            <?php endif; ?>
            <div class="card-body">
              <?php if ($post['category_name']): ?>
                <a class="badge badge-primary" href="/blog?category=<?= Str::e($post['category_slug']) ?>">
                  <?= Str::e($post['category_name']) ?>
                </a>
              <?php endif; ?>
              <h2 style="font-size:1.1rem;margin-top:0.6rem">
                <a href="/blog/<?= Str::e($post['slug']) ?>" style="color:inherit"><?= Str::e($post['title']) ?></a>
              </h2>
              <p class="small muted mt-1"><?= Str::e(Str::excerpt($post['excerpt'], 130)) ?></p>
              <p class="tiny muted mt-2">
                <?= Str::e(Str::date($post['published_at'])) ?> ·
                <?= (int) $post['reading_minutes'] ?> min read
              </p>
            </div>
          </article>
        <?php endforeach; ?>
      </div>

      <?php $pages = (int) ceil($total / $perPage); ?>
      <?php if ($pages > 1): ?>
        <nav class="pagination" aria-label="Pagination">
          <?php $query = static function (int $target) use ($search, $category): string {
              $parts = ['page=' . $target];
              if ($search !== '') { $parts[] = 'q=' . urlencode($search); }
              if ($category !== '') { $parts[] = 'category=' . urlencode($category); }
              return '/blog?' . implode('&amp;', $parts);
          }; ?>
          <?php if ($page > 1): ?>
            <a href="<?= $query($page - 1) ?>">← Newer</a>
          <?php else: ?><span></span><?php endif; ?>

          <span class="muted">Page <?= $page ?> of <?= $pages ?></span>

          <?php if ($page < $pages): ?>
            <a href="<?= $query($page + 1) ?>">Older →</a>
          <?php else: ?><span></span><?php endif; ?>
        </nav>
      <?php endif; ?>
    <?php endif; ?>
  </div>
</section>

<?php View::end(); ?>
