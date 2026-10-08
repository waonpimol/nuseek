import json
import mimetypes

from google import genai
from google.genai import types

# ==========================================
# LLM VERIFICATION AGENT — ใช้เฉพาะที่ /search-by-image เท่านั้น
# ==========================================
#
# หน้าที่ 2 อย่าง:
#   1) describe_image — ให้ Gemini ดูรูปแล้วบรรยายเฉพาะสิ่งของหลักเป็นภาษาไทย (ไม่เอาคน/มือ/พื้นหลัง)
#      ถ้า Gemini ล้มเหลว fallback ไปใช้ BLIP + translate_caption_to_thai
#   2) verify_candidates — พิจารณา candidate ที่ vector search เจอมาอีกที โดยดู "ข้อความ" จริง ๆ
_genai_client = genai.Client()

_MODEL = "gemini-3.5-flash-lite"


_DESCRIBE_PROMPT = (
    "ดูรูปนี้แล้วบรรยาย 'สิ่งของหลักเพียงชิ้นเดียว' ที่เป็นประเด็นของรูป (เช่น ของหายหรือของที่เก็บได้) "
    "ห้ามพูดถึงคน มือ พื้นหลัง หรือสถานที่ ให้ระบุเท่าที่เห็นจริง: ประเภทของ ยี่ห้อ/โลโก้ (ถ้าเห็น) รุ่น (ถ้าเห็น) "
    "สี วัสดุ เคส/สติกเกอร์/ลวดลาย และตำหนิหรือลักษณะเด่น ห้ามเดาสิ่งที่มองไม่เห็น\n"
    'ตอบเป็น JSON เท่านั้น รูปแบบ {"th": "คำบรรยายภาษาไทย 1 ประโยคสั้น ๆ เหมือนที่คนพิมพ์แจ้งของหาย", '
    '"en": "same description in English"}'
)


def describe_image(image_path: str) -> dict:
    """ให้ Gemini ดูรูปโดยตรงแล้วบรรยายเฉพาะสิ่งของหลัก คืน {"th": ..., "en": ...}
    ถ้า Gemini error/ตอบไม่ได้ → fallback ไป BLIP + แปล (import แบบ lazy เพื่อไม่โหลดโมเดลตอนเริ่มเซิร์ฟเวอร์)"""
    try:
        mime = mimetypes.guess_type(image_path)[0] or "image/jpeg"
        with open(image_path, "rb") as f:
            data = f.read()
        response = _genai_client.models.generate_content(
            model=_MODEL,
            contents=[types.Part.from_bytes(data=data, mime_type=mime), _DESCRIBE_PROMPT],
            config=types.GenerateContentConfig(response_mime_type="application/json"),
        )
        parsed = json.loads(response.text or "{}")
        th = (parsed.get("th") or "").strip()
        en = (parsed.get("en") or "").strip()
        if th:
            return {"th": th, "en": en}
    except Exception as e:
        print(f"[describe_image] gemini error, fallback to BLIP: {e}")

    from nuseek.tools.blip_tool import generate_caption
    caption_en = generate_caption(image_path).get("caption", "")
    return {"th": translate_caption_to_thai(caption_en), "en": caption_en}


def translate_caption_to_thai(caption_en: str) -> str:
    """แปล caption ภาษาอังกฤษจาก BLIP ให้เป็นภาษาไทยสั้น ๆ ก่อนเอาไป embed
    ถ้าแปลไม่สำเร็จ (error/ตอบว่าง) ใช้ caption อังกฤษต้นฉบับแทน กัน pipeline ล่มทั้งเส้น"""
    if not caption_en or not caption_en.strip():
        return ""

    try:
        response = _genai_client.models.generate_content(
            model=_MODEL,
            contents=(
                "แปลข้อความนี้จากภาษาอังกฤษเป็นภาษาไทยสั้น ๆ กระชับ เหมือนอธิบายลักษณะของสิ่งของ "
                "ตอบแค่คำแปลอย่างเดียว ห้ามมีคำอธิบายอื่นเพิ่ม ห้ามใส่เครื่องหมายคำพูดครอบ:\n\n" + caption_en
            ),
        )
        translated = (response.text or "").strip()
        return translated or caption_en
    except Exception as e:
        print(f"[translate_caption_to_thai] error: {e}")
        return caption_en


