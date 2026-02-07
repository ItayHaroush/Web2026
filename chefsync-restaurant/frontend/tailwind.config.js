/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
  darkMode: 'class',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Rubik', 'Cairo', 'system-ui', 'sans-serif'],
        display: ['Cairo', 'Rubik', 'system-ui', 'sans-serif'],
        heebo: ['Heebo', 'system-ui', 'sans-serif'],
        assistant: ['Assistant', 'system-ui', 'sans-serif'],
        secular: ['"Secular One"', 'system-ui', 'sans-serif'],
        karantina: ['Karantina', 'system-ui', 'sans-serif'],
        amatic: ['"Amatic SC"', 'cursive', 'sans-serif'],
      },
      colors: {
        brand: {
          primary: '#F97316',
          secondary: '#FB923C',
          dark: '#1F2937',
          accent: '#FBBF24',
          light: '#FFF7ED',
          cream: '#FEF3C7',
          surface: '#FFFFFF',
          success: '#04AA6D',
          warning: '#FF9500',
          'dark-bg': '#111827',
          'dark-surface': '#1F2937',
          'dark-border': '#374151',
          'dark-text': '#F9FAFB',
          'dark-muted': '#9CA3AF',
        },
      },
    },
  },
  plugins: [require('tailwindcss-rtl')],
}

