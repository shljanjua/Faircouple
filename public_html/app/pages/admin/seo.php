<?php
declare(strict_types=1);

/*
 * Technical SEO control room:
 *   - global defaults (keywords, OG image, Twitter handle, verification tags)
 *   - per-path overrides written to `seo_meta`, which Seo::resolved() merges
 *     over whatever the page itself declared
 *   - 301/302 redirects, applied by the router before it matches a route
 *   - a live audit of every indexable path
 */

$me = Auth::requireAdmin();

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'defaults') {
        Settings::put([
            'seo_keywords'            => array_values(array_filter(
                array_map('trim', explode(',', Request::input('seo_keywords')))
            )),
            'seo_default_og_image'    => Request::input('seo_default_og_image'),
            'seo_twitter_handle'      => ltrim(Request::input('seo_twitter_handle'), '@'),
            'seo_block_indexing'      => Request::bool('seo_block_indexing'),
            'seo_google_verification' => Request::input('seo_google_verification'),
            'seo_bing_verification'   => Request::input('seo_bing_verification'),
            'seo_pinterest_verification' => Request::input('seo_pinterest_verification'),
            'seo_yandex_verification' => Request::input('seo_yandex_verification'),
        ], $me['id']);

        Audit::record('admin.seo.defaults', 'settings', 'seo', 'Updated the global SEO defaults');
        Flash::success('SEO defaults saved.');
        Response::redirect('/admin/seo');
    }

    if ($action === 'meta_save') {
        $path = '/' . trim(Request::input('path'), '/');
        if ($path === '/' && Request::input('path') !== '/') {
            Flash::error('Enter the path you want to override, for example /pricing.');
            Response::redirect('/admin/seo');
        }

        Db::run(
            'INSERT INTO seo_meta (id, path, title, description, keywords, og_title, og_description,
                                   og_image, twitter_card, canonical_url, robots, priority, changefreq)
             VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               title = VALUES(title), description = VALUES(description), keywords = VALUES(keywords),
               og_title = VALUES(og_title), og_description = VALUES(og_description),
               og_image = VALUES(og_image), twitter_card = VALUES(twitter_card),
               canonical_url = VALUES(canonical_url), robots = VALUES(robots),
               priority = VALUES(priority), changefreq = VALUES(changefreq)',
            [
                Str::uuid(),
                $path,
                Request::nullable('title'),
                Request::nullable('description'),
                json_encode(array_values(array_filter(array_map('trim', explode(',', Request::input('keywords')))))),
                Request::nullable('og_title'),
                Request::nullable('og_description'),
                Request::nullable('og_image'),
                Request::input('twitter_card', 'summary_large_image'),
                Request::nullable('canonical_url'),
                Request::input('robots', 'index,follow'),
                Str::clamp(Request::float('priority', 0.7), 0.0, 1.0),
                Request::input('changefreq', 'weekly'),
            ]
        );

        Audit::record('admin.seo.meta', 'seo_meta', $path, 'Saved SEO metadata for ' . $path);
        Flash::success('Metadata saved for ' . $path);
        Response::redirect('/admin/seo');
    }

    if ($action === 'meta_delete') {
        Db::delete('seo_meta', 'id = ?', [Request::input('id')]);
        Flash::success('Override removed — that path falls back to its page defaults.');
        Response::redirect('/admin/seo');
    }

    if ($action === 'redirect_save') {
        $source = '/' . trim(Request::input('source'), '/');
        $destination = trim(Request::input('destination'));

        if ($source === '/' || $destination === '') {
            Flash::error('A redirect needs both a source path and a destination.');
            Response::redirect('/admin/seo');
        }

        if ($source === $destination) {
            Flash::error('That redirect points at itself.');
            Response::redirect('/admin/seo');
        }

        Db::run(
            'INSERT INTO redirects (id, source, destination, status_code, is_active)
             VALUES (?,?,?,?,?)
             ON DUPLICATE KEY UPDATE
               destination = VALUES(destination), status_code = VALUES(status_code),
               is_active = VALUES(is_active)',
            [
                Str::uuid(),
                substr($source, 0, 255),
                substr($destination, 0, 255),
                Request::int('status_code', 301) === 302 ? 302 : 301,
                Request::bool('is_active') ? 1 : 0,
            ]
        );

        Audit::record('admin.seo.redirect', 'redirect', $source, $source . ' → ' . $destination);
        Flash::success('Redirect saved.');
        Response::redirect('/admin/seo');
    }

    if ($action === 'redirect_delete') {
        Db::delete('redirects', 'id = ?', [Request::input('id')]);
        Flash::success('Redirect deleted.');
        Response::redirect('/admin/seo');
    }
}

