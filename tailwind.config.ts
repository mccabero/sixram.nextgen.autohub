import type { Config } from 'tailwindcss'

const config: Config = {
  darkMode: 'class',
  content: ['./index.html', './src/**/*.{ts,tsx,js,jsx}'],
  theme: {
    extend: {
      colors: {
        'bosch-yellow': '#FFC20E',
        'bosch-red': '#E11D48',
        'bosch-blue': '#0EA5E9',
        'bosch-green': '#22C55E',
        background: {
          DEFAULT: '#F8FAFC',
          muted: '#F1F5F9',
        },
        text: {
          primary: '#0F172A',
          secondary: '#475569',
        },
        border: {
          DEFAULT: '#E6EEF6',
        },
        card: {
          DEFAULT: '#FFFFFF',
          muted: '#F8FAFC',
        },
        sidebar: {
          DEFAULT: '#0F172A',
          muted: '#0B1220',
        },
      },
      boxShadow: {
        card: '0 6px 20px rgba(15, 23, 42, 0.06)'
      },
      borderRadius: {
        xl: '12px'
      }
    }
  },
  plugins: []
}

export default config
