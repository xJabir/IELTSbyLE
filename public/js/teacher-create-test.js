let profile;
const testId = new URLSearchParams(location.search).get('testId');
let state = null; // { test, passages, sections, writingTasks }

// Which items are currently open in an inline "edit" form. Kept outside
// `state` so toggling edit mode doesn't require a server round-trip —
// we just re-render the affected tab.
const editingPassages = new Set();
const editingReadingQuestions = new Set();
const editingSections = new Set();
const editingListeningQuestions = new Set();
const editingWritingTasks = new Set();

(async () => {
  profile = await Auth.requireRole('teacher');
  if (!profile) return;
  document.getElementById('userName').textContent = profile.name;
  document.getElementById('logoutLink').addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
  document.querySelectorAll('.tabs button').forEach(btn => btn.addEventListener('click', () => switchTab(btn.dataset.tab)));
  document.getElementById('publishBtn').addEventListener('click', togglePublish);
  loadAll();
})();

function esc(s) { return escapeHtml(s); }

async function loadAll() {
  const { data: test } = await supabase.from('tests').select('*').eq('id', testId).single();

  const { data: passages } = await supabase
    .from('reading_passages').select('*, reading_questions(*)').eq('test_id', testId);
  (passages || []).sort((a, b) => a.order_num - b.order_num);
  (passages || []).forEach(p => (p.questions = (p.reading_questions || []).slice().sort((a, b) => a.order_num - b.order_num)));

  const { data: sections } = await supabase
    .from('listening_sections').select('*, listening_questions(*)').eq('test_id', testId);
  (sections || []).sort((a, b) => a.order_num - b.order_num);
  (sections || []).forEach(s => (s.questions = (s.listening_questions || []).slice().sort((a, b) => a.order_num - b.order_num)));

  const { data: writingTasks } = await supabase
    .from('writing_tasks').select('*').eq('test_id', testId);
  (writingTasks || []).sort((a, b) => a.task_number - b.task_number);

  state = { test, passages: passages || [], sections: sections || [], writingTasks: writingTasks || [] };
  renderAll();
}

function renderAll() {
  document.getElementById('testTitleHeading').textContent = state.test.title;
  document.getElementById('publishBadge').innerHTML = state.test.published
    ? '<span class="badge done">Published — visible to students</span>'
    : '<span class="badge pending">Draft — not visible yet</span>';
  document.getElementById('publishBtn').textContent = state.test.published ? 'Unpublish' : 'Publish';
  renderDetails();
  renderReading();
  renderListening();
  renderWriting();
  applyTabVisibility();
}

function applyTabVisibility() {
  const type = state.test.test_type || 'full';
  const map = { reading: ['reading'], listening: ['listening'], writing: ['writing'], full: ['reading', 'listening', 'writing'] };
  const visible = map[type] || map.full;
  document.querySelectorAll('.tabs button[data-tab]').forEach(btn => {
    if (btn.dataset.tab === 'details') return;
    btn.style.display = visible.includes(btn.dataset.tab) ? '' : 'none';
  });
  const activeBtn = document.querySelector('.tabs button.active');
  if (activeBtn && activeBtn.style.display === 'none') switchTab('details');
}

function switchTab(tab) {
  document.querySelectorAll('.tabs button').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  ['details', 'reading', 'listening', 'writing'].forEach(t => {
    document.getElementById(`tab-${t}`).style.display = t === tab ? 'block' : 'none';
  });
}

async function togglePublish() {
  const { error } = await supabase.from('tests').update({ published: !state.test.published }).eq('id', testId);
  if (error) { alert(error.message); return; }
  await loadAll();
}

// ============================= DETAILS =============================

function renderDetails() {
  const t = state.test;
  const type = t.test_type || 'full';
  document.getElementById('tab-details').innerHTML = `
    <div class="panel">
      <h2>Test details</h2>
      <div class="field"><label>Title</label><input id="d-title" type="text" value="${esc(t.title)}"></div>
      <div class="field"><label>Description</label><input id="d-desc" type="text" value="${esc(t.description)}"></div>
      <div class="field">
        <label>Test type</label>
        <select id="d-type">
          <option value="full" ${type === 'full' ? 'selected' : ''}>Full Mock Test (Reading + Listening + Writing)</option>
          <option value="reading" ${type === 'reading' ? 'selected' : ''}>Reading only</option>
          <option value="listening" ${type === 'listening' ? 'selected' : ''}>Listening only</option>
          <option value="writing" ${type === 'writing' ? 'selected' : ''}>Writing only</option>
        </select>
      </div>
      <div class="field">
        <label>Access</label>
        <select id="d-locked">
          <option value="true" ${t.is_locked ? 'selected' : ''}>🔒 Enrolled students only (locked)</option>
          <option value="false" ${!t.is_locked ? 'selected' : ''}>🔓 Free for everyone, including free accounts</option>
        </select>
        <p style="font-size:12px;color:var(--ink-soft);margin-top:6px;">Free accounts always see this test in their list, but can only start it if it's unlocked.</p>
      </div>
      <div class="inline-row" style="margin-top:20px;">
        <div class="field"><label>Listening (min)</label><input id="d-listen" type="number" min="1" value="${t.listening_duration_min}"></div>
        <div class="field"><label>Reading (min)</label><input id="d-read" type="number" min="1" value="${t.reading_duration_min}"></div>
        <div class="field"><label>Writing (min)</label><input id="d-write" type="number" min="1" value="${t.writing_duration_min}"></div>
      </div>
      <div class="submit-row"><button class="button primary" id="saveDetailsBtn" style="padding:10px 20px;">Save details</button></div>
    </div>
  `;
  document.getElementById('saveDetailsBtn').addEventListener('click', async () => {
        const { error } = await supabase.from('tests').update({
      title: document.getElementById('d-title').value,
      description: document.getElementById('d-desc').value,
      test_type: document.getElementById('d-type').value,
      is_locked: document.getElementById('d-locked').value === 'true',
      listening_duration_min: Number(document.getElementById('d-listen').value),
      reading_duration_min: Number(document.getElementById('d-read').value),
      writing_duration_min: Number(document.getElementById('d-write').value)
    }).eq('id', testId);
    if (error) { alert(error.message); return; }
    await loadAll();
  });
}

