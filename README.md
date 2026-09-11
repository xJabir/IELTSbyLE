# London Educators — IELTS Mock Test Platform

Students create profiles and sit IELTS mock tests on an interface built to
match the real computer-delivered IELTS test screen. Teachers build the
tests (reading passages, listening audio, writing tasks) and grade
writing. Speaking has no recording — instead, students book a live slot
from times their teacher opens up; a day shows as unavailable automatically
once every slot on it is full.

## Stack

- **Supabase** — Postgres database, Auth (email/password), Storage (listening audio), and all business logic (grading, band math, slot booking) as Postgres functions.
- **Vercel** — hosts the frontend. It's a **static site** — plain HTML/CSS/JS, one file per page, no build step. There is no backend server: every page talks to Supabase directly using the public anon key, and Supabase's Row Level Security policies are what keep everything safe.
- **GitHub** — holds the code; Vercel deploys from it.

This is different from a typical Node app: nothing runs on Vercel except
static file serving. All the "server" logic — auth, grading, hiding
correct answers from students, atomic slot-capacity checks — lives inside
Supabase as SQL (`supabase/schema.sql`). I tested every one of those rules
against a local Postgres instance standing in for Supabase before
delivering this, so the RLS policies and RPC functions are verified, not
just written.

## 1. Set up Supabase

