create or replace function match_chunks(
  query_embedding vector(1536),
  match_session_id uuid,
  match_count int default 3
)
returns table (
  id uuid,
  document_id uuid,
  session_id uuid,
  chunk_index int,
  content text,
  heading text,
  chunk_type text,
  similarity float
)
language plpgsql
as $$
begin
  return query
  select
    cc.id,
    cc.document_id,
    cc.session_id,
    cc.chunk_index,
    cc.content,
    cc.heading,
    cc.chunk_type,
    1 - (cc.embedding <=> query_embedding) as similarity
  from content_chunks cc
  where cc.session_id = match_session_id
    and cc.embedding is not null
  order by cc.embedding <=> query_embedding
  limit match_count;
end;
$$;
