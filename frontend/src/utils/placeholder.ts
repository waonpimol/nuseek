export function getPlaceholderImage(
  width: number,
  height: number,
  text: string = "ไม่มีรูปภาพ"
): string {
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
      <rect width="100%" height="100%" fill="#e5e7eb" />
      <text
        x="50%"
        y="50%"
        dominant-baseline="middle"
        text-anchor="middle"
        font-family="sans-serif"
        font-size="${Math.max(14, Math.round(width / 20))}"
        fill="#9ca3af"
      >${text}</text>
    </svg>
  `.trim();

  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}