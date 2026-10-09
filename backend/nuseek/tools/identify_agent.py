import asyncio
import io
import json
import os
import re

from google import genai
from google.genai import types

# ==========================================
# IDENTIFY — ระบุสิ่งของจากรูป ใช้ตอน "แจ้งโพสต์" เท่านั้น
# ==========================================
#
# ช่วยผู้ใช้ที่ไม่รู้ว่าสิ่งของในรูปคืออะไร/ยี่ห้อ/รุ่นอะไร (เช่น หูฟังแบรนด์อะไร)
# Gemini ดูรูปอย่างเดียว (อ่านโลโก้/ตัวอักษร/รูปทรง) ไม่ค้นเว็บ แล้วตอบเป็น JSON
# ผลที่ได้เป็น "คำแนะนำ" ให้ผู้ใช้กดเติมช่องชื่อเอง ไม่เติมให้อัตโนมัติ และไม่ยุ่งกับช่องรายละเอียด
#
# ทำไมไม่ใช้ Google Search: grounding ติดโควตา 429 บน Free tier (เรียกโมเดลธรรมดาผ่านแต่ตอนค้นไม่ผ่าน)
# จึงตัดออก ถ้าเปิด billing ภายหลังค่อยเพิ่ม ADK agent + google_search กลับมาได้

# ตั้งค่าโมเดลเองได้ผ่าน .env (IDENTIFY_MODEL)
_MODEL = os.getenv("IDENTIFY_MODEL", "gemini-3.5-flash-lite")
_APP_NAME = "nuseek_identify"
_TIMEOUT_SECONDS = 30
_MAX_SIDE = 1024  # ย่อรูปก่อนส่ง ลดเวลาและโควตา

_INSTRUCTION = """\
คุณคือผู้ช่วยระบุสิ่งของจากรูปภาพสำหรับระบบแจ้งของหาย/ของที่พบ มหาวิทยาลัยนเรศวร
งาน: ดูรูปที่ผู้ใช้ส่งมา หา "สิ่งของหลักเพียงชิ้นเดียว" แล้วระบุว่าคืออะไร ยี่ห้ออะไร รุ่นอะไร

ขั้นตอน:
1) ดูรูปอย่างละเอียด: ประเภทของ โลโก้/ตัวอักษรบนตัวของ รูปทรง สี จำนวนกล้อง/ปุ่ม/ช่อง ลักษณะเด่น
2) ถ้าเห็นยี่ห้อหรือรุ่นชัด ให้ตอบตามนั้น
3) ถ้าไม่ชัด ให้เสนอยี่ห้อ/รุ่นที่น่าจะใช่ที่สุดจากสิ่งที่เห็น แม้ไม่แน่ใจ 100% ก็ตอบมา ปล่อยให้ผู้ใช้เป็นคนตัดสินใจว่าตรงไหม
4) ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

หลักการ:
- ผู้ใช้จะตรวจและแก้ชื่อเองทุกครั้ง จึงให้ตอบเท่าที่พอเห็นและเดาได้อย่างมีเหตุผล ไม่ต้องรอให้มั่นใจเต็มที่
- ใส่ name เสมอ (อย่างน้อยเป็นประเภทของ เช่น มือถือ หูฟัง กระเป๋าสตางค์) ส่วน brand กับ model ให้ใส่เมื่อพอเดาได้
  ถ้าไม่มีเบาะแสของยี่ห้อ/รุ่นเลยจริง ๆ ค่อยเว้นว่าง
- ระดับความมั่นใจต้องบอกตามจริง ถ้าเดาจากรูปร่างให้ใส่ low หรือ medium ไม่ต้องใส่ high เกินจริง
- ห้ามพูดถึงข้อมูลของบุคคล: ใบหน้า ชื่อ เลขบัตร เลขประจำตัว ข้อมูลบนบัตรนักศึกษา/บัตรประชาชน
  ถ้าของในรูปคือบัตรประจำตัว ให้ตอบเพียง "บัตรประจำตัว" และไม่อ่านข้อมูลบนบัตร
- ไม่ต้องบรรยายคน มือ พื้นหลัง หรือสถานที่ (ถ้ามีมือถือของอยู่ ให้ระบุเฉพาะตัวของ)

รูปแบบคำตอบ: JSON object เดียว มี 4 คีย์ คือ name, brand, model, confidence
- name = ชื่อสิ่งของภาษาไทยสั้นๆ เช่น หูฟังครอบหู
- brand = ยี่ห้อ (ข้อความว่างถ้าไม่มีเบาะแสเลย)
- model = รุ่น (ข้อความว่างถ้าไม่มีเบาะแสเลย)
- confidence = high หรือ medium หรือ low

เกณฑ์ confidence: high = เห็นโลโก้/รุ่นชัด, medium = รูปทรงบ่งชี้ยี่ห้อ/รุ่นแต่ไม่เห็นโลโก้ชัด, low = เดาจากรูปร่างหรือระบุได้แค่ประเภท
"""

