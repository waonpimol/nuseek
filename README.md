# NUSeek 🔍

ระบบแจ้งของหาย-ของที่พบ สำหรับมหาวิทยาลัยนเรศวร ใช้ AI จับคู่ของหาย/ของที่พบให้อัตโนมัติ

**Stack:** React + Vite + Tailwind (frontend) · FastAPI (backend) · Supabase (DB/Storage/Auth) · Gemini + BLIP + Sentence-Transformers (AI)

---

## ติดตั้งก่อนเริ่ม
- Node.js 18+
- Python 3.10+
- [uv](https://docs.astral.sh/uv/) — `powershell -c "irm https://astral.sh/uv/install.ps1 | iex"` (Windows) หรือ `curl -LsSf https://astral.sh/uv/install.sh | sh` (Mac/Linux)
- บัญชี [Supabase](https://supabase.com) + [Google API key](https://aistudio.google.com/app/apikey) (Gemini)

## Setup

\`\`\`bash
git clone https://github.com/waonpimol/nuseek.git
cd nuseek
\`\`\`

**Backend:**
\`\`\`bash
cd backend
uv sync
\`\`\`
สร้าง `backend/nuseek/.env`:
\`\`\`dotenv
GOOGLE_GENAI_USE_ENTERPRISE=0
GOOGLE_API_KEY=<gemini key>
SUPABASE_URL=<supabase url>
SUPABASE_KEY=<service_role key>
\`\`\`

**Frontend:**
\`\`\`bash
cd frontend
npm install
\`\`\`
ใส่ Supabase URL + anon key ใน `frontend/src/services/supabaseClient.ts`

**Supabase:** สร้างตาราง `users`, `items`, `matches`, `claims`, `notifications` + เปิด extension `vector` + สร้าง storage bucket `items-images` และ `avatars` (public)

## รันโปรเจกต์ (2 terminal พร้อมกัน)

\`\`\`bash
# Terminal 1 — backend
cd backend
uv run uvicorn app:app --reload --host 0.0.0.0

# Terminal 2 — frontend
cd frontend
npm run dev
\`\`\`

เปิด `http://localhost:5173`

---