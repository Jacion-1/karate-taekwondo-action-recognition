/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        app: {
          canvas: 'var(--bg-canvas)',
          header: 'var(--bg-header)',
          surface: 'var(--bg-surface)',
          elevated: 'var(--bg-elevated)',
          well: 'var(--bg-well)',
          subtle: 'var(--border-subtle)',
          border: 'var(--border-default)',
          strong: 'var(--border-strong)',
          primary: 'var(--text-primary)',
          secondary: 'var(--text-secondary)',
          muted: 'var(--text-muted)',
        },
        brand: {
          primary: 'var(--brand-primary)',
          hover: 'var(--brand-primary-hover)',
          accent: 'var(--brand-accent)',
        },
        discipline: {
          karate: 'var(--discipline-karate)',
          tkd: 'var(--discipline-tkd)',
        },
        status: {
          success: 'var(--status-success)',
          warning: 'var(--status-warning)',
          danger: 'var(--status-danger)',
        },
      },
      fontFamily: {
        sans: [
          '"Noto Sans TC"',
          '"PingFang TC"',
          '"Microsoft JhengHei"',
          '"Heiti TC"',
          '-apple-system',
          'BlinkMacSystemFont',
          'sans-serif',
        ],
        mono: [
          '"JetBrains Mono"',
          'ui-monospace',
          'SFMono-Regular',
          'monospace',
        ],
      },
      fontSize: {
        'metric-lg': ['1.875rem', { lineHeight: '1.2', fontWeight: '700' }],
        'heading-lg': ['1.25rem', { lineHeight: '1.35', fontWeight: '700' }],
        'heading-md': ['1.0625rem', { lineHeight: '1.45', fontWeight: '600' }],
        'title-sm': ['0.9375rem', { lineHeight: '1.5', fontWeight: '600' }],
        'body': ['0.875rem', { lineHeight: '1.65', fontWeight: '400' }],
        'caption': ['0.75rem', { lineHeight: '1.5', fontWeight: '500' }],
      },
      borderRadius: {
        card: '0.875rem',
        panel: '0.625rem',
        control: '0.5rem',
        badge: '0.375rem',
      },
      boxShadow: {
        card: '0 4px 20px -2px rgba(5, 10, 20, 0.45), 0 1px 0 0 rgba(255, 255, 255, 0.05) inset',
        elevated: '0 8px 28px -4px rgba(5, 10, 20, 0.6), 0 1px 0 0 rgba(255, 255, 255, 0.08) inset',
        brand: '0 2px 10px rgba(37, 99, 235, 0.35)',
      },
    },
  },
  plugins: [],
}
