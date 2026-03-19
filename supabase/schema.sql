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
    check (status in ('draft', 'preparing', 'ready', 'live', 'completed')),
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
