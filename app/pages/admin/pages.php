<?php
declare(strict_types=1);

Auth::requireAdmin();

/*
 * Every legal and marketing page the site serves at /{slug} lives here:
 * privacy policy, terms, cookie policy, refund policy, disclaimer, about,
 * contact copy. Content is Markdown; it is escaped before rendering.
 */

// Slugs the router owns — a CMS page can never shadow one of them.
$reservedSlugs = [
    'admin', 'dashboard', 'blog', 'pricing', 'signup', 'signin', 'signout',
    'onboarding', 'invite', 'join', 'checkout', 'assets', 'app', 'storage',
    'file', 'health', 'sitemap', 'robots', 'destinations', 'fairness',
    'features', 'reset-password', 'forgot-password', 'verify-email', '404',
];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        Db::delete('pages', 'id = ?', [Request::input('id')]);
        Audit::record('admin.page.delete', 'page', Request::input('id'), 'Deleted a page');
        Flash::success('Page deleted.');
        Response::redirect('/admin/pages');
    }

    $title = Request::input('title');
    $slug = Str::slug(Request::input('slug') !== '' ? Request::input('slug') : $title);

    if ($title === '' || $slug === '') {
        Flash::error('A page needs a title and a slug.');
        Response::redirect('/admin/pages');
    }

    if (in_array($slug, $reservedSlugs, true)) {
        Flash::error('"' . $slug . '" is used by the app itself. Pick another slug.');
        Response::redirect('/admin/pages');
    }

    $data = [
        'slug'             => substr($slug, 0, 200),
        'title'            => mb_substr($title, 0, 250),
        'content'          => Request::raw('content'),
        'page_type'        => in_array(Request::input('page_type'), ['legal', 'marketing', 'support', 'custom'], true)
            ? Request::input('page_type')
            : 'legal',
        'status'           => in_array(Request::input('status'), ['draft', 'published', 'archived'], true)
            ? Request::input('status')
            : 'published',
        'show_in_footer'   => Request::bool('show_in_footer'),
        'show_in_header'   => Request::bool('show_in_header'),
        'meta_title'       => Request::nullable('meta_title'),
        'meta_description' => Request::nullable('meta_description'),
        'canonical_url'    => Request::nullable('canonical_url'),
        'keywords'         => json_encode(array_values(array_filter(
            array_map('trim', explode(',', Request::input('keywords')))
        ))),
        'no_index'         => Request::bool('no_index'),
        'sort_order'       => Request::int('sort_order'),
    ];

    $id = Request::input('page_id');
    if ($id !== '') {
        $saved = Db::update('pages', $id, $data);
    } else {
        if (Db::one('SELECT id FROM pages WHERE slug = ? LIMIT 1', [$data['slug']])) {
            Flash::error('A page with that slug already exists.');
            Response::redirect('/admin/pages');
        }
        $saved = Db::insert('pages', $data) !== null;
    }

    if (!$saved) {
        Flash::error('Could not save that page: ' . (Db::lastError() ?? 'unknown database error'));
        Response::redirect('/admin/pages');
    }

    Audit::record('admin.page.save', 'page', $data['slug'], 'Saved page "' . $title . '"');
    Flash::success('Page saved.');
    Response::redirect($id !== '' ? '/admin/pages?edit=' . urlencode($id) : '/admin/pages');
}

$pages = Db::all('SELECT * FROM pages ORDER BY page_type ASC, sort_order ASC, title ASC');

$editing = null;
if (($_GET['edit'] ?? '') !== '') {
    $editing = Db::one('SELECT * FROM pages WHERE id = ? LIMIT 1', [$_GET['edit']]);
}

$grouped = [];
foreach ($pages as $page) {
    $grouped[$page['page_type']][] = $page;
}

View::begin('layouts/admin', ['title' => 'Pages & legal', 'no_index' => true]);
?>

<div class="page-head">
  <div class="row-between">
    <div>
      <h1>Pages &amp; legal</h1>
      <p>
        Privacy policy, terms, cookies, refunds, disclaimer and any other standalone page.
        Each one is served at <code>/your-slug</code> with its own SEO fields.
      </p>
    </div>
    <?php if ($editing): ?>
      <a class="btn btn-outline" href="/admin/pages">+ New page</a>
    <?php endif; ?>
  </div>
</div>

