/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        'wc-dark':       '#07091A',
        'wc-navy':       '#0D1130',
        'wc-blue':       '#1A2250',
        'wc-gold':       '#F59E0B',
        'wc-gold-light': '#FCD34D',
        'wc-purple':     '#7C3AED',
        'wc-violet':     '#A855F7',
        'wc-red':        '#C0392B',
      },
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      backgroundImage: {
        'gradient-fifa':   'linear-gradient(135deg, #07091A 0%, #0D1130 50%, #130D2A 100%)',
        'gradient-card':   'linear-gradient(135deg, rgba(26,34,80,0.6) 0%, rgba(13,17,48,0.8) 100%)',
        'gradient-gold':   'linear-gradient(135deg, #F59E0B, #FCD34D)',
        'gradient-purple': 'linear-gradient(135deg, #7C3AED, #A855F7)',
        'gradient-blue':   'linear-gradient(135deg, #1A2250, #0D1130)',
      },
      boxShadow: {
        'glow-gold':   '0 0 20px rgba(245,158,11,0.15)',
        'glow-purple': '0 0 20px rgba(168,85,247,0.15)',
        'glow-blue':   '0 0 30px rgba(26,34,80,0.5)',
        'card':        '0 4px 24px rgba(0,0,0,0.4)',
      },
    },
  },
  plugins: [],
};