// ============================= TABLE / NOTE LAYOUT =============================
// An optional richer view for a passage/section: instead of showing its
// "layout_blank" questions as a plain list, render them woven into a table
// or a flowing note/sentence-completion paragraph — same as real IELTS
// "complete the table/notes" tasks. Each blank still IS an ordinary question
// row (type 'layout_blank'); the layout JSON just says where each one's
// input box sits and what surrounding text/table cells to show around it.
// Grading is untouched — students still submit {question_id, answer_text}.

const draftLayouts = new Map(); // containerId -> layout object currently being edited

function blankQuestionsFor(container) {
  return (container.questions || []).filter(q => q.question_type === 'layout_blank');
}

function usedBlankIds(layout) {
  const used = new Set();
  const walk = parts => (parts || []).forEach(p => { if (p.type === 'blank' && p.question_id) used.add(p.question_id); });
  if (layout && layout.type === 'note') walk(layout.parts);
  if (layout && layout.type === 'table') (layout.rows || []).forEach(row => (row || []).forEach(walk));
  return used;
}

function getParts(draft, path) {
  if (path === 'note') { draft.parts = draft.parts || []; return draft.parts; }
  const [, rStr, cStr] = path.split(':');
  const r = Number(rStr), c = Number(cStr);
  draft.rows[r] = draft.rows[r] || [];
  draft.rows[r][c] = draft.rows[r][c] || [];
  return draft.rows[r][c];
}

function partsPreviewHtml(parts, blanksById) {
  return (parts || []).map(p => {
    if (p.type === 'blank') {
      const q = blanksById.get(p.question_id);
      return `<span style="display:inline-block;min-width:70px;border-bottom:2px solid var(--builder-blue,#142b5f);color:var(--builder-blue,#142b5f);font-weight:700;">${q ? esc(q.correct_answer) : '(unlinked)'}</span>`;
    }
    return esc(p.value || '');
  }).join('');
}

function layoutPreviewHtml(layout, container) {
  const blanksById = new Map((container.questions || []).map(q => [q.id, q]));
  if (!layout || !layout.type || layout.type === 'none') {
    return '<p style="font-size:13px;color:var(--ink-soft, #667085);">No layout yet — its "layout blank" questions (if any) are just shown as a plain list to students.</p>';
  }
  if (layout.type === 'note') {
    return `
      ${layout.intro ? `<p style="font-size:13px;font-weight:600;margin-bottom:8px;">${esc(layout.intro)}</p>` : ''}
      <p style="font-size:14px;line-height:1.9;">${partsPreviewHtml(layout.parts, blanksById)}</p>
    `;
  }
  return `
    ${layout.intro ? `<p style="font-size:13px;font-weight:600;margin-bottom:8px;">${esc(layout.intro)}</p>` : ''}
    <table style="width:100%;border-collapse:collapse;font-size:13px;">
      <tr>${(layout.columns || []).map(c => `<th style="text-align:left;border:1px solid var(--builder-border,#e7ebf2);padding:6px;">${esc(c)}</th>`).join('')}</tr>
      ${(layout.rows || []).map(row => `<tr>${(row || []).map(cell => `<td style="border:1px solid var(--builder-border,#e7ebf2);padding:6px;">${partsPreviewHtml(cell, blanksById)}</td>`).join('')}</tr>`).join('')}
    </table>
  `;
}

function partsListHtml(draft, path, blanks) {
  const parts = getParts(draft, path);
  const used = usedBlankIds(draft);
  const options = blanks.length
    ? blanks.map(q => {
        const disabled = used.has(q.id);
        return `<option value="${q.id}" ${disabled ? 'disabled' : ''}>${esc(q.question_text).slice(0, 40)} → ${esc(q.correct_answer)}${disabled ? ' (already placed)' : ''}</option>`;
      }).join('')
    : '';
  return `
    <div style="display:flex;flex-wrap:wrap;gap:6px;align-items:center;margin:6px 0;">
      ${parts.length ? parts.map((p, i) => `
        <span style="display:inline-flex;align-items:center;gap:5px;background:${p.type === 'blank' ? '#eef3ff' : '#f3f4f7'};border-radius:6px;padding:4px 8px;font-size:12px;">
          ${p.type === 'blank' ? '⬚ ' + esc((blanks.find(b => b.id === p.question_id) || {}).correct_answer || 'unlinked') : esc(p.value)}
          <button type="button" data-part-remove="${path}::${i}" style="border:0;background:none;color:var(--builder-red,#e63946);cursor:pointer;font-weight:800;">×</button>
        </span>
      `).join('') : '<span style="font-size:12px;color:var(--ink-soft,#667085);">Nothing here yet.</span>'}
    </div>
    <div style="display:flex;gap:6px;flex-wrap:wrap;align-items:center;">
      <input type="text" data-part-text-input="${path}" placeholder="Add text…" style="flex:1;min-width:120px;padding:6px 8px;">
      <button type="button" class="small-btn" data-part-add-text="${path}">+ Text</button>
      ${blanks.length ? `
        <select data-part-blank-select="${path}" style="padding:6px 8px;">${options}</select>
        <button type="button" class="small-btn" data-part-add-blank="${path}">+ Blank</button>
      ` : `<span style="font-size:11px;color:var(--ink-soft,#667085);">Add a "layout blank" question below to insert a blank here.</span>`}
    </div>
  `;
}

