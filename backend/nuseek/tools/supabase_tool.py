import os
from datetime import datetime, timedelta, timezone
from dotenv import load_dotenv
from supabase import create_client
from google.adk.tools.tool_context import ToolContext

load_dotenv()

# ==========================================
# SUPABASE CLIENT
# ==========================================

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")

supabase = create_client(SUPABASE_URL, SUPABASE_KEY)

# ==========================================
# STORAGE HELPERS
# ==========================================
BUCKET_NAME = "items-images"

# ประกาศที่เปิดไว้เกินกี่วันถือว่าหมดอายุ: ไม่แสดงในหน้ารวม ผลค้นหา และไม่นำไปจับคู่ (ข้อมูลไม่ถูกลบ)
POST_TTL_DAYS = 30
# ค้างอยู่ระหว่างส่งมอบเกินกี่วันถึงจะแจ้งเตือนให้กลับมากดปิดเคส
HANDOVER_REMINDER_DAYS = 3
REMINDER_PREFIX = "เตือนความจำ:"


def listing_cutoff_iso() -> str:
    return (datetime.now(timezone.utc) - timedelta(days=POST_TTL_DAYS)).isoformat()


def _keep_listable(rows: list) -> list:
    """กรองเหลือเฉพาะโพสต์ที่ยัง active และยังไม่หมดอายุ (rpc search_items ไม่ได้กรองสถานะให้)"""
    ids = [r["id"] for r in rows if r.get("id")]
    if not ids:
        return []
    res = (
        supabase.table("items").select("id")
        .in_("id", ids).eq("status", "active").gte("created_at", listing_cutoff_iso())
        .execute()
    )
    listable = {str(r["id"]) for r in (res.data or [])}
    return [r for r in rows if str(r.get("id")) in listable]


def get_image_url(image_path: str | None) -> str:
    """
    แปลง image_path (object path ใน Supabase Storage) ให้เป็น public URL
    ใช้ตอน "อ่าน" ข้อมูลออกไปแสดงผลที่ frontend เท่านั้น
    ไม่เก็บ URL เต็มลง DB แล้ว (DB เก็บแค่ path)
    """
    if not image_path:
        return ""
    return supabase.storage.from_(BUCKET_NAME).get_public_url(image_path)


def attach_image_url(row: dict) -> dict:
    """เติมฟิลด์ image_url (คำนวณจาก image_path) ให้ row ที่ดึงมาจาก DB ก่อนส่งออกไปให้ frontend"""
    if row:
        row["image_url"] = get_image_url(row.get("image_path"))
        paths = row.get("image_paths") or ([row["image_path"]] if row.get("image_path") else [])
        row["image_urls"] = [get_image_url(p) for p in paths]
    return row


# ==========================================
# INSERT ITEM (plain function, ไม่ผ่าน ADK/LLM)
# ใช้โดย /report ตรงๆ เพราะขั้นตอนนี้ตายตัวอยู่แล้ว ไม่มีอะไรให้ AI ต้อง "ตัดสินใจ"
# ==========================================
def insert_item_direct(item_type, title, description, image_path, location, embedding, user_id, image_paths=None):
    if not embedding:
        return {"success": False, "error": "ไม่พบ embedding"}

    data = {
        "type": item_type,
        "title": title,
        "description": description,
        "image_path": image_path,
        "image_paths": image_paths or ([image_path] if image_path else []),  # รูปทั้งหมด
        "location": location,
        "embedding": embedding,
        "status": "active",
        "user_id": user_id,
    }

    result = supabase.table("items").insert(data).execute()
    return result.data


# ==========================================
# SEARCH SIMILAR ITEMS (plain function, ไม่ผ่าน ADK/LLM)
# หา item ประเภทตรงข้าม (lost หา found, found หา lost) ที่คล้ายกันด้วย embedding ที่คำนวณไว้แล้ว
# ==========================================
def search_similar_items(current_type, embedding, top_k=5, threshold=0.6):
    if not embedding:
        return []

    if current_type == "lost":
        target = "found"
    elif current_type == "found":
        target = "lost"
    else:
        raise ValueError("current_type must be lost or found")

    result = (
        supabase
        .rpc(
            "search_items",
            {
                "query_embedding": embedding,
                "match_type": target,
                "match_count": top_k
            }
        )
        .execute()
    )

    rows = _keep_listable(result.data or [])
    return [attach_image_url(x) for x in rows if x.get("score", 0) >= threshold]

# ==========================================
# SEARCH BY EMBEDDING (plain function, ไม่ผ่าน ADK state)
# ใช้โดย endpoint /search-by-image ที่ไม่ต้องพึ่ง LLM agent
# ==========================================
def get_item_ids_by_user(user_id: str) -> list:
    """id ของโพสต์ทั้งหมดที่ user คนนี้เป็นเจ้าของ (ใช้กันไม่ให้ค้นหาด้วยรูปเจอโพสต์ตัวเอง)"""
    if not user_id:
        return []
    result = supabase.table("items").select("id").eq("user_id", user_id).execute()
    return [r["id"] for r in (result.data or [])]


