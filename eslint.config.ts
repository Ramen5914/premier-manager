import js from '@eslint/js';
import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import prettier from 'eslint-plugin-prettier';
import prettierConfig from 'eslint-config-prettier/flat';
import { defineConfig } from 'eslint/config';

export default defineConfig([
  {
    ignores: ['dist/**', 'node_modules/**'],
  },
  js.configs.recommended,
  prettierConfig,
  {
    files: ['**/*.{js,mjs,cjs,ts,tsx}'],
    languageOptions: {
      parser: tsparser,
      ecmaVersion: 'latest',
      sourceType: 'module',
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      'prettier/prettier': 'error',
      curly: ['error', 'multi-line', 'consistent'],
      'max-nested-callbacks': ['error', { max: 4 }],
      'max-statements-per-line': ['error', { max: 2 }],
      'no-console': 'off',
      'no-empty-function': 'off',
      'no-inline-comments': 'off',
      'no-lonely-if': 'error',
      'no-shadow': 'off',
      '@typescript-eslint/no-shadow': ['error', { allow: ['err', 'resolve', 'reject'] }],
      'no-undef': 'off',
      'no-var': 'error',
      'prefer-const': 'error',
      yoda: 'error',
    },
  },
]);
