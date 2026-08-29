from nuseek.tools.supabase_tool import supabase


def get_notifications(user_id: str, limit: int = 30):
    result = (
        supabase
        .table("notifications")
        .select("*")
        .eq("user_id", user_id)
        .order("created_at", desc=True)
        .limit(limit)
        .execute()
    )
    return result.data or []


def mark_notification_read(notification_id: str):
    result = (
        supabase
        .table("notifications")
        .update({"is_read": True})
        .eq("id", notification_id)
        .execute()
    )
    return result.data


def mark_all_read(user_id: str):
    result = (
        supabase
        .table("notifications")
        .update({"is_read": True})
        .eq("user_id", user_id)
        .eq("is_read", False)
        .execute()
    )
    return result.data