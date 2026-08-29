from PIL import Image
from transformers import BlipForConditionalGeneration, BlipProcessor

# โหลด Processor และ Model สำหรับ BLIP Image Captioning
processor = BlipProcessor.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)
model = BlipForConditionalGeneration.from_pretrained(
    "Salesforce/blip-image-captioning-base"
)


def generate_caption(image_path):
    # 1. เปิดไฟล์ภาพและแปลงสีเป็น RGB
    image = Image.open(image_path).convert("RGB")

    # 2. ประมวลผลภาพให้อยู่ในรูปแบบ Tensor ที่โมเดลเข้าใจ
    inputs = processor(image, return_tensors="pt")

    # 3. ให้โมเดลสร้างข้อความอธิบายภาพ (Caption)
    output = model.generate(**inputs)

    # 4. แปลงคำตอบที่เป็น Token ID กลับมาเป็นข้อความปกติ
    caption = processor.decode(output[0], skip_special_tokens=True)

    return {"caption": caption}