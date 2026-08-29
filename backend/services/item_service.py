from nuseek.tools.supabase_tool import supabase, attach_image_url

# ระบุ column ที่ต้องใช้จริงๆ ในการแสดงผล (ไม่เอา "embedding" ติดมาด้วย
# เพราะเป็นเวกเตอร์ตัวเลขขนาดใหญ่ที่ frontend ไม่ได้ใช้เลย แต่ทำให้ query ช้าลงมากถ้าดึงมาทุกครั้ง)
ITEM_COLUMNS = "id, type, title, description, image_path, location, contact_phone, status, user_id, created_at, users(display_name, avatar_url)"


def _attach_reporter_name(row: dict) -> dict:
    """แปลง nested users: {display_name, avatar_url} ที่ join มา ให้เป็นฟิลด์เดี่ยวๆ ใช้ง่ายฝั่ง frontend"""
    if row:
        reporter = row.pop("users", None)
        row["reporter_name"] = (reporter or {}).get("display_name") or "ผู้ประกาศ"
        row["reporter_avatar_url"] = (reporter or {}).get("avatar_url") or None
    return row


def get_all_items():
    """หน้า 'ประกาศทั้งหมด' — แสดงเฉพาะไอเทมที่ยัง active เท่านั้น
    (ไอเทมที่แมทช์กันแล้วจะถูก set เป็น status='matched' อัตโนมัติใน save_match
    เลยไม่โผล่ที่นี่ แต่ข้อมูลยังอยู่ครบ ดึงผ่าน get_items_by_user ได้)"""

    result = (
        supabase
        .table("items")
        .select(ITEM_COLUMNS)
        .eq("status", "active")
        .execute()
    )

    return [_attach_reporter_name(attach_image_url(row)) for row in (result.data or [])]


def get_items_by_user(user_id: str):
    """หน้าโปรไฟล์ 'ประกาศของฉัน' — แสดงทุกสถานะ (active + matched) ของผู้ใช้คนนั้น"""

    result = (
        supabase
        .table("items")
        .select(ITEM_COLUMNS)
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .execute()
    )

    return [_attach_reporter_name(attach_image_url(row)) for row in (result.data or [])]


def _attach_pending_match(row: dict) -> dict:
    """ถ้า item นี้มีแมทช์ที่ยังไม่ยืนยัน (status='pending') ให้แนบข้อมูลไปด้วย เพื่อให้หน้า PostDetail
    โชว์ปุ่ม "ยืนยันว่าใช่ของฉัน" ได้ถูกจุด

    สำคัญ: ปุ่มต้องโชว์ให้ "เจ้าของฝั่งของหาย (lost)" เท่านั้น ไม่ว่าจะกำลังดูโพสต์ไหนอยู่ก็ตาม
    (โพสต์ของหายของตัวเอง หรือโพสต์ของที่พบของคนอื่นที่แมทช์มา) เพราะฉะนั้นต้องแนบ
    pending_match_lost_owner_id (user_id ของเจ้าของฝั่งของหาย) ไปด้วยเสมอ ให้ frontend เทียบกับ
    user ที่ login อยู่เอง"""
    row["pending_match_id"] = None
    row["pending_match_lost_owner_id"] = None
    if not row:
        return row

    item_id = row.get("id")
    lost_match = (
        supabase.table("matches").select("id, lost_item_id")
        .eq("lost_item_id", item_id).eq("status", "pending")
        .limit(1).execute()
    )
    found_match = (
        supabase.table("matches").select("id, lost_item_id")
        .eq("found_item_id", item_id).eq("status", "pending")
        .limit(1).execute()
    )

    match_rows = (lost_match.data or []) + (found_match.data or [])
    if match_rows:
        match = match_rows[0]
        row["pending_match_id"] = match["id"]

        lost_owner_res = (
            supabase.table("items").select("user_id")
            .eq("id", match["lost_item_id"]).maybe_single().execute()
        )
        row["pending_match_lost_owner_id"] = (lost_owner_res.data or {}).get("user_id") if lost_owner_res else None

    return row


def get_item_by_id(item_id: str):
 
    result = (
        supabase
        .table("items")
        .select(ITEM_COLUMNS)
        .eq("id", item_id)
        .maybe_single()
        .execute()
    )
 
    if not result or not result.data:
        return None
    return _attach_pending_match(_attach_reporter_name(attach_image_url(result.data)))