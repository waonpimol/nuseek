-- ==========================================================
-- 003_search_items_add_created_at.sql — เพิ่ม created_at ในผลของ search_items
-- ==========================================================
-- เหตุผล: หน้า "ค้นหาด้วยรูปภาพ" ต้องแสดงเวลาที่โพสต์ แต่ฟังก์ชันเดิมไม่ส่งคอลัมน์นี้กลับมา
--         (หน้าเว็บเคยขึ้น "NaN เดือนที่แล้ว" จึงซ่อนบรรทัดเวลาเมื่อไม่มีค่า)
--
-- ต้อง drop ก่อน เพราะ create or replace เปลี่ยนรายการคอลัมน์ที่คืนกลับไม่ได้
-- ช่วงระหว่าง drop กับ create ฟังก์ชันจะหายไปชั่วขณะ — รันทั้งไฟล์ในครั้งเดียวและทำนอกเวลาใช้งาน
-- ไม่ต้องแก้โค้ด backend/หน้าเว็บ: ผลลัพธ์ถูกส่งต่อทั้งแถว และหน้าเว็บโชว์เวลาเมื่อมีค่าอยู่แล้ว
-- ==========================================================

begin;

drop function if exists public.search_items(vector, text, integer);

create function public.search_items(
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
  created_at timestamp without time zone,
  score double precision
)
language sql
as $function$
  select
    items.id,
    items.type,
    items.title,
    items.description,
    items.image_path,
    items.location,
    items.created_at,
    1 - (items.embedding <=> query_embedding) as score
  from items
  where items.type = match_type
    and items.status = 'active'
  order by items.embedding <=> query_embedding
  limit match_count;
$function$;

commit;
