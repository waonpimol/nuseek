from sentence_transformers import SentenceTransformer
from google.adk.tools.tool_context import ToolContext

model = SentenceTransformer('paraphrase-multilingual-MiniLM-L12-v2')

def generate_embedding(
    text: str,
    tool_context: ToolContext
) -> str:

    if not text or not text.strip():
        return "ไม่สามารถสร้าง embedding ได้ เนื่องจากข้อความว่าง"

    vector = model.encode(
        text,
        normalize_embeddings=True
    ).tolist()

    tool_context.state["embedding"] = vector
    tool_context.state["processed_text"] = text

    return "สร้าง embedding สำเร็จ"


def embed_text(text: str) -> list:
    """
    เวอร์ชัน plain function (ไม่ผ่าน ADK state) สำหรับใช้นอก agent
    เช่นใน endpoint ค้นหาด้วยรูปที่ไม่ต้องการ LLM ตัดสินใจอะไร
    ใช้โมเดลตัวเดียวกับ generate_embedding เพื่อให้ vector space ตรงกัน
    """
    if not text or not text.strip():
        return []

    return model.encode(text, normalize_embeddings=True).tolist()
