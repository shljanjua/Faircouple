<?php
declare(strict_types=1);

$me = Auth::requireAdmin();

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'delete') {
        Db::delete('blog_posts', 'id = ?', [Request::input('id')]);
        Flash::success('Post deleted.');
        Response::redirect('/admin/blog');
    }

    $title = Request::input('title');
    $slug = Str::slug(Request::input('slug') !== '' ? Request::input('slug') : $title);

    if ($title === '' || $slug === '') {
        Flash::error('Title and slug are required.');
        Response::redirect('/admin/blog');
    }

    $status = Request::input('status', 'draft');
    $content = Request::raw('content');

    $publishedAt = null;
    if ($status === 'published') {
        $publishedAt = Request::date('published_at')
            ? Request::date('published_at') . ' 09:00:00'
            : Str::now();
    }

    $coverImage = Request::nullable('cover_image');

    // An uploaded cover replaces the URL field.
    if (!empty($_FILES['cover']['name'])) {
        $stored = Storage::store($_FILES['cover'], 'blog', null, $me['id'], 'cover');
        if ($stored['ok']) {
            $coverImage = Storage::url('blog', $stored['path']);
        } else {
            Flash::error($stored['error']);
        }
    }

    $data = [
        'slug'             => $slug,
        'title'            => mb_substr($title, 0, 250),
        'excerpt'          => Request::nullable('excerpt'),
        'content'          => $content,
        'cover_image'      => $coverImage,
        'category_id'      => Request::nullable('category_id'),
        'author_id'        => $me['id'],
        'author_name'      => Request::input('author_name', 'FairCouples Team'),
        'status'           => $status,
        'is_featured'      => Request::bool('is_featured'),
        'reading_minutes'  => Request::int('reading_minutes') ?: Str::readingMinutes($content),
        'tags'             => json_encode(array_values(array_filter(array_map('trim', explode(',', Request::input('tags')))))),
        'keywords'         => json_encode(array_values(array_filter(array_map('trim', explode(',', Request::input('keywords')))))),
        'meta_title'       => Request::nullable('meta_title'),
        'meta_description' => Request::nullable('meta_description'),
        'canonical_url'    => Request::nullable('canonical_url'),
        'og_image'         => Request::nullable('og_image'),
        'no_index'         => Request::bool('no_index'),
        'published_at'     => $publishedAt,
    ];

    $id = Request::input('post_id');
    if ($id !== '') {
        $saved = Db::update('blog_posts', $id, $data);
    } else {
        // The slug is unique, so a clash has to be reported rather than
        // swallowed — otherwise the editor looks like it saved and did not.
        if (Db::one('SELECT id FROM blog_posts WHERE slug = ? LIMIT 1', [$slug])) {
            Flash::error('A post with the slug "' . $slug . '" already exists. Give this one a different slug.');
            Response::redirect('/admin/blog');
        }
        $saved = Db::insert('blog_posts', $data) !== null;
    }

    if (!$saved) {
        Flash::error('Could not save that post: ' . (Db::lastError() ?? 'unknown database error'));
        Response::redirect('/admin/blog');
    }

    Audit::record('admin.post.save', 'blog_post', $slug, 'Saved post "' . $title . '"');
    Flash::success('Post saved.');
    Response::redirect('/admin/blog');
}

$posts = Db::all('SELECT * FROM blog_posts ORDER BY published_at IS NULL DESC, published_at DESC, created_at DESC');
$categories = Db::all('SELECT * FROM blog_categories ORDER BY sort_order ASC');

$editing = null;
if (($_GET['edit'] ?? '') !== '') {
    $editing = Db::one('SELECT * FROM blog_posts WHERE id = ? LIMIT 1', [$_GET['edit']]);
}

View::begin('layouts/admin', ['title' => 'Blog', 'no_index' => true]);
?>

<div class="page-head">
  <div class="row-between">
    <div>
      <h1>Blog</h1>
      <p>Full on-page SEO fields on every post. Content is written in Markdown.</p>
    </div>
    <?php if ($editing): ?>
      <a class="btn btn-outline" href="/admin/blog">+ New post</a>
    <?php endif; ?>
  </div>
</div>

