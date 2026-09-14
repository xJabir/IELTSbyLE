// ===========================================================
// Fill these in from your Supabase project: Settings → API.
// The anon key is meant to be public (that's how Supabase apps work) —
// real protection comes from the Row Level Security policies in
// supabase/schema.sql, not from hiding this key.
// ===========================================================
const SUPABASE_URL = 'https://pcnpoisoldqtacmvolcd.supabase.co'; // e.g. https://abcdefgh.supabase.co
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBjbnBvaXNvbGRxdGFjbXZvbGNkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMzkwNDEsImV4cCI6MjEwNDcxNTA0MX0.NmFf3z5MZtGTaw7cV7_bnVMKRSxcfOGITqEA-LvbjeY';

supabase = window.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

const Auth = {
  // Cache of {id, name, email, role} for the current tab — avoids
  // re-querying profiles on every helper call within the same page.
  _profile: null,

  async getSession() {
    const { data } = await supabase.auth.getSession();
    return data.session;
  },

  async getProfile() {
    if (this._profile) return this._profile;
    const session = await this.getSession();
    if (!session) return null;
    const { data, error } = await supabase.from('profiles').select('id, name, email, role, batch_number, student_id_number, approval_status, account_type').eq('id', session.user.id).single();
    if (error) return null;
    this._profile = data;
    return data;
  },

  async logout() {
    await supabase.auth.signOut();
    window.location.href = '/index.html';
  },

  // Redirect away if not logged in as the required role. Returns the
  // profile if OK, otherwise redirects and returns null.
  async requireRole(role) {
    const session = await this.getSession();
    if (!session) {
      window.location.href = role === 'teacher' ? '/teacher-login.html' : '/login.html';
      return null;
    }
    const profile = await this.getProfile();
    if (!profile || profile.role !== role) {
      window.location.href = '/index.html';
      return null;
    }
    return profile;
  },

  // Same as requireRole, but for students it also blocks access until a
  // teacher has approved the account — instead of redirecting, it shows
  // an in-page message so the student understands why they're stuck.
  // Use this (not requireRole) on every page a real student uses.
  async requireApprovedRole(role) {
    const profile = await this.requireRole(role);
    if (!profile) return null;
    if (role === 'student' && profile.approval_status !== 'approved') {
      const rejected = profile.approval_status === 'rejected';
      document.body.innerHTML = `
        <div style="max-width:480px;margin:100px auto;padding:36px;border:1px solid var(--line,#D7DCE5);border-radius:3px;font-family:'IBM Plex Sans',sans-serif;text-align:center;">
          <h2 style="font-family:'Fraunces',serif;margin:0 0 12px;color:var(--ink,#1B3B6F);">${rejected ? 'Account not approved' : 'Your account is pending approval'}</h2>
          <p style="color:var(--ink-soft,#4A5A78);font-size:15px;line-height:1.7;margin:0;">
            ${rejected
              ? 'A teacher has marked this account as not approved. Please contact your teacher if you think this is a mistake.'
              : 'A teacher needs to confirm your enrolment before you can access mock tests, class schedules, and speaking bookings. This is usually quick — check back soon.'}
          </p>
          <a href="#" id="pendingLogoutLink" style="display:inline-block;margin-top:24px;color:var(--ink,#1B3B6F);text-decoration:underline;font-size:14px;">Log out</a>
        </div>`;
      document.getElementById('pendingLogoutLink').addEventListener('click', (e) => { e.preventDefault(); Auth.logout(); });
      return null;
    }
    return profile;
  }
};

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