def search_by_embedding(embedding: list, top_k: int = 10, threshold: float = 0.3, exclude_item_ids=None):
    """
    ค้นหาไอเทมที่คล้ายกัน "ข้ามทั้งสองประเภท" (lost + found)
    รับ embedding ตรง ๆ เป็น argument (ไม่ต้องมี ToolContext/session)

    exclude_item_ids: id ที่ไม่ต้องการให้อยู่ในผล (เช่น โพสต์ของผู้ค้นหาเอง)
    ดึงเกินมา len(exclude) ต่อประเภท ก่อนค่อยตัดทิ้ง เพื่อให้หลังตัดแล้วยังเหลือครบ top_k
    (ไม่ใช่ตัดหลังจากที่โพสต์ตัวเองกินโควตา top_k ไปแล้ว)
    """
    if not embedding:
        return []

    exclude = {str(i) for i in (exclude_item_ids or [])}
    fetch_count = top_k + len(exclude)
    all_rows = []

    for target_type in ("lost", "found"):
        result = (
            supabase
            .rpc(
                "search_items",
                {
                    "query_embedding": embedding,
                    "match_type": target_type,
                    "match_count": fetch_count
                }
            )
            .execute()
        )
        all_rows.extend(r for r in (result.data or []) if str(r.get("id")) not in exclude)

    matches = _keep_listable([x for x in all_rows if x.get("score", 0) >= threshold])
    matches.sort(key=lambda x: x.get("score", 0), reverse=True)
    matches = [attach_image_url(x) for x in matches[:top_k]]

    # ฟังก์ชัน search_items บางเวอร์ชันไม่ส่ง created_at กลับมา (ดู migrations/003)
    # ถ้าขาด ให้ดึงเฉพาะ id + created_at ของผลที่จะโชว์มาเติม (query เดียว) เพื่อให้การ์ดแสดงเวลาได้
    missing = [m["id"] for m in matches if not m.get("created_at")]
    if missing:
        try:
            res = supabase.table("items").select("id, created_at").in_("id", missing).execute()
            created = {str(r["id"]): r.get("created_at") for r in (res.data or [])}
            for m in matches:
                if not m.get("created_at"):
                    m["created_at"] = created.get(str(m["id"]))
        except Exception as e:
            print(f"[search] fill created_at failed: {e}")

    return matches


# ==========================================
# SEARCH LOGS (เก็บไว้ debug ย้อนหลัง + ใช้เป็นหลักฐานตอนเขียนบทประเมินผล thesis)
# ==========================================
def log_search_query(caption_en: str, caption_th: str, candidates: list, shown_count: int):
    """บันทึกทุกครั้งที่มีคนค้นหาด้วยรูป: BLIP caption ดิบ, คำแปลไทย, candidate ทุกตัวที่เจอ
    พร้อมคำตัดสินของ verification agent (score, llm_is_match, llm_reason) และจำนวนที่โชว์จริง

    เรียกผ่าน FastAPI BackgroundTasks เสมอ (ดู routes/search.py) — ห้าม await ตรง ๆ ใน request
    path เพราะจะไปหน่วงเวลาตอบกลับผู้ใช้โดยไม่จำเป็น การ log ไม่ใช่สิ่งที่ผู้ใช้ต้องรอ
    ถ้า insert พลาด แค่ print error ทิ้งไว้ ไม่ throw ต่อ เพราะการค้นหาจบไปแล้วตั้งแต่ก่อนเรียกฟังก์ชันนี้"""
    try:
        supabase.table("search_logs").insert({
            "caption_en": caption_en,
            "caption_th": caption_th,
            "candidates": candidates,
            "shown_count": shown_count,
        }).execute()
    except Exception as e:
        print(f"[log_search_query] error: {e}")



# ==========================================
# NOTIFICATIONS
# ==========================================
def create_notification(user_id, item_id, matched_item_id, message, match_id=None, title=None):
    """สร้างแจ้งเตือน 1 รายการให้ user_id คนหนึ่ง (ข้ามถ้าไม่มี user_id เช่นโพสต์แบบไม่ login)
    title = หัวข้อสั้นๆ ที่หน้าเว็บโชว์เป็นตัวหนาเหนือข้อความ (ต้องรัน migration 004 ก่อนถึงจะถูกเก็บ)"""
    if not user_id:
        return None

    row = {
        "user_id": user_id,
        "item_id": item_id,
        "matched_item_id": matched_item_id,
        "match_id": match_id,
        "message": message,
    }

    if title:
        try:
            return supabase.table("notifications").insert({**row, "title": title}).execute().data
        except Exception as e:
            # ยังไม่ได้รัน migration 004 (ไม่มีคอลัมน์ title) → สร้างแบบไม่มีหัวข้อต่อ ไม่ให้แจ้งเตือนหาย
            print(f"[create_notification] insert with title failed, retrying without title: {e}")

    result = supabase.table("notifications").insert(row).execute()
    return result.data


def _notify_match_owners(lost_item_id, found_item_id, match_id):
    """ดึงเจ้าของของทั้ง 2 ไอเทมที่แมทช์กัน แล้วสร้างแจ้งเตือนให้แต่ละฝั่ง (ถ้ามี user_id ผูกไว้)
    แนบ match_id ไปด้วยเสมอ เพื่อให้ frontend เอาไปกดปุ่ม "ยืนยันว่าใช่ของฉัน" ได้"""
    try:
        lost_res = (
            supabase.table("items").select("id, title, user_id")
            .eq("id", lost_item_id).maybe_single().execute()
        )
        found_res = (
            supabase.table("items").select("id, title, user_id")
            .eq("id", found_item_id).maybe_single().execute()
        )

        lost_data = lost_res.data if lost_res else None
        found_data = found_res.data if found_res else None

        if lost_data and lost_data.get("user_id"):
            title = lost_data.get("title") or "ของหาย"
            create_notification(
                user_id=lost_data["user_id"],
                item_id=lost_item_id,
                matched_item_id=found_item_id,
                match_id=match_id,
                title="พบสิ่งของที่ตรงกับของหายของคุณ",
                message=f'พบสิ่งของที่ตรงกับประกาศ "{title}" ของคุณแล้ว ลองเข้าไปตรวจสอบดู แล้วกดยืนยันถ้าใช่ของคุณ',
            )

        if found_data and found_data.get("user_id"):
            title = found_data.get("title") or "ของที่พบ"
            create_notification(
                user_id=found_data["user_id"],
                item_id=found_item_id,
                matched_item_id=lost_item_id,
                match_id=match_id,
                title="มีคนกำลังตามหาของที่คุณพบ",
                message=f'มีคนกำลังตามหาของที่ตรงกับ "{title}" ที่คุณแจ้งพบไว้ ลองเข้าไปตรวจสอบดู แล้วกดยืนยันถ้าใช่',
            )
    except Exception as e:
        print(f"[_notify_match_owners] error: {e}")


