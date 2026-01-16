/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./views/**/*.ejs",
    "./public/**/*.js"
  ],
  theme: {
    extend: {
      colors: {
        "cosmic-void": "#030014",
        "starlight": "#E2E8F0",
        "neon-blue": "#00F0FF",
        "neon-purple": "#7000FF",
        "glass-surface": "rgba(255, 255, 255, 0.05)",
        "glass-border": "rgba(255, 255, 255, 0.1)",
      },
      fontFamily: {
        sans: ['Outfit', 'Inter', 'sans-serif'],
      },
      animation: {
        'float': 'float 6s ease-in-out infinite',
        'pulse-slow': 'pulse 4s cubic-bezier(0.4, 0, 0.6, 1) infinite',
        'glow': 'glow 2s ease-in-out infinite alternate',
      },
      keyframes: {
        float: {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
        glow: {
          'from': { boxShadow: '0 0 10px -10px #00F0FF' },
          'to': { boxShadow: '0 0 20px 5px #00F0FF' },
        }
      }
    },
  },
  plugins: [require("daisyui")],
  daisyui: {
    themes: [
      {
        neuro: {
          "primary": "#00F0FF",
          "secondary": "#7000FF",
          "accent": "#FF0080",
          "neutral": "#1D1D1F",
          "base-100": "#030014",
          "base-200": "#0A0A1E",
          "base-300": "#15152E",
          "info": "#00F0FF",
          "success": "#34C759",
          "warning": "#FF9500",
          "error": "#FF3B30",
        },
        lumina: {
          "primary": "#0070F3",
          "secondary": "#7928CA",
          "accent": "#FF0080",
          "neutral": "#E2E8F0",
          "base-100": "#F8FAFC",
          "base-200": "#F1F5F9",
          "base-300": "#E2E8F0",
          "base-content": "#1A202C",
          "info": "#0070F3",
          "success": "#34C759",
          "warning": "#FF9500",
          "error": "#FF3B30",
        },
      },
      "dark",
    ],
  },
}
