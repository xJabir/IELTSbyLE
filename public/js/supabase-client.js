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
    const { data, error } = await supabase.from('profiles').select('id, name, email, role, batch_number, student_id_number').eq('id', session.user.id).single();
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
  }
};

function escapeHtml(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
