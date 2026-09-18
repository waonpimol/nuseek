import json

from google import genai

# ==========================================
# LLM VERIFICATION AGENT — ใช้เฉพาะที่ /search-by-image เท่านั้น
# ==========================================
#
# หน้าที่ 2 อย่าง:
#   1) translate_caption_to_thai — แปล caption อังกฤษจาก BLIP เป็นไทย ก่อนเอาไป embed     
#   2) verify_candidates — พิจารณา candidate ที่ vector search เจอมาอีกที โดยดู "ข้อความ" จริง ๆ
_genai_client = genai.Client()

_MODEL = "gemini-3.5-flash-lite"


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
        "คุณเป็นผู้ช่วยตรวจสอบระบบแจ้งของหาย-ของที่พบของมหาวิทยาลัย\n"
        f'ผู้ใช้ถ่ายรูปสิ่งของมาค้นหา ระบบแปลงรูปเป็นคำอธิบายได้ว่า: "{query_text}"\n\n'
        "ระบบค้นหาด้วยเวกเตอร์เจอรายการที่อาจตรงกันต่อไปนี้ (similarity_score คำนวณจากข้อความ "
        "เท่านั้น อาจไม่แม่นเสมอไป โดยเฉพาะถ้าคำอธิบายสั้นหรือถ่ายรูปคนละมุม):\n\n"
        f"{candidates_text}\n\n"
        "ช่วยพิจารณาแต่ละรายการว่าน่าจะเป็นสิ่งของชิ้นเดียวกันกับที่ผู้ใช้ถ่ายมาจริงหรือไม่ "
        "โดยดูทั้งความหมายของข้อความและ similarity_score ประกอบกัน — ถ้าข้อความสื่อถึงของชิ้นเดียวกัน "
        "ชัดเจน ให้ตัดสินว่าตรงกันได้แม้ similarity_score จะต่ำ และถ้าข้อความไม่เกี่ยวข้องกันเลย "
        "ให้ตัดสินว่าไม่ตรง แม้ similarity_score จะสูงก็ตาม\n\n"
        "ตอบกลับเป็น JSON array เท่านั้น ห้ามมีข้อความอื่นนอกเหนือจาก JSON เด็ดขาด ห้ามใส่ ```json "
        'ครอบ รูปแบบนี้:\n[{"id": "...", "is_match": true, "confidence": 0, "reason": "เหตุผลสั้น ๆ ภาษาไทย"}]'
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
        else:
            c["llm_is_match"] = None
            c["llm_confidence"] = None
            c["llm_reason"] = None
        results.append(c)

    return results