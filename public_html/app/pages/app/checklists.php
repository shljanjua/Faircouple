<?php
declare(strict_types=1);

$user     = Auth::require();
$context  = Auth::requireCouple();
$coupleId = $context['couple']['id'];

if (Request::isPost()) {
    $action = Request::input('action');

    if ($action === 'create') {
        $limitError = Plans::check('checklists', 'checklists', 'archived_at IS NULL');
        if ($limitError !== null) {
            Flash::error($limitError);
            Response::redirect('/dashboard/checklists');
        }

        $templateId = Request::nullable('template_id');
        $title    = Request::input('title');
        $category = Request::input('category', 'relationship');
        $emoji    = Request::nullable('emoji');
        $items    = [];

        if ($templateId !== null) {
            $template = Db::one('SELECT * FROM checklist_templates WHERE id = ? LIMIT 1', [$templateId]);
            if ($template) {
                $title    = $title !== '' ? $title : $template['name'];
                $category = $template['category'];
                $emoji    = $template['emoji'];
                $items    = Str::json($template['items']);
            }
        }

        if ($title === '') {
            Flash::error('Give the checklist a name.');
            Response::redirect('/dashboard/checklists');
        }

        $checklistId = Db::insert('checklists', [
            'couple_id'   => $coupleId,
            'trip_id'     => Request::nullable('trip_id'),
            'template_id' => $templateId,
            'title'       => mb_substr($title, 0, 150),
            'category'    => $category,
            'emoji'       => $emoji,
            'description' => Request::nullable('description'),
            'due_date'    => Request::date('due_date'),
            'created_by'  => $user['id'],
        ]);

        foreach ($items as $index => $item) {
            Db::insert('checklist_items', [
                'checklist_id' => $checklistId,
                'title'        => mb_substr((string) ($item['name'] ?? $item['title'] ?? 'Item'), 0, 250),
                'category'     => $item['category'] ?? null,
                'priority'     => !empty($item['essential']) ? 'high' : 'normal',
                'sort_order'   => $index,
            ]);
        }

        Flash::success('Checklist created.');
        Response::redirect('/dashboard/checklists#list-' . $checklistId);
    }

    if ($action === 'add_item') {
        $checklistId = Request::input('checklist_id');
        if (!Auth::ownsRow('checklists', $checklistId)) {
            Response::forbidden();
        }

        $title = Request::input('title');
        if ($title !== '') {
            Db::insert('checklist_items', [
                'checklist_id' => $checklistId,
                'title'        => mb_substr($title, 0, 250),
                'category'     => Request::nullable('item_category'),
                'quantity'     => max(1, Request::int('quantity', 1)),
                'assigned_to'  => Request::nullable('assigned_to'),
                'priority'     => Request::input('priority', 'normal'),
                'due_date'     => Request::date('item_due'),
            ]);
        }

        Response::redirect('/dashboard/checklists#list-' . $checklistId);
    }

    if ($action === 'toggle') {
        $itemId = Request::input('id');
        $owned = Db::one(
            'SELECT i.id, i.checklist_id, i.is_done FROM checklist_items i
               JOIN checklists l ON l.id = i.checklist_id
              WHERE i.id = ? AND l.couple_id = ? LIMIT 1',
            [$itemId, $coupleId]
        );

        if ($owned) {
            $done = !Str::bool($owned['is_done']);
            Db::run(
                'UPDATE checklist_items SET is_done = ?, done_by = ?, done_at = ? WHERE id = ?',
                [$done ? 1 : 0, $done ? $user['id'] : null, $done ? Str::now() : null, $itemId]
            );
            Response::redirect('/dashboard/checklists#list-' . $owned['checklist_id']);
        }

        Response::redirect('/dashboard/checklists');
    }

    if ($action === 'delete_item') {
        Db::run(
            'DELETE i FROM checklist_items i JOIN checklists l ON l.id = i.checklist_id
              WHERE i.id = ? AND l.couple_id = ?',
            [Request::input('id'), $coupleId]
        );
        Response::redirect('/dashboard/checklists');
    }

    if ($action === 'delete_list') {
        Db::delete('checklists', 'id = ? AND couple_id = ?', [Request::input('id'), $coupleId]);
        Flash::success('Checklist deleted.');
        Response::redirect('/dashboard/checklists');
    }
}

