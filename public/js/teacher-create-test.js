let profile;
const testId = new URLSearchParams(location.search).get('testId');
let state = null; // { test, passages, sections, writingTasks }

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
  list.innerHTML = state.passages.map((p, pi) => `
    <div class="builder-item">
      <div class="builder-item-head">
        <span class="tag">Passage ${pi + 1}</span>
        <button class="small-btn danger" data-del-passage="${p.id}">Delete passage</button>
      </div>
      <div class="field"><label>Title</label><input type="text" value="${esc(p.title)}" disabled></div>
      <div class="field"><label>Passage text</label><textarea rows="4" disabled>${esc(p.passage_text)}</textarea></div>
      <div style="margin-top:14px;">
        <strong style="font-size:13px;">Questions (${p.questions.length})</strong>
        ${p.questions.map((q, qi) => `
          <div class="builder-item" style="background:#fff;">
            <div class="builder-item-head">
              <span class="tag">Q${qi + 1} · ${esc(q.question_type)}</span>
              <button class="small-btn danger" data-del-question="${q.id}">Delete</button>
            </div>
            <p style="font-size:14px;">${esc(q.question_text)}</p>
            <p style="font-size:13px;color:var(--ink-soft);">Answer: ${esc(q.correct_answer)}</p>
          </div>
        `).join('')}
      </div>
      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:14px;color:var(--seal);">+ Add a question to this passage</summary>
        ${questionFormHtml(p.id, 'reading')}
      </details>
    </div>
  `).join('') || '<p style="color:var(--ink-soft);font-size:14px;">No passages yet.</p>';

  document.getElementById('addPassageBtn').addEventListener('click', () => showPassageForm());
  list.querySelectorAll('[data-del-passage]').forEach(b => b.addEventListener('click', () => deletePassage(b.dataset.delPassage)));
  list.querySelectorAll('[data-del-question]').forEach(b => b.addEventListener('click', () => deleteReadingQuestion(b.dataset.delQuestion)));
  wireQuestionForms(el, 'reading');
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
  await loadAll();
  switchTab('reading');
}

async function deleteReadingQuestion(id) {
  await supabase.from('reading_questions').delete().eq('id', id);
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
  list.innerHTML = state.sections.map((s, si) => `
    <div class="builder-item">
      <div class="builder-item-head">
        <span class="tag">Section ${si + 1}: ${esc(s.title)}</span>
        <button class="small-btn danger" data-del-section="${s.id}">Delete section</button>
      </div>
      <p style="font-size:13px;color:var(--ink-soft);">${s.audio_url ? `Audio attached ✓ <a href="${s.audio_url}" target="_blank">Preview</a>` : 'No audio uploaded yet'}</p>
      <input type="file" accept=".mp3,.wav,.m4a,.ogg,audio/*" data-upload-audio="${s.id}">
      <div style="margin-top:14px;">
        <strong style="font-size:13px;">Questions (${s.questions.length})</strong>
        ${s.questions.map((q, qi) => `
          <div class="builder-item" style="background:#fff;">
            <div class="builder-item-head">
              <span class="tag">Q${qi + 1} · ${esc(q.question_type)}</span>
              <button class="small-btn danger" data-del-lquestion="${q.id}">Delete</button>
            </div>
            <p style="font-size:14px;">${esc(q.question_text)}</p>
            <p style="font-size:13px;color:var(--ink-soft);">Answer: ${esc(q.correct_answer)}</p>
          </div>
        `).join('')}
      </div>
      <details style="margin-top:12px;">
        <summary style="cursor:pointer;font-size:14px;color:var(--seal);">+ Add a question to this section</summary>
        ${questionFormHtml(s.id, 'listening')}
      </details>
    </div>
  `).join('') || '<p style="color:var(--ink-soft);font-size:14px;">No sections yet.</p>';

  document.getElementById('addSectionBtn').addEventListener('click', () => showSectionForm());
  list.querySelectorAll('[data-del-section]').forEach(b => b.addEventListener('click', () => deleteSection(b.dataset.delSection)));
  list.querySelectorAll('[data-del-lquestion]').forEach(b => b.addEventListener('click', () => deleteListeningQuestion(b.dataset.delLquestion)));
  list.querySelectorAll('[data-upload-audio]').forEach(input => input.addEventListener('change', () => handleAudioUpload(input)));
  wireQuestionForms(el, 'listening');
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
  await loadAll();
  switchTab('listening');
}

async function deleteListeningQuestion(id) {
  await supabase.from('listening_questions').delete().eq('id', id);
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
  el.querySelectorAll('[data-del-task]').forEach(b => b.addEventListener('click', () => deleteWritingTask(b.dataset.delTask)));
}

function renderTaskCard(t) {
  return `
    <div class="builder-item">
      <div class="builder-item-head">
        <span class="tag">Min ${t.min_words} words</span>
        <button class="small-btn danger" data-del-task="${t.id}">Delete &amp; replace</button>
      </div>
      <p style="font-size:14px;">${esc(t.prompt_text)}</p>
      ${t.image_url ? `<img src="${esc(t.image_url)}" style="max-width:280px;margin-top:10px;border:1px solid var(--line);">` : ''}
    </div>
  `;
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
