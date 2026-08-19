<?php
declare(strict_types=1);

if (Request::isPost()) {
    $name    = Request::input('name');
    $email   = strtolower(Request::input('email'));
    $subject = Request::input('subject');
    $message = Request::raw('message');
    $category = Request::input('category', 'general');

    // Honeypot: a bot fills this in, a person never sees it.
    if (Request::input('website') !== '') {
        Flash::success('Thanks — we will reply shortly.');
        Response::redirect('/contact');
    }

    if (mb_strlen($name) < 2 || !filter_var($email, FILTER_VALIDATE_EMAIL) || mb_strlen(trim($message)) < 10) {
        Flash::error('Please add your name, a valid email address and at least a sentence or two.');
        Flash::remember(Request::all());
        Response::redirect('/contact');
    }

    $saved = Db::insert('contact_messages', [
        'name'       => mb_substr($name, 0, 150),
        'email'      => $email,
        'subject'    => $subject !== '' ? mb_substr($subject, 0, 200) : null,
        'message'    => mb_substr($message, 0, 5000),
        'category'   => $category,
        'ip_address' => Request::ip(),
    ]);

    if ($saved === null) {
        Flash::error('We could not save that. Please try again in a moment.');
        Response::redirect('/contact');
    }

    Mailer::template('contact-received', $email, ['name' => $name]);

    Mailer::notifyAdmin(
        'New contact message: ' . ($subject !== '' ? $subject : $category),
        '<p><strong>' . Str::e($name) . '</strong> (' . Str::e($email) . ') wrote:</p>'
        . '<p>' . nl2br(Str::e($message)) . '</p>'
    );

    Flash::clearOld();
    Flash::success('Thanks — your message is in. We reply within one business day.');
    Response::redirect('/contact');
}

Seo::breadcrumbs([['name' => 'Home', 'url' => '/'], ['name' => 'Contact', 'url' => '/contact']]);

View::begin('layouts/public', [
    'title'       => 'Contact us',
    'description' => 'Questions about FairCouples, billing, privacy or a partnership? Send a message and a human replies within one business day.',
]);
?>

<section class="section-tight">
  <div class="container">
    <div class="grid grid-sidebar">
      <div>
        <p class="eyebrow">Contact</p>
        <h1>Talk to a person</h1>
        <p class="muted mt-2" style="max-width:52ch">
          Support, billing, privacy requests, press or partnerships — this all reaches the same inbox,
          and a person answers it.
        </p>

        <form method="post" class="card mt-4">
          <?= Csrf::field() ?>
          <div class="card-body">
            <div class="field-row">
              <div class="field">
                <label for="name">Your name <span class="required">*</span></label>
                <input class="input" id="name" name="name" required maxlength="150"
                       value="<?= Str::e(Flash::old('name')) ?>" autocomplete="name">
              </div>
              <div class="field">
                <label for="email">Email <span class="required">*</span></label>
                <input class="input" type="email" id="email" name="email" required
                       value="<?= Str::e(Flash::old('email')) ?>" autocomplete="email">
              </div>
            </div>

            <div class="field-row">
              <div class="field">
                <label for="category">What is it about?</label>
                <select class="select" id="category" name="category">
                  <option value="general">General question</option>
                  <option value="billing">Billing or a refund</option>
                  <option value="technical">Something is broken</option>
                  <option value="privacy">Privacy or my data</option>
                  <option value="press">Press or partnership</option>
                </select>
              </div>
              <div class="field">
                <label for="subject">Subject</label>
                <input class="input" id="subject" name="subject" maxlength="200"
                       value="<?= Str::e(Flash::old('subject')) ?>">
              </div>
            </div>

            <div class="field">
              <label for="message">Message <span class="required">*</span></label>
              <textarea class="textarea" id="message" name="message" rows="6" required
                        minlength="10" maxlength="5000"><?= Str::e(Flash::old('message')) ?></textarea>
              <span class="hint">The more detail you give, the faster we can actually help.</span>
            </div>

            <div style="position:absolute;left:-9999px" aria-hidden="true">
              <label for="website">Leave this empty</label>
              <input id="website" name="website" tabindex="-1" autocomplete="off">
            </div>

            <button class="btn btn-lg mt-3" type="submit">Send message</button>
          </div>
        </form>
      </div>

      <aside class="stack">
        <div class="card">
          <div class="card-body">
            <h2 style="font-size:1rem">Direct</h2>
            <p class="small mt-2">
              <a href="mailto:<?= Str::e(Settings::text('support_email')) ?>">
                <?= Str::e(Settings::text('support_email')) ?>
              </a>
            </p>
            <?php if (Settings::text('contact_phone') !== ''): ?>
              <p class="small mt-1"><?= Str::e(Settings::text('contact_phone')) ?></p>
            <?php endif; ?>
            <?php if (Settings::text('company_address') !== ''): ?>
              <p class="small muted mt-2"><?= nl2br(Str::e(Settings::text('company_address'))) ?></p>
            <?php endif; ?>
          </div>
        </div>

        <div class="card">
          <div class="card-body">
            <h2 style="font-size:1rem">Faster answers</h2>
            <ul class="list-plain small mt-2">
              <li><a href="/faq">Frequently asked questions</a></li>
              <li><a href="/pricing">Plans and billing</a></li>
              <li><a href="/privacy-policy">Privacy policy</a></li>
              <li><a href="/terms-of-service">Terms of service</a></li>
            </ul>
          </div>
        </div>

        <div class="alert alert-warning">
          <div>
            <strong>If you are in danger</strong>
            FairCouples is a measurement tool, not a crisis service. Contact your local emergency
            number or a domestic abuse helpline.
          </div>
        </div>
      </aside>
    </div>
  </div>
</section>

<?php View::end(); ?>
