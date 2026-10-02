-- Luna initial schema (v0.1)

create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- 1. profiles
create table public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text,
  email text,
  timezone text not null default 'UTC',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 2. projects
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  description text,
  status text not null default 'active' check (status in ('active','paused','completed','archived')),
  current_phase text,
  next_action text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 3. tasks
create table public.tasks (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  description text,
  status text not null default 'todo' check (status in ('todo','in_progress','completed','cancelled')),
  priority text not null default 'medium' check (priority in ('low','medium','high','urgent')),
  due_date date,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 4. notes
create table public.notes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  project_id uuid references public.projects(id) on delete set null,
  title text not null,
  content text not null default '',
  category text not null default 'general',
  search_vector tsvector generated always as (
    to_tsvector('simple', coalesce(title, '') || ' ' || coalesce(content, ''))
  ) stored,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 5. note_tags
create table public.note_tags (
  id uuid primary key default gen_random_uuid(),
  note_id uuid not null references public.notes(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  tag text not null,
  created_at timestamptz not null default now(),
  unique (note_id, tag)
);

-- 6. assistant_memories
create table public.assistant_memories (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in ('preference','profile','project_decision','workflow','important_fact')),
  key text not null,
  value text not null,
  importance smallint not null default 3 check (importance between 1 and 5),
  status text not null default 'active' check (status in ('active','archived')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, category, key)
);

-- 7. conversations
create table public.conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null default 'New conversation',
  last_message_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 8. messages
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user','assistant','system')),
  content text not null,
  provider text,
  model text,
  suggested_actions jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

-- 9. conversation_summaries
create table public.conversation_summaries (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null unique references public.conversations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  summary text not null,
  messages_covered integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 10. focus_sessions
create table public.focus_sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  task_id uuid references public.tasks(id) on delete set null,
  project_id uuid references public.projects(id) on delete set null,
  duration_minutes smallint not null check (duration_minutes in (25,45,60,90)),
  status text not null default 'active' check (status in ('active','completed','cancelled')),
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  actual_minutes integer,
  created_at timestamptz not null default now()
);

-- 11. assistant_settings
create table public.assistant_settings (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null unique references auth.users(id) on delete cascade,
  response_mode text not null default 'normal' check (response_mode in ('short','normal','detailed')),
  voice_max_sentences smallint not null default 3 check (voice_max_sentences between 1 and 3),
  primary_provider text not null default 'openrouter',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- 12. tool_audit_logs
create table public.tool_audit_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  conversation_id uuid references public.conversations(id) on delete set null,
  action_type text not null,
  status text not null check (status in ('proposed','confirmed','executed','rejected','failed')),
  source text not null default 'chat',
  payload jsonb not null default '{}'::jsonb,
  result jsonb,
  error text,
  created_at timestamptz not null default now()
);

-- Indexes
create index idx_projects_user_status on public.projects (user_id, status);
create index idx_tasks_user_status_due on public.tasks (user_id, status, due_date);
create index idx_tasks_project on public.tasks (project_id);
create index idx_notes_user_updated on public.notes (user_id, updated_at desc);
create index idx_notes_project on public.notes (project_id);
create index idx_notes_search on public.notes using gin (search_vector);
create index idx_note_tags_user_tag on public.note_tags (user_id, tag);
create index idx_note_tags_note on public.note_tags (note_id);
create index idx_memories_user_status on public.assistant_memories (user_id, status, importance desc);
create index idx_conversations_user_last on public.conversations (user_id, last_message_at desc);
create index idx_messages_conversation on public.messages (conversation_id, created_at);
create index idx_focus_user_started on public.focus_sessions (user_id, started_at desc);
create unique index idx_focus_one_active on public.focus_sessions (user_id) where status = 'active';
create index idx_audit_user_created on public.tool_audit_logs (user_id, created_at desc);

-- updated_at triggers
create trigger trg_profiles_updated before update on public.profiles for each row execute function public.set_updated_at();
create trigger trg_projects_updated before update on public.projects for each row execute function public.set_updated_at();
create trigger trg_tasks_updated before update on public.tasks for each row execute function public.set_updated_at();
create trigger trg_notes_updated before update on public.notes for each row execute function public.set_updated_at();
create trigger trg_memories_updated before update on public.assistant_memories for each row execute function public.set_updated_at();
create trigger trg_conversations_updated before update on public.conversations for each row execute function public.set_updated_at();
create trigger trg_summaries_updated before update on public.conversation_summaries for each row execute function public.set_updated_at();
create trigger trg_settings_updated before update on public.assistant_settings for each row execute function public.set_updated_at();

-- Row Level Security
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.tasks enable row level security;
alter table public.notes enable row level security;
alter table public.note_tags enable row level security;
alter table public.assistant_memories enable row level security;
alter table public.conversations enable row level security;
alter table public.messages enable row level security;
alter table public.conversation_summaries enable row level security;
alter table public.focus_sessions enable row level security;
alter table public.assistant_settings enable row level security;
alter table public.tool_audit_logs enable row level security;

create policy "profiles_owner" on public.profiles for all to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

create policy "projects_owner" on public.projects for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "tasks_owner" on public.tasks for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
    ))
  );

create policy "notes_owner" on public.notes for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
    ))
  );

create policy "note_tags_owner" on public.note_tags for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.notes n where n.id = note_id and n.user_id = (select auth.uid())
    )
  );

create policy "memories_owner" on public.assistant_memories for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "conversations_owner" on public.conversations for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "messages_owner" on public.messages for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create policy "summaries_owner" on public.conversation_summaries for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.conversations c where c.id = conversation_id and c.user_id = (select auth.uid())
    )
  );

create policy "focus_owner" on public.focus_sessions for all to authenticated
  using (user_id = (select auth.uid()))
  with check (
    user_id = (select auth.uid())
    and (project_id is null or exists (
      select 1 from public.projects p where p.id = project_id and p.user_id = (select auth.uid())
    ))
    and (task_id is null or exists (
      select 1 from public.tasks t where t.id = task_id and t.user_id = (select auth.uid())
    ))
  );

create policy "settings_owner" on public.assistant_settings for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy "audit_select_owner" on public.tool_audit_logs for select to authenticated
  using (user_id = (select auth.uid()));

create policy "audit_insert_owner" on public.tool_audit_logs for insert to authenticated
  with check (user_id = (select auth.uid()));

-- Profile + settings creation after signup
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, email, full_name)
  values (
    new.id,
    new.email,
    coalesce(nullif(new.raw_user_meta_data ->> 'full_name', ''), split_part(new.email, '@', 1))
  );
  insert into public.assistant_settings (user_id) values (new.id);
  return new;
end;
$$;

revoke all on function public.handle_new_user() from public, anon, authenticated;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();