def _notify_match_owner_confirmed(lost_item_id, found_item_id):
    """แจ้งเตือนฝั่ง "ผู้แจ้งพบของ" ว่าเจ้าของของหายยืนยันตัวตนแล้วว่าใช่ของเขาจริง (สเตจ 1 จบแล้ว)
    ให้ไปนัดคืนของกันได้ ไม่ต้องแจ้งฝั่งเจ้าของของหาย เพราะเป็นคนกดเอง รู้อยู่แล้ว"""
    try:
        found_res = (
            supabase.table("items").select("id, title, user_id")
            .eq("id", found_item_id).maybe_single().execute()
        )
        found_data = found_res.data if found_res else None

        if found_data and found_data.get("user_id"):
            title = found_data.get("title") or "ของที่พบ"
            create_notification(
                user_id=found_data["user_id"],
                item_id=found_item_id,
                matched_item_id=lost_item_id,
                title="เจ้าของยืนยันว่าเป็นของเขา",
                message=(
                    f'เจ้าของของหายยืนยันแล้วว่า "{title}" ที่คุณแจ้งพบไว้เป็นของเขาจริง '
                    f'กรุณาติดต่อเพื่อนัดส่งคืน และกดยืนยันเมื่อส่งมอบเรียบร้อยแล้ว'
                ),
            )
    except Exception as e:
        print(f"[_notify_match_owner_confirmed] error: {e}")


def _notify_match_completed(lost_item_id, found_item_id, confirming_user_id):
    """แจ้งเตือนไปหา "อีกฝั่งที่ไม่ได้กด" เสมอ ไม่ว่าใครจะเป็นคนกดยืนยัน "ได้รับของแล้ว" ก็ตาม
    (สเตจ 2 จบแล้ว เคสปิดจริง)"""
    try:
        lost_res = (
            supabase.table("items").select("id, title, user_id")
            .eq("id", lost_item_id).maybe_single().execute()
        )
        found_res = (
            supabase.table("items").select("id, title, user_id")
            .eq("id", found_item_id).maybe_single().execute()
        )
        lost_data = lost_res.data if lost_res else None
        found_data = found_res.data if found_res else None

        lost_owner_id = lost_data.get("user_id") if lost_data else None
        found_owner_id = found_data.get("user_id") if found_data else None

        # ถ้าคนกดคือเจ้าของของหาย → แจ้งฝั่งผู้แจ้งพบ และในทางกลับกัน
        if confirming_user_id == lost_owner_id:
            notify_target, notify_item_id, notify_matched_id = found_owner_id, found_item_id, lost_item_id
        else:
            notify_target, notify_item_id, notify_matched_id = lost_owner_id, lost_item_id, found_item_id

        if notify_target:
            create_notification(
                user_id=notify_target,
                item_id=notify_item_id,
                matched_item_id=notify_matched_id,
                title="ปิดเคสเรียบร้อยแล้ว",
                message="อีกฝั่งยืนยันแล้วว่าได้รับของคืนเรียบร้อย ปิดเคสนี้ให้แล้ว",
            )
    except Exception as e:
        print(f"[_notify_match_completed] error: {e}")


# ==========================================
# SAVE MATCH
# ==========================================
def save_match(lost_item_id, found_item_id, similarity_score):
    """บันทึกแมทช์ที่ AI เจอ (status='pending') + แจ้งเตือนเจ้าของทั้งคู่
    หมายเหตุ: ไม่เปลี่ยนสถานะไอเทมเป็น matched ที่นี่แล้ว!
    ไอเทมจะยังโชว์ในหน้า 'ประกาศทั้งหมด' ตามปกติ จนกว่าเจ้าของจะกด "ยืนยัน" เอง
    ผ่าน endpoint /matches/{match_id}/confirm (ดู confirm_match ด้านล่าง)"""
    result = (
        supabase
        .table("matches")
        .insert(
            {
                "lost_item_id": lost_item_id,
                "found_item_id": found_item_id,
                "similarity_score": similarity_score,
                "status": "pending",
            }
        )
        .execute()
    )

    match_row = (result.data or [{}])[0]
    match_id = match_row.get("id")

    # แจ้งเตือนเจ้าของทั้งสองฝั่ง พร้อมแนบ match_id ให้กดยืนยันได้
    _notify_match_owners(lost_item_id, found_item_id, match_id)

    return result.data


# ==========================================
# UPDATE STATUS
# ==========================================
def update_item_status(item_id, status):
    update = {"status": status}
    # บันทึกเวลาที่จบเคส (resolved_at) ตอนเปลี่ยนเป็น matched — ทุกทางที่ปิดเคสผ่านฟังก์ชันนี้ที่เดียว
    # (ยืนยัน/ส่งมอบแมทช์, ยืนยันการอ้างสิทธิ์, ปิดโพสต์ของผู้อ้างสิทธิ์) ใช้เวลานี้แสดง "จบเคส x ที่แล้ว"
    # และคำนวณระยะเวลาที่เคสใช้จนจบ (resolved_at - created_at) ได้
    # ต้องมีคอลัมน์ items.resolved_at ในฐานข้อมูลก่อน (ดูนิยามตารางใน migrations/001_tables.sql)
    if status == "matched":
        update["resolved_at"] = datetime.now(timezone.utc).isoformat()
    result = (
        supabase
        .table("items")
        .update(update)
        .eq("id", item_id)
        .execute()
    )

    return result.data


