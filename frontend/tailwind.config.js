/** @type {import('tailwindcss').Config} */
// Дизайн-токены завязаны на CSS-переменные из src/index.css (канал-RGB → поддержка alpha).
// Тёмная тема медиа-инструмента: глубокий сине-графитовый фон, индиго-акцент.
const rgb = (v) => `rgb(var(${v}) / <alpha-value>)`

export default {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        bg: rgb('--c-bg'),
        'bg-elev': rgb('--c-bg-elev'),
        surface: rgb('--c-surface'),
        'surface-2': rgb('--c-surface-2'),
        'surface-3': rgb('--c-surface-3'),
        border: rgb('--c-border'),
        'border-strong': rgb('--c-border-strong'),
        content: {
          DEFAULT: rgb('--c-text'),
          muted: rgb('--c-text-muted'),
          faint: rgb('--c-text-faint'),
        },
        primary: {
          DEFAULT: rgb('--c-primary'),
          hover: rgb('--c-primary-hover'),
          fg: rgb('--c-primary-fg'),
          soft: rgb('--c-primary-soft'),
        },
        accent: rgb('--c-accent'),
        success: rgb('--c-success'),
        warning: rgb('--c-warning'),
        danger: rgb('--c-danger'),
        info: rgb('--c-info'),
      },
      borderRadius: {
        sm: '6px',
        DEFAULT: '8px',
        md: '10px',
        lg: '14px',
        xl: '18px',
        '2xl': '24px',
      },
      fontFamily: {
        sans: [
          'Inter',
          'ui-sans-serif',
          'system-ui',
          '-apple-system',
          'Segoe UI',
          'Roboto',
          'sans-serif',
        ],
        mono: ['ui-monospace', 'SFMono-Regular', 'JetBrains Mono', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 2px rgb(0 0 0 / 0.30), 0 1px 1px rgb(0 0 0 / 0.20)',
        elev: '0 8px 24px -8px rgb(0 0 0 / 0.50), 0 2px 6px -2px rgb(0 0 0 / 0.40)',
        pop: '0 16px 48px -12px rgb(0 0 0 / 0.65)',
        glow: '0 0 0 1px rgb(var(--c-primary) / 0.40), 0 4px 16px -4px rgb(var(--c-primary) / 0.45)',
      },
      keyframes: {
        'fade-in': {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        'slide-up': {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        'slide-in-right': {
          from: { opacity: '0', transform: 'translateX(12px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '100%': { transform: 'translateX(100%)' },
        },
      },
      animation: {
        'fade-in': 'fade-in 0.18s ease-out',
        'slide-up': 'slide-up 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-in-right': 'slide-in-right 0.22s cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
