-- ============================================
-- Pretive MVP — Supabase Database Schema
-- ============================================

-- Enable pgvector extension
create extension if not exists vector;

-- ============================================
-- Sessions
-- ============================================
create table if not exists sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references auth.users(id) on delete cascade not null,
  title text not null,
  status text not null default 'draft'
    check (status in ('draft', 'parsed', 'preparing', 'ready', 'live', 'completed', 'error')),
  metadata jsonb default '{}',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ============================================
-- Documents
-- ============================================
create table if not exists documents (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  file_name text not null,
  file_url text not null,
  file_type text not null
    check (file_type in ('pdf', 'pptx', 'docx')),
  file_size bigint,
  parsed_content jsonb,
  status text not null default 'uploaded'
    check (status in ('uploaded', 'parsing', 'parsed', 'error')),
  created_at timestamptz not null default now()
);

-- ============================================
-- Content Chunks (with vector embeddings)
-- ============================================
create table if not exists content_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid references documents(id) on delete cascade not null,
  session_id uuid references sessions(id) on delete cascade not null,
  chunk_index int not null,
  content text not null,
  heading text,
  chunk_type text not null default 'paragraph'
    check (chunk_type in ('heading', 'paragraph', 'list', 'table', 'slide')),
  embedding vector(1536),
  metadata jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- Session Cards (pre-generated support cards)
-- ============================================
create table if not exists session_cards (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  chunk_id uuid references content_chunks(id) on delete set null,
  card_type text not null
    check (card_type in ('summary', 'comparison', 'concept', 'context_bridge', 'fact_check')),
  title text,
  content jsonb not null default '{}',
  display_order int,
  is_approved boolean default false,
  created_at timestamptz not null default now()
);

-- ============================================
-- Session Events (live session log)
-- ============================================
create table if not exists session_events (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id) on delete cascade not null,
  event_type text not null,
  payload jsonb default '{}',
  created_at timestamptz not null default now()
);

-- ============================================
-- Indexes
-- ============================================
create index if not exists idx_sessions_user_id on sessions(user_id);
create index if not exists idx_documents_session_id on documents(session_id);
create index if not exists idx_chunks_session_id on content_chunks(session_id);
create index if not exists idx_chunks_document_id on content_chunks(document_id);
create index if not exists idx_cards_session_id on session_cards(session_id);
create index if not exists idx_events_session_id on session_events(session_id);

-- Vector similarity index (IVFFlat)
create index if not exists idx_chunks_embedding on content_chunks
  using ivfflat (embedding vector_cosine_ops) with (lists = 100);

-- ============================================
-- Row Level Security
-- ============================================
alter table sessions enable row level security;
alter table documents enable row level security;
alter table content_chunks enable row level security;
alter table session_cards enable row level security;
alter table session_events enable row level security;

-- Sessions: users see only their own
create policy "Users manage own sessions"
  on sessions for all
  using (auth.uid() = user_id);

-- Documents: accessible if user owns the session
create policy "Users manage own documents"
  on documents for all
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- Chunks: accessible if user owns the session
create policy "Users manage own chunks"
  on content_chunks for all
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- Cards: accessible if user owns the session
create policy "Users manage own cards"
  on session_cards for all
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- Events: accessible if user owns the session
create policy "Users manage own events"
  on session_events for all
  using (
    session_id in (select id from sessions where user_id = auth.uid())
  );

-- ============================================
-- Updated_at trigger
-- ============================================
create or replace function update_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger sessions_updated_at
  before update on sessions
  for each row
  execute function update_updated_at();

-- ============================================
-- Storage bucket for documents
-- ============================================
-- Run in Supabase dashboard:
-- insert into storage.buckets (id, name, public) values ('documents', 'documents', false);
-- insert into storage.buckets (id, name, public) values ('avatars', 'avatars', true);