# ==========================================
# CONFIRM MATCH (สเตจ 1 — เจ้าของฝั่ง "ของหาย" กดปุ่ม "ยืนยันว่าใช่ของฉัน" เท่านั้น)
# ==========================================
def confirm_match(match_id: str):
    """เจ้าของฝั่งของหายกดยืนยันว่าไอเทมนี้คือของของตัวเองจริง (แค่ยืนยัน "ตัวตน" ของสิ่งของ)
    ยังไม่ปิดเคส! ไม่เปลี่ยนสถานะไอเทมเป็น 'matched' ที่นี่ เพราะยังไม่มีการส่งมอบของเกิดขึ้นจริง —
    ถ้าเปลี่ยนทันทีแล้วดันแมทช์ผิด (เช่นแค่รูปคล้ายกัน) จะกู้คืนยาก
    แค่เปลี่ยนแมทช์เป็น 'confirmed' เพื่อบอกอีกฝั่งว่ามั่นใจแล้ว ให้ไปนัดคืนของกันได้
    ไอเทมยังโชว์ในหน้า 'ประกาศทั้งหมด' ตามปกติ จนกว่าจะมีฝ่ายใดฝ่ายหนึ่งกด "ได้รับของแล้ว"
    (ดู complete_match ด้านล่าง ซึ่งเป็นสเตจ 2 ที่ปิดเคสจริง)"""
    match_res = (
        supabase.table("matches").select("*").eq("id", match_id).maybe_single().execute()
    )
    if not match_res or not match_res.data:
        return {"success": False, "error": "ไม่พบแมทช์นี้"}

    match = match_res.data
    if match.get("status") != "pending":
        return {"success": False, "error": "แมทช์นี้ถูกดำเนินการไปแล้ว"}

    lost_item_id = match["lost_item_id"]
    found_item_id = match["found_item_id"]

    if _has_handover_in_progress(lost_item_id) or _has_handover_in_progress(found_item_id):
        return {"success": False, "error": "ของชิ้นนี้กำลังอยู่ระหว่างส่งมอบกับคนอื่นอยู่"}

    supabase.table("matches").update({"status": "confirmed"}).eq("id", match_id).execute()

    _notify_match_owner_confirmed(lost_item_id, found_item_id)

    return {"success": True, "lost_item_id": lost_item_id, "found_item_id": found_item_id}


# ==========================================
# REJECT MATCH (เจ้าของฝั่ง "ของหาย" กดปุ่ม "ไม่ใช่ของฉัน")
# ==========================================
def reject_match(match_id: str):
    """เจ้าของของหายเช็กแล้วพบว่าไม่ใช่ของตัวเอง — ยกเลิกแมทช์นี้ทิ้ง (status='rejected')
    ไอเทมทั้งคู่ยัง active ตามปกติ ไม่แจ้งเตือนอีกฝั่ง เพราะไม่ใช่เรื่องที่เขาต้องรู้
    (ของของเขาก็ยังรอเจ้าของที่ถูกต้องต่อไป ระบบจะยังแมทช์กับของหายอื่นๆ ที่เข้ามาใหม่ได้ตามปกติ)
    ลบแจ้งเตือนของแมทช์นี้ทั้งสองฝั่งทิ้งด้วย ไม่ให้ค้างชวนไปกดยืนยันแมทช์ที่ยกเลิกแล้ว"""
    match_res = (
        supabase.table("matches").select("*").eq("id", match_id).maybe_single().execute()
    )
    if not match_res or not match_res.data:
        return {"success": False, "error": "ไม่พบแมทช์นี้"}

    if match_res.data.get("status") != "pending":
        return {"success": False, "error": "แมทช์นี้ถูกดำเนินการไปแล้ว"}

    supabase.table("matches").update({"status": "rejected"}).eq("id", match_id).execute()
    supabase.table("notifications").delete().eq("match_id", match_id).execute()
    return {"success": True}


# ==========================================
# COMPLETE MATCH (สเตจ 2 — ฝ่ายใดฝ่ายหนึ่งกดปุ่ม "ได้รับของแล้ว/คืนของแล้ว" ปิดเคสจริง)
# ==========================================
def complete_match(match_id: str, confirming_user_id: str = None):
    """ฝ่ายใดฝ่ายหนึ่ง (เจ้าของของหาย หรือ ผู้แจ้งพบ) กดยืนยันว่าได้ส่งมอบของกันจริงแล้ว
    ต้องรอให้แมทช์อยู่ในสถานะ 'confirmed' ก่อนเท่านั้น (เจ้าของของหายต้องกด "ใช่ของฉัน" มาก่อนแล้ว)
    ตอนนี้แหละที่ไอเทมทั้งคู่ถึงจะเปลี่ยนเป็น 'matched' จริง หายจากหน้า 'ประกาศทั้งหมด'"""
    match_res = (
        supabase.table("matches").select("*").eq("id", match_id).maybe_single().execute()
    )
    if not match_res or not match_res.data:
        return {"success": False, "error": "ไม่พบแมทช์นี้"}

    match = match_res.data
    if match.get("status") != "confirmed":
        return {"success": False, "error": "ต้องรอเจ้าของของหายยืนยันตัวตนก่อน ถึงจะปิดเคสได้"}

    lost_item_id = match["lost_item_id"]
    found_item_id = match["found_item_id"]

    supabase.table("matches").update({"status": "completed"}).eq("id", match_id).execute()

    update_item_status(lost_item_id, "matched")
    update_item_status(found_item_id, "matched")
    _reject_open_matches([lost_item_id, found_item_id], keep_match_id=match_id)

    _notify_match_completed(lost_item_id, found_item_id, confirming_user_id)

    return {"success": True, "lost_item_id": lost_item_id, "found_item_id": found_item_id}


