<?php
declare(strict_types=1);

Auth::requireAdmin();

/*
 * FAQs feed the FAQPage schema on whichever path they are attached to, so
 * they are an SEO surface as much as a content one. Testimonials feed the
 * Review schema and the marketing pages.
 */

if (Request::isPost()) {
    $action = Request::input('action');
    $id = Request::input('id');

    switch ($action) {
        case 'faq_save':
            $question = trim(Request::input('question'));
            $answer = trim(Request::raw('answer'));

            if ($question === '' || $answer === '') {
                Flash::error('A FAQ needs both a question and an answer.');
                Response::redirect('/admin/content');
            }

            $faq = [
                'question'   => mb_substr($question, 0, 500),
                'answer'     => $answer,
                'category'   => Request::input('category', 'general'),
                'page_path'  => Request::nullable('page_path'),
                'sort_order' => Request::int('sort_order'),
                'is_active'  => Request::bool('is_active'),
            ];

            if ($id !== '') {
                $saved = Db::update('faqs', $id, $faq);
            } else {
                // The question is the table's unique key, so an existing one is
                // edited rather than silently failing to insert.
                $existing = Db::one('SELECT id FROM faqs WHERE question = ? LIMIT 1', [$faq['question']]);
                if ($existing) {
                    Flash::error('That question already exists — edit the existing entry instead.');
                    Response::redirect('/admin/content?faq=' . urlencode($existing['id']));
                }
                $saved = Db::insert('faqs', $faq) !== null;
            }

            if (!$saved) {
                Flash::error('Could not save that FAQ: ' . (Db::lastError() ?? 'unknown database error'));
                Response::redirect('/admin/content');
            }

            Audit::record('admin.faq.save', 'faq', $id ?: $faq['question'], 'Saved a FAQ');
            Flash::success('FAQ saved.');
            Response::redirect('/admin/content');

        case 'faq_delete':
            Db::delete('faqs', 'id = ?', [$id]);
            Flash::success('FAQ deleted.');
            Response::redirect('/admin/content');

        case 'faq_toggle':
            Db::run('UPDATE faqs SET is_active = 1 - is_active WHERE id = ?', [$id]);
            Response::redirect('/admin/content');

        case 'testimonial_save':
            $author = trim(Request::input('author_name'));
            $quote = trim(Request::raw('quote'));

            if ($author === '' || $quote === '') {
                Flash::error('A testimonial needs an author and a quote.');
                Response::redirect('/admin/content');
            }

            $testimonial = [
                'author_name'     => mb_substr($author, 0, 120),
                'author_role'     => Request::nullable('author_role'),
                'author_location' => Request::nullable('author_location'),
                'avatar_url'      => Request::nullable('avatar_url'),
                'quote'           => $quote,
                'rating'          => (int) Str::clamp((float) Request::int('rating', 5), 1, 5),
                'is_featured'     => Request::bool('is_featured'),
                'is_active'       => Request::bool('is_active'),
                'sort_order'      => Request::int('sort_order'),
            ];

            $saved = $id !== ''
                ? Db::update('testimonials', $id, $testimonial)
                : Db::insert('testimonials', $testimonial) !== null;

            if (!$saved) {
                Flash::error('Could not save that testimonial: ' . (Db::lastError() ?? 'that quote may already exist'));
                Response::redirect('/admin/content');
            }

            Audit::record('admin.testimonial.save', 'testimonial', $id ?: $author, 'Saved a testimonial');
            Flash::success('Testimonial saved.');
            Response::redirect('/admin/content');

        case 'testimonial_delete':
            Db::delete('testimonials', 'id = ?', [$id]);
            Flash::success('Testimonial deleted.');
            Response::redirect('/admin/content');

        case 'testimonial_toggle':
            Db::run('UPDATE testimonials SET is_active = 1 - is_active WHERE id = ?', [$id]);
            Response::redirect('/admin/content');
    }
}

$faqs = Db::all('SELECT * FROM faqs ORDER BY category ASC, sort_order ASC');
$testimonials = Db::all('SELECT * FROM testimonials ORDER BY is_featured DESC, sort_order ASC');

$editFaq = null;
$editTestimonial = null;

if (($_GET['faq'] ?? '') !== '') {
    $editFaq = Db::one('SELECT * FROM faqs WHERE id = ? LIMIT 1', [$_GET['faq']]);
}
if (($_GET['testimonial'] ?? '') !== '') {
    $editTestimonial = Db::one('SELECT * FROM testimonials WHERE id = ? LIMIT 1', [$_GET['testimonial']]);
}

$categories = ['general', 'pricing', 'fairness', 'privacy', 'travel', 'billing', 'account', 'technical'];

View::begin('layouts/admin', ['title' => 'FAQ & testimonials', 'no_index' => true]);
?>

