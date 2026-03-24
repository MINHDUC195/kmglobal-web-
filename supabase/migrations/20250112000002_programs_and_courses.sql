-- Phase 2: Chương trình học, khóa học cơ bản, khóa học thường

-- Chương trình học (tập hợp khóa học cơ bản)
create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  code text unique,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Khóa học cơ bản (template)
create table if not exists public.base_courses (
  id uuid primary key default gen_random_uuid(),
  program_id uuid references public.programs(id) on delete cascade,
  code text not null,
  name text not null,
  summary text,
  objectives text,
  difficulty_level text,
  prerequisite text,
  -- Phân bổ điểm (%)
  chapter_weight_json jsonb default '{}',
  final_exam_weight_percent numeric default 30,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Khóa học thường (clone từ base, có thời gian mở/đóng)
create table if not exists public.regular_courses (
  id uuid primary key default gen_random_uuid(),
  base_course_id uuid references public.base_courses(id) on delete restrict,
  program_id uuid references public.programs(id) on delete cascade,
  name text not null,
  price_cents bigint default 0,
  registration_open_at timestamptz,
  registration_close_at timestamptz,
  course_start_at timestamptz,
  course_end_at timestamptz,
  status text default 'draft' check (status in ('draft', 'open', 'closed', 'archived')),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Chương (trong khóa học cơ bản)
create table if not exists public.chapters (
  id uuid primary key default gen_random_uuid(),
  base_course_id uuid references public.base_courses(id) on delete cascade,
  sort_order int not null default 0,
  name text not null,
  objectives text,
  weight_percent numeric default 0,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bài học (trong chương)
create table if not exists public.lessons (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references public.chapters(id) on delete cascade,
  sort_order int not null default 0,
  name text not null,
  description text,
  video_url text,
  document_url text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bài tập về nhà (theo chương)
create table if not exists public.homework (
  id uuid primary key default gen_random_uuid(),
  chapter_id uuid references public.chapters(id) on delete cascade,
  name text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Bài thi cuối khóa
create table if not exists public.final_exams (
  id uuid primary key default gen_random_uuid(),
  base_course_id uuid references public.base_courses(id) on delete cascade,
  name text default 'Bài kiểm tra tổng hợp',
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- RLS
alter table public.programs enable row level security;
alter table public.base_courses enable row level security;
alter table public.regular_courses enable row level security;
alter table public.chapters enable row level security;
alter table public.lessons enable row level security;
alter table public.homework enable row level security;
alter table public.final_exams enable row level security;

-- Helper: kiểm tra user có phải owner/admin
create or replace function public.is_owner_or_admin()
returns boolean as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role in ('owner', 'admin')
  );
$$ language sql security definer stable;

-- Owner/Admin: full access
drop policy if exists "Owner admin programs" on public.programs;
create policy "Owner admin programs" on public.programs for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin base_courses" on public.base_courses;
create policy "Owner admin base_courses" on public.base_courses for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin regular_courses" on public.regular_courses;
create policy "Owner admin regular_courses" on public.regular_courses for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin chapters" on public.chapters;
create policy "Owner admin chapters" on public.chapters for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin lessons" on public.lessons;
create policy "Owner admin lessons" on public.lessons for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin homework" on public.homework;
create policy "Owner admin homework" on public.homework for all
  using (public.is_owner_or_admin());

drop policy if exists "Owner admin final_exams" on public.final_exams;
create policy "Owner admin final_exams" on public.final_exams for all
  using (public.is_owner_or_admin());

-- Mọi người xem regular_courses đang mở (cho trang khóa học công khai)
drop policy if exists "Public view open courses" on public.regular_courses;
create policy "Public view open courses" on public.regular_courses
  for select using (status = 'open');
