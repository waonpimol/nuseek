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
def search_similar_items(current_type, embedding, top_k=5, threshold=0.7):
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
                message=f'พบสิ่งของที่ตรงกับประกาศ "{title}" ของคุณแล้ว! ลองเข้าไปตรวจสอบ แล้วกดยืนยันถ้าใช่ของคุณ',
            )

        if found_data and found_data.get("user_id"):
            title = found_data.get("title") or "ของที่พบ"
            create_notification(
                user_id=found_data["user_id"],
                item_id=found_item_id,
                matched_item_id=lost_item_id,
                match_id=match_id,
                message=f'มีคนกำลังตามหาสิ่งของที่ตรงกับ "{title}" ที่คุณแจ้งพบไว้ ลองเข้าไปตรวจสอบ แล้วกดยืนยันถ้าใช่',
            )
    except Exception as e:
        print(f"[_notify_match_owners] error: {e}")


def _notify_match_confirmed(lost_item_id, found_item_id):
    """แจ้งเตือนอีกฝั่งเมื่อมีคนกดยืนยันแมทช์แล้ว (ไม่ต้องมี match_id เพราะจบเคสแล้ว)"""
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
            create_notification(
                user_id=lost_data["user_id"],
                item_id=lost_item_id,
                matched_item_id=found_item_id,
                message="ยืนยันการจับคู่เรียบร้อยแล้ว เคสนี้ปิดแล้วนะ 🎉",
            )
        if found_data and found_data.get("user_id"):
            create_notification(
                user_id=found_data["user_id"],
                item_id=found_item_id,
                matched_item_id=lost_item_id,
                message="ยืนยันการจับคู่เรียบร้อยแล้ว เคสนี้ปิดแล้วนะ 🎉",
            )
    except Exception as e:
        print(f"[_notify_match_confirmed] error: {e}")


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

    # แจ้งเตือนเจ้าของทั้งสองฝั่ง พร้อมแนบ match_id ให้กดยืนยันได้ (ทำเป็น side-effect อัตโนมัติ ไม่ผ่าน LLM)
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
# CONFIRM MATCH (เรียกตอนผู้ใช้กดปุ่ม "ยืนยันว่าใช่ของฉัน" เท่านั้น)
# ==========================================
def confirm_match(match_id: str):
    """เจ้าของฝั่งใดฝั่งหนึ่งกดยืนยันว่าแมทช์นี้ถูกต้องจริง
    ตอนนี้แหละที่ไอเทมทั้งคู่จะถูกเปลี่ยนเป็น 'matched' และหายจากหน้า 'ประกาศทั้งหมด'"""
    match_res = (
        supabase.table("matches").select("*").eq("id", match_id).maybe_single().execute()
    )
    if not match_res or not match_res.data:
        return {"success": False, "error": "ไม่พบแมทช์นี้"}

    match = match_res.data
    lost_item_id = match["lost_item_id"]
    found_item_id = match["found_item_id"]

    supabase.table("matches").update({"status": "confirmed"}).eq("id", match_id).execute()

    update_item_status(lost_item_id, "matched")
    update_item_status(found_item_id, "matched")

    _notify_match_confirmed(lost_item_id, found_item_id)

    return {"success": True, "lost_item_id": lost_item_id, "found_item_id": found_item_id}


# ==========================================
# CLAIM ITEM (ปุ่ม "ใช่ของฉัน" จากหน้าค้นหาด้วยรูปภาพ)
# ==========================================
def claim_item(item_id: str, claimant_user_id: str):
    """ผู้ใช้ที่ค้นหาด้วยรูปภาพ (ยังไม่เคยแจ้งของหายในระบบมาก่อน) กดยืนยันว่าไอเทมนี้เป็นของตัวเอง
    ต่างจาก confirm_match ตรงที่ไม่มี "แมทช์" ที่ AI สร้างไว้ล่วงหน้า
    ขั้นตอนนี้แค่บันทึกลง table claims (status='pending') + แจ้งเตือนเจ้าของโพสต์
    ยังไม่ปิดเคสทันที ต้องรอเจ้าของกดปุ่ม "ได้รับของแล้ว" ก่อน (ดู confirm_claim ด้านล่าง)"""
    item_res = (
        supabase.table("items").select("id, title, user_id")
        .eq("id", item_id).maybe_single().execute()
    )
    item_data = item_res.data if item_res else None
    if not item_data:
        return {"success": False, "error": "ไม่พบโพสต์นี้"}

    owner_id = item_data.get("user_id")
    if not owner_id:
        return {"success": False, "error": "โพสต์นี้ไม่มีเจ้าของที่ระบุไว้ แจ้งเตือนไม่ได้"}

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

    # บันทึกการอ้างสิทธิ์ไว้ก่อน (ยังไม่ปิดเคส) เพื่อให้เจ้าของกด "ได้รับของแล้ว" ยืนยันได้ทีหลัง
    claim_result = (
        supabase.table("claims")
        .insert({"item_id": item_id, "claimant_user_id": claimant_user_id, "status": "pending"})
        .execute()
    )
    claim_row = (claim_result.data or [{}])[0]
    claim_id = claim_row.get("id")

    message = (
        f'{claimant_name} แจ้งว่า "{title}" ที่คุณประกาศไว้น่าจะเป็นของเขา '
        f"ลองติดต่อกลับไปตรวจสอบดูนะ ({contact_text}) พอส่งคืนของแล้วอย่าลืมกดยืนยัน \"ได้รับของแล้ว\" ที่หน้าโพสต์นี้ด้วย"
    )

    create_notification(
        user_id=owner_id,
        item_id=item_id,
        matched_item_id=None,
        message=message,
    )

    return {"success": True, "claim_id": claim_id}


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

    supabase.table("claims").update({"status": "confirmed"}).eq("id", claim_id).execute()
    update_item_status(item_id, "matched")

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
            message=f'อีกฝั่งยืนยันแล้วว่า "{title or "สิ่งของ"}" ถูกส่งคืนเรียบร้อย เคสนี้ปิดแล้วนะ 🎉',
        )

    return {"success": True, "item_id": item_id}