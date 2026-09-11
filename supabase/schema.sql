-- =====================================================================
-- London Educators — Supabase schema
-- Run this once in the Supabase SQL Editor (Dashboard → SQL Editor →
-- New query → paste this whole file → Run). Safe to re-run: most objects
-- use IF NOT EXISTS / CREATE OR REPLACE / ON CONFLICT DO NOTHING.
-- =====================================================================

create extension if not exists pgcrypto;

-- =====================================================================
-- PROFILES  (one row per auth.users row; holds name/role)
-- =====================================================================

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  name text not null,
  email text not null,
  role text not null check (role in ('student','teacher')),
  created_at timestamptz not null default now()
);

alter table public.profiles enable row level security;

drop policy if exists "profiles readable by any authenticated user" on public.profiles;
create policy "profiles readable by any authenticated user"
  on public.profiles for select to authenticated
  using (true);

drop policy if exists "users can update their own profile" on public.profiles;
create policy "users can update their own profile"
  on public.profiles for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Auto-create a profile row whenever someone signs up. name/role come
-- from the `options.data` passed to supabase.auth.signUp() on the client.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, name, email, role)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)),
    new.email,
    coalesce(new.raw_user_meta_data->>'role', 'student')
  );
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- =====================================================================
-- TESTS
-- =====================================================================

create table if not exists public.tests (
  id uuid primary key default gen_random_uuid(),
  title text not null,
  description text default '',
  created_by uuid not null references public.profiles(id),
  published boolean not null default false,
  reading_duration_min int not null default 60,
  listening_duration_min int not null default 30,
  writing_duration_min int not null default 60,
  created_at timestamptz not null default now()
);

alter table public.tests enable row level security;

drop policy if exists "students can read published tests" on public.tests;
create policy "students can read published tests"
  on public.tests for select to authenticated
  using (published = true or created_by = auth.uid());

