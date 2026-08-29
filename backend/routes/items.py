from fastapi import APIRouter, HTTPException
from services.item_service import get_all_items, get_item_by_id, get_items_by_user

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