function tableEditorHtml(draft, blanks) {
  draft.columns = draft.columns && draft.columns.length ? draft.columns : ['Column 1'];
  draft.rows = draft.rows && draft.rows.length ? draft.rows : [draft.columns.map(() => [])];
  return `
    <div style="margin:10px 0;">
      <label style="font-size:12px;font-weight:700;">Columns</label>
      <div style="display:flex;gap:6px;flex-wrap:wrap;margin:6px 0;">
        ${draft.columns.map((c, ci) => `
          <span style="display:inline-flex;gap:4px;align-items:center;">
            <input type="text" data-col-input="${ci}" value="${esc(c)}" style="width:130px;padding:5px 7px;">
            <button type="button" class="small-btn danger" data-col-remove="${ci}">×</button>
          </span>
        `).join('')}
      </div>
      <button type="button" class="small-btn" data-col-add>+ Add column</button>
      <button type="button" class="small-btn" data-row-add style="margin-left:6px;">+ Add row</button>
    </div>
    ${draft.rows.map((row, ri) => `
      <div style="border:1px solid var(--builder-border,#e7ebf2);border-radius:8px;padding:10px;margin-bottom:10px;">
        <div style="display:flex;justify-content:space-between;align-items:center;">
          <strong style="font-size:12px;">Row ${ri + 1}</strong>
          <button type="button" class="small-btn danger" data-row-remove="${ri}">Delete row</button>
        </div>
        ${draft.columns.map((c, ci) => `
          <div style="margin-top:8px;">
            <label style="font-size:11px;color:var(--ink-soft,#667085);">${esc(c)}</label>
            ${partsListHtml(draft, `cell:${ri}:${ci}`, blanks)}
          </div>
        `).join('')}
      </div>
    `).join('')}
  `;
}

function layoutEditorHtml(container, kind) {
  const cid = container.id;
  const draft = draftLayouts.get(cid);
  const blanks = blankQuestionsFor(container);
  return `
    <div class="field">
      <label>Layout type</label>
      <select data-layout-type="${cid}">
        <option value="none" ${!draft.type || draft.type === 'none' ? 'selected' : ''}>None — plain question list</option>
        <option value="note" ${draft.type === 'note' ? 'selected' : ''}>Note / sentence completion (flowing text with blanks)</option>
        <option value="table" ${draft.type === 'table' ? 'selected' : ''}>Table completion (grid with blanks)</option>
      </select>
    </div>
    ${draft.type && draft.type !== 'none' ? `
      <div class="field"><label>Instructions shown above it (optional)</label><input type="text" data-layout-intro="${cid}" value="${esc(draft.intro || '')}" placeholder="e.g. Complete the notes below. Write NO MORE THAN TWO WORDS for each answer."></div>
    ` : ''}
    ${draft.type === 'note' ? `<label style="font-size:12px;font-weight:700;">Body</label>${partsListHtml(draft, 'note', blanks)}` : ''}
    ${draft.type === 'table' ? tableEditorHtml(draft, blanks) : ''}
    <div class="submit-row" style="gap:8px;margin-top:14px;">
      <button class="button primary" data-layout-save="${cid}" style="padding:9px 18px;">Save layout</button>
      <button class="small-btn" data-layout-cancel="${cid}">Cancel</button>
    </div>
  `;
}

function layoutPanelHtml(container, kind) {
  const cid = container.id;
  if (draftLayouts.has(cid)) {
    return `
      <div style="margin-top:16px;border-top:1px dashed var(--builder-border,#e7ebf2);padding-top:14px;">
        <strong style="font-size:13px;">Table / note layout</strong>
        ${layoutEditorHtml(container, kind)}
      </div>
    `;
  }
  return `
    <div style="margin-top:16px;border-top:1px dashed var(--builder-border,#e7ebf2);padding-top:14px;">
      <div style="display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:8px;">
        <strong style="font-size:13px;">Table / note layout</strong>
        <div style="display:flex;gap:8px;">
          ${container.layout
            ? `<button class="small-btn" data-layout-edit="${cid}">Edit layout</button><button class="small-btn danger" data-layout-remove="${cid}">Remove layout</button>`
            : `<button class="small-btn" data-layout-add="${cid}">+ Add table/note layout</button>`}
        </div>
      </div>
      ${layoutPreviewHtml(container.layout, container)}
    </div>
  `;
}

