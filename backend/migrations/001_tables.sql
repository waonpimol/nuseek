-- ==========================================================
-- 001_tables.sql — โครงสร้างตารางของ NUSeek (schema: public)
-- ==========================================================
-- ทุกส่วนในไฟล์นี้ตรวจจริงจาก Supabase ด้วย 3 คำสั่ง:
--   1) คอลัมน์/ชนิด/nullable/default
--        select table_name, column_name, data_type, is_nullable, column_default
--        from information_schema.columns where table_schema = 'public'
--        order by table_name, ordinal_position;
--   2) index
--        select tablename, indexname, indexdef from pg_indexes where schemaname = 'public';
--   3) constraint (PK / FK / CHECK / UNIQUE)
--        select conrelid::regclass as tbl, conname, pg_get_constraintdef(oid) as definition
--        from pg_constraint where connamespace = 'public'::regnamespace order by 1, 2;
--
-- ยังไม่ได้ตรวจ (ไม่อยู่ในไฟล์นี้): RLS policy, storage bucket/policy, trigger
--
-- ไฟล์นี้ใช้เป็นเอกสารและสคริปต์สร้างฐานข้อมูลเปล่า (create ... if not exists)
-- รันบนฐานข้อมูลที่มีตารางอยู่แล้วจะไม่เปลี่ยนอะไร
-- ลำดับการสร้างสำคัญ: ตารางที่ถูกอ้างอิง (users, items, matches) ต้องมาก่อนตารางที่อ้างอิง
-- ==========================================================

create extension if not exists vector;

-- ---------- users: โปรไฟล์ผู้ใช้ (1 แถวต่อ 1 บัญชีใน auth.users) ----------
-- ลบบัญชีใน auth.users แล้วแถวนี้ถูกลบตามอัตโนมัติ (on delete cascade)
-- ข้อควรรู้: items.user_id อ้างอิงตารางนี้โดยไม่มี cascade — ผู้ใช้ที่เคยโพสต์แล้วจะลบบัญชีไม่ได้
--            จนกว่าจะจัดการโพสต์ของเขาก่อน (แอปยังไม่มีฟีเจอร์ลบบัญชี จึงยังไม่เป็นปัญหา)
create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  first_name varchar(100) not null,
  last_name varchar(100) not null,
  display_name varchar(100),
  avatar_url text,
  phone_number varchar(20),
  line_id varchar(50),
  facebook_url varchar(255),
  instagram_username varchar(50),
  created_at timestamptz not null default timezone('utc'::text, now()),
  updated_at timestamptz not null default timezone('utc'::text, now())
  -- หมายเหตุ: ยังไม่มี check ให้ phone_number เป็นตัวเลขล้วน — ดู 004_users_phone_digits_only.sql
);

-- ---------- items: โพสต์ของหาย / ของที่พบ ----------
-- type   : 'lost' | 'found'            (ฐานข้อมูลไม่ได้บังคับ — บังคับที่โค้ด backend)
-- status : 'active' | 'matched'        (ฐานข้อมูลไม่ได้บังคับ — บังคับที่โค้ด backend)
-- embedding : เวกเตอร์ 384 มิติ จาก paraphrase-multilingual-MiniLM-L12-v2
-- image_path: เก็บเฉพาะชื่อไฟล์ใน bucket items-images (backend แปลงเป็น URL เต็มก่อนส่งให้หน้าเว็บ)
-- contact_phone: เลิกใช้แล้ว (ข้อมูลติดต่อย้ายไปอยู่ที่ users) คงคอลัมน์และ check ไว้เพราะโพสต์เก่ายังมีค่า
-- หมายเหตุ: created_at เป็น timestamp "ไม่มี" timezone — หน้าเว็บจึงตีความเป็น UTC เองใน utils/format.ts
create table if not exists public.items (
  id uuid primary key default gen_random_uuid(),
  type text not null,
  title text,
  description text,
  location text,
  status text default 'active',
  embedding vector(384),
  created_at timestamp without time zone default now(),
  contact_phone text,
  image_path text,
  user_id uuid references public.users(id),
  constraint contact_phone_digits_only
    check (contact_phone is null or contact_phone ~ '^[0-9]*$')
);

