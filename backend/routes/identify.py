from fastapi import APIRouter, UploadFile, File, HTTPException

from nuseek.tools.identify_agent import identify_item

router = APIRouter()

MAX_BYTES = 10 * 1024 * 1024  # 10MB ต่อรูป


@router.post("/identify-item")
async def identify(image: UploadFile = File(...)):
    """ผู้ช่วย AI ระบุชื่อ/ยี่ห้อ/รุ่นของสิ่งของจากรูป (ใช้ตอนแจ้งโพสต์เท่านั้น)
    คืน {"title", "name", "brand", "model", "confidence"} — title ว่างแปลว่าระบุไม่ได้
    ผลเป็นเพียงคำแนะนำ หน้าเว็บให้ผู้ใช้กดเติมช่องชื่อเอง"""
    if not (image.content_type or "").startswith("image/"):
        raise HTTPException(status_code=400, detail="ไฟล์ต้องเป็นรูปภาพ")

    data = await image.read()
    if not data:
        raise HTTPException(status_code=400, detail="ไฟล์รูปว่างเปล่า")
    if len(data) > MAX_BYTES:
        raise HTTPException(status_code=413, detail="รูปใหญ่เกินไป (ไม่เกิน 10MB)")

    result = await identify_item(data, image.content_type or "image/jpeg")
    err = result.get("error") or ""
    if "exhausted" in err.lower() or "429" in err:
        # โควตา Gemini ของ API key เต็ม (ไม่ใช่โค้ดพัง) — แจ้งให้ชัดว่ารอแล้วลองใหม่ได้
        raise HTTPException(status_code=429, detail="โควตา AI เต็มชั่วคราว ลองใหม่ภายหลัง หรือพิมพ์ชื่อเอง")
    if err:
        # เรียกโมเดลล้มเหลวจริง ไม่ใช่ "ระบุไม่ได้" — รายละเอียดอยู่ใน log ของ backend
        raise HTTPException(status_code=503, detail="ผู้ช่วย AI ใช้งานไม่ได้ชั่วคราว ลองใหม่อีกครั้ง หรือพิมพ์ชื่อเอง")
    return result