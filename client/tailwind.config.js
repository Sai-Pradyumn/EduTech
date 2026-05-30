/** Asta design tokens — ported from EduTechDesign/docs/DESIGN_SPEC.md §2.7 */
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./src/**/*.{html,ts}'],
  // Dark mode is driven by the `data-theme="dark"` attribute on <html> (ThemeService).
  darkMode: ['selector', '[data-theme="dark"]'],
  theme: {
    // Breakpoint matrix (A1, POLISH_HARDENING_PLAN §2). md/lg/xl/2xl match
    // Tailwind defaults; xs is new (small phone) and sm is tightened to 480.
    screens: {
      xs: '360px',
      sm: '480px',
      md: '768px',
      lg: '1024px',
      xl: '1280px',
      '2xl': '1536px',
    },
    extend: {
      // Colors resolve to CSS custom properties (defined in styles.css) so every
      // utility (`bg-paper`, `text-txt-soft`, `bg-green` …) flips automatically
      // when the theme changes. No Tailwind alpha-modifiers are used on these
      // tokens (audited), so plain var() references are safe.
      colors: {
        ink: { DEFAULT: 'var(--ink)', 2: 'var(--ink-2)', 3: 'var(--ink-3)' },
        paper: { DEFAULT: 'var(--paper)', 2: 'var(--paper-2)', 3: 'var(--paper-3)' },
        txt: { DEFAULT: 'var(--text)', soft: 'var(--text-soft)', mute: 'var(--text-mute)' },
        onink: { DEFAULT: 'var(--on-ink)', soft: 'var(--on-ink-soft)', mute: 'var(--on-ink-mute)' },
        green: { DEFAULT: 'var(--green)', deep: 'var(--green-deep)' },
        coral: { DEFAULT: 'var(--coral)', deep: 'var(--coral-deep)' },
        peri: { DEFAULT: 'var(--peri)', deep: 'var(--peri-deep)' },
        danger: { DEFAULT: 'var(--danger)' },
      },
      fontFamily: {
        display: ['"Bricolage Grotesque"', 'Georgia', 'serif'],
        sans: ['"Hanken Grotesk"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'ui-monospace', 'monospace'],
      },
      borderRadius: {
        xs: '8px',
        sm: '12px',
        md: '18px',
        lg: '26px',
        xl: '36px',
        '2xl': '48px',
      },
      maxWidth: { content: '1240px', app: '1100px', chat: '760px', reading: '760px', dash: '1360px' },
      boxShadow: {
        sm: '0 1px 2px oklch(0.2 0.03 264 / .06), 0 2px 8px oklch(0.2 0.03 264 / .05)',
        md: '0 4px 12px oklch(0.2 0.03 264 / .08), 0 16px 40px oklch(0.2 0.03 264 / .08)',
        lg: '0 8px 24px oklch(0.2 0.03 264 / .12), 0 30px 80px oklch(0.2 0.03 264 / .14)',
      },
      transitionTimingFunction: {
        ease: 'cubic-bezier(.2,.7,.2,1)',
        spring: 'cubic-bezier(.22,1.2,.36,1)',
      },
    },
  },
  plugins: [],
};
