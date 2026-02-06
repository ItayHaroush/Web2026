/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx}",
  ],
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
          primary: '#009DE0',
          secondary: '#00C2E8',
          dark: '#002B49',
          accent: '#FFC629',
          light: '#F5F7FA',
          success: '#04AA6D',
          warning: '#FF9500',
        },
      },
    },
  },
  plugins: [require('tailwindcss-rtl')],
}

