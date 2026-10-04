# NUSeek 🔍

ระบบแจ้งของหาย-ของที่พบ (Lost & Found) สำหรับมหาวิทยาลัยนเรศวร ใช้ AI วิเคราะห์รูปและข้อความ เพื่อจับคู่ของหายกับของที่มีคนเก็บได้ให้อัตโนมัติ

## ฟีเจอร์หลัก
- สมัครสมาชิก / เข้าสู่ระบบ / ลืมรหัสผ่าน / โปรไฟล์ (รูป และช่องทางติดต่อ: เบอร์โทร, Line, Facebook, Instagram)
- แจ้งของหาย / แจ้งพบของ พร้อมรูป — ระบบหาคู่ฝั่งตรงข้ามอัตโนมัติและแจ้งเตือนทั้งสองฝ่าย
- ค้นหาด้วยรูปภาพ — AI อ่านรูป หาโพสต์ที่คล้ายกัน และมี verification agent ตรวจซ้ำรายการที่คะแนนต่ำ
- ปิดเคส 2 ทาง: ยืนยันแมทช์ที่ AI จับให้ (ยืนยัน/ปฏิเสธ → ส่งมอบของ) และ "ใช่ของฉัน" จากการค้นหารูป
- แจ้งเตือนในแอป (กระดิ่ง), สถิติและรายการประกาศของตัวเองในโปรไฟล์, ใช้ได้ทั้งมือถือและคอมพิวเตอร์

## Stack
| ส่วน | เทคโนโลยี |
|---|---|
| Frontend | React + TypeScript + Vite + Tailwind CSS |
| Backend | FastAPI (Python 3.12) จัดการแพ็กเกจด้วย [uv](https://docs.astral.sh/uv/) |
| Database / Storage / Auth | Supabase (PostgreSQL + pgvector) |
| AI | BLIP (อ่านรูป) · Sentence-Transformers `paraphrase-multilingual-MiniLM-L12-v2` (embedding 384 มิติ) · Gemini (แปลคำอธิบาย + verification agent) |

---

## ติดตั้งก่อนเริ่ม
- **Node.js 20.19+** (หรือ 22.12+ ตามที่ Vite 8 ต้องการ)
- **Python 3.12+** และ **uv** — `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"` (Windows) หรือ `curl -LsSf https://astral.sh/uv/install.sh | sh` (Mac/Linux)
- โปรเจกต์ [Supabase](https://supabase.com) และ [Google API key](https://aistudio.google.com/app/apikey) (Gemini)

## ตั้งค่า

```bash
git clone https://github.com/waonpimol/nuseek.git
cd nuseek
```

**1) Backend** — `pyproject.toml` อยู่ที่รากของโปรเจกต์ (ไม่ใช่ในโฟลเดอร์ `backend`)
```bash
uv sync
```
สร้างไฟล์ `backend/nuseek/.env` (ดูแบบจาก `.env.example` ในโฟลเดอร์เดียวกัน):
```dotenv
GOOGLE_GENAI_USE_ENTERPRISE=0
GOOGLE_API_KEY=<Gemini API key>
SUPABASE_URL=<Supabase project URL>
SUPABASE_KEY=<service_role (secret) key>
```
> `SUPABASE_KEY` ต้องเป็น **service_role** ไม่ใช่ anon key (backend ใช้ข้ามกฎ RLS ของตาราง)
> ขอค่าจริงจากเจ้าของโปรเจกต์โดยตรง ห้าม commit `.env`

**2) Frontend**
```bash
cd frontend
npm install
```
ใส่ Supabase URL และ **anon (publishable) key** ใน `frontend/src/services/supabaseClient.ts` (คนละตัวกับของ backend)

## รันโปรเจกต์ (2 terminal พร้อมกัน)

```bash
# Terminal 1 — backend (รันในโฟลเดอร์ backend)
cd backend
uv run uvicorn app:app --reload --host 0.0.0.0

# Terminal 2 — frontend
cd frontend
npm run dev
```
เปิด `http://localhost:5173`

- **ครั้งแรกจะช้า**: backend ดาวน์โหลดโมเดล BLIP และ Sentence-Transformers จาก Hugging Face (ขนาดรวมหลาย GB ต้องมีอินเทอร์เน็ต) และ `torch` ก็ใหญ่ ใช้ RAM มาก
- **ทดสอบผ่านมือถือ** (ต้องอยู่ WiFi เดียวกัน): ใช้ URL ช่อง Network ที่ Vite แสดง หน้าเว็บเรียก backend ที่ host เดียวกับที่เปิดอยู่ (พอร์ต 8000) อัตโนมัติ ถ้าเข้าไม่ได้ให้เช็ค firewall และ WiFi ที่เปิด client isolation (พบบ่อยในหอพัก/มหาวิทยาลัย)

## โครงสร้างโปรเจกต์
```
nuseek/
├── pyproject.toml, uv.lock     # dependency ของ backend
├── backend/
│   ├── app.py                  # FastAPI entry point
│   ├── routes/                 # endpoint: /report, /items, /search-by-image, /notifications, /matches ...
│   ├── services/               # ดึง/ประกอบข้อมูลโพสต์
│   ├── nuseek/tools/           # BLIP, embedding, verification agent, ฟังก์ชัน Supabase
│   └── migrations/             # SQL ของฐานข้อมูล (001–003)
└── frontend/src/
    ├── pages/                  # หน้าเว็บทั้งหมด
    ├── components/             # component ใช้ร่วม (modal, loader, toast, empty state ...)
    ├── hooks/, services/, utils/
```