function wireLayoutPanel(el, container, kind) {
  const cid = container.id;
  const rerender = kind === 'reading' ? renderReading : renderListening;

  const addBtn = el.querySelector(`[data-layout-add="${cid}"]`);
  if (addBtn) addBtn.addEventListener('click', () => { draftLayouts.set(cid, { type: 'none' }); rerender(); });

  const editBtn = el.querySelector(`[data-layout-edit="${cid}"]`);
  if (editBtn) editBtn.addEventListener('click', () => {
    draftLayouts.set(cid, JSON.parse(JSON.stringify(container.layout || { type: 'none' })));
    rerender();
  });

  const removeBtn = el.querySelector(`[data-layout-remove="${cid}"]`);
  if (removeBtn) removeBtn.addEventListener('click', async () => {
    if (!confirm('Remove this table/note layout? The underlying blank questions are kept.')) return;
    const table = kind === 'reading' ? 'reading_passages' : 'listening_sections';
    const { error } = await supabase.from(table).update({ layout: null }).eq('id', cid);
    if (error) { alert(error.message); return; }
    await loadAll();
    switchTab(kind);
  });

  if (!draftLayouts.has(cid)) return;
  const draft = draftLayouts.get(cid);
  const blanks = blankQuestionsFor(container);

  const typeSel = el.querySelector(`[data-layout-type="${cid}"]`);
  if (typeSel) typeSel.addEventListener('change', () => {
    const v = typeSel.value;
    draftLayouts.set(cid,
      v === 'none' ? { type: 'none' } :
      v === 'note' ? { type: 'note', intro: draft.intro || '', parts: draft.parts || [] } :
      { type: 'table', intro: draft.intro || '', columns: draft.columns || ['Column 1'], rows: draft.rows || [] });
    rerender();
  });

  const introInput = el.querySelector(`[data-layout-intro="${cid}"]`);
  if (introInput) introInput.addEventListener('input', () => { draft.intro = introInput.value; });

  el.querySelectorAll('[data-part-add-text]').forEach(btn => btn.addEventListener('click', () => {
    const path = btn.dataset.partAddText;
    const input = el.querySelector(`[data-part-text-input="${path}"]`);
    const value = input.value.trim();
    if (!value) return;
    getParts(draft, path).push({ type: 'text', value });
    rerender();
  }));
  el.querySelectorAll('[data-part-add-blank]').forEach(btn => btn.addEventListener('click', () => {
    const path = btn.dataset.partAddBlank;
    const select = el.querySelector(`[data-part-blank-select="${path}"]`);
    if (!select || !select.value) return;
    getParts(draft, path).push({ type: 'blank', question_id: select.value });
    rerender();
  }));
  el.querySelectorAll('[data-part-remove]').forEach(btn => btn.addEventListener('click', () => {
    const [path, idxStr] = btn.dataset.partRemove.split('::');
    getParts(draft, path).splice(Number(idxStr), 1);
    rerender();
  }));

  el.querySelectorAll('[data-col-input]').forEach(inp => inp.addEventListener('input', () => {
    draft.columns[Number(inp.dataset.colInput)] = inp.value;
  }));
  el.querySelectorAll('[data-col-remove]').forEach(btn => btn.addEventListener('click', () => {
    const ci = Number(btn.dataset.colRemove);
    draft.columns.splice(ci, 1);
    (draft.rows || []).forEach(row => row.splice(ci, 1));
    rerender();
  }));
  const colAddBtn = el.querySelector('[data-col-add]');
  if (colAddBtn) colAddBtn.addEventListener('click', () => {
    draft.columns.push(`Column ${draft.columns.length + 1}`);
    (draft.rows || []).forEach(row => row.push([]));
    rerender();
  });
  const rowAddBtn = el.querySelector('[data-row-add]');
  if (rowAddBtn) rowAddBtn.addEventListener('click', () => {
    draft.rows = draft.rows || [];
    draft.rows.push(draft.columns.map(() => []));
    rerender();
  });
  el.querySelectorAll('[data-row-remove]').forEach(btn => btn.addEventListener('click', () => {
    draft.rows.splice(Number(btn.dataset.rowRemove), 1);
    rerender();
  }));

  const saveBtn = el.querySelector(`[data-layout-save="${cid}"]`);
  if (saveBtn) saveBtn.addEventListener('click', async () => {
    const table = kind === 'reading' ? 'reading_passages' : 'listening_sections';
    const payload = (!draft.type || draft.type === 'none') ? null : draft;
    const { error } = await supabase.from(table).update({ layout: payload }).eq('id', cid);
    if (error) { alert(error.message); return; }
    draftLayouts.delete(cid);
    await loadAll();
    switchTab(kind);
  });

  const cancelBtn = el.querySelector(`[data-layout-cancel="${cid}"]`);
  if (cancelBtn) cancelBtn.addEventListener('click', () => { draftLayouts.delete(cid); rerender(); });
}

// ============================= READING =============================

