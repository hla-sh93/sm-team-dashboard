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
        // Light theme (Vuexy-style): cool light page, white surfaces.
        bg: {
          DEFAULT: '#f5f7fa', // page background
          elev: '#ffffff', // sidebar / inputs / raised surfaces
          elev2: '#eceff3', // hover / chip background
          card: '#ffffff', // cards
        },
        border: {
          DEFAULT: '#d8dde4',
          soft: '#e7ebf0',
        },
        fg: {
          DEFAULT: '#1b2733', // strong text / headings
          dim: '#586475', // secondary text
          muted: '#929cab', // muted / placeholder
        },
        // Primary = aqua.
        accent: {
          DEFAULT: '#0a8fa3',
          dim: '#07778a', // darker (hover / gradient end)
          soft: '#e3f4f7', // light aqua tint
        },
        success: '#1e9e68',
        warning: '#c77e1b',
        danger: '#d6453b',
        info: '#2d72c8',
      },
      borderRadius: {
        // Tighter radii (Vuexy-like).
        DEFAULT: '6px',
        sm: '4px',
        md: '6px',
        lg: '8px',
        xl: '10px',
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
