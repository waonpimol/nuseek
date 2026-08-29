from fastapi import APIRouter, HTTPException
from services.notification_service import (
    get_notifications,
    mark_notification_read,
    mark_all_read,
)

router = APIRouter()


@router.get("/notifications")
def notifications(user_id: str):
    if not user_id:
        raise HTTPException(status_code=400, detail="ต้องระบุ user_id")
    return get_notifications(user_id)


# สำคัญ: ต้องอยู่ก่อน /notifications/read-all ไม่งั้น FastAPI จะงงกับ path ที่ทับซ้อนกัน
@router.post("/notifications/read-all")
def read_all(user_id: str):
    if not user_id:
        raise HTTPException(status_code=400, detail="ต้องระบุ user_id")
    return mark_all_read(user_id)


@router.post("/notifications/{notification_id}/read")
def read_notification(notification_id: str):
    return mark_notification_read(notification_id)