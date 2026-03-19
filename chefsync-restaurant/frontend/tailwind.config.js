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
      keyframes: {
        menuOrdersHintIn: {
          '0%': { transform: 'translateX(110%)', opacity: '0' },
          '100%': { transform: 'translateX(0)', opacity: '1' },
        },
        /** פופ־אפ עליון ממורכז — בלי translateX כדי שלא ידרוס מרכוז (left-1/2 -translate-x-1/2) */
        topDismissibleIn: {
          '0%': { opacity: '0', transform: 'translateY(-0.5rem)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      animation: {
        'menu-orders-hint-in': 'menuOrdersHintIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
        'top-dismissible-in': 'topDismissibleIn 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards',
      },
      colors: {
        brand: {
          primary: '#F97316',
          secondary: '#FB923C',
          dark: '#1F2937',
          accent: '#FBBF24',
          /** טקסט מודגש על רקע שמנת/כתום בהיר (תואם למיתוג) */
          muted: '#78350F',
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

