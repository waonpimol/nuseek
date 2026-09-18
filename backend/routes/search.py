import os
import shutil
import tempfile
import uuid

from fastapi import APIRouter, UploadFile, File, BackgroundTasks

from nuseek.tools.blip_tool import generate_caption
from nuseek.tools.embedding_tool import embed_text
from nuseek.tools.supabase_tool import search_by_embedding, log_search_query
from nuseek.tools.verification_agent import translate_caption_to_thai, verify_candidates

router = APIRouter()

# threshold "กว้าง" ไว้ดึง candidate เข้ามาพิจารณา (ต่ำกว่านี้ไม่เอาเข้ามาเลย ไม่เกี่ยวข้องแน่ๆ)
RECALL_THRESHOLD = 0.3
# score ถึงระดับนี้ถือว่าเชื่อถือได้เลย โชว์ตรงๆ ไม่ต้องพึ่ง agent ตรวจซ้ำ
HIGH_CONFIDENCE_THRESHOLD = 0.7
# ผลลัพธ์สุดท้ายที่ยืนยันว่าตรงแล้ว อาจมีหลายอันพร้อมกัน (เช่น มีคนโพสต์ของแบบเดียวกันไว้หลายโพสต์)
# โชว์ให้ผู้ใช้แค่ที่ดีที่สุด 5 อันดับแรกพอ ไม่ต้องเทกองมาให้ดูทั้งหมด
DISPLAY_TOP_K = 5


@router.post("/search-by-image")
async def search_by_image(image: UploadFile = File(...), background_tasks: BackgroundTasks = None):
    """
    ค้นหาไอเทมที่คล้ายกับรูปที่แนบมา (ข้ามทั้งประกาศของหาย/ของพบ)

    มี AI Agent ตรวจสอบซ้ำ (verification agent, ดู nuseek/tools/verification_agent.py) เพิ่มเข้ามา
    แต่เรียกเฉพาะกับ candidate ที่ similarity_score ยังไม่ถึงเกณฑ์ที่เชื่อถือได้เท่านั้น:

      1) แคปรูปด้วย BLIP (อังกฤษ)
      2) แปล caption เป็นไทยด้วย Gemini ก่อนเอาไป embed (กัน embedding เพี้ยนจากการปนภาษา)
      3) ค้นหาด้วย vector search แบบ "recall กว้าง" (threshold ต่ำ = 0.3) ไม่ตัดทิ้งด้วยตัวเลขตรง ๆ
      4) แบ่ง candidate เป็น 2 กลุ่มตาม similarity_score:
         - score >= 0.7 (HIGH_CONFIDENCE_THRESHOLD) → เชื่อถือได้เลย โชว์ตรง ๆ ไม่ต้องพึ่ง agent
         - score < 0.7 → ยังไม่ทิ้ง ส่งให้ Gemini อ่าน title/description/location เทียบกับ
           คำอธิบายรูปที่ผู้ใช้ถ่ายมาอีกที (เผื่อ BLIP แคปรูปออกมาไม่ตรงทำให้ embedding เพี้ยน)
           ถ้า agent เห็นว่าตรงกันจริงถึงจะเอามาโชว์ ถ้าไม่ตรง/agent ตัดสินไม่ได้ก็ไม่โชว์
      5) รวมผลทั้งสองกลุ่ม เรียงตาม score เอาแค่ 5 อันดับแรก
      6) log การค้นหาครั้งนี้ลง search_logs แบบ background task (ไม่บล็อกการตอบกลับผู้ใช้)
         เก็บไว้ debug ย้อนหลัง + ใช้เป็นหลักฐานตอนเขียนบทประเมินผล thesis

    นี่คือจุดเดียวในระบบที่มี AI Agent จริง ๆ (ให้เหตุผล+ตัดสินใจ) ส่วน /report ยังเป็น
    deterministic pipeline เหมือนเดิม เพราะขั้นตอนตายตัวอยู่แล้ว ไม่มีอะไรให้ต้องให้เหตุผล
    """

    suffix = os.path.splitext(image.filename or "")[1] or ".jpg"
    tmp_path = os.path.join(tempfile.gettempdir(), f"{uuid.uuid4()}{suffix}")

    with open(tmp_path, "wb") as buffer:
        shutil.copyfileobj(image.file, buffer)

    try:
        caption_result = generate_caption(tmp_path)
        caption_en = caption_result.get("caption", "")

        # แปล caption อังกฤษ -> ไทย ก่อน embed
        caption_th = translate_caption_to_thai(caption_en)

        embedding = embed_text(caption_th or caption_en)

        # recall กว้าง ๆ ก่อน (score >= 0.3 ทั้งหมด)
        candidates = search_by_embedding(embedding, top_k=10, threshold=RECALL_THRESHOLD)

        high_confidence = [c for c in candidates if c.get("score", 0) >= HIGH_CONFIDENCE_THRESHOLD]
        low_confidence = [c for c in candidates if c.get("score", 0) < HIGH_CONFIDENCE_THRESHOLD]

        # ส่งเฉพาะกลุ่ม score ต่ำให้ agent พิจารณา ไม่ต้องเปลืองเรียก Gemini กับกลุ่มที่ชัวร์อยู่แล้ว
        verified_low = verify_candidates(caption_th or caption_en, low_confidence) if low_confidence else []
        low_confidence_matched = [r for r in verified_low if r.get("llm_is_match") is True]

        results = high_confidence + low_confidence_matched
        results.sort(key=lambda r: r.get("score", 0), reverse=True)
        results = results[:DISPLAY_TOP_K]

        # เก็บเฉพาะ candidate ที่ agent ตัดสินใจจริง (score < 0.7) ไม่เก็บกลุ่ม high_confidence
        # เพราะเหตุผลที่โชว์ของกลุ่มนั้นตายตัวอยู่แล้ว (score >= 0.7) ไม่มีอะไรต้อง debug
        log_candidates = [
            {
                "id": c.get("id"), "title": c.get("title"), "type": c.get("type"),
                "score": c.get("score"), "llm_is_match": c.get("llm_is_match"),
                "llm_confidence": c.get("llm_confidence"), "llm_reason": c.get("llm_reason"),
            }
            for c in verified_low
        ]

    finally:
        if os.path.exists(tmp_path):
            os.remove(tmp_path)

    # log แบบ background task — ไม่ await ตรงนี้ กันไม่ให้ insert ไปหน่วงเวลาตอบกลับผู้ใช้
    # เก็บเฉพาะตอนที่ agent ถูกเรียกใช้จริง (มี candidate score < 0.7 อย่างน้อย 1 ตัว)
    # ไม่ว่าผลสุดท้ายจะถูกโชว์หรือไม่ก็ตาม — เคสที่ agent ไม่เกี่ยวข้องเลยไม่มีอะไรต้อง debug ไม่ต้องเก็บ
    if background_tasks is not None and low_confidence:
        background_tasks.add_task(log_search_query, caption_en, caption_th, log_candidates, len(results))

    return {
        "caption": caption_en,
        "caption_th": caption_th,
        "results": results,
    }