$checklists = Db::all(
    'SELECT * FROM checklists WHERE couple_id = ? AND archived_at IS NULL ORDER BY created_at DESC',
    [$coupleId]
);

$items = [];
if ($checklists !== []) {
    $ids = array_column($checklists, 'id');
    $rows = Db::all(
        'SELECT i.*, p.display_name, p.full_name
           FROM checklist_items i
           LEFT JOIN profiles p ON p.id = i.assigned_to
          WHERE i.checklist_id IN (' . Db::placeholders($ids) . ')
          ORDER BY i.is_done ASC, i.sort_order ASC, i.created_at ASC',
        $ids
    );
    foreach ($rows as $row) {
        $items[$row['checklist_id']][] = $row;
    }
}

$templates = Db::all('SELECT id, name, emoji, category, is_premium FROM checklist_templates WHERE is_public = 1 ORDER BY sort_order ASC');
$trips = Db::all('SELECT id, title FROM trips WHERE couple_id = ? AND status <> "cancelled" ORDER BY start_date DESC', [$coupleId]);

$preselect = (string) ($_GET['template'] ?? '');

View::begin('layouts/app', ['title' => 'Checklists', 'no_index' => true]);
?>

<div class="page-head">
  <h1>Checklists</h1>
  <p>Packing, travel admin and relationship rituals. Assign items to each other so it is clear who is doing what.</p>
</div>