$overrides = Db::all('SELECT * FROM seo_meta ORDER BY path ASC');
$redirects = Db::all('SELECT * FROM redirects ORDER BY source ASC');

$editing = null;
if (($_GET['path'] ?? '') !== '') {
    $editing = Db::one('SELECT * FROM seo_meta WHERE path = ? LIMIT 1', [$_GET['path']]);
    if (!$editing) {
        // Editing a path that has no override yet — prefill just the path.
        $editing = ['path' => (string) $_GET['path']];
    }
}

/*
 * The audit list: every indexable URL the site can serve, so you can see at a
 * glance which ones still have no title or description of their own.
 */
$audit = [
    ['/', 'Home'],
    ['/pricing', 'Pricing'],
    ['/features', 'Features'],
    ['/fairness', 'Fairness checklist'],
    ['/love-or-attraction', 'Love or attraction'],
    ['/checklists', 'Travel checklists'],
    ['/destinations', 'Destinations'],
    ['/countries', 'Countries'],
    ['/blog', 'Blog index'],
    ['/faq', 'FAQ'],
    ['/contact', 'Contact'],
];

foreach (Db::all('SELECT slug, title FROM pages WHERE status = ? ORDER BY title ASC', ['published']) as $page) {
    $audit[] = ['/' . $page['slug'], $page['title']];
}

$overrideByPath = [];
foreach ($overrides as $row) {
    $overrideByPath[$row['path']] = $row;
}

$counts = [
    'posts'        => Db::count('blog_posts', 'status = ?', ['published']),
    'pages'        => Db::count('pages', 'status = ?', ['published']),
    'destinations' => Db::count('destinations', 'is_active = 1'),
    'countries'    => Db::count('countries', 'is_active = 1'),
];

View::begin('layouts/admin', ['title' => 'SEO & redirects', 'no_index' => true]);
?>

<div class="page-head">
  <h1>SEO &amp; redirects</h1>
  <p>
    Site-wide defaults, per-path overrides and redirects. Overrides win over whatever a page declares
    in code, so you can retitle any URL without touching a file.
  </p>
</div>

<div class="grid grid-4">
  <div class="card stat">
    <p class="stat-label">Indexable URLs</p>
    <p class="stat-value tabular">
      <?= number_format(count($audit) + $counts['posts'] + $counts['destinations'] + $counts['countries']) ?>
    </p>
  </div>
  <div class="card stat">
    <p class="stat-label">Path overrides</p>
    <p class="stat-value tabular"><?= number_format(count($overrides)) ?></p>
  </div>
  <div class="card stat">
    <p class="stat-label">Redirects</p>
    <p class="stat-value tabular"><?= number_format(count($redirects)) ?></p>
  </div>
  <div class="card stat">
    <p class="stat-label">Indexing</p>
    <p class="stat-value">
      <?php if (Settings::bool('seo_block_indexing') || Settings::bool('maintenance_mode')): ?>
        <span class="badge badge-danger">blocked</span>
      <?php else: ?>
        <span class="badge badge-success">open</span>
      <?php endif; ?>
    </p>
  </div>
</div>

<div class="alert alert-info mt-3">
  <div>
    <strong>Submit these to Google Search Console and Bing Webmaster Tools</strong>
    Sitemap index: <code><?= Str::e(Config::siteUrl('/sitemap.xml')) ?></code><br>
    Robots: <code><?= Str::e(Config::siteUrl('/robots.txt')) ?></code>
  </div>
