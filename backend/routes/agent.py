import mimetypes
import os
import shutil
import tempfile
import uuid

from fastapi import APIRouter, UploadFile, File, Form, HTTPException

from nuseek.tools.supabase_tool import (
    supabase,
    BUCKET_NAME,
    get_image_url,
    insert_item_direct,
    search_similar_items,
    save_match,
)
from nuseek.tools.embedding_tool import embed_text

router = APIRouter()

MAX_IMAGES = 5  # จำนวนรูปสูงสุดต่อ 1 ประกาศ (ต้องตรงกับค่าในหน้า ReportLost/ReportFound)


def upload_image_to_supabase(file_path: str, filename: str) -> str:
    """อัปโหลดรูปขึ้น Supabase Storage แล้วคืน "path" ของอ็อบเจกต์ในบัคเก็ต (ไม่ใช่ URL เต็ม)"""
    with open(file_path, "rb") as f:
        supabase.storage.from_(BUCKET_NAME).upload(
            filename,
            f,
            {"content-type": mimetypes.guess_type(filename)[0] or "image/jpeg"},
        )
    return filename


@router.post("/report")
async def report_item(
    item_type: str = Form(...),       # "lost" หรือ "found"
    item_name: str = Form(...),       # ผู้ใช้ต้องกรอกเองเสมอ ไม่มี AI สรุปให้อีกต่อไป
    details: str = Form(""),
    location: str = Form(""),         # สถานที่ที่ผู้ใช้เลือกจาก dropdown ในฟอร์ม
    user_id: str = Form(""),          # uuid ของผู้ login ที่ส่งมาจาก frontend (supabase.auth.getUser())
    images: list[UploadFile] = File(default=[]),   # แนบได้หลายรูป (สูงสุด MAX_IMAGES) รูปแรก = รูปปก
    image: UploadFile | None = File(None),         # ช่องเดิมรูปเดียว เก็บไว้ให้หน้าเว็บเวอร์ชันเก่ายังใช้ได้
):
    """
    รับข้อมูลจากฟอร์ม ReportLost / ReportFound แล้วประมวลผลตรง ๆ แบบ deterministic
    (ไม่ผ่าน multi-agent อีกต่อไป เพราะลำดับงานตายตัวอยู่แล้ว ไม่มีอะไรให้ LLM ต้องมา
    "ตัดสินใจ" ว่าจะเรียก tool ไหนต่อ — ตัดรอบ LLM ที่ไม่จำเป็นออก ทำให้เร็วขึ้นมาก
    embedding สร้างจากข้อความที่ผู้ใช้พิมพ์เองล้วน ๆ (item_name + details) ไม่ผ่าน BLIP แล้ว
    เพราะ caption ภาษาอังกฤษจาก BLIP ไปเจือจาง embedding ภาษาไทย ทำให้ของชิ้นเดียวกันที่ถ่ายคนละมุม
    คะแนนความคล้ายตกลงมาต่ำกว่า threshold ได้ง่าย
    หน้า "ค้นหาจากรูป" (/search-by-image) ยังใช้ BLIP อยู่เหมือนเดิม เพราะจุดนั้นไม่มีข้อความให้ใช้เลย
    ต้องพึ่งภาพอย่างเดียว ไม่กระทบกับ endpoint นี้
    """

    # 1) ถ้ามีรูปแนบ: เซฟไฟล์ชั่วคราวทีละรูป + อัปโหลดขึ้น Storage (รูปไหนอัปโหลดไม่สำเร็จข้ามไป รูปอื่นยังใช้ได้)
    files = [f for f in images if f is not None and (f.filename or "")]
    if image is not None and (image.filename or ""):
        files.append(image)
    if len(files) > MAX_IMAGES:
        raise HTTPException(status_code=400, detail=f"แนบรูปได้สูงสุด {MAX_IMAGES} รูปต่อประกาศ")

    storage_image_paths = []
    for f in files:
        suffix = os.path.splitext(f.filename or "")[1] or ".jpg"
        local_tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{suffix}")
        try:
            with open(local_tmp_path, "wb") as buffer:
                shutil.copyfileobj(f.file, buffer)
            storage_image_paths.append(
                upload_image_to_supabase(local_tmp_path, os.path.basename(local_tmp_path))
            )
        except Exception as e:
            print(f"[upload_image_to_supabase] error: {e}")
        finally:
            if os.path.exists(local_tmp_path):
                os.remove(local_tmp_path)

    storage_image_path = storage_image_paths[0] if storage_image_paths else ""   # รูปปก

    # 2) รวมข้อความทั้งหมดไว้ใช้สร้าง embedding — ใช้แค่ข้อความที่ผู้ใช้พิมพ์เอง ไม่ผ่าน BLIP แล้ว
    combined_text = " ".join(filter(None, [item_name.strip(), details.strip()])).strip()

    # 3) สร้าง embedding ตรง ๆ 
    embedding = embed_text(combined_text)

    # 4) ชื่อสิ่งของมาจากที่ผู้ใช้กรอกเองเสมอ
    title = item_name.strip()

    # 5) บันทึกไอเทมลง DB ตรง ๆ
    try:
        insert_result = insert_item_direct(
            item_type=item_type,
            title=title,
            description=details,
            image_path=storage_image_path,
            location=location,
            embedding=embedding,
            user_id=user_id or None,
            image_paths=storage_image_paths,
        )
    except Exception as e:
        print(f"[insert_item_direct] error: {e}")
        raise HTTPException(status_code=500, detail="บันทึกประกาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง")

    # 6) (ไฟล์ชั่วคราวลบไปแล้วในขั้นตอนที่ 1 ทีละรูป)

    if not insert_result:
        return {
            "message": "บันทึกประกาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
            "image_url": get_image_url(storage_image_path),
        }

    new_item = insert_result[0]
    new_item_id = new_item["id"]

    # 7) ค้นหาไอเทมประเภทตรงข้ามที่คล้ายกัน แล้วบันทึกแมทช์ทุกอันที่เจอ 
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

    # 8) สรุปข้อความกลับไปให้ frontend 
    matched_item_id = None
    if matches:
        best = max(matches, key=lambda x: x.get("score", 0))
        percent = round(best.get("score", 0) * 100)
        matched_item_id = best.get("id")
        message = (
            f'บันทึกประกาศเรียบร้อยแล้ว พบไอเทมที่คล้ายกัน {len(matches)} รายการ '
            f'ใกล้เคียงที่สุด "{best.get("title") or "ไม่ระบุชื่อ"}" ({percent}%) '
            f'กดดูรายละเอียดได้เลย'
        )
    else:
        message = "บันทึกประกาศเรียบร้อยแล้ว ยังไม่พบไอเทมที่ตรงกันในตอนนี้ ระบบจะแจ้งเตือนทันทีถ้ามีการแมทช์เกิดขึ้นภายหลัง"

    return {
        "message": message,
        "image_url": get_image_url(storage_image_path),
        "matched_item_id": matched_item_id,
    }