<div class="page-head">
  <h1>FAQ &amp; testimonials</h1>
  <p>
    FAQs render as an accordion and as <code>FAQPage</code> structured data on the path you attach them to.
    Testimonials render as <code>Review</code> structured data on the home and pricing pages.
  </p>
</div>

<div class="grid grid-2 gap-lg">

  <!-- ------------------------------------------------------------ FAQs -->
  <div>
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="faq_save">
      <input type="hidden" name="id" value="<?= Str::e($editFaq['id'] ?? '') ?>">

      <div class="card-head">
        <h2><?= $editFaq ? 'Edit FAQ' : 'Add a FAQ' ?></h2>
        <?php if ($editFaq): ?><a class="small" href="/admin/content">Cancel</a><?php endif; ?>
      </div>

      <div class="card-body">
        <div class="field">
          <label for="question">Question <span class="required">*</span></label>
          <input class="input" id="question" name="question" required maxlength="500"
                 value="<?= Str::e($editFaq['question'] ?? '') ?>">
        </div>

        <div class="field">
          <label for="answer">Answer <span class="required">*</span></label>
          <textarea class="textarea" rows="5" id="answer" name="answer"
                    required><?= Str::e($editFaq['answer'] ?? '') ?></textarea>
          <span class="hint">Plain text reads best in structured data. Keep it to two or three sentences.</span>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="category">Category</label>
            <select class="select" id="category" name="category">
              <?php foreach ($categories as $category): ?>
                <option value="<?= Str::e($category) ?>"
                        <?= ($editFaq['category'] ?? 'general') === $category ? 'selected' : '' ?>>
                  <?= Str::e(ucfirst($category)) ?>
                </option>
              <?php endforeach; ?>
            </select>
          </div>
          <div class="field">
            <label for="page_path">Show on path</label>
            <input class="input mono" id="page_path" name="page_path"
                   value="<?= Str::e($editFaq['page_path'] ?? '') ?>" placeholder="/pricing">
          </div>
          <div class="field">
            <label for="faq_sort">Order</label>
            <input class="input" type="number" id="faq_sort" name="sort_order"
                   value="<?= (int) ($editFaq['sort_order'] ?? 0) ?>">
          </div>
        </div>

        <label class="checkbox">
          <input type="checkbox" name="is_active" value="1"
                 <?= Str::bool($editFaq['is_active'] ?? true) ? 'checked' : '' ?>>
          Visible on the site
        </label>

        <button class="btn mt-3" type="submit"><?= $editFaq ? 'Save FAQ' : 'Add FAQ' ?></button>
      </div>
    </form>

    <div class="card mt-3">
      <div class="card-head"><h2><?= count($faqs) ?> FAQs</h2></div>
      <div class="card-body stack-sm">
        <?php $lastCategory = null; ?>
        <?php foreach ($faqs as $faq): ?>
          <?php if ($faq['category'] !== $lastCategory): ?>
            <p class="side-heading"><?= Str::e(ucfirst($faq['category'])) ?></p>
            <?php $lastCategory = $faq['category']; ?>
          <?php endif; ?>
          <div class="row-between" style="gap:0.75rem;align-items:flex-start">
            <div style="<?= Str::bool($faq['is_active']) ? '' : 'opacity:.5' ?>">
              <span class="bold small"><?= Str::e($faq['question']) ?></span>
              <span class="tiny muted" style="display:block"><?= Str::e(Str::excerpt($faq['answer'], 110)) ?></span>
              <?php if ($faq['page_path']): ?>
                <span class="tiny muted mono"><?= Str::e($faq['page_path']) ?></span>
              <?php endif; ?>
            </div>
            <div class="nowrap">
              <a class="btn btn-sm btn-outline" href="/admin/content?faq=<?= Str::e($faq['id']) ?>">Edit</a>
              <form method="post" style="display:inline">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="faq_toggle">
                <input type="hidden" name="id" value="<?= Str::e($faq['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">
                  <?= Str::bool($faq['is_active']) ? 'Hide' : 'Show' ?>
                </button>
              </form>
              <form method="post" style="display:inline" data-confirm="Delete this FAQ?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="faq_delete">
                <input type="hidden" name="id" value="<?= Str::e($faq['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">×</button>
              </form>
            </div>
          </div>
          <hr class="divider">
        <?php endforeach; ?>
        <?php if ($faqs === []): ?><p class="small muted">No FAQs yet.</p><?php endif; ?>
      </div>
    </div>
  </div>

  <!-- ---------------------------------------------------- Testimonials -->
  <div>
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="testimonial_save">
      <input type="hidden" name="id" value="<?= Str::e($editTestimonial['id'] ?? '') ?>">

      <div class="card-head">
        <h2><?= $editTestimonial ? 'Edit testimonial' : 'Add a testimonial' ?></h2>
        <?php if ($editTestimonial): ?><a class="small" href="/admin/content">Cancel</a><?php endif; ?>
      </div>

      <div class="card-body">
        <div class="field-row">
          <div class="field">
            <label for="author_name">Author <span class="required">*</span></label>
            <input class="input" id="author_name" name="author_name" required maxlength="120"
                   value="<?= Str::e($editTestimonial['author_name'] ?? '') ?>">
          </div>
          <div class="field">
            <label for="author_role">Role</label>
            <input class="input" id="author_role" name="author_role" maxlength="120"
                   value="<?= Str::e($editTestimonial['author_role'] ?? '') ?>" placeholder="Together 6 years">
          </div>
        </div>

        <div class="field-row">
          <div class="field">
            <label for="author_location">Location</label>
            <input class="input" id="author_location" name="author_location" maxlength="120"
                   value="<?= Str::e($editTestimonial['author_location'] ?? '') ?>" placeholder="Manchester, UK">
          </div>
          <div class="field">
            <label for="rating">Rating</label>
            <select class="select" id="rating" name="rating">
              <?php for ($star = 5; $star >= 1; $star--): ?>
                <option value="<?= $star ?>" <?= (int) ($editTestimonial['rating'] ?? 5) === $star ? 'selected' : '' ?>>
                  <?= str_repeat('★', $star) ?>
                </option>
              <?php endfor; ?>
            </select>
          </div>
          <div class="field">
            <label for="t_sort">Order</label>
            <input class="input" type="number" id="t_sort" name="sort_order"
                   value="<?= (int) ($editTestimonial['sort_order'] ?? 0) ?>">
          </div>
        </div>

        <div class="field">
          <label for="quote">Quote <span class="required">*</span></label>
          <textarea class="textarea" rows="4" id="quote" name="quote"
                    required><?= Str::e($editTestimonial['quote'] ?? '') ?></textarea>
        </div>

        <div class="field">
          <label for="avatar_url">Avatar URL</label>
          <input class="input" id="avatar_url" name="avatar_url"
                 value="<?= Str::e($editTestimonial['avatar_url'] ?? '') ?>">
          <span class="hint">Leave blank to show coloured initials instead.</span>
        </div>

        <div class="row">
          <label class="checkbox">
            <input type="checkbox" name="is_featured" value="1"
                   <?= Str::bool($editTestimonial['is_featured'] ?? false) ? 'checked' : '' ?>>
            Featured
          </label>
          <label class="checkbox">
            <input type="checkbox" name="is_active" value="1"
                   <?= Str::bool($editTestimonial['is_active'] ?? true) ? 'checked' : '' ?>>
            Visible
          </label>
        </div>

        <button class="btn mt-3" type="submit"><?= $editTestimonial ? 'Save testimonial' : 'Add testimonial' ?></button>
      </div>
    </form>

    <div class="card mt-3">
      <div class="card-head"><h2><?= count($testimonials) ?> testimonials</h2></div>
      <div class="card-body stack-sm">
        <?php foreach ($testimonials as $testimonial): ?>
          <div class="row-between" style="gap:0.75rem;align-items:flex-start">
            <div class="row" style="gap:0.6rem;<?= Str::bool($testimonial['is_active']) ? '' : 'opacity:.5' ?>">
              <?= View::avatar($testimonial['avatar_url'], $testimonial['author_name'], 36) ?>
              <div>
                <span class="bold small">
                  <?= Str::e($testimonial['author_name']) ?>
                  <span class="tiny" style="color:hsl(var(--warning))"><?= str_repeat('★', (int) $testimonial['rating']) ?></span>
                  <?php if (Str::bool($testimonial['is_featured'])): ?>
                    <span class="badge badge-primary">featured</span>
                  <?php endif; ?>
                </span>
                <span class="tiny muted" style="display:block"><?= Str::e(Str::excerpt($testimonial['quote'], 110)) ?></span>
              </div>
            </div>
            <div class="nowrap">
              <a class="btn btn-sm btn-outline"
                 href="/admin/content?testimonial=<?= Str::e($testimonial['id']) ?>">Edit</a>
              <form method="post" style="display:inline">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="testimonial_toggle">
                <input type="hidden" name="id" value="<?= Str::e($testimonial['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">
                  <?= Str::bool($testimonial['is_active']) ? 'Hide' : 'Show' ?>
                </button>
              </form>
              <form method="post" style="display:inline" data-confirm="Delete this testimonial?">
                <?= Csrf::field() ?>
                <input type="hidden" name="action" value="testimonial_delete">
                <input type="hidden" name="id" value="<?= Str::e($testimonial['id']) ?>">
                <button class="btn btn-sm btn-ghost" type="submit">×</button>
              </form>
            </div>
          </div>
          <hr class="divider">
        <?php endforeach; ?>
        <?php if ($testimonials === []): ?><p class="small muted">No testimonials yet.</p><?php endif; ?>
      </div>
    </div>
  </div>
</div>

<?php View::end(); ?>
