/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        ink: {
          950: '#06080b',
          900: '#0b0e13',
          850: '#0f131a',
          800: '#141922',
          700: '#1c222d',
          600: '#283040',
        },
        volt: { DEFAULT: '#22d3ee', soft: '#67e8f9', deep: '#0891b2' },
        ok: '#34d399',
        warn: '#f59e0b',
        crit: '#f43f5e',
      },
      fontFamily: {
        display: ['Space Grotesk', 'ui-sans-serif', 'system-ui', 'sans-serif'],
        sans: ['IBM Plex Sans', 'ui-sans-serif', 'system-ui', 'Segoe UI', 'Roboto', 'sans-serif'],
        mono: ['JetBrains Mono', 'ui-monospace', 'SFMono-Regular', 'Menlo', 'monospace'],
      },
      boxShadow: {
        card: '0 1px 0 0 rgba(255,255,255,0.03) inset, 0 18px 40px -24px rgba(0,0,0,0.9)',
      },
      keyframes: {
        pulsering: {
          '0%': { transform: 'scale(0.9)', opacity: '0.7' },
          '70%': { transform: 'scale(2.2)', opacity: '0' },
          '100%': { transform: 'scale(2.2)', opacity: '0' },
        },
        flowx: {
          '0%': { transform: 'translateX(-6px)', opacity: '0' },
          '40%': { opacity: '1' },
          '100%': { transform: 'translateX(6px)', opacity: '0' },
        },
        fadeup: {
          from: { opacity: '0', transform: 'translateY(6px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        pulsering: 'pulsering 2.4s cubic-bezier(0,0,0.2,1) infinite',
        fadeup: 'fadeup .35s ease-out both',
        flowx: 'flowx 1.8s ease-in-out infinite',
      },
    },
  },
  plugins: [],
}
