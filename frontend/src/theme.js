// Bảng màu giao diện. Giá trị màu thật nằm ở tailwind.config.js (biến CSS theo thuộc tính data-theme của <html>);
// ở đây chỉ có tên, mô tả, ba chấm màu minh họa cho trang Tài khoản và màu thanh địa chỉ trên điện thoại.
export const THEMES = [
  { id: 'ngoc', label: 'Xanh ngọc', hint: 'Dịu mắt, tự nhiên (mặc định)', swatch: ['#14b8a6', '#38bdf8', '#f3f9f8'], color: '#0f766e' },
  { id: 'bien', label: 'Xanh biển', hint: 'Trong trẻo, đáng tin cậy', swatch: ['#3b82f6', '#22d3ee', '#f4f8ff'], color: '#1d4ed8' },
  { id: 'am', label: 'Ấm áp', hint: 'Thân thiện, gần gũi', swatch: ['#f97316', '#fbbf24', '#fffaf3'], color: '#c2410c' },
]

export const DEFAULT_THEME = THEMES[0].id
const KEY = 'hkii_theme'

export function getTheme() {
  try {
    const saved = localStorage.getItem(KEY)
    return THEMES.some((t) => t.id === saved) ? saved : DEFAULT_THEME
  } catch {
    return DEFAULT_THEME
  }
}

export function applyTheme(id) {
  document.documentElement.setAttribute('data-theme', id)
  const color = THEMES.find((t) => t.id === id)?.color
  if (color) document.querySelector('meta[name="theme-color"]')?.setAttribute('content', color)
}

export function setTheme(id) {
  try {
    localStorage.setItem(KEY, id)
  } catch {
    /* trình duyệt chặn lưu trữ: bảng màu vẫn đổi nhưng chỉ trong lần mở này */
  }
  applyTheme(id)
}
