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

export async function claimItem(itemId: string, userId: string) {
  const formData = new FormData();
  formData.append("user_id", userId);

  const response = await fetch(`${API}/items/${itemId}/claim`, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let detail = "แจ้งเจ้าของโพสต์ไม่สำเร็จ";
    try {
      const errBody = await response.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch {
      // ไม่ใช่ JSON ก็ปล่อยข้อความ default ไว้
    }
    throw new Error(detail);
  }

  return await response.json();
}

export async function confirmClaim(claimId: string, userId: string) {
  const formData = new FormData();
  formData.append("user_id", userId);

  const response = await fetch(`${API}/claims/${claimId}/confirm`, {
    method: "POST",
    body: formData,
  });

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
    // ดึงข้อความ error ที่ backend ส่งมา (เช่น "กรุณากรอกเบอร์โทรศัพท์เป็นตัวเลขเท่านั้น")
    // แทนที่จะทิ้งไปแล้วโชว์แค่ข้อความทั่วไป
    let detail = "ส่งประกาศไม่สำเร็จ";
    try {
      const errBody = await response.json();
      if (errBody?.detail) detail = errBody.detail;
    } catch {
      // ไม่ใช่ JSON ก็ปล่อยข้อความ default ไว้
    }
    throw new Error(detail);
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