function renderReading() {
  const el = document.getElementById('tab-reading');
  el.innerHTML = `
    <div class="panel">
      <h2>Reading passages</h2>
      <p class="panel-sub">Add one panel per passage, then attach questions underneath it.</p>
      <div id="passageList"></div>
      <button class="small-btn" id="addPassageBtn" style="margin-top:14px;">+ Add passage</button>
    </div>
  `;
  const list = document.getElementById('passageList');
  list.innerHTML = state.passages.map((p, pi) => {
    const numOffset = state.passages.slice(0, pi).reduce((sum, pp) => sum + pp.questions.length, 0);
    const editingThisPassage = editingPassages.has(p.id);
    return `
    <div class="builder-item">
      <div class="builder-item-head">
        <span class="tag">Passage ${pi + 1}</span>
        <div style="display:flex;gap:8px;">
          ${editingThisPassage ? '' : `<button class="small-btn" data-edit-passage="${p.id}">Edit</button>`}
          <button class="small-btn danger" data-del-passage="${p.id}">Delete passage</button>
        </div>
      </div>
      ${editingThisPassage ? `
        <div class="field"><label>Title</label><input type="text" id="edit-p-title-${p.id}" value="${esc(p.title)}"></div>
        <div class="field"><label>Passage text</label><textarea rows="8" id="edit-p-text-${p.id}">${esc(p.passage_text)}</textarea></div>
        <div class="submit-row" style="gap:8px;">
          <button class="button primary" data-save-passage="${p.id}" style="padding:9px 18px;">Save</button>
          <button class="small-btn" data-cancel-passage="${p.id}">Cancel</button>
        </div>
      ` : `
        <div class="field"><label>Title</label><input type="text" value="${esc(p.title)}" disabled></div>
        <div class="field"><label>Passage text</label><textarea rows="4" disabled>${esc(p.passage_text)}</textarea></div>
      `}
      <div style="margin-top:14px;">
        <strong style="font-size:13px;">Questions (${p.questions.length})${p.questions.length ? ` — numbered ${numOffset + 1}–${numOffset + p.questions.length} on the real test` : ''}</strong>
        ${p.questions.map((q, qi) => {
          const editingThisQuestion = editingReadingQuestions.has(q.id);
          return editingThisQuestion
            ? questionEditFormHtml(q, 'reading')
            : `
          <div class="builder-item" style="background:#fff;">
            <div class="builder-item-head">
              <span class="tag">Q${numOffset + qi + 1} · ${esc(q.question_type)}</span>
              <div style="display:flex;gap:8px;">
                <button class="small-btn" data-edit-question="${q.id}" data-kind="reading">Edit</button>
                <button class="small-btn danger" data-del-question="${q.id}">Delete</button>
              </div>
            </div>
            <p style="font-size:14px;">${esc(q.question_text)}</p>
            <p style="font-size:13px;color:var(--ink-soft);">Answer: ${esc(q.correct_answer)}</p>
          </div>
        `;
        }).join('')}
      </div>
      ${layoutPanelHtml(p, 'reading')}
      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:14px;color:var(--seal);">+ Add a question to this passage</summary>
        ${questionFormHtml(p.id, 'reading')}
      </details>
    </div>
  `;
  }).join('') || '<p style="color:var(--ink-soft);font-size:14px;">No passages yet.</p>';

  document.getElementById('addPassageBtn').addEventListener('click', () => showPassageForm());
  list.querySelectorAll('[data-del-passage]').forEach(b => b.addEventListener('click', () => deletePassage(b.dataset.delPassage)));
  list.querySelectorAll('[data-edit-passage]').forEach(b => b.addEventListener('click', () => { editingPassages.add(b.dataset.editPassage); renderReading(); }));
  list.querySelectorAll('[data-cancel-passage]').forEach(b => b.addEventListener('click', () => { editingPassages.delete(b.dataset.cancelPassage); renderReading(); }));
  list.querySelectorAll('[data-save-passage]').forEach(b => b.addEventListener('click', () => savePassageEdit(b.dataset.savePassage)));
  list.querySelectorAll('[data-del-question]').forEach(b => b.addEventListener('click', () => deleteReadingQuestion(b.dataset.delQuestion)));
  list.querySelectorAll('[data-edit-question]').forEach(b => b.addEventListener('click', () => {
    (b.dataset.kind === 'reading' ? editingReadingQuestions : editingListeningQuestions).add(b.dataset.editQuestion);
    (b.dataset.kind === 'reading' ? renderReading : renderListening)();
  }));
  wireQuestionForms(el, 'reading');
  wireQuestionEditForms(el, 'reading');
  state.passages.forEach(p => wireLayoutPanel(list, p, 'reading'));
}

async function savePassageEdit(id) {
  const title = document.getElementById(`edit-p-title-${id}`).value.trim();
  const passage_text = document.getElementById(`edit-p-text-${id}`).value.trim();
  if (!title || !passage_text) return;
  const { error } = await supabase.from('reading_passages').update({ title, passage_text }).eq('id', id);
  if (error) { alert(error.message); return; }
  editingPassages.delete(id);
  await loadAll();
  switchTab('reading');
}

function showPassageForm() {
  const list = document.getElementById('passageList');
  const wrap = document.createElement('div');
  wrap.className = 'builder-item';
  wrap.innerHTML = `
    <div class="field"><label>Passage title</label><input type="text" id="new-p-title" placeholder="e.g. The Rise of Urban Beekeeping"></div>
    <div class="field"><label>Passage text</label><textarea id="new-p-text" rows="8" placeholder="Paste the full passage text"></textarea></div>
    <div class="submit-row"><button class="button primary" id="saveNewPassage" style="padding:9px 18px;">Add passage</button></div>
  `;
  list.appendChild(wrap);
  document.getElementById('saveNewPassage').addEventListener('click', async () => {
    const title = document.getElementById('new-p-title').value.trim();
    const passage_text = document.getElementById('new-p-text').value.trim();
    if (!title || !passage_text) return;
    const { error } = await supabase.from('reading_passages')
      .insert({ test_id: testId, title, passage_text, order_num: state.passages.length + 1 });
    if (error) { alert(error.message); return; }
    await loadAll();
    switchTab('reading');
  });
}

async function deletePassage(id) {
  if (!confirm('Delete this passage and all its questions?')) return;
  await supabase.from('reading_passages').delete().eq('id', id);
  editingPassages.delete(id);
  await loadAll();
  switchTab('reading');
}

async function deleteReadingQuestion(id) {
  await supabase.from('reading_questions').delete().eq('id', id);
  editingReadingQuestions.delete(id);
  await loadAll();
  switchTab('reading');
}

// ============================= LISTENING =============================

