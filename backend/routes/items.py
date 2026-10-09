from fastapi import APIRouter, HTTPException, Form
from services.item_service import get_all_items, get_item_by_id, get_items_by_user
from nuseek.tools.supabase_tool import update_own_item, delete_own_item
from nuseek.tools.embedding_tool import embed_text

router = APIRouter()


@router.get("/items")
def items():
    return get_all_items()


@router.get("/items/mine")
def my_items(user_id: str):
    if not user_id:
        raise HTTPException(status_code=400, detail="ต้องระบุ user_id")
    return get_items_by_user(user_id)


@router.get("/items/{item_id}")
def item(item_id: str):
    result = get_item_by_id(item_id)
    if not result:
        raise HTTPException(status_code=404, detail="ไม่พบไอเทมนี้")
    return result


@router.post("/items/{item_id}/update")
def update_item(
    item_id: str,
    user_id: str = Form(...),
    item_name: str = Form(...),
    details: str = Form(""),
    location: str = Form(""),
):
    """เจ้าของแก้ชื่อ/รายละเอียด/สถานที่ของโพสต์ที่ยังเปิดอยู่ (สร้าง embedding ใหม่จากข้อความใหม่)"""
    combined_text = " ".join(filter(None, [item_name.strip(), details.strip()])).strip()
    if not combined_text:
        raise HTTPException(status_code=400, detail="ต้องระบุชื่อสิ่งของ")
    result = update_own_item(item_id, user_id, item_name, details, location, embed_text(combined_text))
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "แก้ไขไม่สำเร็จ"))
    return result


@router.post("/items/{item_id}/delete")
def delete_item(item_id: str, user_id: str = Form(...)):
    """เจ้าของลบโพสต์ที่ลงผิดทิ้งถาวร (ทำได้เฉพาะโพสต์ที่ยังไม่จบเคส)"""
    result = delete_own_item(item_id, user_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "ลบไม่สำเร็จ"))
    return result