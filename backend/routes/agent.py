import os
import shutil
import tempfile
import uuid

from fastapi import APIRouter, UploadFile, File, Form, HTTPException
from google import genai

from nuseek.tools.supabase_tool import (
    supabase,
    BUCKET_NAME,
    get_image_url,
    insert_item_direct,
    search_similar_items,
    save_match,
)
from nuseek.tools.blip_tool import generate_caption
from nuseek.tools.embedding_tool import embed_text

router = APIRouter()

# ตัวเดียวใช้เรียก Gemini แบบ one-shot (ไม่ผ่าน ADK Agent/Runner)
# ใช้เฉพาะตอนต้องให้ AI "คิดจริง ๆ" เท่านั้น คือสรุปชื่อสิ่งของตอนผู้ใช้ไม่ได้กรอกมา (ฟอร์ม "แจ้งพบของ")
# ไม่ระบุ api_key ตรงๆ ให้ genai.Client() อ่าน config จาก env vars ชุดเดียวกับที่ ADK agent ใช้อยู่แล้ว (GOOGLE_API_KEY / GOOGLE_GENAI_USE_ENTERPRISE)
_genai_client = genai.Client()


def upload_image_to_supabase(file_path: str, filename: str) -> str:
    """อัปโหลดรูปขึ้น Supabase Storage แล้วคืน "path" ของอ็อบเจกต์ในบัคเก็ต (ไม่ใช่ URL เต็ม)"""
    with open(file_path, "rb") as f:
        supabase.storage.from_(BUCKET_NAME).upload(
            filename,
            f,
            {"content-type": "image/jpeg"},
        )
    return filename


def summarize_title(text: str) -> str:
    """เรียก Gemini แบบ one-shot (เร็วกว่าผ่าน ADK Agent เยอะ เพราะไม่มี tool-calling loop)
    ให้สรุปชื่อสิ่งของสั้น ๆ จากรายละเอียดที่มี ใช้เฉพาะตอนไม่มีชื่อสิ่งของกรอกมาเลย"""
    if not text.strip():
        return "ไม่ระบุชื่อสิ่งของ"

    try:
        response = _genai_client.models.generate_content(
            model="gemini-3.5-flash-lite",
            contents=(
                "สรุปชื่อสิ่งของสั้น ๆ (ไม่เกิน 6 คำ ภาษาไทย) จากรายละเอียดนี้ "
                "ตอบแค่ชื่อสิ่งของอย่างเดียว ห้ามมีคำอธิบายอื่นเพิ่ม:\n\n" + text
            ),
        )
        title = (response.text or "").strip()
        return title or "ไม่ระบุชื่อสิ่งของ"
    except Exception as e:
        print(f"[summarize_title] error: {e}")
        return "ไม่ระบุชื่อสิ่งของ"