def verify_candidates(query_text: str, candidates: list) -> list:
    """ให้ LLM ตรวจสอบซ้ำว่า candidate แต่ละตัวที่ vector search เจอ ตรงกับ query_text จริงไหม
    โดยพิจารณาทั้งข้อความ (title + description) และ similarity_score ที่ vector search ให้มาประกอบกัน
    (ไม่ใช่เชื่อ similarity_score อย่างเดียวเหมือนเดิม)

    คืนค่า list เดิมที่แนบฟิลด์เพิ่มต่อรายการ: llm_is_match, llm_confidence, llm_reason
    ถ้า Gemini error/parse ไม่ได้ทั้งชุด → ทุกรายการจะได้ llm_is_match=None (แปลว่า "ตัดสินไม่ได้")
    ผู้เรียกใช้ฟังก์ชันนี้ต้องมี fallback ของตัวเอง (เช่น เชื่อ similarity_score เดิม)
    ไม่ตัดรายการทิ้งไปเฉย ๆ ตรงนี้ กัน agent ล่มแล้วผู้ใช้ไม่เห็นผลอะไรเลย"""
    if not candidates:
        return []

    candidates_text = "\n".join(
        f'{i + 1}. id={c["id"]} | ชื่อ: {c.get("title") or "-"} | '
        f'รายละเอียด: {(c.get("description") or "-")[:200]} | '
        f'similarity_score: {c.get("score", 0):.3f}'
        for i, c in enumerate(candidates)
    )

    prompt = (
        "คุณเป็นผู้ตรวจสอบของระบบแจ้งของหาย-ของที่พบของมหาวิทยาลัย "
        "หน้าที่คือป้องกันไม่ให้ระบบเสนอรายการที่ไม่ใช่สิ่งของชิ้นเดียวกันให้ผู้ใช้\n"
        f'ผู้ใช้ถ่ายรูปสิ่งของมาค้นหา ระบบแปลงรูปเป็นคำอธิบายได้ว่า: "{query_text}"\n\n'
        "รายการที่ระบบค้นหาด้วยเวกเตอร์เจอ (similarity_score เป็นแค่ตัวช่วย ไม่ใช่คำตัดสิน "
        "และคำนวณจากข้อความเท่านั้น):\n\n"
        f"{candidates_text}\n\n"
        "เกณฑ์การตัดสิน (เข้มงวด):\n"
        "1. ชนิดของสิ่งของอย่างเดียวไม่เพียงพอ (เช่น มีแค่คำว่า \"หูฟัง\" \"กระเป๋า\" \"แก้วน้ำ\") "
        "ต้องมีรายละเอียดที่ตรงกันอย่างน้อย 2 อย่างขึ้นไป เช่น สี ยี่ห้อ รูปทรง วัสดุ ลวดลาย "
        "อุปกรณ์เสริมหรือของที่ห้อยติด ตำหนิ ขนาด\n"
        "2. ต้องเป็นบริบทเดียวกัน คือน่าจะเป็นสิ่งของชิ้นเดียวกันจริง ไม่ใช่แค่ของประเภทเดียวกัน\n"
        "3. ถ้ามีรายละเอียดที่ขัดกัน (เช่น คนละสี คนละยี่ห้อ) ให้ตัดสินว่าไม่ตรงทันที\n"
        "4. ถ้าข้อมูลของรายการนั้นน้อยเกินกว่าจะยืนยันรายละเอียดได้ (เช่น มีแค่ชื่อสั้น ๆ ไม่มีรายละเอียด) "
        "ให้ตัดสินว่าไม่ตรง\n"
        "5. ถ้าไม่แน่ใจ ให้ตอบว่าไม่ตรง\n\n"
        "ตอบกลับเป็น JSON array เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON เด็ดขาด ห้ามใส่ ```json "
        "ครอบ รูปแบบนี้ (confidence เป็นจำนวนเต็ม 0-100):\n"
        '[{"id": "...", "is_match": true, "confidence": 85, '
        '"matched_details": ["สีชมพู", "เคสซิลิโคน"], "reason": "เหตุผลสั้น ๆ ภาษาไทย"}]\n'
        "matched_details คือรายละเอียดที่ตรงกันจริงของรายการนั้น (ไม่นับชนิดของสิ่งของ) "
        "ถ้า is_match เป็น false ให้ใส่ []"
    )

    verdict_by_id = {}
    try:
        response = _genai_client.models.generate_content(model=_MODEL, contents=prompt)
        raw = (response.text or "").strip()
        # กันเผื่อ Gemini ตอบมาแบบมี ```json ครอบ ทั้งที่สั่งห้ามแล้ว
        if raw.startswith("```"):
            raw = raw.strip("`")
            if raw.startswith("json"):
                raw = raw[4:]
            raw = raw.strip()
        verdicts = json.loads(raw)
        verdict_by_id = {str(v.get("id")): v for v in verdicts if isinstance(v, dict)}
    except Exception as e:
        print(f"[verify_candidates] error: {e}")

    results = []
    for c in candidates:
        verdict = verdict_by_id.get(str(c["id"]))
        if verdict:
            c["llm_is_match"] = bool(verdict.get("is_match"))
            c["llm_confidence"] = verdict.get("confidence")
            c["llm_reason"] = verdict.get("reason")
            details = verdict.get("matched_details")
            c["llm_matched_details"] = (
                [str(d).strip() for d in details if str(d).strip()]
                if isinstance(details, list) else []
            )
        else:
            c["llm_is_match"] = None
            c["llm_confidence"] = None
            c["llm_reason"] = None
            c["llm_matched_details"] = []
        results.append(c)

    return results