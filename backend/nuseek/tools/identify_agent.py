import asyncio
import io
import json
import os
import re
import uuid

from google.adk.agents import Agent
from google.adk.runners import Runner
from google.adk.sessions import InMemorySessionService
from google.adk.tools import google_search
from google.genai import types

# ==========================================
# IDENTIFY AGENT (ADK + Google Search) — ใช้ตอน "แจ้งโพสต์" เท่านั้น
# ==========================================
#
# ช่วยผู้ใช้ที่ไม่รู้ว่าสิ่งของในรูปคืออะไร/ยี่ห้อ/รุ่นอะไร (เช่น หูฟังแบรนด์อะไร)
# ทางหลัก: ADK agent ดูรูป แล้วใช้ google_search ค้นหาชื่อยี่ห้อ/รุ่น → ตอบเป็น JSON
# ทางสำรอง: ถ้าทางหลักล้มเหลว (โควตา Google Search เต็ม / tool error / timeout)
#           ให้ Gemini ดูรูปอย่างเดียว (อ่านโลโก้/ตัวอักษร/รูปทรง) ไม่ค้นเว็บ
# ผลที่ได้เป็น "คำแนะนำ" ให้ผู้ใช้กดเติมช่องชื่อเอง ไม่เติมให้อัตโนมัติ และไม่ยุ่งกับช่องรายละเอียด
#
# หมายเหตุ: instruction ห้ามมีวงเล็บปีกกา { } เพราะ ADK จะตีความเป็นตัวแปร state แล้ว error
#
# ข้อจำกัดของ ADK: google_search เป็น built-in tool ที่ใช้ได้เพียงตัวเดียวต่อ agent
# จึงแยกเป็น agent ของตัวเอง ไม่รวมกับ verification agent ในไฟล์ verification_agent.py
# และเพราะเหตุเดียวกันจึงใช้ output_schema ไม่ได้ ต้อง parse JSON จากข้อความเอง (ดู _parse_json)
#
# โควตา: Google Search grounding มีโควตาแยกจากการเรียกโมเดลปกติ และบน Free tier อาจเต็ม/เป็นศูนย์
# (อาการ: log ขึ้น agent+search error ... 429 แล้วระบบใช้ทางสำรองแทน) แก้ด้วยการเปิด billing หรือเปลี่ยน IDENTIFY_MODEL

# ตั้งค่าโมเดลเองได้ผ่าน .env (IDENTIFY_MODEL) ถ้าโมเดลเริ่มต้นไม่รองรับ Google Search
_MODEL = os.getenv("IDENTIFY_MODEL", "gemini-2.5-flash")
_APP_NAME = "nuseek_identify"
_TIMEOUT_SECONDS = 45
_MAX_SIDE = 1024  # ย่อรูปก่อนส่ง ลดเวลาและโควตา