@router.post("/report")
async def report_item(
    item_type: str = Form(...),       # "lost" หรือ "found"
    item_name: str = Form(""),        # อาจไม่มี (เช่นฟอร์ม ReportFound ที่ไม่มีช่องชื่อแยก)
    details: str = Form(""),
    phone: str = Form(""),
    location: str = Form(""),         # สถานที่ที่ผู้ใช้เลือกจาก dropdown ในฟอร์ม
    user_id: str = Form(""),          # uuid ของผู้ login ที่ส่งมาจาก frontend (supabase.auth.getUser())
    image: UploadFile | None = File(None),
):
    """
    รับข้อมูลจากฟอร์ม ReportLost / ReportFound แล้วประมวลผลตรง ๆ แบบ deterministic
    (ไม่ผ่าน multi-agent อีกต่อไป เพราะลำดับงานตายตัวอยู่แล้ว ไม่มีอะไรให้ LLM ต้องมา
    "ตัดสินใจ" ว่าจะเรียก tool ไหนต่อ — ตัดรอบ LLM ที่ไม่จำเป็นออก ทำให้เร็วขึ้นมาก
    แต่ AI ยังทำงานจริงทุกจุดเหมือนเดิม: BLIP caption รูป, สร้าง embedding, ค้นหาด้วย vector search
    หน้า "ค้นหาจากรูป" (/search-by-image) ไม่เกี่ยวกับ endpoint นี้เลย ไม่กระทบใด ๆ)
    """

    local_tmp_path = None
    storage_image_path = ""

    # 1) ถ้ามีรูปแนบ: เซฟไฟล์ชั่วคราว + อัปโหลดขึ้น Storage
    if image is not None:
        suffix = os.path.splitext(image.filename or "")[1] or ".jpg"
        local_tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{suffix}")
        with open(local_tmp_path, "wb") as buffer:
            shutil.copyfileobj(image.file, buffer)

        try:
            storage_image_path = upload_image_to_supabase(
                local_tmp_path, os.path.basename(local_tmp_path)
            )
        except Exception as e:
            print(f"[upload_image_to_supabase] error: {e}")

    # 2) แคปรูปด้วย BLIP ตรง ๆ (ถ้ามีรูป) — ไม่ต้องให้ LLM มาตัดสินใจว่าจะเรียกไหม เพราะมีรูปก็ต้อง caption เสมออยู่แล้ว
    caption_text = ""
    if local_tmp_path:
        try:
            caption_text = generate_caption(local_tmp_path).get("caption", "")
        except Exception as e:
            print(f"[generate_caption] error: {e}")

    # 3) รวมข้อความทั้งหมดไว้ใช้สร้าง embedding + (ถ้าจำเป็น) สรุปชื่อ
    combined_text = " ".join(filter(None, [item_name.strip(), details.strip(), caption_text])).strip()

    # 4) สร้าง embedding ตรง ๆ (โมเดล sentence-transformers ตัวเดียวกับที่ /search-by-image ใช้)
    embedding = embed_text(combined_text)

    # หาชื่อสิ่งของ: ถ้าผู้ใช้กรอกมาแล้วใช้เลย ไม่ต้องยุ่งกับ LLM เลย
    #    เรียก AI แค่ตอนไม่มีชื่อจริง ๆ (ฟอร์ม "แจ้งพบของ")
    title = item_name.strip() or summarize_title(combined_text)

    # 6) บันทึกไอเทมลง DB ตรง ๆ
    # หมายเหตุ: description เก็บแค่ข้อความที่ผู้ใช้พิมพ์เอง (details) ไม่เอา caption ของ BLIP
    # มาต่อท้ายให้เห็นในหน้ารายละเอียด — caption ใช้แค่ตอนสร้าง embedding (combined_text) เท่านั้น
    # เพื่อช่วยให้ AI จับคู่แม่นขึ้น โดยไม่ต้องโชว์ข้อความที่ AI มองเห็นให้ผู้ใช้อ่าน
    try:
        insert_result = insert_item_direct(
            item_type=item_type,
            title=title,
            description=details,
            image_path=storage_image_path,
            location=location,
            contact_phone=phone,
            embedding=embedding,
            user_id=user_id or None,
        )
    except Exception as e:
        # ลบไฟล์ชั่วคราวทิ้งก่อน ไม่ว่าจะ error หรือไม่
        if local_tmp_path and os.path.exists(local_tmp_path):
            os.remove(local_tmp_path)

        # ดักจับ error เฉพาะจาก CHECK constraint "contact_phone_digits_only" ที่ตั้งไว้ใน Supabase
        # แปลงเป็นข้อความไทยที่เข้าใจง่าย แทนที่จะโยน error ดิบๆ ของฐานข้อมูลกลับไปให้ frontend
        if "contact_phone_digits_only" in str(e):
            raise HTTPException(
                status_code=400,
                detail="กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขเท่านั้น (ห้ามมีตัวอักษรหรือสัญลักษณ์ปน)",
            )
        raise HTTPException(status_code=500, detail="บันทึกประกาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")

    # 7) ลบไฟล์ชั่วคราวทิ้ง
    if local_tmp_path and os.path.exists(local_tmp_path):
        os.remove(local_tmp_path)

    if not insert_result:
        return {
            "message": "บันทึกประกาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
            "image_url": get_image_url(storage_image_path),
        }

    new_item = insert_result[0]
    new_item_id = new_item["id"]

    # 8) ค้นหาไอเทมประเภทตรงข้ามที่คล้ายกัน แล้วบันทึกแมทช์ทุกอันที่เจอ (ลำดับตายตัว ไม่ต้องมี LLM คิด)
    matches = search_similar_items(item_type, embedding, top_k=5, threshold=0.7)

    for m in matches:
        if item_type == "lost":
            lost_item_id, found_item_id = new_item_id, m["id"]
        else:
            lost_item_id, found_item_id = m["id"], new_item_id
        try:
            save_match(lost_item_id, found_item_id, m.get("score", 0))
        except Exception as e:
            print(f"[save_match] error: {e}")

    # 9) สรุปข้อความกลับไปให้ frontend (จัดรูปประโยคตรง ๆ ไม่ต้องเสีย LLM รอบสุดท้าย)
    if matches:
        best = max(matches, key=lambda x: x.get("score", 0))
        percent = round(best.get("score", 0) * 100)
        message = (
            f'บันทึกประกาศเรียบร้อยแล้ว พบไอเทมที่คล้ายกัน {len(matches)} รายการ '
            f'ใกล้เคียงที่สุด "{best.get("title") or "ไม่ระบุชื่อ"}" ({percent}%) '
            f'ระบบแจ้งเตือนเจ้าของอีกฝั่งให้แล้ว'
        )
    else:
        message = "บันทึกประกาศเรียบร้อยแล้ว ยังไม่พบไอเทมที่ตรงกัน ระบบจะแจ้งเตือนทันทีถ้ามีการแมทช์เกิดขึ้นภายหลัง"

    return {
        "message": message,
        "image_url": get_image_url(storage_image_path),
    }