-- ==========================================================
-- 002_search_items.sql — ฟังก์ชันค้นหาความคล้าย (เวอร์ชันเดิม)
-- ==========================================================
-- ดึงจริงจาก Supabase ด้วย
--   select pg_get_functiondef(oid) from pg_proc where proname = 'search_items';
-- เก็บไว้เป็นประวัติของเวอร์ชันก่อนเพิ่ม created_at (ดู 003)
--
-- <=> คือ cosine distance ของ pgvector (ยิ่งน้อยยิ่งคล้าย) แปลงเป็น score = 1 - distance
-- เรียกจาก backend: supabase.rpc("search_items", {query_embedding, match_type, match_count})
-- ==========================================================

create or replace function public.search_items(
  query_embedding vector,
  match_type text,
  match_count integer
)
returns table(
  id uuid,
  type text,
  title text,
  description text,
  image_path text,
  location text,
  score double precision
)
language sql
as $function$
  select
    id,
    type,
    title,
    description,
    image_path,
    location,
    1 - (embedding <=> query_embedding) as score
  from items
  where type = match_type
    and status = 'active'
  order by embedding <=> query_embedding
  limit match_count;
$function$;
