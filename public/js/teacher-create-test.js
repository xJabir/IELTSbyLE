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
      listening_duration_min: Number(document.getElementById('d-listen').value),
      reading_duration_min: Number(document.getElementById('d-read').value),
      writing_duration_min: Number(document.getElementById('d-write').value)
    }).eq('id', testId);
    if (error) { alert(error.message); return; }
    await loadAll();
  });
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
        </select>
      </div>
      <div class="field"><label>Question text</label><textarea rows="2" data-qtext="${parentId}" placeholder="Question wording"></textarea></div>
      <div class="field" data-qoptions-wrap="${parentId}">
        <label>Options (multiple choice only — one per line)</label>
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
        </select>
      </div>
      <div class="field"><label>Question text</label><textarea rows="2" data-eqtext="${q.id}">${esc(q.question_text)}</textarea></div>
      <div class="field">
        <label>Options (multiple choice only — one per line)</label>
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
      const options = question_type === 'multiple_choice' ? optionsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
      const table = kind === 'reading' ? 'reading_questions' : 'listening_questions';
      const parentField = kind === 'reading' ? 'passage_id' : 'section_id';
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
      const options = question_type === 'multiple_choice' ? optionsRaw.split('\n').map(s => s.trim()).filter(Boolean) : [];
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