function renderListening() {
  const el = document.getElementById('tab-listening');
  el.innerHTML = `
    <div class="panel">
      <h2>Listening sections</h2>
      <p class="panel-sub">Upload one audio clip per section (mp3/wav/m4a/ogg), then attach its questions.</p>
      <div id="sectionList"></div>
      <button class="small-btn" id="addSectionBtn" style="margin-top:14px;">+ Add section</button>
    </div>
  `;
  const list = document.getElementById('sectionList');
  list.innerHTML = state.sections.map((s, si) => {
    const numOffset = state.sections.slice(0, si).reduce((sum, ss) => sum + ss.questions.length, 0);
    const editingThisSection = editingSections.has(s.id);
    return `
    <div class="builder-item">
      <div class="builder-item-head">
        ${editingThisSection
          ? `<input type="text" id="edit-s-title-${s.id}" value="${esc(s.title)}" style="flex:1;margin-right:10px;">`
          : `<span class="tag">Section ${si + 1}: ${esc(s.title)}</span>`}
        <div style="display:flex;gap:8px;">
          ${editingThisSection
            ? `<button class="button primary" data-save-section="${s.id}" style="padding:6px 14px;">Save</button>
               <button class="small-btn" data-cancel-section="${s.id}">Cancel</button>`
            : `<button class="small-btn" data-edit-section="${s.id}">Edit</button>`}
          <button class="small-btn danger" data-del-section="${s.id}">Delete section</button>
        </div>
      </div>
      <p style="font-size:13px;color:var(--ink-soft);">${s.audio_url ? `Audio attached ✓ <a href="${s.audio_url}" target="_blank">Preview</a>` : 'No audio uploaded yet'}</p>
      <input type="file" accept=".mp3,.wav,.m4a,.ogg,audio/*" data-upload-audio="${s.id}">
      <div style="margin-top:14px;">
        <strong style="font-size:13px;">Questions (${s.questions.length})${s.questions.length ? ` — numbered ${numOffset + 1}–${numOffset + s.questions.length} on the real test` : ''}</strong>
        ${s.questions.map((q, qi) => {
          const editingThisQuestion = editingListeningQuestions.has(q.id);
          return editingThisQuestion
            ? questionEditFormHtml(q, 'listening')
            : `
          <div class="builder-item" style="background:#fff;">
            <div class="builder-item-head">
              <span class="tag">Q${numOffset + qi + 1} · ${esc(q.question_type)}</span>
              <div style="display:flex;gap:8px;">
                <button class="small-btn" data-edit-question="${q.id}" data-kind="listening">Edit</button>
                <button class="small-btn danger" data-del-lquestion="${q.id}">Delete</button>
              </div>
            </div>
            <p style="font-size:14px;">${esc(q.question_text)}</p>
            <p style="font-size:13px;color:var(--ink-soft);">Answer: ${esc(q.correct_answer)}</p>
          </div>
        `;
        }).join('')}
      </div>
      ${layoutPanelHtml(s, 'listening')}
      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:14px;color:var(--seal);">+ Add a question to this section</summary>
        ${questionFormHtml(s.id, 'listening')}
      </details>
    </div>
  `;
  }).join('') || '<p style="color:var(--ink-soft);font-size:14px;">No sections yet.</p>';

  document.getElementById('addSectionBtn').addEventListener('click', () => showSectionForm());
  list.querySelectorAll('[data-del-section]').forEach(b => b.addEventListener('click', () => deleteSection(b.dataset.delSection)));
  list.querySelectorAll('[data-edit-section]').forEach(b => b.addEventListener('click', () => { editingSections.add(b.dataset.editSection); renderListening(); }));
  list.querySelectorAll('[data-cancel-section]').forEach(b => b.addEventListener('click', () => { editingSections.delete(b.dataset.cancelSection); renderListening(); }));
  list.querySelectorAll('[data-save-section]').forEach(b => b.addEventListener('click', () => saveSectionEdit(b.dataset.saveSection)));
  list.querySelectorAll('[data-del-lquestion]').forEach(b => b.addEventListener('click', () => deleteListeningQuestion(b.dataset.delLquestion)));
  list.querySelectorAll('[data-edit-question]').forEach(b => b.addEventListener('click', () => {
    (b.dataset.kind === 'reading' ? editingReadingQuestions : editingListeningQuestions).add(b.dataset.editQuestion);
    (b.dataset.kind === 'reading' ? renderReading : renderListening)();
  }));
  list.querySelectorAll('[data-upload-audio]').forEach(input => input.addEventListener('change', () => handleAudioUpload(input)));
  wireQuestionForms(el, 'listening');
  wireQuestionEditForms(el, 'listening');
  state.sections.forEach(s => wireLayoutPanel(list, s, 'listening'));
}

async function saveSectionEdit(id) {
  const title = document.getElementById(`edit-s-title-${id}`).value.trim();
  if (!title) return;
  const { error } = await supabase.from('listening_sections').update({ title }).eq('id', id);
  if (error) { alert(error.message); return; }
  editingSections.delete(id);
  await loadAll();
  switchTab('listening');
}

function showSectionForm() {
  const list = document.getElementById('sectionList');
  const wrap = document.createElement('div');
  wrap.className = 'builder-item';
  wrap.innerHTML = `
    <div class="field"><label>Section title</label><input type="text" id="new-s-title" placeholder="e.g. Section 1 — Booking a hotel room"></div>
    <div class="submit-row"><button class="button primary" id="saveNewSection" style="padding:9px 18px;">Add section</button></div>
  `;
  list.appendChild(wrap);
  document.getElementById('saveNewSection').addEventListener('click', async () => {
    const title = document.getElementById('new-s-title').value.trim();
    if (!title) return;
    const { error } = await supabase.from('listening_sections')
      .insert({ test_id: testId, title, order_num: state.sections.length + 1 });
    if (error) { alert(error.message); return; }
    await loadAll();
    switchTab('listening');
  });
}

async function deleteSection(id) {
  if (!confirm('Delete this section and all its questions?')) return;
  await supabase.from('listening_sections').delete().eq('id', id);
  editingSections.delete(id);
  await loadAll();
  switchTab('listening');
}

async function deleteListeningQuestion(id) {
  await supabase.from('listening_questions').delete().eq('id', id);
  editingListeningQuestions.delete(id);
  await loadAll();
  switchTab('listening');
}

async function handleAudioUpload(input) {
  const file = input.files[0];
  if (!file) return;
  const sectionId = input.dataset.uploadAudio;
  input.disabled = true;
  try {
    const ext = file.name.split('.').pop();
    const path = `${testId}/${sectionId}-${Date.now()}.${ext}`;
    const { error: uploadError } = await supabase.storage.from('listening-audio').upload(path, file, { upsert: true });
    if (uploadError) throw uploadError;
    const { data: pub } = supabase.storage.from('listening-audio').getPublicUrl(path);
    const { error: updateError } = await supabase.from('listening_sections').update({ audio_url: pub.publicUrl }).eq('id', sectionId);
    if (updateError) throw updateError;
    await loadAll();
    switchTab('listening');
  } catch (e) {
    alert(e.message);
    input.disabled = false;
  }
}

// ============================= WRITING =============================

