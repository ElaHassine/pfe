/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    './App.{js,jsx,ts,tsx}',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      colors: {
        // Lesio brand tokens
        navy: {
          900: '#020A16',
          800: '#050E1F',
          700: '#0A1A30',
          600: '#0D2147',
          500: '#152B4E',
          400: '#1E3A66',
        },
        teal: {
          DEFAULT: '#00C2B2',
          light:   '#33CEBC',
          dim:     'rgba(0,194,178,0.12)',
        },
        risk: {
          low:     '#00C48C',
          lowbg:   'rgba(0,196,140,0.12)',
          med:     '#F59E0B',
          medbg:   'rgba(245,158,11,0.12)',
          high:    '#FF4757',
          highbg:  'rgba(255,71,87,0.12)',
        },
      },
      fontFamily: {
        sora:   ['Sora_700Bold'],
        sorasb: ['Sora_600SemiBold'],
        sans:   ['DMSans_400Regular'],
        medium: ['DMSans_500Medium'],
      },
      boxShadow: {
        card:  '0 2px 8px rgba(0,0,0,0.08)',
        teal:  '0 4px 16px rgba(0,194,178,0.28)',
      },
    },
  },
  plugins: [],
};