def _shrink_image(data: bytes, mime: str) -> tuple[bytes, str]:
    """ย่อรูปให้ด้านยาวไม่เกิน _MAX_SIDE แล้วแปลงเป็น JPEG (ถ้าย่อไม่ได้ ใช้รูปเดิม)"""
    try:
        from PIL import Image, ImageOps

        img = ImageOps.exif_transpose(Image.open(io.BytesIO(data)))
        img = img.convert("RGB")
        img.thumbnail((_MAX_SIDE, _MAX_SIDE))
        buf = io.BytesIO()
        img.save(buf, format="JPEG", quality=85)
        return buf.getvalue(), "image/jpeg"
    except Exception as e:
        print(f"[identify] shrink image failed, using original: {e}")
        return data, mime or "image/jpeg"


def _parse_json(text: str) -> dict:
    """ดึง JSON จากคำตอบของ agent (อาจมี ```json ครอบ หรือมีข้อความนำหน้า/ตามหลัง)"""
    text = (text or "").strip()
    text = re.sub(r"^```(?:json)?\s*|\s*```$", "", text, flags=re.IGNORECASE)
    try:
        return json.loads(text)
    except Exception:
        pass
    match = re.search(r"\{.*\}", text, flags=re.DOTALL)
    if match:
        try:
            return json.loads(match.group(0))
        except Exception:
            pass
    return {}


def build_title(name: str, brand: str, model: str) -> str:
    """รวมเป็นชื่อสำหรับช่อง "ชื่อสิ่งของ": ชื่อ + ยี่ห้อ + รุ่น (ข้ามส่วนที่ซ้ำกับส่วนก่อนหน้า)"""
    parts: list[str] = []
    for part in (name, brand, model):
        part = (part or "").strip()
        if part and part.lower() not in " ".join(parts).lower():
            parts.append(part)
    return " ".join(parts)


def _normalize(parsed: dict) -> dict:
    confidence = str(parsed.get("confidence") or "low").strip().lower()
    if confidence not in ("high", "medium", "low"):
        confidence = "low"
    name = str(parsed.get("name") or "").strip()
    brand = str(parsed.get("brand") or "").strip()
    model = str(parsed.get("model") or "").strip()
    return {
        "title": build_title(name, brand, model),
        "name": name,
        "brand": brand,
        "model": model,
        "confidence": confidence,
    }


_USER_PROMPT = "ระบุสิ่งของหลักในรูปนี้ และตอบเป็น JSON ตามรูปแบบที่กำหนด"


async def _ask_gemini(data: bytes, mime: str) -> str:
    client = genai.Client()
    response = await client.aio.models.generate_content(
        model=_MODEL,
        contents=[types.Part.from_bytes(data=data, mime_type=mime), _INSTRUCTION + "\n" + _USER_PROMPT],
    )
    return response.text or ""


async def identify_item(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """ให้ Gemini ดูรูปแล้วคืน {"title", "name", "brand", "model", "confidence"}
    - ระบุไม่ได้จริง ๆ (ตอบแล้วแต่ไม่ได้ชื่อ) → title ว่าง
    - เรียกโมเดลล้มเหลว → ใส่ฟิลด์ "error" เพิ่ม (route จะตอบ 429/503 ให้หน้าเว็บแยกออกว่า
      "ระบบ AI ขัดข้อง" ไม่ใช่ "ระบุจากรูปนี้ไม่ได้") ไม่ throw"""
    empty = {"title": "", "name": "", "brand": "", "model": "", "confidence": "low"}
    data, mime = _shrink_image(image_bytes, mime_type)
    try:
        text = await asyncio.wait_for(_ask_gemini(data, mime), timeout=_TIMEOUT_SECONDS)
    except Exception as e:
        print(f"[identify] error: {type(e).__name__}: {e}")
        return {**empty, "error": f"{type(e).__name__}: {e}"[:400]}

    if not text.strip():
        print("[identify] no text from model")
        return {**empty, "error": "no text from model"}
    result = _normalize(_parse_json(text))
    if not result["title"]:
        print(f"[identify] could not parse a name from reply: {text[:300]!r}")
        return empty
    return result