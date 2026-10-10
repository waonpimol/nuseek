"""ทดสอบว่า API key + โมเดลนี้ใช้ Google Search grounding ได้จริงไหม (แยกจากโค้ดของระบบ)

วิธีใช้ (รันในโฟลเดอร์ backend):
    uv run python scripts/test_google_search.py                # ใช้โมเดลจาก IDENTIFY_MODEL หรือค่าเริ่มต้น
    uv run python scripts/test_google_search.py <ชื่อโมเดล>     # ลองโมเดลอื่น เช่นตัวที่ใช้ได้ใน AI Studio

ผลที่เป็นไปได้:
  - ขึ้น "OK" พร้อมรายการคำค้น  → key และโมเดลนี้ใช้ Google Search ได้ ปัญหาอยู่ที่โค้ด/ADK (ส่ง log มาดู)
  - ขึ้น 429 / RESOURCE_EXHAUSTED → โควตา Google Search ของ key นี้เต็มหรือเป็นศูนย์ (มักเกิดบน Free tier)
  - ขึ้น 400 / not supported       → โมเดลนี้ไม่รองรับ Google Search ให้ลองโมเดลอื่น
"""
import os
import sys

from pathlib import Path

from dotenv import load_dotenv
from google import genai
from google.genai import types

# ไฟล์ .env ของโปรเจกต์อยู่ที่ backend/nuseek/.env (ตามที่ README ระบุ) หาให้ทั้งกรณีวางสคริปต์ใน backend/scripts และ backend
_here = Path(__file__).resolve().parent
for _candidate in (_here.parent / "nuseek" / ".env", _here / "nuseek" / ".env"):
    if _candidate.exists():
        load_dotenv(_candidate)
        print(f"โหลด .env จาก {_candidate}")
        break
else:
    load_dotenv()  # ไม่เจอ ลองหาแบบปกติ (cwd และโฟลเดอร์แม่)
    print("ไม่เจอ backend/nuseek/.env ลองหา .env แบบปกติแทน")

if not (os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")):
    print("ยังไม่เจอ GOOGLE_API_KEY ใน .env — เช็กว่าไฟล์ backend/nuseek/.env มีบรรทัด GOOGLE_API_KEY=...")
    sys.exit(1)
model = sys.argv[1] if len(sys.argv) > 1 else os.getenv("IDENTIFY_MODEL", "gemini-3.5-flash-lite")
print(f"model = {model}")

client = genai.Client()
try:
    resp = client.models.generate_content(
        model=model,
        contents="หูฟังครอบหู Sony WH-CH520 ราคาเท่าไหร่ในไทย",
        config=types.GenerateContentConfig(tools=[types.Tool(google_search=types.GoogleSearch())]),
    )
except Exception as e:
    print(f"FAILED: {type(e).__name__}: {e}")
    sys.exit(1)

gm = resp.candidates[0].grounding_metadata if resp.candidates else None
queries = list(getattr(gm, "web_search_queries", None) or [])
print("OK" if queries else "ตอบได้ แต่โมเดลไม่ได้ค้น Google (web_search_queries ว่าง)")
print("queries:", queries)
print("answer:", (resp.text or "")[:300])