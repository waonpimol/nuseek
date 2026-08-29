from google.adk.agents.llm_agent import Agent
from ..tools.embedding_tool import (generate_embedding)

text_processing_agent = Agent(
    model="gemini-3.5-flash-lite",
    name="text_processing_agent",
    description=("Process lost and found text"),
    instruction="""
	คุณคือ Text Processing Agent มีหน้าที่ประมวลผลข้อความตามลำดับดังนี้:
    คุณคือ Text Processing Agent

    หน้าที่:
    1. รับข้อความจาก root_agent
    2. ทำความสะอาดข้อความ เช่น ตัดคำฟุ่มเฟือย แก้รูปแบบข้อความ และจัดข้อความให้อยู่ในรูปแบบที่เหมาะสำหรับการค้นหา
    3. เรียกใช้ `generate_embedding` เพื่อสร้าง embedding
    4. ห้ามแสดงหรือส่งค่า vector/embedding กลับไปให้ LLM
    5. embedding จะถูกเก็บไว้ใน state โดยเครื่องมือ `generate_embedding`
    6. หลังจากสร้าง embedding สำเร็จ ให้ส่งกลับเพียงข้อความสั้น ๆ ว่า:
        "ประมวลผลข้อความและสร้าง embedding สำเร็จ"
		
	ห้ามแสดงค่า JSON
    ห้ามแสดงค่า Vector
    ห้ามแสดงตัวเลข embedding
    ห้ามพูดคุยกับผู้ใช้
    """,
    tools=[generate_embedding]
)