</div>

<!-- ------------------------------------------------------- Global defaults -->
<form method="post" class="card mt-3">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="defaults">

  <div class="card-head"><h2>Site-wide defaults</h2></div>

  <div class="card-body">
    <div class="field">
      <label for="seo_keywords">Default keywords — comma separated</label>
      <input class="input" id="seo_keywords" name="seo_keywords"
             value="<?= Str::e(implode(', ', Settings::list('seo_keywords', []))) ?>">
      <span class="hint">Used on any page that does not set its own.</span>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="seo_default_og_image">Default social share image URL</label>
        <input class="input" id="seo_default_og_image" name="seo_default_og_image"
               value="<?= Str::e(Settings::text('seo_default_og_image')) ?>">
      </div>
      <div class="field">
        <label for="seo_twitter_handle">X / Twitter handle</label>
        <input class="input" id="seo_twitter_handle" name="seo_twitter_handle"
               value="<?= Str::e(Settings::text('seo_twitter_handle')) ?>" placeholder="faircouples">
      </div>
    </div>

    <hr class="divider">
    <h3 style="font-family:var(--font);font-size:1rem">Search engine verification</h3>
    <p class="small muted">Paste just the token, not the whole meta tag.</p>

    <div class="field-row mt-2">
      <div class="field">
        <label for="seo_google_verification">Google Search Console</label>
        <input class="input mono" id="seo_google_verification" name="seo_google_verification"
               value="<?= Str::e(Settings::text('seo_google_verification')) ?>">
      </div>
      <div class="field">
        <label for="seo_bing_verification">Bing Webmaster Tools</label>
        <input class="input mono" id="seo_bing_verification" name="seo_bing_verification"
               value="<?= Str::e(Settings::text('seo_bing_verification')) ?>">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="seo_pinterest_verification">Pinterest</label>
        <input class="input mono" id="seo_pinterest_verification" name="seo_pinterest_verification"
               value="<?= Str::e(Settings::text('seo_pinterest_verification')) ?>">
      </div>
      <div class="field">
        <label for="seo_yandex_verification">Yandex</label>
        <input class="input mono" id="seo_yandex_verification" name="seo_yandex_verification"
               value="<?= Str::e(Settings::text('seo_yandex_verification')) ?>">
      </div>
    </div>

    <label class="checkbox mt-2">
      <input type="checkbox" name="seo_block_indexing" value="1"
             <?= Settings::bool('seo_block_indexing') ? 'checked' : '' ?>>
      <span>
        Block all search engines
        <span class="hint">Turns robots.txt into a full Disallow. Use this before launch, then switch it off.</span>
      </span>
    </label>

    <button class="btn mt-3" type="submit">Save defaults</button>
  </div>
</form>

