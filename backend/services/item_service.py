from nuseek.tools.supabase_tool import supabase, attach_image_url

# ระบุ column ที่ต้องใช้จริงๆ ในการแสดงผล (ไม่เอา "embedding" ติดมาด้วย
# เพราะเป็นเวกเตอร์ตัวเลขขนาดใหญ่ที่ frontend ไม่ได้ใช้เลย แต่ทำให้ query ช้าลงมากถ้าดึงมาทุกครั้ง)
# ดึงข้อมูลติดต่อทั้งหมดจากโปรไฟล์ผู้ใช้ (users) แทนที่จะเก็บซ้ำเป็น contact_phone ต่อโพสต์
ITEM_COLUMNS = "id, type, title, description, image_path, location, status, user_id, created_at, users(display_name, avatar_url, phone_number, line_id, facebook_url, instagram_username)"


def _attach_reporter_name(row: dict) -> dict:
    """แปลง nested users: {...} ที่ join มา ให้เป็นฟิลด์เดี่ยวๆ ใช้ง่ายฝั่ง frontend
    รวมถึงข้อมูลติดต่อทุกช่องทางจากโปรไฟล์ (เบอร์โทร, Line, Facebook, Instagram)"""
    if row:
        reporter = row.pop("users", None) or {}
        row["reporter_name"] = reporter.get("display_name") or "ผู้ประกาศ"
        row["reporter_avatar_url"] = reporter.get("avatar_url") or None
        row["reporter_phone"] = reporter.get("phone_number") or None
        row["reporter_line_id"] = reporter.get("line_id") or None
        row["reporter_facebook_url"] = reporter.get("facebook_url") or None
        row["reporter_instagram_username"] = reporter.get("instagram_username") or None
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


def _attach_matched_with(row: dict) -> dict:
    """ถ้า item นี้ status='matched' แล้ว (ยืนยันแมทช์เรียบร้อย) ให้ไปดึงข้อมูลของ "อีกฝั่ง"
    ที่แมทช์กัน (ชื่อผู้ประกาศ, รูป, เบอร์โทร, ชื่อสิ่งของ) มาแนบเป็น matched_with
    เพื่อให้หน้า PostDetail โชว์ทั้งผู้ประกาศเดิม + อีกฝั่งที่แมทช์กันพร้อมกันได้"""
    row["matched_with"] = None
    if not row or row.get("status") != "matched":
        return row

    item_id = row.get("id")

    match_res = (
        supabase.table("matches").select("lost_item_id, found_item_id")
        .or_(f"lost_item_id.eq.{item_id},found_item_id.eq.{item_id}")
        .eq("status", "confirmed")
        .limit(1).execute()
    )
    match_rows = match_res.data or []
    if not match_rows:
        return row

    match = match_rows[0]
    other_item_id = match["found_item_id"] if match["lost_item_id"] == item_id else match["lost_item_id"]

    other_res = (
        supabase.table("items")
        .select("id, title, users(display_name, avatar_url, phone_number, line_id, facebook_url, instagram_username)")
        .eq("id", other_item_id).maybe_single().execute()
    )
    other_data = other_res.data if other_res else None
    if other_data:
        reporter = other_data.get("users") or {}
        row["matched_with"] = {
            "item_id": other_data.get("id"),
            "title": other_data.get("title") or "ไม่ระบุชื่อ",
            "reporter_name": reporter.get("display_name") or "ผู้ประกาศ",
            "reporter_avatar_url": reporter.get("avatar_url"),
            "reporter_phone": reporter.get("phone_number"),
            "reporter_line_id": reporter.get("line_id"),
            "reporter_facebook_url": reporter.get("facebook_url"),
            "reporter_instagram_username": reporter.get("instagram_username"),
        }

    return row


def _attach_pending_claim(row: dict) -> dict:
    """ถ้า item นี้มีการ "อ้างสิทธิ์" (claim) ที่ยังไม่ยืนยัน (status='pending') ให้แนบ pending_claim_id
    + pending_claim_claimant_id ไปด้วย เพื่อให้หน้า PostDetail โชว์ปุ่ม "ได้รับของแล้ว/คืนของแล้ว"
    ให้ทั้งเจ้าของโพสต์ (ฝั่งพบของ) และผู้อ้างสิทธิ์ (ฝั่งทำของหาย) กดปิดเคสได้ทั้งคู่"""
    row["pending_claim_id"] = None
    row["pending_claim_claimant_id"] = None
    if not row:
        return row

    claim_res = (
        supabase.table("claims").select("id, claimant_user_id")
        .eq("item_id", row.get("id")).eq("status", "pending")
        .limit(1).execute()
    )
    claim_rows = claim_res.data or []
    if claim_rows:
        row["pending_claim_id"] = claim_rows[0]["id"]
        row["pending_claim_claimant_id"] = claim_rows[0]["claimant_user_id"]

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
    row = _attach_pending_match(_attach_reporter_name(attach_image_url(result.data)))
    row = _attach_matched_with(row)
    return _attach_pending_claim(row)