_INSTRUCTION = """\
คุณคือผู้ช่วยระบุสิ่งของจากรูปภาพสำหรับระบบแจ้งของหาย/ของที่พบ มหาวิทยาลัยนเรศวร
งาน: ดูรูปที่ผู้ใช้ส่งมา หา "สิ่งของหลักเพียงชิ้นเดียว" แล้วระบุว่าคืออะไร ยี่ห้ออะไร รุ่นอะไร

ขั้นตอน:
1) ดูรูปอย่างละเอียด: ประเภทของ โลโก้/ตัวอักษรบนตัวของ รูปทรง สี จำนวนกล้อง/ปุ่ม/ช่อง ลักษณะเด่น
2) ถ้าเห็นยี่ห้อหรือรุ่นชัดอยู่แล้ว ตอบได้เลย (ใช้ google_search ยืนยันถ้าจำเป็น)
3) ถ้าไม่ชัด ให้ลองใช้ google_search ค้นด้วยลักษณะที่เห็น (ประเภทของ + รูปทรง + จุดเด่น) เพื่อหายี่ห้อ/รุ่นที่ใกล้เคียงที่สุด
   แล้วเสนอตัวที่น่าจะใช่ที่สุด แม้จะไม่แน่ใจ 100% ก็ตอบมา ปล่อยให้ผู้ใช้เป็นคนตัดสินใจว่าตรงไหม
4) ตอบเป็น JSON เท่านั้น ห้ามมีข้อความอื่น

หลักการ:
- ผู้ใช้จะตรวจและแก้ชื่อเองทุกครั้ง จึงให้ตอบเท่าที่พอเห็นและเดาได้อย่างมีเหตุผล ไม่ต้องรอให้มั่นใจเต็มที่
- ใส่ name เสมอ (อย่างน้อยเป็นประเภทของ เช่น มือถือ หูฟัง กระเป๋าสตางค์) ส่วน brand กับ model ให้ใส่เมื่อพอเดาได้
  ถ้าไม่มีเบาะแสของยี่ห้อ/รุ่นเลยจริง ๆ ค่อยเว้นว่าง
- ระดับความมั่นใจต้องบอกตามจริง ถ้าเดาจากรูปร่างให้ใส่ low หรือ medium ไม่ต้องใส่ high เกินจริง
- ห้ามค้นหรือพูดถึงข้อมูลของบุคคล: ใบหน้า ชื่อ เลขบัตร เลขประจำตัว ข้อมูลบนบัตรนักศึกษา/บัตรประชาชน
  ถ้าของในรูปคือบัตรประจำตัว ให้ตอบเพียง "บัตรประจำตัว" และไม่อ่านข้อมูลบนบัตร
- ไม่ต้องบรรยายคน มือ พื้นหลัง หรือสถานที่ (ถ้ามีมือถือของอยู่ ให้ระบุเฉพาะตัวของ)
- ค้นเฉพาะเพื่อหาชื่อยี่ห้อ/รุ่นของสิ่งของ ไม่ต้องค้นเรื่องอื่น

รูปแบบคำตอบ: JSON object เดียว มี 4 คีย์ คือ name, brand, model, confidence
- name = ชื่อสิ่งของภาษาไทยสั้นๆ เช่น หูฟังครอบหู
- brand = ยี่ห้อ (ข้อความว่างถ้าไม่มีเบาะแสเลย)
- model = รุ่น (ข้อความว่างถ้าไม่มีเบาะแสเลย)
- confidence = high หรือ medium หรือ low

เกณฑ์ confidence: high = เห็นโลโก้/รุ่นชัดหรือค้นยืนยันได้, medium = รูปทรงตรงกับผลค้นหาแต่ไม่เห็นโลโก้ชัด, low = เดาจากรูปร่างหรือระบุได้แค่ประเภท
"""

identify_agent = Agent(
    name="item_identifier",
    model=_MODEL,
    description="ระบุชื่อ ยี่ห้อ และรุ่นของสิ่งของจากรูปภาพ โดยใช้ Google Search ยืนยัน",
    instruction=_INSTRUCTION,
    tools=[google_search],
)

_session_service = InMemorySessionService()
_runner = Runner(agent=identify_agent, app_name=_APP_NAME, session_service=_session_service)


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


async def _identify_with_search(data: bytes, mime: str) -> tuple[str, list]:
    """ทางหลัก: ADK agent + google_search คืน (ข้อความคำตอบสุดท้าย, รายการคำที่ agent ค้น Google จริง)
    ล้มเหลวจะ raise รายการคำค้นมาจาก grounding_metadata ของ event (ว่าง = โมเดลตอบโดยไม่ได้ค้น)"""
    user_id = "web"
    session_id = uuid.uuid4().hex  # session ใหม่ทุกครั้ง ไม่เอาประวัติรูปก่อนหน้ามาปน
    await _session_service.create_session(app_name=_APP_NAME, user_id=user_id, session_id=session_id)
    message = types.Content(
        role="user",
        parts=[types.Part.from_bytes(data=data, mime_type=mime), types.Part(text=_USER_PROMPT)],
    )
    final_text = ""
    last_event_error = ""
    queries: list = []
    try:
        async for event in _runner.run_async(user_id=user_id, session_id=session_id, new_message=message):
            # ADK บางเวอร์ชันไม่ raise เมื่อโมเดลตอบ error แต่ส่งมาเป็น event ที่มี error_code/error_message
            gm = getattr(event, "grounding_metadata", None)
            for q in (getattr(gm, "web_search_queries", None) or []):
                if q not in queries:
                    queries.append(q)
            code = getattr(event, "error_code", None)
            msg = getattr(event, "error_message", None)
            if code or msg:
                last_event_error = f"{code or ''} {msg or ''}".strip()
            if event.is_final_response() and event.content and event.content.parts:
                final_text = "".join(p.text or "" for p in event.content.parts if getattr(p, "text", None))
    finally:
        try:
            await _session_service.delete_session(app_name=_APP_NAME, user_id=user_id, session_id=session_id)
        except Exception:
            pass  # เก็บกวาด session ไม่สำเร็จก็ไม่เป็นไร (อยู่ใน memory)

    if not final_text.strip():
        raise RuntimeError(f"agent returned no text{': ' + last_event_error if last_event_error else ''}")
    return final_text, queries


