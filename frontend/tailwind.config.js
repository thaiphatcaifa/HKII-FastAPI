import colors from 'tailwindcss/colors'
import plugin from 'tailwindcss/plugin'

const SHADES = [50, 100, 200, 300, 400, 500, 600, 700, 800, 900, 950]

const toRgb = (hex) => {
  const n = parseInt(hex.slice(1), 16)
  return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`
}
const variables = (name, palette) => Object.fromEntries(SHADES.map((s) => [`--${name}-${s}`, toRgb(palette[s])]))
const scale = (name) => Object.fromEntries(SHADES.map((s) => [s, `rgb(var(--${name}-${s}) / <alpha-value>)`]))

// Mỗi bảng màu gồm: màu chủ đạo (brand), màu nhấn (accent), dải xám cho chữ và viền (neutral) và màu nền trang.
// Chọn bảng màu bằng thuộc tính data-theme trên thẻ <html> (xem src/theme.js). Các trang chỉ dùng tên brand,
// accent, slate nên thêm hoặc đổi bảng màu không cần sửa từng trang. Chữ dùng sắc 700 trở lên của brand để đủ tương phản.
const DEFAULT_THEME = 'ngoc'
const THEMES = {
  ngoc: { brand: colors.teal, accent: colors.sky, neutral: colors.slate, page: '#f3f9f8' },
  bien: { brand: colors.blue, accent: colors.cyan, neutral: colors.slate, page: '#f4f8ff' },
  am: { brand: colors.orange, accent: colors.amber, neutral: colors.stone, page: '#fffaf3' },
}

/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        brand: scale('brand'),
        accent: scale('accent'),
        slate: scale('neutral'),
      },
      fontFamily: {
        sans: ['"Inter Variable"', 'ui-sans-serif', 'system-ui', '-apple-system', 'Segoe UI', 'Roboto', 'sans-serif'],
        // Phông tiêu đề và số liệu lớn (có bộ ký tự tiếng Việt)
        display: ['"Plus Jakarta Sans Variable"', '"Inter Variable"', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      boxShadow: {
        card: '0 1px 2px 0 rgb(var(--neutral-900) / 0.04), 0 10px 28px -14px rgb(var(--neutral-900) / 0.12)',
        'card-hover': '0 2px 4px 0 rgb(var(--neutral-900) / 0.05), 0 18px 40px -16px rgb(var(--brand-600) / 0.3)',
        glow: '0 18px 44px -14px rgb(var(--brand-500) / 0.45)',
      },
      keyframes: {
        'fade-in': { from: { opacity: '0' }, to: { opacity: '1' } },
        'pop-in': {
          from: { opacity: '0', transform: 'translateY(8px) scale(0.98)' },
          to: { opacity: '1', transform: 'none' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(10px)' },
          to: { opacity: '1', transform: 'none' },
        },
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-8px)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 150ms ease-out',
        'pop-in': 'pop-in 180ms ease-out',
        'slide-up': 'slide-up 220ms ease-out both',
        float: 'float 7s ease-in-out infinite',
        'float-slow': 'float 10s ease-in-out infinite',
      },
    },
  },
  plugins: [
    plugin(({ addBase }) => {
      const css = {}
      for (const [id, t] of Object.entries(THEMES)) {
        const selector = id === DEFAULT_THEME ? `:root, [data-theme='${id}']` : `[data-theme='${id}']`
        css[selector] = {
          ...variables('brand', t.brand),
          ...variables('accent', t.accent),
          ...variables('neutral', t.neutral),
          '--page': toRgb(t.page),
        }
      }
      addBase(css)
    }),
  ],
}
