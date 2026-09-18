import os
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
    return row


# ==========================================
# INSERT ITEM (plain function, ไม่ผ่าน ADK/LLM)
# ใช้โดย /report ตรงๆ เพราะขั้นตอนนี้ตายตัวอยู่แล้ว ไม่มีอะไรให้ AI ต้อง "ตัดสินใจ"
# ==========================================
def insert_item_direct(item_type, title, description, image_path, location, embedding, user_id):
    if not embedding:
        return {"success": False, "error": "ไม่พบ embedding"}

    data = {
        "type": item_type,
        "title": title,
        "description": description,
        "image_path": image_path,
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

    rows = result.data or []
    return [attach_image_url(x) for x in rows if x.get("score", 0) >= threshold]


# ==========================================
# INSERT ITEM (เวอร์ชัน ADK tool — เก็บไว้เผื่อ agent อื่นเรียกใช้ ปัจจุบัน /report ไม่ได้ใช้แล้ว)
# ==========================================
def insert_item(item_type, title, description, contact_phone, tool_context: ToolContext):
    """
    บันทึก item ลง Supabase
    โดยดึง embedding, image_path, location และ user_id จาก ADK state
    (ไม่รับเป็นพารามิเตอร์จาก LLM เพื่อกันไม่ให้ LLM พิมพ์/เดาผิดหรือส่งค่าว่างมาโดยไม่ตั้งใจ
    ค่าพวกนี้มาจากตัวเลือกจริงที่ผู้ใช้กรอกในฟอร์มเสมอ)
    """

    # ดึง embedding จาก state
    embedding = tool_context.state.get("embedding")

    # ตรวจสอบ embedding
    if not embedding:
        return {
            "success": False,
            "error": "ไม่พบ embedding ใน state"
        }

    # ดึง image_path จาก state (ตั้งค่าไว้ล่วงหน้าตอนสร้าง session ใน routes/agent.py)
    image_path = tool_context.state.get("image_path", "")

    # ดึง location ที่ผู้ใช้เลือกจาก dropdown ในฟอร์มจาก state เช่นเดียวกัน
    location = tool_context.state.get("location", "")

    # ดึง user_id ของผู้ประกาศจาก state เช่นเดียวกัน (None ถ้าไม่ได้ login)
    reporter_user_id = tool_context.state.get("reporter_user_id")

    data = {
        "type": item_type,
        "title": title,
        "description": description,
        "image_path": image_path,
        "location": location,
        "contact_phone": contact_phone,
        "embedding": embedding,
        "status": "active",
        "user_id": reporter_user_id,
    }

    result = supabase.table("items").insert(data).execute()
    return result.data


# ==========================================
# SEARCH VECTOR
# ==========================================
def search_vector(
    current_type,
    tool_context: ToolContext,
    top_k=5,
    threshold=0.7
):

     # ดึง embedding จาก state
    embedding = tool_context.state.get("embedding")

    if not embedding:
        return []

    # กำหนดประเภทที่ต้องการค้นหา
    if current_type == "lost":
        target = "found"

    elif current_type == "found":
        target = "lost"

    else:
        raise ValueError(
            "current_type must be lost or found"
        )

    # ค้นหาด้วย pgvector
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

    rows = result.data or []

    # กรองตาม threshold แล้วเติม image_url ให้แต่ละรายการ
    return [
        attach_image_url(x)
        for x in rows
        if x.get("score", 0) >= threshold
    ]

# ==========================================
# SEARCH BY EMBEDDING (plain function, ไม่ผ่าน ADK state)
# ใช้โดย endpoint /search-by-image ที่ไม่ต้องพึ่ง LLM agent
# ==========================================
def search_by_embedding(embedding: list, top_k: int = 10, threshold: float = 0.3):
    """
    ค้นหาไอเทมที่คล้ายกัน "ข้ามทั้งสองประเภท" (lost + found)
    รับ embedding ตรง ๆ เป็น argument (ไม่ต้องมี ToolContext/session)
    """
    if not embedding:
        return []

    all_rows = []

    for target_type in ("lost", "found"):
        result = (
            supabase
            .rpc(
                "search_items",
                {
                    "query_embedding": embedding,
                    "match_type": target_type,
                    "match_count": top_k
                }
            )
            .execute()
        )
        all_rows.extend(result.data or [])

    matches = [x for x in all_rows if x.get("score", 0) >= threshold]
    matches.sort(key=lambda x: x.get("score", 0), reverse=True)
    matches = [attach_image_url(x) for x in matches[:top_k]]

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
def create_notification(user_id, item_id, matched_item_id, message, match_id=None):
    """สร้างแจ้งเตือน 1 รายการให้ user_id คนหนึ่ง (ข้ามถ้าไม่มี user_id เช่นโพสต์แบบไม่ login)"""
    if not user_id:
        return None

    result = (
        supabase
        .table("notifications")
        .insert(
            {
                "user_id": user_id,
                "item_id": item_id,
                "matched_item_id": matched_item_id,
                "match_id": match_id,
                "message": message,
            }
        )
        .execute()
    )
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
                message=f'พบสิ่งของที่ตรงกับประกาศ "{title}" ของคุณแล้ว ลองเข้าไปตรวจสอบดู แล้วกดยืนยันถ้าใช่ของคุณ',
            )

        if found_data and found_data.get("user_id"):
            title = found_data.get("title") or "ของที่พบ"
            create_notification(
                user_id=found_data["user_id"],
                item_id=found_item_id,
                matched_item_id=lost_item_id,
                match_id=match_id,
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
                message=(
                    f'เจ้าของของหายยืนยันแล้วว่า "{title}" ที่คุณแจ้งพบไว้เป็นของเขาจริง '
                    f'ติดต่อนัดคืนของกันได้เลย แล้วอย่าลืมกดยืนยัน "ได้รับของแล้ว" '
                    f'หลังส่งมอบของเรียบร้อย'
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
    result = (
        supabase
        .table("items")
        .update({"status": status})
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

    supabase.table("matches").update({"status": "confirmed"}).eq("id", match_id).execute()

    _notify_match_owner_confirmed(lost_item_id, found_item_id)

    return {"success": True, "lost_item_id": lost_item_id, "found_item_id": found_item_id}


# ==========================================
# REJECT MATCH (เจ้าของฝั่ง "ของหาย" กดปุ่ม "ไม่ใช่ของฉัน")
# ==========================================
def reject_match(match_id: str):
    """เจ้าของของหายเช็กแล้วพบว่าไม่ใช่ของตัวเอง — ยกเลิกแมทช์นี้ทิ้ง (status='rejected')
    ไอเทมทั้งคู่ยัง active ตามปกติ ไม่แจ้งเตือนอีกฝั่ง เพราะไม่ใช่เรื่องที่เขาต้องรู้
    (ของของเขาก็ยังรอเจ้าของที่ถูกต้องต่อไป ระบบจะยังแมทช์กับของหายอื่นๆ ที่เข้ามาใหม่ได้ตามปกติ)"""
    match_res = (
        supabase.table("matches").select("*").eq("id", match_id).maybe_single().execute()
    )
    if not match_res or not match_res.data:
        return {"success": False, "error": "ไม่พบแมทช์นี้"}

    if match_res.data.get("status") != "pending":
        return {"success": False, "error": "แมทช์นี้ถูกดำเนินการไปแล้ว"}

    supabase.table("matches").update({"status": "rejected"}).eq("id", match_id).execute()
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
        supabase.table("items").select("id, type, title, user_id")
        .eq("id", item_id).maybe_single().execute()
    )
    item_data = item_res.data if item_res else None
    if not item_data:
        return {"success": False, "error": "ไม่พบโพสต์นี้"}

    owner_id = item_data.get("user_id")
    if not owner_id:
        return {"success": False, "error": "โพสต์นี้ไม่มีเจ้าของที่ระบุไว้ แจ้งเตือนไม่ได้"}

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

    if item_type == "lost":
        # โพสต์เป็น "ของหาย" — ผู้กดปุ่มคือคนที่เจอของ กำลังแจ้งเจ้าของ (คนที่ทำของหาย) ว่าเจอแล้ว
        message = (
            f'{claimant_name} แจ้งว่าเจอ "{title}" ที่คุณแจ้งหายไว้แล้ว '
            f"ติดต่อไปนัดรับคืนได้เลย ({contact_text}) ได้ของคืนแล้วอย่าลืมกดยืนยัน \"ได้รับของแล้ว\" ที่โพสต์นี้ด้วย"
        )
    else:
        # โพสต์เป็น "ของที่พบ" (ค่าเริ่มต้น/พฤติกรรมเดิม) — ผู้กดปุ่มคือคนที่ทำของหาย กำลังอ้างว่าเป็นของตัวเอง
        message = (
            f'{claimant_name} แจ้งว่า "{title}" ที่คุณโพสต์ไว้น่าจะเป็นของเขา '
            f"ติดต่อไปตรวจสอบได้เลย ({contact_text}) ส่งคืนของแล้วอย่าลืมกดยืนยัน \"ได้รับของแล้ว\" ที่โพสต์นี้ด้วย"
        )

    create_notification(
        user_id=owner_id,
        item_id=item_id,
        matched_item_id=None,
        message=message,
    )

    return {"success": True, "claim_id": claim_id}


# ==========================================
# CLOSE CLAIMANT'S OWN ORPHANED POST (side-effect ของ confirm_claim)
# ==========================================
def _close_claimant_own_post(claimant_user_id: str, claimed_item_type: str):
    """ถ้าผู้อ้างสิทธิ์มีโพสต์ของตัวเอง (ประเภทตรงข้ามกับไอเทมที่เพิ่งปิดเคสไป) ค้างเป็น active
    อยู่ในระบบ ถือว่าน่าจะเป็นของชิ้นเดียวกันที่เพิ่งจบเคสไปแล้ว (เช่น เขาแจ้งของหายไว้เอง แต่ดันมาเจอ
    โพสต์ของที่พบอีกอันผ่านการไล่ดูหน้าประกาศ แล้วกด claim แทนที่จะรอ AI auto-match) — ถ้าปล่อยไว้
    โพสต์เดิมของเขาจะค้างเป็น active ตลอดไป ไม่โผล่ใน KPI 'พบเจ้าของแล้ว' เลย จึงปิดให้พร้อมกันไปด้วย

    หมายเหตุ: เดาไม่ได้แน่ชัดว่าอันไหนตรงกับเคสนี้จริง ๆ ถ้ามีหลายโพสต์ค้างอยู่ เลือกอันล่าสุดสุด
    (created_at ล่าสุด) เป็น best-effort เท่านั้น"""
    if not claimant_user_id or not claimed_item_type:
        return

    opposite_type = "found" if claimed_item_type == "lost" else "lost"

    try:
        own_posts_res = (
            supabase.table("items").select("id, title")
            .eq("user_id", claimant_user_id)
            .eq("type", opposite_type)
            .eq("status", "active")
            .order("created_at", desc=True)
            .limit(1)
            .execute()
        )
        own_posts = own_posts_res.data or []
        if not own_posts:
            return

        own_item = own_posts[0]
        update_item_status(own_item["id"], "matched")

        create_notification(
            user_id=claimant_user_id,
            item_id=own_item["id"],
            matched_item_id=None,
            message=(
                f'ปิดเคสให้ประกาศ "{own_item.get("title") or "ของคุณ"}" ของคุณด้วยแล้ว '
                f'เพราะน่าจะเป็นของชิ้นเดียวกับที่คุณเพิ่งปิดเคสไป '
                f'ถ้าไม่ใช่ของชิ้นเดียวกัน ติดต่อทีมงานให้เปิดประกาศคืนได้เลย'
            ),
        )
    except Exception as e:
        print(f"[_close_claimant_own_post] error: {e}")


# ==========================================
# CONFIRM CLAIM (ปุ่ม "ได้รับของแล้ว/ส่งคืนของแล้ว" กดได้ทั้ง 2 ฝ่าย)
# ==========================================
def confirm_claim(claim_id: str, confirming_user_id: str = None):
    """ฝ่ายใดฝ่ายหนึ่งกดยืนยันว่ามีการส่งคืนของกันเรียบร้อยแล้ว (เจ้าของโพสต์ หรือ ผู้อ้างสิทธิ์ก็ได้)
    ตอนนี้แหละที่ไอเทมถึงจะเปลี่ยนเป็น matched จริง (หายจากหน้าประกาศทั่วไป
    ไปนับรวมใน KPI 'พบเจ้าของแล้ว' ที่หน้าโปรไฟล์แทน)

    สำคัญ: ต้องแจ้งเตือนไปหา "อีกฝั่งที่ไม่ได้กด" เสมอ ไม่ว่าใครจะเป็นคนกดยืนยันก็ตาม
    (ก่อนหน้านี้เคย hardcode ไว้ว่าแจ้งไปหาผู้อ้างสิทธิ์เท่านั้น ถ้าผู้อ้างสิทธิ์เป็นคนกดเอง
    เจ้าของโพสต์จะไม่มีทางรู้เลยว่าเคสปิดแล้ว)

    ยังปิดโพสต์ของผู้อ้างสิทธิ์เองด้วย ถ้าเขามีโพสต์ประเภทตรงข้ามค้างเป็น active อยู่
    (ดู _close_claimant_own_post ด้านบน — กันไม่ให้โพสต์เก่าค้าง active ตลอดไปทั้งที่เคสจบแล้ว)"""
    claim_res = (
        supabase.table("claims").select("*").eq("id", claim_id).maybe_single().execute()
    )
    if not claim_res or not claim_res.data:
        return {"success": False, "error": "ไม่พบคำขอนี้"}

    claim = claim_res.data
    item_id = claim["item_id"]
    claimant_user_id = claim["claimant_user_id"]

    supabase.table("claims").update({"status": "confirmed"}).eq("id", claim_id).execute()
    update_item_status(item_id, "matched")

    item_res = supabase.table("items").select("type, title, user_id").eq("id", item_id).maybe_single().execute()
    item_data = item_res.data if item_res else {}
    title = item_data.get("title")
    owner_id = item_data.get("user_id")
    item_type = item_data.get("type")

    _close_claimant_own_post(claimant_user_id, item_type)

    # แจ้งไปหา "อีกฝั่งที่ไม่ได้กด" เสมอ
    notify_target = claimant_user_id if confirming_user_id == owner_id else owner_id

    if notify_target:
        create_notification(
            user_id=notify_target,
            item_id=item_id,
            matched_item_id=None,
            message=f'อีกฝั่งยืนยันแล้วว่า "{title or "สิ่งของ"}" ส่งคืนกันเรียบร้อย ปิดเคสนี้ให้แล้ว',
        )

    return {"success": True, "item_id": item_id}