# ==========================================
# CLAIM ITEM (ปุ่ม "ใช่ของฉัน" จากหน้าค้นหาด้วยรูปภาพ)
# ==========================================
def claim_item(item_id: str, claimant_user_id: str):
    """ผู้ใช้ที่ไม่ใช่เจ้าของโพสต์กดปุ่มอ้างสิทธิ์/แจ้งว่าเจอของ — ใช้ได้ทั้งสองทิศทาง:
    - โพสต์เป็น "ของที่พบ" (type='found') → ผู้กดคือคนที่ทำของหาย กำลังยืนยันว่า "นี่ของฉัน"
    - โพสต์เป็น "ของหาย" (type='lost') → ผู้กดคือคนที่เจอของ กำลังแจ้งว่า "เจอของชิ้นนี้แล้ว"
    ต่างจาก confirm_match ตรงที่ไม่มี "แมทช์" ที่ AI สร้างไว้ล่วงหน้า (มักมาจากการค้นหาด้วยรูป
    หรือไล่ดูหน้าประกาศทั้งหมดเจอเอง)
    ขั้นตอนนี้แค่บันทึกลง table claims (status='pending') + แจ้งเตือนเจ้าของโพสต์
    ยังไม่ปิดเคสทันที ต้องรอฝ่ายใดฝ่ายหนึ่งกด "ได้รับของแล้ว" ก่อน (ดู confirm_claim ด้านล่าง)"""
    item_res = (
        supabase.table("items").select("id, type, title, user_id, status")
        .eq("id", item_id).maybe_single().execute()
    )
    item_data = item_res.data if item_res else None
    if not item_data:
        return {"success": False, "error": "ไม่พบโพสต์นี้"}

    owner_id = item_data.get("user_id")
    if not owner_id:
        return {"success": False, "error": "โพสต์นี้ไม่มีเจ้าของที่ระบุไว้ แจ้งเตือนไม่ได้"}
    if owner_id == claimant_user_id:
        return {"success": False, "error": "อ้างสิทธิ์โพสต์ของตัวเองไม่ได้"}
    if item_data.get("status") == "matched":
        return {"success": False, "error": "เคสนี้ปิดไปแล้ว"}
    if _has_handover_in_progress(item_id):
        return {"success": False, "error": "โพสต์นี้กำลังอยู่ระหว่างส่งมอบกับคนอื่นอยู่"}

    item_type = item_data.get("type")

    claimant_res = (
        supabase.table("users")
        .select("display_name, phone_number, line_id, facebook_url, instagram_username")
        .eq("id", claimant_user_id).maybe_single().execute()
    )
    claimant = claimant_res.data if claimant_res else {}
    claimant = claimant or {}

    claimant_name = claimant.get("display_name") or "ผู้ใช้ท่านหนึ่ง"

    contact_parts = []
    if claimant.get("phone_number"):
        contact_parts.append(f"เบอร์โทร {claimant['phone_number']}")
    if claimant.get("line_id"):
        contact_parts.append(f"Line {claimant['line_id']}")
    if claimant.get("facebook_url"):
        contact_parts.append(f"Facebook {claimant['facebook_url']}")
    if claimant.get("instagram_username"):
        contact_parts.append(f"Instagram {claimant['instagram_username']}")
    contact_text = " / ".join(contact_parts) if contact_parts else "ยังไม่มีข้อมูลติดต่อ"

    title = item_data.get("title") or "สิ่งของนี้"

    # บันทึกการอ้างสิทธิ์ไว้ก่อน (ยังไม่ปิดเคส) เพื่อให้ฝ่ายใดฝ่ายหนึ่งกด "ได้รับของแล้ว" ยืนยันได้ทีหลัง
    claim_result = (
        supabase.table("claims")
        .insert({"item_id": item_id, "claimant_user_id": claimant_user_id, "status": "pending"})
        .execute()
    )
    claim_row = (claim_result.data or [{}])[0]
    claim_id = claim_row.get("id")

    claim_title = "มีคนแจ้งว่าเจอของของคุณ" if item_type == "lost" else "มีคนแจ้งว่าน่าจะเป็นของเขา"
    if item_type == "lost":
        # โพสต์เป็น "ของหาย" — ผู้กดปุ่มคือคนที่เจอของ กำลังแจ้งเจ้าของ (คนที่ทำของหาย) ว่าเจอแล้ว
        message = (
            f'{claimant_name} แจ้งว่าเจอ "{title}" ที่คุณแจ้งหายไว้แล้ว '
            f"กรุณาติดต่อเพื่อนัดรับคืน ({contact_text}) และกดยืนยันที่ประกาศนี้เมื่อได้รับคืนแล้ว"
        )
    else:
        # โพสต์เป็น "ของที่พบ" (ค่าเริ่มต้น/พฤติกรรมเดิม) — ผู้กดปุ่มคือคนที่ทำของหาย กำลังอ้างว่าเป็นของตัวเอง
        message = (
            f'{claimant_name} แจ้งว่า "{title}" ที่คุณโพสต์ไว้น่าจะเป็นของเขา '
            f"กรุณาติดต่อเพื่อตรวจสอบ ({contact_text}) และกดยืนยันที่ประกาศนี้เมื่อส่งคืนแล้ว"
        )

    create_notification(
        user_id=owner_id,
        item_id=item_id,
        matched_item_id=None,
        title=claim_title,
        message=message,
    )

    return {"success": True, "claim_id": claim_id}


# ==========================================
# EDIT / DELETE OWN POST (เจ้าของโพสต์แก้ไขหรือลบประกาศที่ลงผิด)
# ==========================================
def _get_own_active_item(item_id: str, user_id: str):
    """ตรวจสิทธิ์ร่วมของการแก้ไข/ลบ: ต้องมีโพสต์, เป็นเจ้าของ, และโพสต์ยังไม่จบเคส
    คืน (item, None) ถ้าผ่าน หรือ (None, ข้อความ error) ถ้าไม่ผ่าน
    โพสต์ที่ปิดเคสแล้ว (matched) ถือเป็นประวัติ ใช้นับสถิติและอ้างอิงจากอีกฝั่ง จึงไม่ให้แก้/ลบ"""
    item_res = (
        supabase.table("items")
        .select("id, type, title, user_id, status, image_path, image_paths")
        .eq("id", item_id).maybe_single().execute()
    )
    item = item_res.data if item_res else None
    if not item:
        return None, "ไม่พบโพสต์นี้"
    if not user_id or item.get("user_id") != user_id:
        return None, "ทำได้เฉพาะเจ้าของโพสต์เท่านั้น"
    if item.get("status") == "matched":
        return None, "เคสนี้ปิดไปแล้ว แก้ไขหรือลบไม่ได้"
    return item, None


def _has_handover_in_progress(item_id: str) -> bool:
    """โพสต์นี้กำลังอยู่ระหว่างส่งมอบของหรือไม่ (แมทช์ confirmed หรือมีคำอ้างสิทธิ์ pending)
    ช่วงนี้อีกฝั่งกำลังพึ่งข้อมูลในโพสต์อยู่ จึงไม่ให้แก้ไข"""
    confirmed = (
        supabase.table("matches").select("id")
        .or_(f"lost_item_id.eq.{item_id},found_item_id.eq.{item_id}")
        .eq("status", "confirmed").execute()
    ).data or []
    if confirmed:
        return True
    pending_claims = (
        supabase.table("claims").select("id")
        .eq("item_id", item_id).eq("status", "pending").execute()
    ).data or []
    return bool(pending_claims)


