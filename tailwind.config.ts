import type { Config } from 'tailwindcss';

const config: Config = {
  content: ['./src/**/*.{js,ts,jsx,tsx,mdx}'],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['var(--font-tajawal)', 'system-ui', 'sans-serif'],
        display: ['var(--font-reem)', 'serif'],
      },
      colors: {
        bg: {
          DEFAULT: '#0a0a0f',
          elev: '#13131c',
          elev2: '#1a1a26',
          card: '#111118',
        },
        border: {
          DEFAULT: '#2a2a3a',
          soft: '#1f1f2e',
        },
        fg: {
          DEFAULT: '#f4f4f8',
          dim: '#9090a8',
          muted: '#5a5a70',
        },
        accent: {
          DEFAULT: '#d4af37',
          dim: '#a08828',
          soft: '#3a2f10',
        },
        success: '#3fb27f',
        warning: '#e5a04a',
        danger: '#e0584a',
        info: '#5a8fd4',
      },
      borderRadius: {
        DEFAULT: '14px',
        sm: '8px',
        lg: '20px',
      },
      animation: {
        'fade-in': 'fadeIn 0.3s ease',
        'slide-in': 'slideIn 0.3s ease',
      },
      keyframes: {
        fadeIn: {
          from: { opacity: '0', transform: 'translateY(8px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        slideIn: {
          from: { transform: 'translateX(-20px)', opacity: '0' },
          to: { transform: 'translateX(0)', opacity: '1' },
        },
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
};

export default config;
