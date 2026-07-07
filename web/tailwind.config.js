/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  theme: {
    extend: {
      colors: {
        meavo: {
          bg: '#FAF9F7',
          ink: '#212121',
          beige: '#ECE8E1',
          accent: '#0C8F61',
          'beige-300': '#F2F0EB',
          'beige-600': '#D7D3CD',
          pink: '#EEDCDC',
          yellow: '#F4E3B1',
          blue: '#E1E9EC',
          grey: '#727272',
          'grey-50': '#EAEAEA',
        },
      },
      fontFamily: {
        sans: ['"Instrument Sans"', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
};