function renderWriting() {
  const el = document.getElementById('tab-writing');
  const t1 = state.writingTasks.find(t => t.task_number === 1);
  const t2 = state.writingTasks.find(t => t.task_number === 2);
  el.innerHTML = `
    <div class="panel">
      <h2>Writing Task 1</h2>
      <p class="panel-sub">Usually a report, chart, or letter description. 150 words minimum is typical.</p>
      ${t1 ? renderTaskCard(t1) : writingTaskForm(1)}
    </div>
    <div class="panel">
      <h2>Writing Task 2</h2>
      <p class="panel-sub">An essay responding to an argument or question. 250 words minimum is typical.</p>
      ${t2 ? renderTaskCard(t2) : writingTaskForm(2)}
    </div>
  `;
  if (!t1) wireWritingForm(1);
  if (!t2) wireWritingForm(2);
  if (t1 && editingWritingTasks.has(t1.id)) wireWritingEditForm(t1);
  if (t2 && editingWritingTasks.has(t2.id)) wireWritingEditForm(t2);
  el.querySelectorAll('[data-del-task]').forEach(b => b.addEventListener('click', () => deleteWritingTask(b.dataset.delTask)));
  el.querySelectorAll('[data-edit-task]').forEach(b => b.addEventListener('click', () => { editingWritingTasks.add(b.dataset.editTask); renderWriting(); }));
  el.querySelectorAll('[data-cancel-task]').forEach(b => b.addEventListener('click', () => { editingWritingTasks.delete(b.dataset.cancelTask); renderWriting(); }));
}

function renderTaskCard(t) {
  if (editingWritingTasks.has(t.id)) {
    return `
      <div class="field"><label>Prompt</label><textarea id="editw-prompt-${t.id}" rows="4">${esc(t.prompt_text)}</textarea></div>
      <div class="inline-row" style="margin-top:14px;">
        <div class="field"><label>Image URL (optional, for charts)</label><input type="text" id="editw-image-${t.id}" value="${esc(t.image_url || '')}"></div>
        <div class="field" style="flex:0 0 140px;"><label>Min words</label><input type="number" id="editw-min-${t.id}" value="${t.min_words}"></div>
      </div>
      <div class="submit-row" style="gap:8px;">
        <button class="button primary" id="saveEditW-${t.id}" style="padding:9px 18px;">Save</button>
        <button class="small-btn" data-cancel-task="${t.id}">Cancel</button>
      </div>
    `;
  }
  return `
    <div class="builder-item">
      <div class="builder-item-head">
        <span class="tag">Min ${t.min_words} words</span>
        <div style="display:flex;gap:8px;">
          <button class="small-btn" data-edit-task="${t.id}">Edit</button>
          <button class="small-btn danger" data-del-task="${t.id}">Delete &amp; replace</button>
        </div>
      </div>
      <p style="font-size:14px;">${esc(t.prompt_text)}</p>
      ${t.image_url ? `<img src="${esc(t.image_url)}" style="max-width:280px;margin-top:10px;border:1px solid var(--line);">` : ''}
    </div>
  `;
}

function wireWritingEditForm(t) {
  const btn = document.getElementById(`saveEditW-${t.id}`);
  if (!btn) return;
  btn.addEventListener('click', async () => {
    const prompt_text = document.getElementById(`editw-prompt-${t.id}`).value.trim();
    if (!prompt_text) return;
    const { error } = await supabase.from('writing_tasks').update({
      prompt_text,
      image_url: document.getElementById(`editw-image-${t.id}`).value.trim(),
      min_words: Number(document.getElementById(`editw-min-${t.id}`).value) || t.min_words
    }).eq('id', t.id);
    if (error) { alert(error.message); return; }
    editingWritingTasks.delete(t.id);
    await loadAll();
    switchTab('writing');
  });
}

function writingTaskForm(num) {
  return `
    <div class="field"><label>Prompt</label><textarea id="w${num}-prompt" rows="4" placeholder="Task ${num} prompt text"></textarea></div>
    <div class="inline-row" style="margin-top:14px;">
      <div class="field"><label>Image URL (optional, for charts)</label><input type="text" id="w${num}-image" placeholder="https://..."></div>
      <div class="field" style="flex:0 0 140px;"><label>Min words</label><input type="number" id="w${num}-min" value="${num === 1 ? 150 : 250}"></div>
    </div>
    <div class="submit-row"><button class="button primary" id="saveW${num}" style="padding:9px 18px;">Add Task ${num}</button></div>
  `;
}

function wireWritingForm(num) {
  document.getElementById(`saveW${num}`).addEventListener('click', async () => {
    const prompt_text = document.getElementById(`w${num}-prompt`).value.trim();
    if (!prompt_text) return;
    const { error } = await supabase.from('writing_tasks').insert({
      test_id: testId,
      task_number: num,
      prompt_text,
      image_url: document.getElementById(`w${num}-image`).value.trim(),
      min_words: Number(document.getElementById(`w${num}-min`).value) || (num === 1 ? 150 : 250)
    });
    if (error) { alert(error.message); return; }
    await loadAll();
    switchTab('writing');
  });
}

async function deleteWritingTask(id) {
  await supabase.from('writing_tasks').delete().eq('id', id);
  editingWritingTasks.delete(id);
  await loadAll();
  switchTab('writing');
}

// ============================= SHARED QUESTION FORM =============================

