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
    item_name: str = Form(...),
    details: str = Form(""),
    location: str = Form(""),
    user_id: str = Form(""),          # uuid ของผู้ login
    images: list[UploadFile] = File(default=[]),   # แนบได้หลายรูป (สูงสุด MAX_IMAGES) รูปแรก = รูปปก
    image: UploadFile | None = File(None),         # ช่องรูปเดียวแบบเดิม รองรับ client เก่า
):
    """
    รับข้อมูลจากฟอร์ม ReportLost / ReportFound บันทึกประกาศ แล้วหาแมทช์กับประกาศฝั่งตรงข้าม
    embedding สร้างจากข้อความที่ผู้ใช้พิมพ์เอง (item_name + details) ไม่ใช้ caption จาก BLIP
    เพราะ caption ภาษาอังกฤษไปเจือจาง embedding ภาษาไทย ทำให้ของชิ้นเดียวกันได้คะแนนความคล้ายต่ำ
    """

    # รูปไหนอัปโหลดไม่สำเร็จข้ามไป รูปอื่นยังใช้ได้
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

    combined_text = " ".join(filter(None, [item_name.strip(), details.strip()])).strip()
    embedding = embed_text(combined_text)
    title = item_name.strip()

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

    if not insert_result:
        return {
            "message": "บันทึกประกาศไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
            "image_url": get_image_url(storage_image_path),
        }

    new_item = insert_result[0]
    new_item_id = new_item["id"]

    # ค้นหาไอเทมประเภทตรงข้ามที่คล้ายกัน แล้วบันทึกแมทช์ทุกอันที่เจอ
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