def update_own_item(item_id: str, user_id: str, title: str, description: str, location: str, embedding: list):
    """เจ้าของแก้ชื่อ/รายละเอียด/สถานที่ของโพสต์ที่ยังเปิดอยู่ (embedding คำนวณใหม่โดยผู้เรียก
    เพราะข้อความเปลี่ยน ไม่งั้นการค้นหาจะยังใช้ข้อความเก่า)
    ไม่แก้รูป และไม่สร้างแมทช์ใหม่ย้อนหลัง — แมทช์เดิมที่ค้างอยู่ยังอยู่ตามเดิม"""
    item, err = _get_own_active_item(item_id, user_id)
    if err:
        return {"success": False, "error": err}

    title = (title or "").strip()
    if not title:
        return {"success": False, "error": "ต้องระบุชื่อสิ่งของ"}

    if _has_handover_in_progress(item_id):
        return {"success": False, "error": "กำลังอยู่ระหว่างติดต่อส่งมอบของ แก้ไขตอนนี้ไม่ได้ ถ้าข้อมูลผิดให้ปิดเคสหรือแจ้งอีกฝั่งก่อน"}

    result = (
        supabase.table("items")
        .update({
            "title": title,
            "description": (description or "").strip(),
            "location": (location or "").strip(),
            "embedding": embedding,
        })
        .eq("id", item_id).execute()
    )
    return {"success": True, "item": (result.data or [None])[0]}


def delete_own_item(item_id: str, user_id: str):
    """เจ้าของลบโพสต์ที่ลงผิดทิ้งถาวร (ย้อนกลับไม่ได้) ทำได้เฉพาะโพสต์ที่ยังไม่จบเคส
    - แมทช์ทั้งหมดของโพสต์นี้ถูกลบ (matches อ้างอิง items โดยไม่มี cascade ต้องลบก่อน)
      ฝั่งตรงข้ามของแมทช์ที่ยังค้างอยู่ (pending/confirmed) ได้รับแจ้ง โพสต์ของเขายัง active รอคู่ใหม่
    - คำอ้างสิทธิ์ถูกลบตามโพสต์ (cascade) ผู้ที่อ้างสิทธิ์ค้างอยู่ (pending) ได้รับแจ้ง
    - แจ้งเตือนเก่าที่ชี้มาที่โพสต์นี้ถูกลบ กันกดแล้วเปิดหน้าที่ไม่มีอยู่
    - ลบไฟล์รูปออกจาก Storage ด้วย (ล้มเหลวก็ไม่ย้อนการลบ)"""
    item, err = _get_own_active_item(item_id, user_id)
    if err:
        return {"success": False, "error": err}

    title = item.get("title") or "สิ่งของนี้"

    # เก็บข้อมูลที่ต้องใช้แจ้งอีกฝั่ง "ก่อน" ลบ
    all_matches = (
        supabase.table("matches").select("id, lost_item_id, found_item_id, status")
        .or_(f"lost_item_id.eq.{item_id},found_item_id.eq.{item_id}").execute()
    ).data or []

    other_owner_notices = []
    for m in all_matches:
        if m.get("status") not in ("pending", "confirmed"):
            continue
        other_id = m["found_item_id"] if m["lost_item_id"] == item_id else m["lost_item_id"]
        other_res = (
            supabase.table("items").select("user_id, title")
            .eq("id", other_id).maybe_single().execute()
        )
        other = other_res.data if other_res else None
        if other and other.get("user_id"):
            other_owner_notices.append((other["user_id"], other_id, other.get("title") or "สิ่งของนี้"))

    pending_claims = (
        supabase.table("claims").select("claimant_user_id")
        .eq("item_id", item_id).eq("status", "pending").execute()
    ).data or []

    # ลบ: แจ้งเตือนที่ชี้มาที่โพสต์นี้ → แมทช์ → โพสต์ (claims ถูกลบตาม cascade)
    supabase.table("notifications").delete().or_(
        f"item_id.eq.{item_id},matched_item_id.eq.{item_id}"
    ).execute()
    if all_matches:
        supabase.table("matches").delete().or_(
            f"lost_item_id.eq.{item_id},found_item_id.eq.{item_id}"
        ).execute()
    supabase.table("items").delete().eq("id", item_id).execute()

    # ลบรูปใน Storage (ล้มเหลวก็แค่ทิ้งไฟล์ค้าง ไม่กระทบผลการลบโพสต์)
    paths = item.get("image_paths") or ([item["image_path"]] if item.get("image_path") else [])
    if paths:
        try:
            supabase.storage.from_(BUCKET_NAME).remove(paths)
        except Exception as e:
            print(f"delete_own_item: remove images failed: {e}")

    # แจ้งอีกฝั่ง — ทำหลังลบสำเร็จแล้ว
    for owner_id, other_item_id, other_title in other_owner_notices:
        try:
            create_notification(
                user_id=owner_id, item_id=other_item_id, matched_item_id=None,
                title="ประกาศที่จับคู่กับคุณถูกลบแล้ว",
                message=f'ประกาศ "{title}" ที่เคยแมทช์กับ "{other_title}" ของคุณถูกเจ้าของลบแล้ว แมทช์จึงถูกยกเลิก ประกาศของคุณยังเปิดอยู่ รอคู่ที่ถูกต้องต่อไป',
            )
        except Exception as e:
            print(f"delete_own_item: notify other owner failed: {e}")
    for c in pending_claims:
        try:
            create_notification(
                user_id=c["claimant_user_id"], item_id=None, matched_item_id=None,
                title="ประกาศที่คุณแจ้งถูกลบแล้ว",
                message=f'ประกาศ "{title}" ที่คุณแจ้งไว้ ถูกเจ้าของลบแล้ว',
            )
        except Exception as e:
            print(f"delete_own_item: notify claimant failed: {e}")

    return {"success": True, "cancelled_matches": len(other_owner_notices), "cancelled_claims": len(pending_claims)}


