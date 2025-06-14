/* eslint-env node */
import process from 'node:process'
import js from '@eslint/js'
import tseslint from '@typescript-eslint/eslint-plugin'
import tsp from '@typescript-eslint/parser'
import prettier from 'eslint-plugin-prettier'

/** @type {import("eslint").Linter.FlatConfig[]} */
const config = [
  js.configs.recommended,
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsp,
      parserOptions: {
        project: './tsconfig.json',
        sourceType: 'module',
        ecmaVersion: 'latest',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
      prettier: prettier,
    },
    rules: {
      'prettier/prettier': 'error',
      '@typescript-eslint/no-explicit-any': 'off', // 👈 Temporarily disable 'any' restriction
      '@typescript-eslint/no-unused-vars': [
        'warn',
        { argsIgnorePattern: '^_' },
      ],
      'no-console': process.env.NODE_ENV === 'production' ? 'error' : 'off', // 👈 Allow `console.log` in dev
      'no-undef': 'off', // 👈 Sometimes needed in TypeScript projects
      'prefer-const': 'error',
    },
  },
]

export default config