<form method="post" class="card">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="save">
  <input type="hidden" name="page_id" value="<?= Str::e($editing['id'] ?? '') ?>">

  <div class="card-head">
    <h2><?= $editing ? 'Edit: ' . Str::e($editing['title']) : 'Create a page' ?></h2>
    <?php if ($editing): ?>
      <a class="small" href="/<?= Str::e($editing['slug']) ?>" target="_blank">View it →</a>
    <?php endif; ?>
  </div>

  <div class="card-body">
    <div class="field-row">
      <div class="field">
        <label for="title">Title <span class="required">*</span></label>
        <input class="input" id="title" name="title" required maxlength="250"
               value="<?= Str::e($editing['title'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="slug">URL slug</label>
        <input class="input mono" id="slug" name="slug" maxlength="200"
               value="<?= Str::e($editing['slug'] ?? '') ?>" placeholder="privacy-policy">
        <span class="hint">Served at <code>/slug</code>.</span>
      </div>
    </div>

    <div class="field">
      <label for="content">Content (Markdown) <span class="required">*</span></label>
      <textarea class="textarea mono" rows="22" id="content" name="content"
                style="font-size:0.85rem"><?= Str::e($editing['content'] ?? '') ?></textarea>
      <span class="hint"># Heading · ## Subheading · **bold** · - list item · [text](url)</span>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="page_type">Type</label>
        <select class="select" id="page_type" name="page_type">
          <?= View::options([
              'legal'     => 'Legal',
              'marketing' => 'Marketing',
              'support'   => 'Support',
              'custom'    => 'Custom',
          ], $editing['page_type'] ?? 'legal') ?>
        </select>
      </div>
      <div class="field">
        <label for="status">Status</label>
        <select class="select" id="status" name="status">
          <?= View::options(['published' => 'Published', 'draft' => 'Draft', 'archived' => 'Archived'],
                            $editing['status'] ?? 'published') ?>
        </select>
      </div>
      <div class="field">
        <label for="sort_order">Sort order</label>
        <input class="input" type="number" id="sort_order" name="sort_order"
               value="<?= (int) ($editing['sort_order'] ?? 0) ?>">
      </div>
    </div>

    <div class="row">
      <label class="checkbox">
        <input type="checkbox" name="show_in_footer" value="1"
               <?= Str::bool($editing['show_in_footer'] ?? true) ? 'checked' : '' ?>>
        Link in the footer
      </label>
      <label class="checkbox">
        <input type="checkbox" name="show_in_header" value="1"
               <?= Str::bool($editing['show_in_header'] ?? false) ? 'checked' : '' ?>>
        Link in the header
      </label>
    </div>

    <hr class="divider">
    <h3 style="font-family:var(--font);font-size:1rem">Search engine settings</h3>

    <div class="field-row mt-2">
      <div class="field">
        <label for="meta_title">Meta title</label>
        <input class="input" id="meta_title" name="meta_title" maxlength="250"
               value="<?= Str::e($editing['meta_title'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="canonical_url">Canonical URL</label>
        <input class="input" id="canonical_url" name="canonical_url"
               value="<?= Str::e($editing['canonical_url'] ?? '') ?>">
      </div>
    </div>

    <div class="field">
      <label for="meta_description">Meta description</label>
      <textarea class="textarea" rows="2" id="meta_description"
                name="meta_description"><?= Str::e($editing['meta_description'] ?? '') ?></textarea>
    </div>

    <div class="field">
      <label for="keywords">Keywords — comma separated</label>
      <input class="input" id="keywords" name="keywords"
             value="<?= Str::e(implode(', ', Str::json($editing['keywords'] ?? null))) ?>">
    </div>

    <label class="checkbox">
      <input type="checkbox" name="no_index" value="1" <?= Str::bool($editing['no_index'] ?? false) ? 'checked' : '' ?>>
      Hide from search engines
    </label>

    <button class="btn btn-lg mt-3" type="submit"><?= $editing ? 'Save page' : 'Create page' ?></button>
  </div>
</form>

<div class="card mt-3">
  <div class="card-head"><h2>All pages (<?= count($pages) ?>)</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Page</th><th>Type</th><th>Status</th><th>Links</th><th>Updated</th><th></th></tr></thead>
      <tbody>
        <?php foreach ($grouped as $type => $rows): ?>
          <tr><td colspan="6" class="side-heading" style="padding-top:1rem"><?= Str::e(ucfirst($type)) ?></td></tr>
          <?php foreach ($rows as $page): ?>
            <tr>
              <td>
                <span class="bold"><?= Str::e($page['title']) ?></span>
                <span class="tiny muted mono" style="display:block">/<?= Str::e($page['slug']) ?></span>
              </td>
              <td class="small muted"><?= Str::e($page['page_type']) ?></td>
              <td>
                <span class="badge badge-<?= $page['status'] === 'published' ? 'success' : 'outline' ?>">
                  <?= Str::e($page['status']) ?>
                </span>
                <?php if (Str::bool($page['no_index'])): ?>
                  <span class="badge badge-warning">noindex</span>
                <?php endif; ?>
              </td>
              <td class="tiny muted">
                <?= Str::bool($page['show_in_footer']) ? 'footer' : '' ?>
                <?= Str::bool($page['show_in_header']) ? 'header' : '' ?>
              </td>
              <td class="small muted nowrap"><?= Str::e(Str::date($page['updated_at'])) ?></td>
              <td class="right nowrap">
                <a class="btn btn-sm btn-outline" href="/admin/pages?edit=<?= Str::e($page['id']) ?>">Edit</a>
                <form method="post" style="display:inline" data-confirm="Delete this page permanently?">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete">
                  <input type="hidden" name="id" value="<?= Str::e($page['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit">Delete</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
