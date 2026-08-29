const API = "http://127.0.0.1:8000";

export async function getItems() {
  const response = await fetch(`${API}/items`);

  if (!response.ok) {
    throw new Error("โหลดข้อมูลไม่สำเร็จ");
  }

  return await response.json();
}

export async function getItem(id: string) {
  const response = await fetch(`${API}/items/${id}`);

  if (!response.ok) {
    throw new Error("ไม่พบประกาศนี้");
  }

  return await response.json();
}

export async function getMyItems(userId: string) {
  const response = await fetch(`${API}/items/mine?user_id=${encodeURIComponent(userId)}`);

  if (!response.ok) {
    throw new Error("โหลดประกาศของฉันไม่สำเร็จ");
  }

  return await response.json();
}

export async function getNotifications(userId: string) {
  const response = await fetch(`${API}/notifications?user_id=${encodeURIComponent(userId)}`);

  if (!response.ok) {
    throw new Error("โหลดแจ้งเตือนไม่สำเร็จ");
  }

  return await response.json();
}

export async function markNotificationRead(id: string) {
  const response = await fetch(`${API}/notifications/${id}/read`, { method: "POST" });

  if (!response.ok) {
    throw new Error("อัปเดตแจ้งเตือนไม่สำเร็จ");
  }

  return await response.json();
}

export async function markAllNotificationsRead(userId: string) {
  const response = await fetch(
    `${API}/notifications/read-all?user_id=${encodeURIComponent(userId)}`,
    { method: "POST" }
  );

  if (!response.ok) {
    throw new Error("อัปเดตแจ้งเตือนไม่สำเร็จ");
  }

  return await response.json();
}

export async function confirmMatch(matchId: string) {
  const response = await fetch(`${API}/matches/${matchId}/confirm`, { method: "POST" });

  if (!response.ok) {
    throw new Error("ยืนยันไม่สำเร็จ");
  }

  return await response.json();
}

export async function reportItem(formData: FormData) {
  const response = await fetch(`${API}/report`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("ส่งประกาศไม่สำเร็จ");
  }

  return await response.json();
}

export async function searchByImage(file: File) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch(`${API}/search-by-image`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    throw new Error("ค้นหาไม่สำเร็จ");
  }

  return await response.json();
}