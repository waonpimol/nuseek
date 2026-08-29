from fastapi import APIRouter, HTTPException
from nuseek.tools.supabase_tool import confirm_match

router = APIRouter()


@router.post("/matches/{match_id}/confirm")
def confirm(match_id: str):
    result = confirm_match(match_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error", "ยืนยันไม่สำเร็จ"))
    return result