drop policy if exists "teachers manage their own tests" on public.tests;
create policy "teachers manage their own tests"
  on public.tests for all to authenticated
  using (created_by = auth.uid())
  with check (
    created_by = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

-- =====================================================================
-- READING  (passages hidden from students directly — only reachable via
-- the start_or_resume_test() function below, which strips correct answers)
-- =====================================================================

create table if not exists public.reading_passages (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  order_num int not null default 1,
  title text not null,
  passage_text text not null
);
alter table public.reading_passages enable row level security;

drop policy if exists "teachers manage passages on their tests" on public.reading_passages;
create policy "teachers manage passages on their tests"
  on public.reading_passages for all to authenticated
  using (exists (select 1 from public.tests t where t.id = test_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.tests t where t.id = test_id and t.created_by = auth.uid()));

create table if not exists public.reading_questions (
  id uuid primary key default gen_random_uuid(),
  passage_id uuid not null references public.reading_passages(id) on delete cascade,
  order_num int not null default 1,
  question_type text not null,
  question_text text not null,
  options jsonb not null default '[]',
  correct_answer text not null
);
alter table public.reading_questions enable row level security;

drop policy if exists "teachers manage reading questions on their tests" on public.reading_questions;
create policy "teachers manage reading questions on their tests"
  on public.reading_questions for all to authenticated
  using (exists (
    select 1 from public.reading_passages rp join public.tests t on t.id = rp.test_id
    where rp.id = passage_id and t.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.reading_passages rp join public.tests t on t.id = rp.test_id
    where rp.id = passage_id and t.created_by = auth.uid()
  ));

-- =====================================================================
-- LISTENING
-- =====================================================================

create table if not exists public.listening_sections (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  order_num int not null default 1,
  title text not null,
  audio_url text default ''
);
alter table public.listening_sections enable row level security;

drop policy if exists "teachers manage listening sections on their tests" on public.listening_sections;
create policy "teachers manage listening sections on their tests"
  on public.listening_sections for all to authenticated
  using (exists (select 1 from public.tests t where t.id = test_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.tests t where t.id = test_id and t.created_by = auth.uid()));

create table if not exists public.listening_questions (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.listening_sections(id) on delete cascade,
  order_num int not null default 1,
  question_type text not null,
  question_text text not null,
  options jsonb not null default '[]',
  correct_answer text not null
);
alter table public.listening_questions enable row level security;

drop policy if exists "teachers manage listening questions on their tests" on public.listening_questions;
create policy "teachers manage listening questions on their tests"
  on public.listening_questions for all to authenticated
  using (exists (
    select 1 from public.listening_sections ls join public.tests t on t.id = ls.test_id
    where ls.id = section_id and t.created_by = auth.uid()
  ))
  with check (exists (
    select 1 from public.listening_sections ls join public.tests t on t.id = ls.test_id
    where ls.id = section_id and t.created_by = auth.uid()
  ));

-- =====================================================================
-- WRITING  (no secret column, so students can read tasks directly)
-- =====================================================================

create table if not exists public.writing_tasks (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  task_number int not null check (task_number in (1,2)),
  prompt_text text not null,
  image_url text default '',
  min_words int not null default 150
);
alter table public.writing_tasks enable row level security;

drop policy if exists "teachers manage writing tasks on their tests" on public.writing_tasks;
create policy "teachers manage writing tasks on their tests"
  on public.writing_tasks for all to authenticated
  using (exists (select 1 from public.tests t where t.id = test_id and t.created_by = auth.uid()))
  with check (exists (select 1 from public.tests t where t.id = test_id and t.created_by = auth.uid()));

drop policy if exists "students can read writing tasks of published tests" on public.writing_tasks;
create policy "students can read writing tasks of published tests"
  on public.writing_tasks for select to authenticated
  using (exists (select 1 from public.tests t where t.id = test_id and t.published = true));

-- =====================================================================
-- SUBMISSIONS & ANSWERS
-- All writes to these tables happen ONLY through the SECURITY DEFINER
-- functions below (start_or_resume_test, submit_reading_answers,
-- submit_listening_answers, save_writing_answers, finish_submission,
-- grade_writing). There are deliberately no INSERT/UPDATE/DELETE RLS
-- policies on these tables — direct writes are blocked for everyone,
-- which is what stops a student from writing their own band scores.
-- =====================================================================

create table if not exists public.submissions (
  id uuid primary key default gen_random_uuid(),
  test_id uuid not null references public.tests(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  started_at timestamptz not null default now(),
  submitted_at timestamptz,
  status text not null default 'in_progress' check (status in ('in_progress','submitted','graded')),
  reading_raw_score int,
  reading_band numeric,
  listening_raw_score int,
  listening_band numeric,
  writing_task1_band numeric,
  writing_task2_band numeric,
  writing_band numeric,
  overall_band numeric
);
alter table public.submissions enable row level security;

drop policy if exists "students can read their own submissions" on public.submissions;
create policy "students can read their own submissions"
  on public.submissions for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "teachers can read submissions on their own tests" on public.submissions;
create policy "teachers can read submissions on their own tests"
  on public.submissions for select to authenticated
  using (exists (select 1 from public.tests t where t.id = test_id and t.created_by = auth.uid()));

create table if not exists public.reading_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.reading_questions(id),
  answer_text text default '',
  is_correct boolean
);
alter table public.reading_answers enable row level security;

drop policy if exists "students can read their own reading answers" on public.reading_answers;
create policy "students can read their own reading answers"
  on public.reading_answers for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id and s.student_id = auth.uid()));

drop policy if exists "teachers can read reading answers on their own tests" on public.reading_answers;
create policy "teachers can read reading answers on their own tests"
  on public.reading_answers for select to authenticated
  using (exists (
    select 1 from public.submissions s join public.tests t on t.id = s.test_id
    where s.id = submission_id and t.created_by = auth.uid()
  ));

create table if not exists public.listening_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  question_id uuid not null references public.listening_questions(id),
  answer_text text default '',
  is_correct boolean
);
alter table public.listening_answers enable row level security;

drop policy if exists "students can read their own listening answers" on public.listening_answers;
create policy "students can read their own listening answers"
  on public.listening_answers for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id and s.student_id = auth.uid()));

drop policy if exists "teachers can read listening answers on their own tests" on public.listening_answers;
create policy "teachers can read listening answers on their own tests"
  on public.listening_answers for select to authenticated
  using (exists (
    select 1 from public.submissions s join public.tests t on t.id = s.test_id
    where s.id = submission_id and t.created_by = auth.uid()
  ));

create table if not exists public.writing_answers (
  id uuid primary key default gen_random_uuid(),
  submission_id uuid not null references public.submissions(id) on delete cascade,
  task_id uuid not null references public.writing_tasks(id),
  answer_text text default '',
  word_count int default 0,
  band_score numeric,
  feedback text default ''
);
alter table public.writing_answers enable row level security;

