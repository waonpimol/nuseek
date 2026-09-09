from fastapi import APIRouter, HTTPException, Form
from nuseek.tools.supabase_tool import confirm_match, claim_item, confirm_claim

router = APIRouter()


@router.post("/matches/{match_id}/confirm")
def confirm(match_id: str):
    result = confirm_match(match_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error", "ยืนยันไม่สำเร็จ"))
    return result


@router.post("/items/{item_id}/claim")
def claim(item_id: str, user_id: str = Form(...)):
    result = claim_item(item_id, user_id)
    if not result.get("success"):
        raise HTTPException(status_code=400, detail=result.get("error", "แจ้งเจ้าของโพสต์ไม่สำเร็จ"))
    return result


@router.post("/claims/{claim_id}/confirm")
def confirm_receipt(claim_id: str, user_id: str = Form(...)):
    result = confirm_claim(claim_id, user_id)
    if not result.get("success"):
        raise HTTPException(status_code=404, detail=result.get("error", "ยืนยันไม่สำเร็จ"))
    return result