# ==========================================
# CLOSE OWN ITEM (เจ้าของปิดประกาศเอง)
# ==========================================
def close_own_item(item_id: str, user_id: str):
    """เจ้าของปิดประกาศของตัวเอง เมื่อได้ของคืนหรือคืนเจ้าของแล้วนอกขั้นตอนส่งมอบในระบบ (เช่น มีคนโทรมาบอก)
    ถ้ากำลังส่งมอบอยู่ (แมทช์ confirmed / คำอ้างสิทธิ์ค้าง) ต้องใช้ปุ่มของการส่งมอบแทน"""
    item, err = _get_own_active_item(item_id, user_id)
    if err:
        return {"success": False, "error": err}
    if _has_handover_in_progress(item_id):
        return {"success": False, "error": "ประกาศนี้กำลังอยู่ระหว่างส่งมอบ ให้กดปุ่มในกล่องส่งมอบด้านล่างแทน"}
    update_item_status(item_id, "matched")
    _reject_open_matches([item_id])
    return {"success": True}


# ==========================================
# CONFIRM CLAIM (ปุ่ม "ได้รับของแล้ว/ส่งคืนของแล้ว" กดได้ทั้ง 2 ฝ่าย)
# ==========================================
def confirm_claim(claim_id: str, confirming_user_id: str = None):
    """ฝ่ายใดฝ่ายหนึ่งกดยืนยันว่ามีการส่งคืนของกันเรียบร้อยแล้ว (เจ้าของโพสต์ หรือ ผู้อ้างสิทธิ์ก็ได้)
    ตอนนี้แหละที่ไอเทมถึงจะเปลี่ยนเป็น matched จริง (หายจากหน้าประกาศทั่วไป
    ไปนับรวมใน KPI 'พบเจ้าของแล้ว' ที่หน้าโปรไฟล์แทน)

    สำคัญ: ต้องแจ้งเตือนไปหา "อีกฝั่งที่ไม่ได้กด" เสมอ ไม่ว่าใครจะเป็นคนกดยืนยันก็ตาม
    (ก่อนหน้านี้เคย hardcode ไว้ว่าแจ้งไปหาผู้อ้างสิทธิ์เท่านั้น ถ้าผู้อ้างสิทธิ์เป็นคนกดเอง
    เจ้าของโพสต์จะไม่มีทางรู้เลยว่าเคสปิดแล้ว)"""
    claim_res = (
        supabase.table("claims").select("*").eq("id", claim_id).maybe_single().execute()
    )
    if not claim_res or not claim_res.data:
        return {"success": False, "error": "ไม่พบคำขอนี้"}

    claim = claim_res.data
    item_id = claim["item_id"]
    claimant_user_id = claim["claimant_user_id"]

    # อัปเดตเฉพาะตอนที่ยัง pending กันกดซ้ำ/สองฝ่ายกดพร้อมกันแล้วทำงานซ้ำ
    updated = (
        supabase.table("claims").update({"status": "completed"})
        .eq("id", claim_id).eq("status", "pending").execute()
    )
    if not updated.data:
        return {"success": False, "error": "ยืนยันการส่งมอบไปแล้ว"}
    update_item_status(item_id, "matched")
    _reject_open_matches([item_id])

    item_res = supabase.table("items").select("title, user_id").eq("id", item_id).maybe_single().execute()
    item_data = item_res.data if item_res else {}
    title = item_data.get("title")
    owner_id = item_data.get("user_id")

    # แจ้งไปหา "อีกฝั่งที่ไม่ได้กด" เสมอ
    notify_target = claimant_user_id if confirming_user_id == owner_id else owner_id

    if notify_target:
        create_notification(
            user_id=notify_target,
            item_id=item_id,
            matched_item_id=None,
            title="ปิดเคสเรียบร้อยแล้ว",
            message=f'อีกฝั่งยืนยันแล้วว่า "{title or "สิ่งของ"}" ส่งคืนกันเรียบร้อย ปิดเคสนี้ให้แล้ว',
        )

    return {"success": True, "item_id": item_id}

def _reject_open_matches(item_ids: list, keep_match_id=None):
    """ปิดเคสแล้ว: ยกเลิกแมทช์อื่นของโพสต์เหล่านี้ที่ยังค้าง (pending/confirmed) และลบแจ้งเตือนของแมทช์นั้น
    ไม่งั้นโพสต์อีกฝั่งจะค้างรอแมทช์ที่ไม่มีวันจบ"""
    ids = [str(i) for i in item_ids if i]
    if not ids:
        return
    id_list = ",".join(ids)
    try:
        open_rows = (
            supabase.table("matches").select("id")
            .or_(f"lost_item_id.in.({id_list}),found_item_id.in.({id_list})")
            .in_("status", ["pending", "confirmed"]).execute()
        ).data or []
        match_ids = [m["id"] for m in open_rows if str(m["id"]) != str(keep_match_id)]
        if not match_ids:
            return
        supabase.table("matches").update({"status": "rejected"}).in_("id", match_ids).execute()
        supabase.table("notifications").delete().in_("match_id", match_ids).execute()
    except Exception as e:
        print(f"[_reject_open_matches] error: {e}")


def _notify_handover_cancelled(user_id, item_id, title):
    if not user_id:
        return
    create_notification(
        user_id=user_id,
        item_id=item_id,
        matched_item_id=None,
        title="การส่งมอบถูกยกเลิก",
        message=f'การส่งมอบ "{title or "สิ่งของ"}" ถูกยกเลิก เพราะอีกฝ่ายแจ้งว่าไม่ใช่ของชิ้นเดียวกัน ประกาศของคุณยังเปิดอยู่',
    )