drop policy if exists "students can read their own writing answers" on public.writing_answers;
create policy "students can read their own writing answers"
  on public.writing_answers for select to authenticated
  using (exists (select 1 from public.submissions s where s.id = submission_id and s.student_id = auth.uid()));

drop policy if exists "teachers can read writing answers on their own tests" on public.writing_answers;
create policy "teachers can read writing answers on their own tests"
  on public.writing_answers for select to authenticated
  using (exists (
    select 1 from public.submissions s join public.tests t on t.id = s.test_id
    where s.id = submission_id and t.created_by = auth.uid()
  ));

-- =====================================================================
-- SPEAKING — scheduled slots instead of a recorded module.
-- Teachers create dated/timed slots with a capacity; students book one.
-- =====================================================================

create table if not exists public.speaking_slots (
  id uuid primary key default gen_random_uuid(),
  teacher_id uuid not null references public.profiles(id),
  slot_date date not null,
  slot_time time not null,
  capacity int not null default 1 check (capacity > 0),
  created_at timestamptz not null default now(),
  unique (teacher_id, slot_date, slot_time)
);
alter table public.speaking_slots enable row level security;

drop policy if exists "anyone authenticated can read speaking slots" on public.speaking_slots;
create policy "anyone authenticated can read speaking slots"
  on public.speaking_slots for select to authenticated
  using (true);

