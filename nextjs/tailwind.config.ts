import type {Config} from 'tailwindcss';

export default {
  darkMode: ['class'],
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        body: ['Inter', 'sans-serif'],
        headline: ['Space Grotesk', 'sans-serif'],
        code: ['monospace'],
      },
      colors: {
        background: 'hsl(var(--background))',
        foreground: 'hsl(var(--foreground))',
        card: {
          DEFAULT: 'hsl(var(--card))',
          foreground: 'hsl(var(--card-foreground))',
        },
        popover: {
          DEFAULT: 'hsl(var(--popover))',
          foreground: 'hsl(var(--popover-foreground))',
        },
        primary: {
          DEFAULT: 'hsl(var(--primary))',
          foreground: 'hsl(var(--primary-foreground))',
        },
        secondary: {
          DEFAULT: 'hsl(var(--secondary))',
          foreground: 'hsl(var(--secondary-foreground))',
        },
        muted: {
          DEFAULT: 'hsl(var(--muted))',
          foreground: 'hsl(var(--muted-foreground))',
        },
        accent: {
          DEFAULT: 'hsl(var(--accent))',
          foreground: 'hsl(var(--accent-foreground))',
        },
        destructive: {
          DEFAULT: 'hsl(var(--destructive))',
          foreground: 'hsl(var(--destructive-foreground))',
        },
        border: 'hsl(var(--border))',
        input: 'hsl(var(--input))',
        ring: 'hsl(var(--ring))',
        chart: {
          '1': 'hsl(var(--chart-1))',
          '2': 'hsl(var(--chart-2))',
          '3': 'hsl(var(--chart-3))',
          '4': 'hsl(var(--chart-4))',
          '5': 'hsl(var(--chart-5))',
        },
        sidebar: {
          DEFAULT: 'hsl(var(--sidebar-background))',
          foreground: 'hsl(var(--sidebar-foreground))',
          primary: 'hsl(var(--sidebar-primary))',
          'primary-foreground': 'hsl(var(--sidebar-primary-foreground))',
          accent: 'hsl(var(--sidebar-accent))',
          'accent-foreground': 'hsl(var(--sidebar-accent-foreground))',
          border: 'hsl(var(--sidebar-border))',
          ring: 'hsl(var(--sidebar-ring))',
        },
      },
      borderRadius: {
        lg: 'var(--radius)',
        md: 'calc(var(--radius) - 2px)',
        sm: 'calc(var(--radius) - 4px)',
      },
      keyframes: {
        'accordion-down': {
          from: {
            height: '0',
          },
          to: {
            height: 'var(--radix-accordion-content-height)',
          },
        },
        'accordion-up': {
          from: {
            height: 'var(--radix-accordion-content-height)',
          },
          to: {
            height: '0',
          },
        },
        // Spec 06 - Card Display Rules: the check stamp fades in above the cell, presses down and settles
        'stamp-in': {
          '0%': { opacity: '0', transform: 'rotate(-12deg) scale(1.5)' },
          '45%': { opacity: '0.45', transform: 'rotate(-12deg) scale(1.35)' },
          '70%': { opacity: '0.7', transform: 'rotate(-12deg) scale(0.94)' },
          '85%': { opacity: '0.6', transform: 'rotate(-12deg) scale(1.03)' },
          '100%': { opacity: '0.6', transform: 'rotate(-12deg) scale(1)' },
        },
        // Spec 06 - Card Display Rules: the hourglass fades in, shakes left and right, and settles centred
        'hourglass-in': {
          '0%': { opacity: '0', transform: 'translateX(0) rotate(0deg)' },
          '30%': { opacity: '0.6', transform: 'translateX(0) rotate(0deg)' },
          '45%': { transform: 'translateX(-8%) rotate(-6deg)' },
          '60%': { transform: 'translateX(7%) rotate(5deg)' },
          '74%': { transform: 'translateX(-5%) rotate(-3deg)' },
          '87%': { transform: 'translateX(3%) rotate(2deg)' },
          '100%': { opacity: '0.6', transform: 'translateX(0) rotate(0deg)' },
        },
      },
      animation: {
        'accordion-down': 'accordion-down 0.2s ease-out',
        'accordion-up': 'accordion-up 0.2s ease-out',
        'stamp-in': 'stamp-in 550ms cubic-bezier(.2,.8,.3,1) 150ms both',
        'hourglass-in': 'hourglass-in 700ms ease-out 150ms both',
      },
    },
  },
  plugins: [require('tailwindcss-animate')],
} satisfies Config;
