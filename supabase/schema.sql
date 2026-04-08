-- ============================================
-- 업무 할일 DB 스키마
-- Supabase SQL Editor에서 실행
-- ============================================

-- Tasks 테이블
create table public.tasks (
  id          bigint generated always as identity primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  text        text not null,
  done        boolean default false,
  priority    smallint default 2 check (priority between 1 and 3),
  type        text default 'quick' check (type in ('project', 'quick')),
  date_key    text not null,                          -- 'YYYY-MM-DD'
  created_at  timestamptz default now()
);

-- Subtasks 테이블
create table public.subtasks (
  id          bigint generated always as identity primary key,
  task_id     bigint references public.tasks(id) on delete cascade not null,
  text        text not null,
  done        boolean default false,
  done_at     text,                                     -- 'YYYY-MM-DD' 완료 날짜
  sort_order  smallint default 0,
  created_at  timestamptz default now()
);

-- 인덱스
create index idx_tasks_user_date on public.tasks (user_id, date_key);
create index idx_subtasks_task   on public.subtasks (task_id);

-- ============================================
-- Row Level Security (유저별 데이터 격리)
-- ============================================

alter table public.tasks enable row level security;
alter table public.subtasks enable row level security;

-- Tasks: 본인 데이터만 CRUD
create policy "tasks_owner" on public.tasks
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Subtasks: 본인 task의 subtask만 CRUD
create policy "subtasks_owner" on public.subtasks
  for all
  using (task_id in (select id from public.tasks where user_id = auth.uid()))
  with check (task_id in (select id from public.tasks where user_id = auth.uid()));
