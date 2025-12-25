/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        // Vibrant party palette
        'buzz-red': '#FF2D55',
        'buzz-orange': '#FF9500',
        'buzz-yellow': '#FFCC00',
        'buzz-green': '#34C759',
        'buzz-blue': '#007AFF',
        'buzz-purple': '#AF52DE',
        'buzz-pink': '#FF2D55',
        'buzz-dark': '#0A0A0F',
        'buzz-darker': '#050508',
        'buzz-card': '#16161F',
        'buzz-border': '#2A2A3A',
      },
      fontFamily: {
        display: ['var(--font-display)', 'system-ui', 'sans-serif'],
        body: ['var(--font-body)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'monospace'],
      },
      animation: {
        'buzz-pulse': 'buzz-pulse 0.5s ease-in-out',
        'queue-slide': 'queue-slide 0.3s ease-out',
        'glow': 'glow 2s ease-in-out infinite alternate',
        'shake': 'shake 0.5s ease-in-out',
        'float': 'float 3s ease-in-out infinite',
      },
      keyframes: {
        'buzz-pulse': {
          '0%, 100%': { transform: 'scale(1)' },
          '50%': { transform: 'scale(0.95)' },
        },
        'queue-slide': {
          '0%': { opacity: '0', transform: 'translateX(-20px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        'glow': {
          '0%': { boxShadow: '0 0 20px rgba(255, 45, 85, 0.5)' },
          '100%': { boxShadow: '0 0 40px rgba(255, 45, 85, 0.8)' },
        },
        'shake': {
          '0%, 100%': { transform: 'translateX(0)' },
          '25%': { transform: 'translateX(-5px)' },
          '75%': { transform: 'translateX(5px)' },
        },
        'float': {
          '0%, 100%': { transform: 'translateY(0)' },
          '50%': { transform: 'translateY(-10px)' },
        },
      },
      boxShadow: {
        'buzz': '0 0 60px rgba(255, 45, 85, 0.4)',
        'buzz-active': '0 0 80px rgba(255, 45, 85, 0.6)',
        'card': '0 4px 20px rgba(0, 0, 0, 0.3)',
      },
    },
  },
  plugins: [],
};