-- ---------- matches: คู่ที่ AI จับให้อัตโนมัติ ----------
-- status (บังคับด้วย matches_status_check; ความหมายตามโค้ดใน supabase_tool.py):
--   'pending'   AI เจอแล้ว รอเจ้าของฝั่งของหายยืนยัน        (save_match)
--   'confirmed' เจ้าของยืนยันว่าใช่ของตัวเอง รอส่งมอบของ     (confirm_match)
--   'rejected'  เจ้าของตรวจแล้วไม่ใช่ของตัวเอง              (reject_match)
--   'completed' ส่งมอบของเรียบร้อย จบเคส                    (complete_match)
-- FK ไปที่ items โดยไม่มี cascade — โพสต์ที่มีแมทช์อยู่จะลบไม่ได้ (แอปยังไม่มีฟีเจอร์ลบโพสต์)
create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  lost_item_id uuid references public.items(id),
  found_item_id uuid references public.items(id),
  similarity_score double precision,
  status text default 'pending',
  created_at timestamp without time zone default now(),
  constraint matches_status_check
    check (status in ('pending', 'confirmed', 'rejected', 'completed'))
);

-- ---------- claims: การอ้างสิทธิ์จากหน้าค้นหาด้วยรูป (ไม่มีไอเทมคู่ใน matches) ----------
-- status: 'pending' | 'confirmed'  (ฐานข้อมูลไม่ได้บังคับ)
-- ลบโพสต์หรือผู้ใช้แล้ว claim ที่เกี่ยวข้องถูกลบตาม (on delete cascade)
create table if not exists public.claims (
  id uuid primary key default gen_random_uuid(),
  item_id uuid references public.items(id) on delete cascade,
  claimant_user_id uuid references public.users(id) on delete cascade,
  status text not null default 'pending',
  created_at timestamptz not null default now()
);

-- ---------- notifications: แจ้งเตือนในแอป (กระดิ่ง) ----------
-- ลบผู้ใช้ → แจ้งเตือนของเขาถูกลบตาม / ลบโพสต์หรือแมทช์ → ช่องอ้างอิงถูกเซตเป็น null แต่แจ้งเตือนยังอยู่
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.users(id) on delete cascade,
  item_id uuid references public.items(id) on delete set null,
  matched_item_id uuid references public.items(id) on delete set null,
  message text not null,
  is_read boolean not null default false,
  created_at timestamptz not null default now(),
  match_id uuid references public.matches(id) on delete set null
);

-- ---------- search_logs: บันทึกการค้นหาด้วยรูป (ใช้ debug และทำบทประเมินผล) ----------
-- candidates: jsonb ของแต่ละ candidate รวม score, llm_is_match, llm_confidence,
--             llm_reason, llm_matched_details
create table if not exists public.search_logs (
  id uuid primary key default gen_random_uuid(),
  caption_en text,
  caption_th text,
  candidates jsonb,
  shown_count integer,
  created_at timestamptz default now()
);

create index if not exists idx_search_logs_created_at
  on public.search_logs using btree (created_at desc);

-- ==========================================================
-- ข้อสังเกตจากรายการ index จริง
-- ==========================================================
-- ไม่มี index บน items.embedding — การค้นหาความคล้ายสแกนทุกแถวของประเภทนั้น (exact search)
-- ที่ปริมาณข้อมูลระดับโปรเจกต์เร็วพอและได้ผลตรงที่สุด ถ้าข้อมูลโตมากค่อยเพิ่ม index แบบประมาณค่า เช่น
--   create index on public.items using hnsw (embedding vector_cosine_ops);
-- แต่ index แบบนี้ร่วมกับเงื่อนไข type/status ใน search_items อาจคืนผลน้อยกว่าที่ขอ
-- (ยังไม่ได้ทดสอบ จึงไม่ใส่เป็นของจริงในไฟล์นี้)