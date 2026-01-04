/** @type {import('tailwindcss').Config} */
export default {
    content: [
        "./index.html",
        "./src/**/*.{js,ts,jsx,tsx}",
    ],
    theme: {
        extend: {
            colors: {
                'brand-primary': '#0ea5e9',
                'brand-secondary': '#06b6d4',
                'brand-dark': '#0f172a',
            },
        },
    },
    plugins: [],
}