drop policy if exists "teachers manage their own speaking slots" on public.speaking_slots;
create policy "teachers manage their own speaking slots"
  on public.speaking_slots for all to authenticated
  using (teacher_id = auth.uid())
  with check (
    teacher_id = auth.uid()
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

create table if not exists public.speaking_bookings (
  id uuid primary key default gen_random_uuid(),
  slot_id uuid not null references public.speaking_slots(id) on delete cascade,
  student_id uuid not null references public.profiles(id),
  status text not null default 'booked' check (status in ('booked','cancelled')),
  booked_at timestamptz not null default now(),
  unique (slot_id, student_id)
);
alter table public.speaking_bookings enable row level security;

-- A student can only hold one *active* booking at a time.
drop index if exists one_active_booking_per_student;
create unique index one_active_booking_per_student
  on public.speaking_bookings (student_id)
  where (status = 'booked');

drop policy if exists "students can read their own bookings" on public.speaking_bookings;
create policy "students can read their own bookings"
  on public.speaking_bookings for select to authenticated
  using (student_id = auth.uid());

drop policy if exists "teachers can read bookings on their own slots" on public.speaking_bookings;
create policy "teachers can read bookings on their own slots"
  on public.speaking_bookings for select to authenticated
  using (exists (select 1 from public.speaking_slots sl where sl.id = slot_id and sl.teacher_id = auth.uid()));

-- Cancelling is a direct, safe RLS-permitted update: a student may only
-- flip their own row to 'cancelled', never anything else.
drop policy if exists "students can cancel their own booking" on public.speaking_bookings;
create policy "students can cancel their own booking"
  on public.speaking_bookings for update to authenticated
  using (student_id = auth.uid())
  with check (student_id = auth.uid() and status = 'cancelled');

-- Booking itself goes through book_speaking_slot() below (no direct
-- INSERT policy) so the capacity check is atomic and can't be raced.

-- Aggregate view: remaining seats per slot. Created (and therefore owned)
-- by the migration role, which bypasses RLS — so this view reports true
-- totals even though the underlying speaking_bookings rows are hidden
-- from any single student by the policies above. Grant lets everyone read it.
drop view if exists public.speaking_slot_availability;
create view public.speaking_slot_availability as
select
  sl.id,
  sl.teacher_id,
  sl.slot_date,
  sl.slot_time,
  sl.capacity,
  count(b.id) filter (where b.status = 'booked') as booked_count,
  sl.capacity - count(b.id) filter (where b.status = 'booked') as remaining
from public.speaking_slots sl
left join public.speaking_bookings b on b.slot_id = sl.id
group by sl.id, sl.teacher_id, sl.slot_date, sl.slot_time, sl.capacity;

grant select on public.speaking_slot_availability to authenticated;

-- =====================================================================
-- HELPER FUNCTIONS: IELTS band conversion
-- =====================================================================

create or replace function public.ielts_band_from_raw(p_raw int, p_kind text)
returns numeric
language plpgsql
immutable
as $$
begin
  if p_kind = 'reading' then
    return case
      when p_raw between 39 and 40 then 9
      when p_raw between 37 and 38 then 8.5
      when p_raw between 35 and 36 then 8
      when p_raw between 33 and 34 then 7.5
      when p_raw between 30 and 32 then 7
      when p_raw between 27 and 29 then 6.5
      when p_raw between 23 and 26 then 6
      when p_raw between 19 and 22 then 5.5
      when p_raw between 15 and 18 then 5
      when p_raw between 13 and 14 then 4.5
      when p_raw between 10 and 12 then 4
      when p_raw between 8 and 9 then 3.5
      when p_raw between 6 and 7 then 3
      when p_raw between 4 and 5 then 2.5
      else 2
    end;
  else
    return case
      when p_raw between 39 and 40 then 9
      when p_raw between 37 and 38 then 8.5
      when p_raw between 35 and 36 then 8
      when p_raw between 32 and 34 then 7.5
      when p_raw between 30 and 31 then 7
      when p_raw between 26 and 29 then 6.5
      when p_raw between 23 and 25 then 6
      when p_raw between 18 and 22 then 5.5
      when p_raw between 16 and 17 then 5
      when p_raw between 13 and 15 then 4.5
      when p_raw between 11 and 12 then 4
      when p_raw between 8 and 10 then 3.5
      when p_raw between 6 and 7 then 3
      when p_raw between 4 and 5 then 2.5
      else 2
    end;
  end if;
end;
$$;

create or replace function public.round_half(p_value numeric)
returns numeric
language sql
immutable
as $$
  select round(p_value * 2) / 2;
$$;

-- =====================================================================
-- RPC: start_or_resume_test
-- Returns the exam content for a published test WITHOUT correct_answer,
-- creating (or resuming) this student's in-progress submission.
-- =====================================================================

create or replace function public.start_or_resume_test(p_test_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_test public.tests;
  v_submission_id uuid;
  v_result jsonb;
begin
  select * into v_test from public.tests where id = p_test_id and published = true;
  if v_test.id is null then
    raise exception 'Test not found or not published.';
  end if;

  select id into v_submission_id from public.submissions
    where test_id = p_test_id and student_id = auth.uid() and status = 'in_progress'
    limit 1;

  if v_submission_id is null then
    insert into public.submissions (test_id, student_id) values (p_test_id, auth.uid())
      returning id into v_submission_id;
  end if;

  select jsonb_build_object(
    'submissionId', v_submission_id,
    'test', jsonb_build_object(
      'id', v_test.id, 'title', v_test.title, 'description', v_test.description,
      'reading_duration_min', v_test.reading_duration_min,
      'listening_duration_min', v_test.listening_duration_min,
      'writing_duration_min', v_test.writing_duration_min
    ),
    'passages', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id, 'order_num', p.order_num, 'title', p.title, 'passage_text', p.passage_text,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', q.id, 'order_num', q.order_num, 'question_type', q.question_type,
            'question_text', q.question_text, 'options', q.options
          ) order by q.order_num)
          from public.reading_questions q where q.passage_id = p.id
        ), '[]'::jsonb)
      ) order by p.order_num)
      from public.reading_passages p where p.test_id = p_test_id
    ), '[]'::jsonb),
    'sections', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id, 'order_num', s.order_num, 'title', s.title, 'audio_url', s.audio_url,
        'questions', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', q.id, 'order_num', q.order_num, 'question_type', q.question_type,
            'question_text', q.question_text, 'options', q.options
          ) order by q.order_num)
          from public.listening_questions q where q.section_id = s.id
        ), '[]'::jsonb)
      ) order by s.order_num)
      from public.listening_sections s where s.test_id = p_test_id
    ), '[]'::jsonb),
    'writingTasks', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', w.id, 'task_number', w.task_number, 'prompt_text', w.prompt_text,
        'image_url', w.image_url, 'min_words', w.min_words
      ) order by w.task_number)
      from public.writing_tasks w where w.test_id = p_test_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

grant execute on function public.start_or_resume_test(uuid) to authenticated;

-- =====================================================================
-- RPC: submit_reading_answers / submit_listening_answers
-- Grade against correct_answer (which the caller never sees) and update
-- the submission's raw score + band.
-- =====================================================================

