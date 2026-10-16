# Backend สำหรับ Hugging Face Spaces (SDK: Docker) — อัปโหลดไฟล์ทั้งหมดในโฟลเดอร์ backend ขึ้น Space
FROM python:3.12-slim

# Spaces รันด้วย user id 1000 และเปิดพอร์ต 7860
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH \
    HF_HOME=/home/user/.cache/huggingface \
    PYTHONUNBUFFERED=1
WORKDIR /home/user/app

RUN pip install --no-cache-dir --user torch --index-url https://download.pytorch.org/whl/cpu
COPY --chown=user requirements.txt .
RUN pip install --no-cache-dir --user -r requirements.txt

COPY --chown=user . .

EXPOSE 7860
CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "7860"]
