import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        'c2-bg': '#06070d',
        'c2-surface': '#0c0d18',
        'c2-card': '#0f1020',
        'c2-border': 'rgba(255,255,255,0.07)',
        'c2-text': '#e2e8f0',
        'c2-muted': '#64748b',
        'c2-violet': '#7c3aed',
        'c2-indigo': '#4f46e5',
        'c2-green': '#10b981',
        'c2-red': '#ef4444',
        'c2-amber': '#f59e0b',
        'c2-blue': '#3b82f6',
        'c2-cyan': '#06b6d4',
        'c2-purple': '#a855f7',
      },
      backgroundImage: {
        'gradient-violet': 'linear-gradient(135deg, #7c3aed 0%, #4f46e5 100%)',
        'gradient-emerald': 'linear-gradient(135deg, #10b981 0%, #059669 100%)',
        'gradient-amber': 'linear-gradient(135deg, #f59e0b 0%, #d97706 100%)',
        'gradient-blue': 'linear-gradient(135deg, #3b82f6 0%, #2563eb 100%)',
        'gradient-red': 'linear-gradient(135deg, #ef4444 0%, #dc2626 100%)',
        'gradient-radial-violet': 'radial-gradient(ellipse at top left, rgba(124,58,237,0.15) 0%, transparent 60%)',
        'gradient-radial-blue': 'radial-gradient(ellipse at top right, rgba(79,70,229,0.1) 0%, transparent 60%)',
        'mesh-gradient': 'linear-gradient(135deg, #06070d 0%, #0c0d18 50%, #06070d 100%)',
      },
      animation: {
        'fade-up': 'fadeUp 0.5s ease-out forwards',
        'fade-in': 'fadeIn 0.3s ease-out forwards',
        'pulse-glow': 'pulseGlow 2s ease-in-out infinite',
        'pulse-slow': 'pulse 3s ease-in-out infinite',
        'slide-in-right': 'slideInRight 0.3s ease-out forwards',
        'shimmer': 'shimmer 2s linear infinite',
        'count-up': 'countUp 1s ease-out forwards',
        'spin-slow': 'spin 3s linear infinite',
      },
      keyframes: {
        fadeUp: {
          '0%': { opacity: '0', transform: 'translateY(20px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          '0%': { opacity: '0' },
          '100%': { opacity: '1' },
        },
        pulseGlow: {
          '0%, 100%': { boxShadow: '0 0 5px rgba(124,58,237,0.3), 0 0 10px rgba(124,58,237,0.2)' },
          '50%': { boxShadow: '0 0 15px rgba(124,58,237,0.6), 0 0 30px rgba(124,58,237,0.4)' },
        },
        slideInRight: {
          '0%': { opacity: '0', transform: 'translateX(100px)' },
          '100%': { opacity: '1', transform: 'translateX(0)' },
        },
        shimmer: {
          '0%': { backgroundPosition: '-200% 0' },
          '100%': { backgroundPosition: '200% 0' },
        },
        countUp: {
          '0%': { opacity: '0', transform: 'translateY(10px)' },
          '100%': { opacity: '1', transform: 'translateY(0)' },
        },
      },
      fontFamily: {
        sans: ['var(--font-inter)', 'system-ui', 'sans-serif'],
        mono: ['var(--font-mono)', 'JetBrains Mono', 'monospace'],
      },
      backdropBlur: {
        xs: '2px',
      },
      boxShadow: {
        'glow-violet': '0 0 20px rgba(124,58,237,0.4)',
        'glow-blue': '0 0 20px rgba(79,70,229,0.4)',
        'glow-green': '0 0 20px rgba(16,185,129,0.4)',
        'glow-red': '0 0 20px rgba(239,68,68,0.4)',
        'glow-amber': '0 0 20px rgba(245,158,11,0.4)',
        'card': '0 4px 24px rgba(0,0,0,0.4), inset 0 1px 0 rgba(255,255,255,0.05)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.5), inset 0 1px 0 rgba(255,255,255,0.08)',
      },
      borderRadius: {
        'xl': '1rem',
        '2xl': '1.25rem',
        '3xl': '1.5rem',
      },
    },
  },
  plugins: [],
};

export default config;
