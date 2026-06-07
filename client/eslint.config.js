// @ts-check
const eslint = require('@eslint/js');
const tseslint = require('typescript-eslint');
const angular = require('angular-eslint');

/**
 * Client ESLint (flat config). TypeScript + inline-template linting for the
 * Angular standalone app. Pragmatic baseline: catches real bugs (unused vars,
 * obvious mistakes, a11y on templates) without forcing a giant first-pass
 * reformat. Stylistic-only rules are relaxed; prettier is intentionally not
 * wired here (the client isn't prettier-formatted).
 */
module.exports = tseslint.config(
  {
    ignores: [
      'dist/**',
      '.angular/**',
      'coverage/**',
      'node_modules/**',
      'eslint.config.js',
      'jest.config.js',
      'setup-jest.ts',
      '**/*.spec.ts',
    ],
  },
  {
    files: ['**/*.ts'],
    extends: [
      eslint.configs.recommended,
      ...tseslint.configs.recommended,
      ...angular.configs.tsRecommended,
    ],
    processor: angular.processInlineTemplates,
    rules: {
      '@angular-eslint/directive-selector': [
        'warn',
        { type: 'attribute', prefix: 'asta', style: 'camelCase' },
      ],
      '@angular-eslint/component-selector': [
        'warn',
        { type: 'element', prefix: 'asta', style: 'kebab-case' },
      ],
      // Matches the server stance — `any` is allowed where justified (DOM/lib gaps).
      '@typescript-eslint/no-explicit-any': 'off',
      // Underscore-prefixed args/vars are intentionally unused (signatures, stubs).
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/no-empty-function': 'off',
      // The app deliberately names component outputs after their domain action
      // (select / change / submit / close); renaming would break every call site.
      '@angular-eslint/no-output-native': 'off',
    },
  },
  {
    files: ['**/*.html'],
    extends: [
      ...angular.configs.templateRecommended,
      ...angular.configs.templateAccessibility,
    ],
    rules: {
      // Genuine, pervasive keyboard-a11y gaps (clickable divs, label association).
      // Surfaced as warnings so the lint baseline is green; a focused keyboard-a11y
      // pass is tracked separately in IMPROVEMENTS_BACKLOG.md.
      '@angular-eslint/template/click-events-have-key-events': 'warn',
      '@angular-eslint/template/interactive-supports-focus': 'warn',
      '@angular-eslint/template/label-has-associated-control': 'warn',
    },
  },
);