<div class="grid grid-sidebar">
  <div class="stack">
    <?php if ($checklists === []): ?>
      <div class="card"><div class="card-body empty">
        <p class="empty-emoji">✅</p>
        <p class="bold">No checklists yet</p>
        <p>Start from a template on the right — there are packing lists for every climate, plus the weekly fairness ritual.</p>
      </div></div>
    <?php endif; ?>

    <?php foreach ($checklists as $checklist): ?>
      <?php
      $rows = $items[$checklist['id']] ?? [];
      $done = count(array_filter($rows, static fn ($row) => Str::bool($row['is_done'])));
      $percent = $rows === [] ? 0 : ($done / count($rows)) * 100;
      ?>
      <section class="card" id="list-<?= Str::e($checklist['id']) ?>">
        <div class="card-head">
          <div>
            <h2>
              <span style="font-size:1.2rem"><?= Str::e($checklist['emoji']) ?></span>
              <?= Str::e($checklist['title']) ?>
            </h2>
            <p class="tiny muted">
              <?= $done ?> of <?= count($rows) ?> done
              <?php if ($checklist['due_date']): ?> · due <?= Str::e(Str::date($checklist['due_date'])) ?><?php endif; ?>
            </p>
          </div>

          <form method="post" data-confirm="Delete this whole checklist?">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="delete_list">
            <input type="hidden" name="id" value="<?= Str::e($checklist['id']) ?>">
            <button class="btn btn-sm btn-ghost" type="submit">Delete</button>
          </form>
        </div>

        <div class="card-body">
          <?= View::meter($percent, 100, $percent === 100.0 ? 'success' : 'primary') ?>

          <?php if ($checklist['description']): ?>
            <p class="small muted mt-2"><?= Str::e($checklist['description']) ?></p>
          <?php endif; ?>

          <ul class="list-plain mt-3">
            <?php foreach ($rows as $item): ?>
              <li class="row-between" style="gap:0.5rem;padding-block:0.2rem">
                <form method="post" class="row" style="gap:0.6rem;flex:1;min-width:0">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="toggle">
                  <input type="hidden" name="id" value="<?= Str::e($item['id']) ?>">
                  <button type="submit" class="btn btn-ghost btn-icon" aria-label="Toggle">
                    <?= Str::bool($item['is_done']) ? '☑' : '☐' ?>
                  </button>
                  <span class="small <?= Str::bool($item['is_done']) ? 'muted' : '' ?>"
                        style="<?= Str::bool($item['is_done']) ? 'text-decoration:line-through' : '' ?>">
                    <?= Str::e($item['title']) ?>
                    <?php if ((int) $item['quantity'] > 1): ?> ×<?= (int) $item['quantity'] ?><?php endif; ?>
                    <?php if ($item['priority'] === 'high' || $item['priority'] === 'critical'): ?>
                      <span class="badge badge-danger">essential</span>
                    <?php endif; ?>
                    <?php if ($item['display_name'] || $item['full_name']): ?>
                      <span class="tiny muted">· <?= Str::e($item['display_name'] ?: $item['full_name']) ?></span>
                    <?php endif; ?>
                  </span>
                </form>

                <form method="post">
                  <?= Csrf::field() ?>
                  <input type="hidden" name="action" value="delete_item">
                  <input type="hidden" name="id" value="<?= Str::e($item['id']) ?>">
                  <button class="btn btn-sm btn-ghost" type="submit" aria-label="Remove item">✕</button>
                </form>
              </li>
            <?php endforeach; ?>
          </ul>

          <form method="post" class="row mt-3" style="flex-wrap:nowrap;gap:0.5rem">
            <?= Csrf::field() ?>
            <input type="hidden" name="action" value="add_item">
            <input type="hidden" name="checklist_id" value="<?= Str::e($checklist['id']) ?>">

            <label class="sr-only" for="add-<?= Str::e($checklist['id']) ?>">New item</label>
            <input class="input" id="add-<?= Str::e($checklist['id']) ?>" name="title"
                   placeholder="Add an item…" maxlength="250" style="flex:1">

            <label class="sr-only" for="assign-<?= Str::e($checklist['id']) ?>">Assign to</label>
            <select class="select" id="assign-<?= Str::e($checklist['id']) ?>" name="assigned_to" style="width:auto">
              <option value="">Anyone</option>
              <?php foreach ($context['members'] as $member): ?>
                <option value="<?= Str::e($member['user_id']) ?>">
                  <?= Str::e($member['display_name'] ?: $member['full_name'] ?: 'Member') ?>
                </option>
              <?php endforeach; ?>
            </select>

            <button class="btn btn-icon" type="submit" aria-label="Add">+</button>
          </form>
        </div>
      </section>
    <?php endforeach; ?>
  </div>

  <aside class="stack">
    <form method="post" class="card">
      <?= Csrf::field() ?>
      <input type="hidden" name="action" value="create">

      <div class="card-head"><h2>New checklist</h2></div>
      <div class="card-body">
        <div class="field">
          <label for="template_id">Start from a template</label>
          <select class="select" id="template_id" name="template_id">
            <option value="">Blank list</option>
            <?php foreach ($templates as $template): ?>
              <option value="<?= Str::e($template['id']) ?>" <?= $preselect === $template['id'] ? 'selected' : '' ?>>
                <?= Str::e($template['emoji'] . ' ' . $template['name']) ?>
              </option>
            <?php endforeach; ?>
          </select>
        </div>

        <div class="field">
          <label for="title">Name</label>
          <input class="input" id="title" name="title" maxlength="150" placeholder="Leave blank to use the template name">
        </div>

        <div class="field">
          <label for="category">Category</label>
          <select class="select" id="category" name="category">
            <option value="relationship">Relationship</option>
            <option value="packing">Packing</option>
            <option value="travel">Travel admin</option>
            <option value="honeymoon">Honeymoon</option>
            <option value="money">Money</option>
          </select>
        </div>

        <?php if ($trips !== []): ?>
          <div class="field">
            <label for="trip_id">Attach to a trip</label>
            <select class="select" id="trip_id" name="trip_id">
              <option value="">Not trip-specific</option>
              <?php foreach ($trips as $trip): ?>
                <option value="<?= Str::e($trip['id']) ?>"><?= Str::e($trip['title']) ?></option>
              <?php endforeach; ?>
            </select>
          </div>
        <?php endif; ?>

        <div class="field">
          <label for="due_date">Due date</label>
          <input class="input" type="date" id="due_date" name="due_date">
        </div>

        <button class="btn btn-block mt-2" type="submit">Create checklist</button>
      </div>
    </form>

    <div class="card">
      <div class="card-body">
        <h2 style="font-size:1rem">Browse the templates</h2>
        <p class="small muted mt-2">
          Fourteen ready-made lists: beach, city, winter, hiking, tech, health, honeymoon, pre-flight,
          plus the weekly fairness ritual and the repair conversation.
        </p>
        <a class="btn btn-sm btn-outline mt-2" href="/checklists" target="_blank">See what is in each one</a>
      </div>
    </div>
  </aside>
</div>

<?php View::end(); ?>