<!-- --------------------------------------------------- Per-path override -->
<form method="post" class="card mt-3">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="meta_save">

  <div class="card-head">
    <h2><?= $editing ? 'Override ' . Str::e($editing['path']) : 'Override a single path' ?></h2>
    <?php if ($editing): ?><a class="small" href="/admin/seo">Cancel</a><?php endif; ?>
  </div>

  <div class="card-body">
    <div class="field-row">
      <div class="field">
        <label for="path">Path <span class="required">*</span></label>
        <input class="input mono" id="path" name="path" required
               value="<?= Str::e($editing['path'] ?? '') ?>" placeholder="/pricing">
      </div>
      <div class="field">
        <label for="robots">Robots directive</label>
        <select class="select" id="robots" name="robots">
          <?= View::options([
              'index,follow'     => 'index, follow',
              'noindex,follow'   => 'noindex, follow',
              'index,nofollow'   => 'index, nofollow',
              'noindex,nofollow' => 'noindex, nofollow',
          ], $editing['robots'] ?? 'index,follow') ?>
        </select>
      </div>
    </div>

    <div class="field">
      <label for="seo_title">Title</label>
      <input class="input" id="seo_title" name="title" maxlength="250"
             value="<?= Str::e($editing['title'] ?? '') ?>">
      <span class="hint">Around 55 characters reads best in results.</span>
    </div>

    <div class="field">
      <label for="seo_description">Meta description</label>
      <textarea class="textarea" rows="2" id="seo_description"
                name="description"><?= Str::e($editing['description'] ?? '') ?></textarea>
      <span class="hint">Around 155 characters.</span>
    </div>

    <div class="field">
      <label for="seo_keywords_path">Keywords — comma separated</label>
      <input class="input" id="seo_keywords_path" name="keywords"
             value="<?= Str::e(implode(', ', Str::json($editing['keywords'] ?? null))) ?>">
    </div>

    <div class="field-row">
      <div class="field">
        <label for="og_title">Open Graph title</label>
        <input class="input" id="og_title" name="og_title" maxlength="250"
               value="<?= Str::e($editing['og_title'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="og_image">Open Graph image URL</label>
        <input class="input" id="og_image" name="og_image" value="<?= Str::e($editing['og_image'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="twitter_card">Twitter card</label>
        <select class="select" id="twitter_card" name="twitter_card">
          <?= View::options([
              'summary_large_image' => 'Large image',
              'summary'             => 'Summary',
          ], $editing['twitter_card'] ?? 'summary_large_image') ?>
        </select>
      </div>
    </div>

    <div class="field">
      <label for="og_description">Open Graph description</label>
      <textarea class="textarea" rows="2" id="og_description"
                name="og_description"><?= Str::e($editing['og_description'] ?? '') ?></textarea>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="canonical_url">Canonical URL</label>
        <input class="input" id="canonical_url" name="canonical_url"
               value="<?= Str::e($editing['canonical_url'] ?? '') ?>">
        <span class="hint">Leave blank and the site canonicalises to itself.</span>
      </div>
      <div class="field">
        <label for="priority">Sitemap priority</label>
        <input class="input" type="number" min="0" max="1" step="0.1" id="priority" name="priority"
               value="<?= Str::e($editing['priority'] ?? '0.7') ?>">
      </div>
      <div class="field">
        <label for="changefreq">Change frequency</label>
        <select class="select" id="changefreq" name="changefreq">
          <?= View::options([
              'always' => 'always', 'hourly' => 'hourly', 'daily' => 'daily',
              'weekly' => 'weekly', 'monthly' => 'monthly', 'yearly' => 'yearly', 'never' => 'never',
          ], $editing['changefreq'] ?? 'weekly') ?>
        </select>
      </div>
    </div>

    <button class="btn mt-3" type="submit">Save metadata</button>
  </div>
</form>

<!-- ----------------------------------------------------------- Page audit -->
<div class="card mt-3">
  <div class="card-head"><h2>Page audit</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Path</th><th>Page</th><th>Title override</th><th>Description</th><th>Robots</th><th></th></tr></thead>
      <tbody>
        <?php foreach ($audit as [$path, $label]): ?>
          <?php $override = $overrideByPath[$path] ?? null; ?>
          <tr>
            <td class="mono small"><?= Str::e($path) ?></td>
            <td class="small"><?= Str::e($label) ?></td>
            <td class="small">
              <?php if ($override && $override['title']): ?>
                <?= Str::e(Str::excerpt($override['title'], 46)) ?>
              <?php else: ?>
                <span class="tiny muted">page default</span>
              <?php endif; ?>
            </td>
            <td class="small">
              <?php if ($override && $override['description']): ?>
                <span class="badge badge-success"><?= mb_strlen((string) $override['description']) ?> chars</span>
              <?php else: ?>
                <span class="tiny muted">page default</span>
              <?php endif; ?>
            </td>
            <td class="tiny mono muted"><?= Str::e($override['robots'] ?? 'index,follow') ?></td>
            <td class="right nowrap">
              <a class="btn btn-sm btn-outline" href="/admin/seo?path=<?= urlencode($path) ?>">Override</a>
              <a class="btn btn-sm btn-ghost" href="<?= Str::e($path) ?>" target="_blank">Open</a>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
  <div class="card-body">
    <p class="small muted">
      Blog posts, destinations and country pages carry their own SEO fields, edited on their own screens.
      They are all listed in the sitemap: <?= number_format($counts['posts']) ?> posts,
      <?= number_format($counts['destinations']) ?> destinations,
      <?= number_format($counts['countries']) ?> countries.
    </p>
  </div>