def cancel_match(match_id: str, user_id: str):
    """ระหว่างรอส่งมอบ (confirmed) ฝ่ายใดฝ่ายหนึ่งกด "ย้อนไปตามหาใหม่" เมื่อไปเจอกันแล้วไม่ใช่ของชิ้นนี้
    แมทช์เป็น rejected โพสต์ทั้งสองยัง active และแจ้งอีกฝ่าย"""
    match_res = supabase.table("matches").select("*").eq("id", match_id).maybe_single().execute()
    match = match_res.data if match_res else None
    if not match:
        return {"success": False, "error": "ไม่พบแมทช์นี้"}

    items = (
        supabase.table("items").select("id, user_id, title")
        .in_("id", [match["lost_item_id"], match["found_item_id"]]).execute()
    ).data or []
    by_id = {str(i["id"]): i for i in items}
    lost = by_id.get(str(match["lost_item_id"])) or {}
    found = by_id.get(str(match["found_item_id"])) or {}
    if not user_id or user_id not in (lost.get("user_id"), found.get("user_id")):
        return {"success": False, "error": "ทำได้เฉพาะคู่กรณีของแมทช์นี้"}

    updated = (
        supabase.table("matches").update({"status": "rejected"})
        .eq("id", match_id).eq("status", "confirmed").execute()
    )
    if not updated.data:
        return {"success": False, "error": "แมทช์นี้ไม่ได้อยู่ระหว่างส่งมอบแล้ว"}

    other = found if user_id == lost.get("user_id") else lost
    _notify_handover_cancelled(other.get("user_id"), other.get("id"), other.get("title"))
    return {"success": True}


def cancel_claim(claim_id: str, user_id: str):
    """ระหว่างรอส่งมอบของแทร็กอ้างสิทธิ์ ฝ่ายใดฝ่ายหนึ่งกด "ย้อนไปตามหาใหม่"
    ลบคำอ้างสิทธิ์ทิ้ง (ไม่เพิ่มสถานะใหม่ในตาราง claims) โพสต์ยัง active ให้คนอื่นอ้างสิทธิ์ได้อีก และแจ้งอีกฝ่าย"""
    claim_res = supabase.table("claims").select("*").eq("id", claim_id).maybe_single().execute()
    claim = claim_res.data if claim_res else None
    if not claim:
        return {"success": False, "error": "ไม่พบคำขอนี้"}

    item_res = (
        supabase.table("items").select("id, user_id, title")
        .eq("id", claim["item_id"]).maybe_single().execute()
    )
    item = (item_res.data if item_res else None) or {}
    owner_id = item.get("user_id")
    claimant_id = claim.get("claimant_user_id")
    if not user_id or user_id not in (owner_id, claimant_id):
        return {"success": False, "error": "ทำได้เฉพาะคู่กรณีของคำขอนี้"}

    deleted = (
        supabase.table("claims").delete()
        .eq("id", claim_id).eq("status", "pending").execute()
    )
    if not deleted.data:
        return {"success": False, "error": "คำขอนี้ไม่ได้อยู่ระหว่างส่งมอบแล้ว"}

    other_id = claimant_id if user_id == owner_id else owner_id
    _notify_handover_cancelled(other_id, item.get("id"), item.get("title"))
    return {"success": True}


def create_handover_reminders(user_id: str):
    """เตือนให้กลับมากดปิดเคส เมื่อค้างอยู่ระหว่างส่งมอบเกิน HANDOVER_REMINDER_DAYS วัน
    ระบบไม่มีตัวตั้งเวลา จึงเช็กตอนผู้ใช้โหลดแจ้งเตือน และเตือนครั้งเดียวต่อโพสต์"""
    if not user_id:
        return
    try:
        cutoff = (datetime.now(timezone.utc) - timedelta(days=HANDOVER_REMINDER_DAYS)).isoformat()
        my_items = (
            supabase.table("items").select("id, title")
            .eq("user_id", user_id).eq("status", "active").execute()
        ).data or []
        titles = {str(i["id"]): i.get("title") for i in my_items}
        stale_item_ids = set()

        if titles:
            id_list = ",".join(titles)
            confirmed = (
                supabase.table("matches").select("lost_item_id, found_item_id")
                .or_(f"lost_item_id.in.({id_list}),found_item_id.in.({id_list})")
                .eq("status", "confirmed").lt("created_at", cutoff).execute()
            ).data or []
            for m in confirmed:
                mine = m["lost_item_id"] if str(m["lost_item_id"]) in titles else m["found_item_id"]
                stale_item_ids.add(str(mine))
            claims_on_mine = (
                supabase.table("claims").select("item_id")
                .in_("item_id", list(titles)).eq("status", "pending").lt("created_at", cutoff).execute()
            ).data or []
            stale_item_ids.update(str(c["item_id"]) for c in claims_on_mine)

        my_claims = (
            supabase.table("claims").select("item_id")
            .eq("claimant_user_id", user_id).eq("status", "pending").lt("created_at", cutoff).execute()
        ).data or []
        claimed_ids = [str(c["item_id"]) for c in my_claims]
        if claimed_ids:
            claimed_items = (
                supabase.table("items").select("id, title").in_("id", claimed_ids).execute()
            ).data or []
            titles.update({str(i["id"]): i.get("title") for i in claimed_items})
            stale_item_ids.update(claimed_ids)

        if not stale_item_ids:
            return
        already = (
            supabase.table("notifications").select("item_id")
            .eq("user_id", user_id).in_("item_id", list(stale_item_ids))
            .like("message", f"{REMINDER_PREFIX}%").execute()
        ).data or []
        reminded = {str(n["item_id"]) for n in already}

        for item_id in stale_item_ids - reminded:
            create_notification(
                user_id=user_id,
                item_id=item_id,
                matched_item_id=None,
                title="อย่าลืมกดปิดเคส",
                message=(
                    f'{REMINDER_PREFIX} ส่งมอบ "{titles.get(item_id) or "สิ่งของ"}" กันเรียบร้อยแล้วหรือยัง? '
                    'ถ้าเรียบร้อยแล้วกดยืนยันเพื่อปิดเคส ถ้าไม่ใช่ของชิ้นนี้ กด "ย้อนไปตามหาใหม่"'
                ),
            )
    except Exception as e:
        print(f"[create_handover_reminders] error: {e}")
