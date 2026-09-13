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
  }
};