-- ============================================
-- Profiles
-- ============================================
create table if not exists profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null default '',
  bio text not null default '',
  avatar_url text,
  job_title text not null default '',
  company text not null default '',
  phone text not null default '',
  timezone text not null default 'UTC',
  language text not null default 'en',
  theme text not null default 'light'
    check (theme in ('light', 'dark', 'system')),
  notification_email boolean not null default true,
  notification_session_end boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on profiles
  for each row
  execute function update_updated_at();

-- Auto-create profile on user sign-up
create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, coalesce(new.raw_user_meta_data->>'full_name', ''));
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row
  execute function handle_new_user();

-- ============================================
-- Organizations
-- ============================================
create table if not exists organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug text not null unique,
  website text,
  industry text,
  size text,
  owner_id uuid references auth.users(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger organizations_updated_at
  before update on organizations
  for each row
  execute function update_updated_at();

-- ============================================
-- Organization Members
-- ============================================
create table if not exists organization_members (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  user_id uuid references auth.users(id) on delete cascade not null,
  role text not null default 'member'
    check (role in ('owner', 'admin', 'member', 'viewer')),
  joined_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

-- ============================================
-- Organization Invitations
-- ============================================
create table if not exists organization_invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid references organizations(id) on delete cascade not null,
  email text not null,
  role text not null default 'member'
    check (role in ('admin', 'member', 'viewer')),
  invited_by uuid references auth.users(id) on delete set null,
  status text not null default 'pending'
    check (status in ('pending', 'accepted', 'declined', 'expired')),
  created_at timestamptz not null default now()
);

-- ============================================
-- Indexes (profiles, orgs, members, invitations)
-- ============================================
create index if not exists idx_organizations_slug on organizations(slug);
create index if not exists idx_organizations_owner_id on organizations(owner_id);
create index if not exists idx_org_members_org_id on organization_members(organization_id);
create index if not exists idx_org_members_user_id on organization_members(user_id);
create index if not exists idx_org_invitations_org_id on organization_invitations(organization_id);
create index if not exists idx_org_invitations_email on organization_invitations(email);

-- ============================================
-- RLS — Profiles
-- ============================================
alter table profiles enable row level security;

create policy "Users manage own profile"
  on profiles for all
  using (auth.uid() = id);

-- ============================================
-- RLS — Organizations
-- ============================================
alter table organizations enable row level security;

create policy "Org members can view their organizations"
  on organizations for select
  using (
    id in (select organization_id from organization_members where user_id = auth.uid())
  );

create policy "Owners can update their organizations"
  on organizations for update
  using (owner_id = auth.uid());

create policy "Authenticated users can create organizations"
  on organizations for insert
  with check (auth.uid() is not null);

-- ============================================
-- RLS — Organization Members
-- ============================================
alter table organization_members enable row level security;

create policy "Org members can view fellow members"
  on organization_members for select
  using (
    organization_id in (select organization_id from organization_members where user_id = auth.uid())
  );

create policy "Org owners/admins manage members"
  on organization_members for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

-- ============================================
-- RLS — Organization Invitations
-- ============================================
alter table organization_invitations enable row level security;

create policy "Org owners/admins manage invitations"
  on organization_invitations for all
  using (
    organization_id in (
      select organization_id from organization_members
      where user_id = auth.uid() and role in ('owner', 'admin')
    )
  );

create policy "Invitees can view their own invitations"
  on organization_invitations for select
  using (email = auth.email());

-- ============================================
-- Session Questions (Q&A module)
-- ============================================
CREATE TABLE IF NOT EXISTS session_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid REFERENCES sessions(id) ON DELETE CASCADE,
  text text NOT NULL,
  participant_name text DEFAULT 'Anonymous',
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'answered', 'dismissed')),
  upvotes int DEFAULT 0,
  ai_context text,
  answer text,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX idx_questions_session ON session_questions(session_id);
ALTER TABLE session_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read session questions" ON session_questions FOR SELECT USING (true);
CREATE POLICY "Anyone can insert questions" ON session_questions FOR INSERT WITH CHECK (true);
CREATE POLICY "Anyone can update questions" ON session_questions FOR UPDATE USING (true);
