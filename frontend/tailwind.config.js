/** @type {import('tailwindcss').Config} */
export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      fontFamily: {
        racing: ['Rajdhani', 'sans-serif'],
        body: ['Inter', 'sans-serif'],
      },
      colors: {
        'racing-dark': '#0a0a0a',
        'racing-gray': '#111111',
        'racing-card': '#1a1a1a',
        'racing-border': '#2a2a2a',
        'racing-red': '#e63946',
        'racing-red-dark': '#9d0208',
        'racing-accent': '#ff4d5a',
        'racing-highlight': '#f5f5f5',
        'racing-silver': '#c0c0c0',
        'racing-bronze': '#8f8f8f',
      },
      backgroundImage: {
        'gradient-racing': 'linear-gradient(135deg, #e63946 0%, #9d0208 100%)',
        'gradient-dark': 'linear-gradient(180deg, #0a0a0a 0%, #111111 100%)',
        'hero-pattern': "url(\"data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.03'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E\")",
      },
      boxShadow: {
        'racing': '0 0 20px rgba(230, 57, 70, 0.3)',
        'racing-lg': '0 0 40px rgba(230, 57, 70, 0.2)',
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.37)',
      },
      animation: {
        'fade-in': 'fadeIn 0.5s ease-in-out',
        'slide-up': 'slideUp 0.4s ease-out',
        'pulse-red': 'pulseRed 2s infinite',
      },
      keyframes: {
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        slideUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        pulseRed: {
          '0%, 100%': { boxShadow: '0 0 0 0 rgba(230, 57, 70, 0.4)' },
          '50%': { boxShadow: '0 0 0 10px rgba(230, 57, 70, 0)' },
        },
      },
    },
  },
  plugins: [],
}
