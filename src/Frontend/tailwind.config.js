/** @type {import('tailwindcss').Config} */

/*
 * SINGLE SOURCE OF TRUTH FOR COLOR.
 *
 * The design tokens previously lived only in index.css `:root`, which Tailwind
 * could not see. Since almost every page is written in Tailwind utilities, there
 * was no way to reach the brand color from a page — so pages reached for
 * `blue-700` or `indigo-600` from memory instead. That left three different
 * "primary" blues in the app, none of which matched the sidebar.
 *
 * The palette now lives here and index.css derives its `--*` variables from it
 * via `theme()`. Change a value here and both systems follow.
 */
const brand = {
  50: '#eef1fe',
  100: '#dfe5fd',
  200: '#c5d0fb',
  300: '#a3b4f9',
  400: '#7b90f8',
  500: '#4f6ef7', // accent: rings, borders, hover tints, gradients
  600: '#3b54d4', // solid fills behind white text — 6.17:1, passes WCAG AA
  700: '#2f43ab',
  800: '#26368a',
  900: '#1f2c6f',
};

export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        brand,
        /*
         * Semantic aliases. These deliberately mirror stock Tailwind families
         * rather than inventing new hues — the goal is that one meaning maps to
         * one family everywhere. `utils/statusTone.ts` enforces that at render
         * sites; these tokens just give the vocabulary a name.
         */
        success: {
          50: '#ecfdf5', 100: '#d1fae5', 200: '#a7f3d0', 300: '#6ee7b7', 400: '#34d399',
          500: '#10b981', 600: '#059669', 700: '#047857', 800: '#065f46', 900: '#064e3b',
        },
        warning: {
          50: '#fffbeb', 100: '#fef3c7', 200: '#fde68a', 300: '#fcd34d', 400: '#fbbf24',
          500: '#f59e0b', 600: '#d97706', 700: '#b45309', 800: '#92400e', 900: '#78350f',
        },
        danger: {
          50: '#fef2f2', 100: '#fee2e2', 200: '#fecaca', 300: '#fca5a5', 400: '#f87171',
          500: '#ef4444', 600: '#dc2626', 700: '#b91c1c', 800: '#991b1b', 900: '#7f1d1d',
        },
        // Page/card surfaces, so pages stop hand-painting `bg-slate-50` over the shell.
        surface: {
          bg: '#f4f6fb',
          card: '#ffffff',
          hover: '#fafbff',
          sunken: '#eef1f6',
        },
      },
      borderRadius: {
        // Named radii sit alongside Tailwind's numeric scale rather than
        // redefining it, so existing `rounded-lg`/`rounded-xl` keep their sizes.
        control: '8px',  // buttons, inputs, chips
        card: '12px',    // cards, panels, tables
        panel: '16px',   // modals, large surfaces
      },
      fontFamily: {
        sans: ['Inter', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'sans-serif'],
      },
      animation: {
        'fade-in-up': 'fadeInUp 0.45s cubic-bezier(0.16, 1, 0.3, 1) both',
        'fade-in': 'fadeIn 0.35s ease both',
        'scale-in': 'scaleIn 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
        'slide-in-left': 'slideInLeft 0.3s cubic-bezier(0.16, 1, 0.3, 1) both',
      },
      keyframes: {
        fadeInUp: {
          from: { opacity: '0', transform: 'translateY(12px)' },
          to: { opacity: '1', transform: 'translateY(0)' },
        },
        fadeIn: {
          from: { opacity: '0' },
          to: { opacity: '1' },
        },
        scaleIn: {
          from: { opacity: '0', transform: 'scale(0.95)' },
          to: { opacity: '1', transform: 'scale(1)' },
        },
        slideInLeft: {
          from: { opacity: '0', transform: 'translateX(-8px)' },
          to: { opacity: '1', transform: 'translateX(0)' },
        },
      },
      boxShadow: {
        'card': '0 1px 3px rgba(0,0,0,0.04), 0 4px 14px rgba(0,0,0,0.03)',
        'card-hover': '0 4px 12px rgba(0,0,0,0.06), 0 8px 24px rgba(0,0,0,0.04)',
        'elevated': '0 8px 30px rgba(0,0,0,0.08), 0 2px 8px rgba(0,0,0,0.04)',
      },
    },
  },
  plugins: [],
}