function questionFormHtml(parentId, kind) {
  return `
    <div class="builder-item" style="background:#fff;margin-top:8px;">
      <div class="field">
        <label>Question type</label>
        <select data-qtype="${parentId}">
          ${kind === 'reading' ? '<option value="true_false_not_given">True / False / Not Given</option>' : ''}
          <option value="multiple_choice">Multiple choice</option>
          <option value="fill_blank">Fill in the blank</option>
          <option value="short_answer">Short answer</option>
          <option value="matching">Matching (drag &amp; drop)</option>
          <option value="layout_blank">Blank for a table / note layout</option>
        </select>
      </div>
      <div class="field"><label>Question text</label><textarea rows="2" data-qtext="${parentId}" placeholder="For a table/note blank, a short internal label is fine — e.g. Q11 answer"></textarea></div>
      <div class="field" data-qoptions-wrap="${parentId}">
        <label>Options (one per line — used for multiple choice, and as the shared drag-and-drop word bank for matching questions in this ${kind === 'reading' ? 'passage' : 'section'})</label>
        <textarea rows="3" data-qoptions="${parentId}" placeholder="London&#10;Paris&#10;Rome"></textarea>
      </div>
      <div class="field">
        <label>Correct answer</label>
        <input type="text" data-qanswer="${parentId}" placeholder="e.g. true, or London, or accept several: colour | color">
      </div>
      <button class="small-btn" data-save-question="${parentId}" data-kind="${kind}" style="margin-top:6px;">Add question</button>
    </div>
  `;
}

// Same shape as questionFormHtml, but pre-filled with an existing question's
// values and wired to update rather than insert. Used for both reading and
// listening questions — the two only differ in which table wireQuestionEditForms()
// writes to.
function questionEditFormHtml(q, kind) {
  const optionsVal = (q.options || []).join('\n');
  return `
    <div class="builder-item" style="background:#fff;">
      <div class="field">
        <label>Question type</label>
        <select data-eqtype="${q.id}">
          ${kind === 'reading' ? `<option value="true_false_not_given" ${q.question_type === 'true_false_not_given' ? 'selected' : ''}>True / False / Not Given</option>` : ''}
          <option value="multiple_choice" ${q.question_type === 'multiple_choice' ? 'selected' : ''}>Multiple choice</option>
          <option value="fill_blank" ${q.question_type === 'fill_blank' ? 'selected' : ''}>Fill in the blank</option>
          <option value="short_answer" ${q.question_type === 'short_answer' ? 'selected' : ''}>Short answer</option>
          <option value="matching" ${q.question_type === 'matching' ? 'selected' : ''}>Matching (drag &amp; drop)</option>
          <option value="layout_blank" ${q.question_type === 'layout_blank' ? 'selected' : ''}>Blank for a table / note layout</option>
        </select>
      </div>
      <div class="field"><label>Question text</label><textarea rows="2" data-eqtext="${q.id}">${esc(q.question_text)}</textarea></div>
      <div class="field">
        <label>Options (one per line — multiple choice, or the shared drag-and-drop word bank for matching)</label>
        <textarea rows="3" data-eqoptions="${q.id}">${esc(optionsVal)}</textarea>
      </div>
      <div class="field">
        <label>Correct answer</label>
        <input type="text" data-eqanswer="${q.id}" value="${esc(q.correct_answer)}">
      </div>
      <div class="submit-row" style="gap:8px;">
        <button class="button primary" data-save-edit-question="${q.id}" data-kind="${kind}" style="padding:9px 18px;">Save</button>
        <button class="small-btn" data-cancel-edit-question="${q.id}" data-kind="${kind}">Cancel</button>
      </div>
    </div>
  `;
}

function wireQuestionForms(container, kind) {
  container.querySelectorAll('[data-save-question]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const parentId = btn.dataset.saveQuestion;
      const question_type = container.querySelector(`[data-qtype="${parentId}"]`).value;
      const question_text = container.querySelector(`[data-qtext="${parentId}"]`).value.trim();
      const optionsRaw = container.querySelector(`[data-qoptions="${parentId}"]`).value.trim();
      const correct_answer = container.querySelector(`[data-qanswer="${parentId}"]`).value.trim();
      if (!question_text || !correct_answer) return;
      const options = (question_type === 'multiple_choice' || question_type === 'matching') ? optionsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
      const siblingCount = kind === 'reading'
        ? state.passages.find(p => p.id === parentId).questions.length
        : state.sections.find(s => s.id === parentId).questions.length;
      const { error } = await supabase.from(table).insert({
        [parentField]: parentId, question_type, question_text, options, correct_answer, order_num: siblingCount + 1
      });
      if (error) { alert(error.message); return; }
      await loadAll();
      switchTab(kind);
    });
  });
}

function wireQuestionEditForms(container, kind) {
  container.querySelectorAll('[data-save-edit-question]').forEach(btn => {
    btn.addEventListener('click', async () => {
      const qid = btn.dataset.saveEditQuestion;
      const question_type = container.querySelector(`[data-eqtype="${qid}"]`).value;
      const question_text = container.querySelector(`[data-eqtext="${qid}"]`).value.trim();
      const optionsRaw = container.querySelector(`[data-eqoptions="${qid}"]`).value.trim();
      const correct_answer = container.querySelector(`[data-eqanswer="${qid}"]`).value.trim();
      if (!question_text || !correct_answer) return;
      const options = (question_type === 'multiple_choice' || question_type === 'matching') ? optionsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
      const table = kind === 'reading' ? 'reading_questions' : 'listening_questions';
      const { error } = await supabase.from(table)
        .update({ question_type, question_text, options, correct_answer }).eq('id', qid);
      if (error) { alert(error.message); return; }
      (kind === 'reading' ? editingReadingQuestions : editingListeningQuestions).delete(qid);
      await loadAll();
      switchTab(kind);
    });
  });
  container.querySelectorAll('[data-cancel-edit-question]').forEach(btn => {
    btn.addEventListener('click', () => {
      const kindHere = btn.dataset.kind;
      (kindHere === 'reading' ? editingReadingQuestions : editingListeningQuestions).delete(btn.dataset.cancelEditQuestion);
      (kindHere === 'reading' ? renderReading : renderListening)();
    });
  });
}