async def _identify_without_search(data: bytes, mime: str) -> str:
    """ทางสำรอง: ถ้าค้น Google ไม่ได้ (โควตา/tool ล้มเหลว) ให้ Gemini ดูรูปอย่างเดียว ไม่ค้นเว็บ
    ยังอ่านโลโก้/ข้อความบนตัวของได้ แต่ไม่ได้ยืนยันรุ่นจากเว็บ จึงลด confidence ลง (ดู identify_item)"""
    from google import genai  # import แบบ lazy ให้ทางสำรองแยกจาก agent หลัก

    client = genai.Client()
    response = await client.aio.models.generate_content(
        model=_MODEL,
        contents=[
            types.Part.from_bytes(data=data, mime_type=mime),
            _INSTRUCTION + "\n\nหมายเหตุ: ครั้งนี้ไม่มีเครื่องมือค้นหา ให้ระบุจากสิ่งที่เห็นในรูปเท่านั้น (ข้ามขั้นตอนการค้นหา)\n" + _USER_PROMPT,
        ],
    )
    return response.text or ""


async def identify_item(image_bytes: bytes, mime_type: str = "image/jpeg") -> dict:
    """ให้ identify agent ดูรูปแล้วคืน {"title", "name", "brand", "model", "confidence", "searched", "used_search"}
    - searched=True: ผ่านทางหลัก (ADK agent ที่มี Google Search) / False: ทางสำรอง (Gemini ดูรูปอย่างเดียว)
    - used_search=True: agent ค้น Google จริง (มี web_search_queries) — ทางหลักไม่ได้แปลว่าโมเดลเลือกค้นเสมอ
    - ระบุไม่ได้จริง ๆ (ตอบแล้วแต่ไม่ได้ชื่อ) → title ว่าง
    - ทั้งสองทางล้มเหลว → ใส่ฟิลด์ "error" เพิ่ม (route จะตอบ 429/503 ให้หน้าเว็บแยกออกว่า
      "ระบบ AI ขัดข้อง" ไม่ใช่ "ระบุจากรูปนี้ไม่ได้") ไม่ throw"""
    empty = {"title": "", "name": "", "brand": "", "model": "", "confidence": "low", "searched": False, "used_search": False}
    data, mime = _shrink_image(image_bytes, mime_type)

    searched = True
    queries: list = []
    try:
        text, queries = await asyncio.wait_for(_identify_with_search(data, mime), timeout=_TIMEOUT_SECONDS)
        if queries:
            print(f"[identify] google search queries: {queries}")
        else:
            print("[identify] agent answered without calling google search")
    except Exception as e:
        primary_error = f"{type(e).__name__}: {e}"
        print(f"[identify] agent+search error, falling back to image-only: {primary_error}")
        searched = False
        try:
            text = await asyncio.wait_for(_identify_without_search(data, mime), timeout=_TIMEOUT_SECONDS)
        except Exception as e2:
            print(f"[identify] fallback error: {type(e2).__name__}: {e2}")
            return {**empty, "error": f"{primary_error} | fallback {type(e2).__name__}: {e2}"[:400]}

    if not (text or "").strip():
        print("[identify] no text from model")
        return {**empty, "error": "no text from model"}

    result = _normalize(_parse_json(text))
    if not result["title"]:
        print(f"[identify] could not parse a name from reply: {text[:300]!r}")
        return {**empty, "searched": searched, "used_search": bool(queries)}
    if not searched and result["confidence"] == "high":
        result["confidence"] = "medium"  # ไม่ได้ค้นยืนยัน จึงไม่ควรมั่นใจสูง
    result["searched"] = searched
    result["used_search"] = bool(queries)
    return result