create or replace function public.submit_reading_answers(p_submission_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions;
  v_correct int := 0;
  v_item jsonb;
  v_correct_answer text;
  v_is_correct boolean;
  v_band numeric;
begin
  select * into v_submission from public.submissions
    where id = p_submission_id and student_id = auth.uid() and status = 'in_progress';
  if v_submission.id is null then
    raise exception 'Submission not found or already submitted.';
  end if;

  delete from public.reading_answers where submission_id = p_submission_id;

  for v_item in select * from jsonb_array_elements(p_answers)
  loop
    select correct_answer into v_correct_answer from public.reading_questions where id = (v_item->>'question_id')::uuid;
    if v_correct_answer is null then continue; end if;
    v_is_correct := exists (
      select 1 from unnest(string_to_array(v_correct_answer, '|')) as opt
      where trim(lower(opt)) = trim(lower(coalesce(v_item->>'answer_text','')))
    );
    if v_is_correct then v_correct := v_correct + 1; end if;
    insert into public.reading_answers (submission_id, question_id, answer_text, is_correct)
      values (p_submission_id, (v_item->>'question_id')::uuid, v_item->>'answer_text', v_is_correct);
  end loop;

  v_band := public.ielts_band_from_raw(v_correct, 'reading');
  update public.submissions set reading_raw_score = v_correct, reading_band = v_band where id = p_submission_id;

  return jsonb_build_object('rawScore', v_correct, 'band', v_band);
end;
$$;

grant execute on function public.submit_reading_answers(uuid, jsonb) to authenticated;

create or replace function public.submit_listening_answers(p_submission_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions;
  v_correct int := 0;
  v_item jsonb;
  v_correct_answer text;
  v_is_correct boolean;
  v_band numeric;
begin
  select * into v_submission from public.submissions
    where id = p_submission_id and student_id = auth.uid() and status = 'in_progress';
  if v_submission.id is null then
    raise exception 'Submission not found or already submitted.';
  end if;

  delete from public.listening_answers where submission_id = p_submission_id;

  for v_item in select * from jsonb_array_elements(p_answers)
  loop
    select correct_answer into v_correct_answer from public.listening_questions where id = (v_item->>'question_id')::uuid;
    if v_correct_answer is null then continue; end if;
    v_is_correct := exists (
      select 1 from unnest(string_to_array(v_correct_answer, '|')) as opt
      where trim(lower(opt)) = trim(lower(coalesce(v_item->>'answer_text','')))
    );
    if v_is_correct then v_correct := v_correct + 1; end if;
    insert into public.listening_answers (submission_id, question_id, answer_text, is_correct)
      values (p_submission_id, (v_item->>'question_id')::uuid, v_item->>'answer_text', v_is_correct);
  end loop;

  v_band := public.ielts_band_from_raw(v_correct, 'listening');
  update public.submissions set listening_raw_score = v_correct, listening_band = v_band where id = p_submission_id;

  return jsonb_build_object('rawScore', v_correct, 'band', v_band);
end;
$$;

grant execute on function public.submit_listening_answers(uuid, jsonb) to authenticated;

-- =====================================================================
-- RPC: save_writing_answers / finish_submission
-- =====================================================================

create or replace function public.save_writing_answers(p_submission_id uuid, p_answers jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_submission public.submissions;
  v_item jsonb;
  v_text text;
  v_word_count int;
begin
  select * into v_submission from public.submissions
    where id = p_submission_id and student_id = auth.uid() and status = 'in_progress';
  if v_submission.id is null then
    raise exception 'Submission not found or already submitted.';
  end if;

  delete from public.writing_answers where submission_id = p_submission_id;

  for v_item in select * from jsonb_array_elements(p_answers)
  loop
    v_text := coalesce(v_item->>'answer_text', '');
    if trim(v_text) = '' then
      v_word_count := 0;
    else
      v_word_count := coalesce(array_length(regexp_split_to_array(trim(v_text), '\s+'), 1), 0);
    end if;
    insert into public.writing_answers (submission_id, task_id, answer_text, word_count)
      values (p_submission_id, (v_item->>'task_id')::uuid, v_text, v_word_count);
  end loop;

  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.save_writing_answers(uuid, jsonb) to authenticated;

create or replace function public.finish_submission(p_submission_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.submissions
    set status = 'submitted', submitted_at = now()
    where id = p_submission_id and student_id = auth.uid() and status = 'in_progress';
  if not found then
    raise exception 'Submission not found or already finished.';
  end if;
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.finish_submission(uuid) to authenticated;

-- =====================================================================
-- RPC: grade_writing  (teacher only)
-- Sets band_score/feedback on this submission's writing_answers, then
-- recomputes writing_band (Task 2 weighted double, per IELTS) and
-- overall_band once reading/listening/writing are all present.
-- =====================================================================

create or replace function public.grade_writing(p_submission_id uuid, p_scores jsonb)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner_ok boolean;
  v_item jsonb;
  v_t1 numeric;
  v_t2 numeric;
  v_writing_band numeric;
  v_overall numeric;
  v_reading_band numeric;
  v_listening_band numeric;
begin
  select exists (
    select 1 from public.submissions s join public.tests t on t.id = s.test_id
    where s.id = p_submission_id and t.created_by = auth.uid()
  ) into v_owner_ok;
  if not v_owner_ok then
    raise exception 'Not authorized to grade this submission.';
  end if;

  for v_item in select * from jsonb_array_elements(p_scores)
  loop
    update public.writing_answers
      set band_score = (v_item->>'band_score')::numeric,
          feedback = coalesce(v_item->>'feedback', '')
      where id = (v_item->>'writing_answer_id')::uuid and submission_id = p_submission_id;
  end loop;

  select wa.band_score into v_t1 from public.writing_answers wa join public.writing_tasks wt on wt.id = wa.task_id
    where wa.submission_id = p_submission_id and wt.task_number = 1;
  select wa.band_score into v_t2 from public.writing_answers wa join public.writing_tasks wt on wt.id = wa.task_id
    where wa.submission_id = p_submission_id and wt.task_number = 2;

  if v_t1 is not null and v_t2 is not null then
    v_writing_band := public.round_half((v_t1 + 2 * v_t2) / 3);
  end if;

  select reading_band, listening_band into v_reading_band, v_listening_band
    from public.submissions where id = p_submission_id;

  if v_reading_band is not null and v_listening_band is not null and v_writing_band is not null then
    v_overall := public.round_half((v_reading_band + v_listening_band + v_writing_band) / 3);
  end if;

  update public.submissions
    set writing_task1_band = v_t1, writing_task2_band = v_t2, writing_band = v_writing_band,
        overall_band = v_overall,
        status = case when v_overall is not null then 'graded' else status end
    where id = p_submission_id;

  return jsonb_build_object('ok', true, 'writingBand', v_writing_band, 'overall', v_overall);
end;
$$;

grant execute on function public.grade_writing(uuid, jsonb) to authenticated;

-- =====================================================================
-- RPC: book_speaking_slot  (atomic capacity check)
-- =====================================================================

create or replace function public.book_speaking_slot(p_slot_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_capacity int;
  v_booked int;
  v_already boolean;
begin
  select exists (
    select 1 from public.speaking_bookings where student_id = auth.uid() and status = 'booked'
  ) into v_already;
  if v_already then
    raise exception 'You already have an upcoming speaking test booked. Cancel it before booking another.';
  end if;

  -- Lock the slot row so two students booking at the same instant can't
  -- both slip past the capacity check.
  select capacity into v_capacity from public.speaking_slots where id = p_slot_id for update;
  if v_capacity is null then
    raise exception 'Slot not found.';
  end if;

  select count(*) into v_booked from public.speaking_bookings where slot_id = p_slot_id and status = 'booked';
  if v_booked >= v_capacity then
    raise exception 'This time slot is already full.';
  end if;

  insert into public.speaking_bookings (slot_id, student_id) values (p_slot_id, auth.uid());
  return jsonb_build_object('ok', true);
end;
$$;

grant execute on function public.book_speaking_slot(uuid) to authenticated;

-- =====================================================================
-- STORAGE: listening audio bucket
-- =====================================================================

insert into storage.buckets (id, name, public)
values ('listening-audio', 'listening-audio', true)
on conflict (id) do nothing;

drop policy if exists "anyone can read listening audio" on storage.objects;
create policy "anyone can read listening audio"
  on storage.objects for select
  using (bucket_id = 'listening-audio');

drop policy if exists "teachers can upload listening audio" on storage.objects;
create policy "teachers can upload listening audio"
  on storage.objects for insert to authenticated
  with check (
    bucket_id = 'listening-audio'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );

drop policy if exists "teachers can delete their listening audio" on storage.objects;
create policy "teachers can delete their listening audio"
  on storage.objects for delete to authenticated
  using (
    bucket_id = 'listening-audio'
    and exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = 'teacher')
  );