</div>

<?php if ($overrides !== []): ?>
  <div class="card mt-3">
    <div class="card-head"><h2>Saved overrides</h2></div>
    <div class="table-wrap">
      <table>
        <thead><tr><th>Path</th><th>Title</th><th>Priority</th><th>Updated</th><th></th></tr></thead>
        <tbody>
          <?php foreach ($overrides as $override): ?>
            <tr>
              <td class="mono small"><?= Str::e($override['path']) ?></td>
              <td class="small"><?= Str::e(Str::excerpt($override['title'], 60)) ?></td>
              <td class="small tabular"><?= Str::e($override['priority']) ?></td>
              <td class="small muted nowrap"><?= Str::e(Str::date($override['updated_at'])) ?></td>
              <td class="right nowrap">
                <a class="btn btn-sm btn-outline"
                   href="/admin/seo?path=<?= urlencode($override['path']) ?>">Edit</a>
                <form method="post" style="display:inline" data-confirm="Remove this override?">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="meta_delete">
                  <input type="hidden" name="id" value="<?= Str::e($override['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit">×</button>
                </form>
              </td>
            </tr>
          <?php endforeach; ?>
        </tbody>
      </table>
    </div>
  </div>
<?php endif; ?>

<!-- ------------------------------------------------------------ Redirects -->
<div class="card mt-3">
  <div class="card-head"><h2>Redirects</h2></div>

  <div class="card-body">
    <form method="post" class="field-row" style="align-items:flex-end">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="redirect_save">
      <div class="field">
        <label for="source">From path</label>
        <input class="input mono" id="source" name="source" required placeholder="/old-pricing">
      </div>
      <div class="field">
        <label for="destination">To path or URL</label>
        <input class="input mono" id="destination" name="destination" required placeholder="/pricing">
      </div>
      <div class="field" style="max-width:9rem">
        <label for="status_code">Type</label>
        <select class="select" id="status_code" name="status_code">
          <option value="301">301 permanent</option>
          <option value="302">302 temporary</option>
        </select>
      </div>
      <div class="field" style="max-width:8rem">
        <label class="checkbox"><input type="checkbox" name="is_active" value="1" checked> Active</label>
      </div>
      <button class="btn" type="submit">Add</button>
    </form>
  </div>

  <div class="table-wrap">
    <table>
      <thead><tr><th>From</th><th>To</th><th>Type</th><th class="right">Hits</th><th>State</th><th></th></tr></thead>
      <tbody>
        <?php if ($redirects === []): ?>
          <tr><td colspan="6" class="small muted">No redirects yet. Add one whenever you change a URL.</td></tr>
        <?php endif; ?>
        <?php foreach ($redirects as $redirect): ?>
          <tr>
            <td class="mono small"><?= Str::e($redirect['source']) ?></td>
            <td class="mono small"><?= Str::e($redirect['destination']) ?></td>
            <td class="small muted"><?= (int) $redirect['status_code'] ?></td>
            <td class="right tabular small"><?= number_format((int) $redirect['hits']) ?></td>
            <td>
              <span class="badge badge-<?= Str::bool($redirect['is_active']) ? 'success' : 'outline' ?>">
                <?= Str::bool($redirect['is_active']) ? 'on' : 'off' ?>
              </span>
            </td>
            <td class="right">
              <form method="post" style="display:inline" data-confirm="Delete this redirect?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="redirect_delete">
                <input type="hidden" name="id" value="<?= Str::e($redirect['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">×</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
