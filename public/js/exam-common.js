// Shared across reading.html, listening.html and writing.html.
const ExamRuntime = {
  getSession() {
    const raw = sessionStorage.getItem('le_exam_session');
    if (!raw) { window.location.href = '/student/mock-tests.html'; return null; }
    return JSON.parse(raw);
  },

  // Canonical module order matches the real CD IELTS test day order.
  nextModuleUrl(session, currentModule) {
    const order = ['listening', 'reading', 'writing'];
    const has = {
      listening: session.sections && session.sections.length > 0,
      reading: session.passages && session.passages.length > 0,
      writing: session.writingTasks && session.writingTasks.length > 0
    };
    const startAt = order.indexOf(currentModule) + 1;
    for (let i = startAt; i < order.length; i++) {
      if (has[order[i]]) return `/exam/${order[i]}.html`;
    }
    return '/exam/finish.html';
  },

  formatTime(totalSeconds) {
    const m = Math.floor(totalSeconds / 60);
    const s = totalSeconds % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  },

  // Starts a countdown; calls onTick(secondsLeft) each second and onExpire() at zero.
  // Returns a controller with .clear().
  startTimer(minutes, onTick, onExpire) {
    let secondsLeft = Math.round(minutes * 60);
    onTick(secondsLeft);
    const handle = setInterval(() => {
      secondsLeft -= 1;
      onTick(secondsLeft);
      if (secondsLeft <= 0) {
        clearInterval(handle);
        onExpire();
      }
    }, 1000);
    return { clear: () => clearInterval(handle) };
  },

  // Renders the numbered question-navigator strip used at the bottom of
  // reading/listening screens. questions: [{id}], answers: Map(id -> value), currentId.
  renderNavStrip(container, questions, answers, currentId, onJump) {
    container.innerHTML = questions.map((q, i) => {
      const answered = answers.has(q.id) && String(answers.get(q.id) || '').trim() !== '';
      const cls = ['q-nav-btn'];
      if (answered) cls.push('answered');
      if (q.id === currentId) cls.push('current');
      return `<button class="${cls.join(' ')}" data-qid="${q.id}">${i + 1}</button>`;
    }).join('');
    container.querySelectorAll('.q-nav-btn').forEach(btn => {
      btn.addEventListener('click', () => onJump(btn.dataset.qid));
    });
  },

  escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  },

  // Same **bold** / *italic* / newline convention as the teacher's layout
  // intro editor — text is escaped first, so markers are the only thing
  // treated specially.
  formatIntroHtml(s) {
    return ExamRuntime.escapeHtml(s || '')
      .replace(/\n/g, '<br>')
      .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
      .replace(/\*(.+?)\*/g, '<em>$1</em>');
  },

  // ===================== TABLE / NOTE COMPLETION LAYOUTS =====================
  // Renders a passage/section's optional `layout` (built in the test builder)
  // as a flowing note or a table, with each blank as a normal text input
  // carrying data-answer-for="<question id>" — the caller's existing generic
  // `[data-answer-for]` wiring picks these up exactly like any other question,
  // so no extra wiring is needed for layouts themselves.
  renderLayoutHtml(layout, container, answers) {
    const blanksById = new Map((container.questions || []).map(q => [q.id, q]));
    const blankHtml = (p) => {
      const val = ExamRuntime.escapeHtml(answers.get(p.question_id) || '');
      return `<input type="text" class="q-blank-input" data-answer-for="${p.question_id}" value="${val}">`;
    };
    const partsHtml = (parts) => (parts || []).map(p => p.type === 'blank' && blanksById.has(p.question_id)
      ? blankHtml(p)
      : ExamRuntime.escapeHtml(p.value || '')
    ).join('');

    if (!layout || !layout.type || layout.type === 'none') return '';

    if (layout.type === 'note') {
      return `
        ${layout.intro ? `<p class="q-layout-intro">${ExamRuntime.formatIntroHtml(layout.intro)}</p>` : ''}
        <p class="q-layout-note">${partsHtml(layout.parts)}</p>
      `;
    }

    return `
      ${layout.intro ? `<p class="q-layout-intro">${ExamRuntime.formatIntroHtml(layout.intro)}</p>` : ''}
      <table class="q-layout-table">
        <tr>${(layout.columns || []).map(c => `<th>${ExamRuntime.escapeHtml(c)}</th>`).join('')}</tr>
        ${(layout.rows || []).map(row => `<tr>${(row || []).map(cell => `<td>${partsHtml(cell)}</td>`).join('')}</tr>`).join('')}
      </table>
    `;
  },

  // Ids of a container's questions that are rendered inside its layout (so
  // the caller can skip them when it also renders the plain per-question list).
  layoutBlankIds(layout) {
    const ids = new Set();
    const walk = parts => (parts || []).forEach(p => { if (p.type === 'blank' && p.question_id) ids.add(p.question_id); });
    if (layout && layout.type === 'note') walk(layout.parts);
    if (layout && layout.type === 'table') (layout.rows || []).forEach(row => (row || []).forEach(walk));
    return ids;
  },

  // ===================== MATCHING / DRAG & DROP =====================
  // Renders a shared drag-and-drop word bank plus one drop target per
  // question. `items` is [{ q, num }]; all questions must share the same
  // container (passage/section) so bank options can be merged. Each target
  // carries a hidden input[data-answer-for] so it plugs into the caller's
  // normal answer-collection code — call ExamRuntime.wireMatching(root) once
  // after inserting this HTML.
  renderMatchingHtml(items, answers) {
    if (!items.length) return '';
    const bank = [];
    items.forEach(({ q }) => (q.options || []).forEach(opt => { if (!bank.includes(opt)) bank.push(opt); }));
    const groupId = 'grp-' + items[0].q.id;
    return `
      <div class="q-match-group" data-match-group="${groupId}">
        <div class="q-match-bank" data-bank-for="${groupId}">
          ${bank.map(opt => `<div class="q-match-chip" draggable="true" data-chip-label="${ExamRuntime.escapeHtml(opt)}">${ExamRuntime.escapeHtml(opt)}</div>`).join('')}
        </div>
        ${items.map(({ q, num }) => `
          <div class="q-item" id="q-${q.id}">
            <div class="q-text"><span class="q-num-badge">${num}</span>${ExamRuntime.escapeHtml(q.question_text)}</div>
            <div class="q-match-target" data-target-for="${q.id}" data-group="${groupId}">
              <span class="placeholder">Drag an answer here, or tap a word above then tap here</span>
            </div>
            <input type="hidden" data-answer-for="${q.id}" value="${ExamRuntime.escapeHtml(answers.get(q.id) || '')}">
          </div>
        `).join('')}
      </div>
    `;
  },

  // Wires drag/drop + click-to-place for every .q-match-group under `root`.
  // Call once after inserting matching HTML (and it's safe to call again
  // after a full re-render, since it re-reads state from the DOM each time).
  wireMatching(root) {
    root.querySelectorAll('.q-match-group').forEach(group => {
      let selectedChip = null;

      const refresh = () => {
        const placedLabels = new Set();
        group.querySelectorAll('.q-match-target').forEach(target => {
          const input = target.parentElement.querySelector(`input[data-answer-for="${target.dataset.targetFor}"]`);
          const val = input ? input.value : '';
          if (val) {
            placedLabels.add(val);
            target.innerHTML = `<span class="placed-chip">${ExamRuntime.escapeHtml(val)}<button type="button" data-remove-chip>×</button></span>`;
          } else {
            target.innerHTML = `<span class="placeholder">Drag an answer here, or tap a word above then tap here</span>`;
          }
        });
        group.querySelectorAll('.q-match-chip').forEach(chip => {
          chip.classList.toggle('placed', placedLabels.has(chip.dataset.chipLabel));
        });
        group.querySelectorAll('[data-remove-chip]').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const target = btn.closest('.q-match-target');
            place(target, '');
          });
        });
      };

      const place = (target, label) => {
        const input = target.parentElement.querySelector(`input[data-answer-for="${target.dataset.targetFor}"]`);
        if (!input) return;
        input.value = label;
        input.dispatchEvent(new Event('input', { bubbles: true }));
        refresh();
      };

      group.querySelectorAll('.q-match-chip').forEach(chip => {
        chip.addEventListener('dragstart', (e) => {
          e.dataTransfer.setData('text/plain', chip.dataset.chipLabel);
        });
        chip.addEventListener('click', () => {
          if (chip.classList.contains('placed')) return;
          group.querySelectorAll('.q-match-chip').forEach(c => c.classList.remove('selected'));
          selectedChip = chip.classList.toggle('selected') ? chip.dataset.chipLabel : null;
        });
      });

      group.querySelectorAll('.q-match-target').forEach(target => {
        target.addEventListener('dragover', (e) => { e.preventDefault(); target.classList.add('dragover'); });
        target.addEventListener('dragleave', () => target.classList.remove('dragover'));
        target.addEventListener('drop', (e) => {
          e.preventDefault();
          target.classList.remove('dragover');
          const label = e.dataTransfer.getData('text/plain');
          if (label) place(target, label);
        });
        target.addEventListener('click', () => {
          if (!selectedChip) return;
          place(target, selectedChip);
          group.querySelectorAll('.q-match-chip').forEach(c => c.classList.remove('selected'));
          selectedChip = null;
        });
      });

      refresh();
    });
  }
};