1. Create a project at [supabase.com](https://supabase.com).
2. Open **SQL Editor → New query**, paste the entire contents of
   `supabase/schema.sql`, and run it. It's safe to re-run if you ever need to.
3. Go to **Authentication → Providers** and make sure Email is enabled.
   Under **Authentication → URL Configuration**, you may want to turn off
   "Confirm email" while testing (Settings → Auth → toggle "Enable email
   confirmations") so signup logs you straight in — turn it back on before
   real students use it.
4. Go to **Settings → API** and copy:
   - **Project URL**
   - **anon public** key (not the `service_role` key — never put that in
     frontend code)

## 2. Connect the frontend to your project

Open `public/js/supabase-client.js` and replace the two placeholders:

```js
const SUPABASE_URL = 'YOUR_SUPABASE_PROJECT_URL';
const SUPABASE_ANON_KEY = 'YOUR_SUPABASE_ANON_KEY';
```

That's the only configuration step. These values are meant to be public —
Supabase apps always ship the anon key to the browser; the RLS policies in
`schema.sql` are what actually enforce access control.

## 3. Push to GitHub

```bash
git init
git add .
git commit -m "London Educators"
git branch -M main
git remote add origin <your-empty-github-repo-url>
git push -u origin main
```

## 4. Deploy on Vercel

1. [vercel.com](https://vercel.com) → **Add New → Project** → import the
   GitHub repo you just pushed.
2. Vercel will detect no framework — that's expected. It reads
   `vercel.json` (already in this repo), which points it at the `public/`
   folder. No environment variables are needed on Vercel's side, since the
   Supabase keys are already baked into `supabase-client.js`.
3. Deploy. You'll get a `*.vercel.app` URL — that's the whole app.

Any time you push to `main`, Vercel redeploys automatically.

## Project layout

```
supabase/
  schema.sql                  — run this once in the Supabase SQL Editor.
                                 Tables, RLS policies, storage bucket +
                                 policies, and every RPC function.

public/
  index.html                  — landing page
  login.html / signup.html    — student auth (Supabase Auth)
  teacher-login.html / teacher-signup.html
  css/main.css                — site + dashboard styling (design tokens at top)
  css/exam.css                — exam-screen chrome
  js/supabase-client.js       — Supabase client init + session/role helper (EDIT THIS)
  js/exam-common.js           — shared timer / question-navigator logic
  js/teacher-create-test.js   — test-builder logic

  student/
    dashboard.html             — published tests + this student's stats
    results.html                — band-score history table
    result-detail.html           — one attempt's full breakdown
    speaking.html                 — book/cancel a Speaking slot

  exam/
    intro.html, reading.html, listening.html, writing.html, finish.html

  teacher/
    dashboard.html               — this teacher's tests
    create-test.html              — tabbed builder (Details/Reading/Listening/Writing)
    submissions.html               — student attempts for one test
    grade.html                      — grade writing, view auto-marked R/L
    speaking-slots.html              — create/delete Speaking slots, see bookings
```

## How the security actually works

Nothing in the frontend is trusted. Specifically:

- **Correct answers are never sent to a student's browser.** Reading and
  listening questions are only reachable through `start_or_resume_test()`,
  a Postgres function that builds the exam JSON itself and simply never
  includes `correct_answer` in it. Direct table access to
  `reading_questions`/`listening_questions` is blocked entirely for
  students by RLS.
- **A student can't write their own band score.** There are no
  INSERT/UPDATE policies on `submissions` for students at all — the only
  way a submission gets graded is through `submit_reading_answers()`,
  `submit_listening_answers()`, and (for writing) the teacher's
  `grade_writing()`, all of which check `auth.uid()` against the row
  before touching anything.
- **Speaking slot capacity can't be raced.** `book_speaking_slot()` locks
  the slot row (`SELECT ... FOR UPDATE`) before counting existing bookings,
  so two students booking the last seat at the same instant can't both
  succeed.
- **A teacher can only see/grade their own tests.** Every policy on
  passages/questions/sections/tasks/submissions checks a join back to
  `tests.created_by = auth.uid()`.

## How scoring works

- **Reading / Listening:** raw score out of 40 → band, via
  `ielts_band_from_raw()` in `schema.sql` (the standard published IELTS
  conversion table). Multiple acceptable spellings for one answer can be
  given separated by `|` (e.g. `colour | color`).
- **Writing:** the teacher enters a band (0–9, in 0.5 steps) per task.
  `writing_band = round_half((task1 + 2 × task2) / 3)` — Task 2 weighted
  double, matching real IELTS.
- **Overall:** once Reading, Listening and Writing bands all exist,
  `overall_band = round_half(average of the three)`. There's no Speaking
  band folded in here since Speaking is a live-graded slot, not part of
  the written mock test — see below.

## How Speaking scheduling works

- A teacher opens slots on `teacher/speaking-slots.html` — each one a
  specific date + time + seat capacity (e.g. 5 slots of capacity 1, or one
  slot of capacity 4 for a group session).
- Students see a date strip on `student/speaking.html`; any day where
  every slot is full is visibly greyed out and unclickable. Picking an
  open day shows its individual time slots with seats remaining.
- Booking calls `book_speaking_slot()`, which is atomic and enforces one
  active booking per student — trying to book a second slot while already
  booked is rejected with a clear message until they cancel the first.
- Cancelling is a direct, RLS-permitted update (a student can only flip
  their *own* booking to `cancelled`, nothing else), which immediately
  frees the seat for someone else.
- This module isn't graded in-app — it's meant to be conducted live
  (in person or by video call) between teacher and student at the booked
  time. If you want to fold a Speaking band into the overall score later,
  add a `speaking_band` column to `submissions` (or a standalone
  `speaking_results` table keyed on the booking) and extend
  `grade_writing()`'s averaging logic — or ask for that build directly.

## Question types supported

`true_false_not_given`, `multiple_choice`, `fill_blank`, `short_answer` —
covers the large majority of real IELTS Reading/Listening question styles.

## Extending it

- **Email verification / password reset:** Supabase Auth supports both out
  of the box (Authentication settings in the dashboard) — nothing to build,
  just configure and (for password reset) add a small reset-password page
  using `supabase.auth.resetPasswordForEmail()`.
- **Anti-cheating / lockdown browser:** not included — this replicates the
  *look* of CD IELTS, not exam-security software.
- **Custom domain:** add it under the Vercel project's Settings → Domains;
  no code changes needed.
