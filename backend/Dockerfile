# Backend สำหรับ Google Cloud Run (ใช้กับ Docker host อื่นได้ด้วย)
# deploy: gcloud run deploy nuseek-api --source backend ...
FROM python:3.12-slim

RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1
WORKDIR /home/user/app

# torch แบบ CPU อย่างเดียว image เล็กกว่าแบบ CUDA หลาย GB
RUN pip install --no-cache-dir --user torch --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

# โหลดโมเดล embedding ไว้ใน image เลย ไม่ต้องดาวน์โหลดใหม่ทุกครั้งที่เครื่องเปิดขึ้นมา (cold start เร็วขึ้น)
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')"

COPY --chown=user . .

# Cloud Run ส่งพอร์ตมาทาง $PORT (ค่าเริ่มต้น 8080)
ENV PORT=8080
EXPOSE 8080
CMD uvicorn app:app --host 0.0.0.0 --port ${PORT}