<form method="post" enctype="multipart/form-data" class="card">
  <?= Csrf::field() ?>
  <input type="hidden" name="action" value="save">
  <input type="hidden" name="post_id" value="<?= Str::e($editing['id'] ?? '') ?>">

  <div class="card-head">
    <h2><?= $editing ? 'Edit: ' . Str::e($editing['title']) : 'Write a new post' ?></h2>
    <?php if ($editing): ?>
      <a class="small" href="/blog/<?= Str::e($editing['slug']) ?>" target="_blank">View it →</a>
    <?php endif; ?>
  </div>

  <div class="card-body">
    <div class="field-row">
      <div class="field">
        <label for="title">Title <span class="required">*</span></label>
        <input class="input" id="title" name="title" required maxlength="250" value="<?= Str::e($editing['title'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="slug">Slug</label>
        <input class="input" id="slug" name="slug" maxlength="190" value="<?= Str::e($editing['slug'] ?? '') ?>"
               placeholder="Generated from the title">
      </div>
    </div>

    <div class="field">
      <label for="excerpt">Excerpt</label>
      <textarea class="textarea" rows="2" id="excerpt" name="excerpt"><?= Str::e($editing['excerpt'] ?? '') ?></textarea>
      <span class="hint">Shown on the blog index and used as the meta description if you leave that blank.</span>
    </div>

    <div class="field">
      <label for="content">Content (Markdown) <span class="required">*</span></label>
      <textarea class="textarea mono" rows="18" id="content" name="content"
                style="font-size:0.85rem"><?= Str::e($editing['content'] ?? '') ?></textarea>
      <span class="hint"># Heading · **bold** · *italic* · - list item · &gt; quote · [text](url)</span>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="category_id">Category</label>
        <select class="select" id="category_id" name="category_id">
          <option value="">None</option>
          <?php foreach ($categories as $category): ?>
            <option value="<?= Str::e($category['id']) ?>"
                    <?= ($editing['category_id'] ?? '') === $category['id'] ? 'selected' : '' ?>>
              <?= Str::e($category['name']) ?>
            </option>
          <?php endforeach; ?>
        </select>
      </div>
      <div class="field">
        <label for="status">Status</label>
        <select class="select" id="status" name="status">
          <?= View::options(['draft' => 'Draft', 'published' => 'Published', 'archived' => 'Archived'],
                            $editing['status'] ?? 'draft') ?>
        </select>
      </div>
      <div class="field">
        <label for="published_at">Publish date</label>
        <input class="input" type="date" id="published_at" name="published_at"
               value="<?= Str::e(substr((string) ($editing['published_at'] ?? ''), 0, 10)) ?>">
      </div>
      <div class="field">
        <label for="reading_minutes">Reading minutes</label>
        <input class="input" type="number" min="1" id="reading_minutes" name="reading_minutes"
               value="<?= (int) ($editing['reading_minutes'] ?? 0) ?>" placeholder="Auto">
      </div>
    </div>

    <div class="field-row">
      <div class="field">
        <label for="cover">Cover image — upload</label>
        <input class="input" type="file" id="cover" name="cover" accept="image/*" style="height:auto;padding:0.6rem">
      </div>
      <div class="field">
        <label for="cover_image">…or paste a URL</label>
        <input class="input" id="cover_image" name="cover_image" value="<?= Str::e($editing['cover_image'] ?? '') ?>">
      </div>
      <div class="field">
        <label for="author_name">Author name</label>
        <input class="input" id="author_name" name="author_name"
               value="<?= Str::e($editing['author_name'] ?? 'FairCouples Team') ?>">
      </div>
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

    <div class="field-row">
      <div class="field">
        <label for="keywords">Keywords — comma separated</label>
        <input class="input" id="keywords" name="keywords"
               value="<?= Str::e(implode(', ', Str::json($editing['keywords'] ?? null))) ?>">
      </div>
      <div class="field">
        <label for="tags">Tags — comma separated</label>
        <input class="input" id="tags" name="tags"
               value="<?= Str::e(implode(', ', Str::json($editing['tags'] ?? null))) ?>">
      </div>
      <div class="field">
        <label for="og_image">Social share image URL</label>
        <input class="input" id="og_image" name="og_image" value="<?= Str::e($editing['og_image'] ?? '') ?>">
      </div>
    </div>

    <div class="row">
      <label class="checkbox">
        <input type="checkbox" name="is_featured" value="1" <?= Str::bool($editing['is_featured'] ?? false) ? 'checked' : '' ?>>
        Featured
      </label>
      <label class="checkbox">
        <input type="checkbox" name="no_index" value="1" <?= Str::bool($editing['no_index'] ?? false) ? 'checked' : '' ?>>
        Hide from search engines
      </label>
    </div>

    <button class="btn btn-lg mt-3" type="submit"><?= $editing ? 'Save changes' : 'Create post' ?></button>
  </div>
</form>

<div class="card mt-3">
  <div class="card-head"><h2>All posts (<?= count($posts) ?>)</h2></div>
  <div class="table-wrap">
    <table>
      <thead><tr><th>Title</th><th>Status</th><th>Published</th><th class="right">Views</th><th></th></tr></thead>
      <tbody>
        <?php foreach ($posts as $post): ?>
          <tr>
            <td>
              <span class="bold"><?= Str::e($post['title']) ?></span>
              <span class="tiny muted mono" style="display:block">/blog/<?= Str::e($post['slug']) ?></span>
            </td>
            <td>
              <span class="badge badge-<?= $post['status'] === 'published' ? 'success' : 'outline' ?>">
                <?= Str::e($post['status']) ?>
              </span>
              <?php if (Str::bool($post['is_featured'])): ?><span class="badge badge-primary">featured</span><?php endif; ?>
            </td>
            <td class="small muted nowrap"><?= Str::e(Str::date($post['published_at'])) ?></td>
            <td class="right tabular"><?= number_format((int) $post['view_count']) ?></td>
            <td class="right nowrap">
              <a class="btn btn-sm btn-outline" href="/admin/blog?edit=<?= Str::e($post['id']) ?>">Edit</a>
              <form method="post" style="display:inline" data-confirm="Delete this post?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="delete">
                <input type="hidden" name="id" value="<?= Str::e($post['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">Delete</button>
              </form>
            </td>
          </tr>
        <?php endforeach; ?>
      </tbody>
    </table>
  </div>
</div>

<?php View::end(); ?>
