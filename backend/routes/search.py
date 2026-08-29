import os
import shutil
import tempfile
import uuid

from fastapi import APIRouter, UploadFile, File

from nuseek.tools.blip_tool import generate_caption
from nuseek.tools.embedding_tool import embed_text
from nuseek.tools.supabase_tool import search_by_embedding

router = APIRouter()


@router.post("/search-by-image")
async def search_by_image(image: UploadFile = File(...)):
    """
    ค้นหาไอเทมที่คล้ายกับรูปที่แนบมา (ข้ามทั้งประกาศของหาย/ของพบ)
    ไม่ผ่าน LLM agent เพราะเป็น pipeline ตรงไปตรงมา ไม่มีการตัดสินใจ
    ที่ต้องใช้เหตุผลซับซ้อน: แคปรูป -> สร้าง embedding -> ค้นหา -> คืนผล
    """

    suffix = os.path.splitext(image.filename or "")[1] or ".jpg"
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{suffix}")

    with open(tmp_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    try:
        caption_result = generate_caption(tmp_path)
        caption = caption_result.get("caption", "")

        embedding = embed_text(caption)
        results = search_by_embedding(embedding, top_k=10, threshold=0.3)

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    return {
        "caption": caption,
        "results": results,
    }