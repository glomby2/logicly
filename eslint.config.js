import js from '@eslint/js';
import { defineConfig, globalIgnores } from 'eslint/config';
import reactHooks from 'eslint-plugin-react-hooks';
import reactRefresh from 'eslint-plugin-react-refresh';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  globalIgnores(['dist', 'coverage']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      ecmaVersion: 2022,
      globals: globals.browser,
    },
  },
  {
    // Слой core/ — чистый TypeScript: никаких зависимостей от UI, React Flow и состояния.
    files: ['src/core/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                'react',
                'react-dom',
                'react/*',
                '@xyflow/*',
                'zustand',
                'zustand/*',
                'lucide-react',
                '@/app/*',
                '@/store/*',
                '@/editor/*',
                '@/features/*',
                '@/components/*',
                '**/app/**',
                '**/store/**',
                '**/editor/**',
                '**/features/**',
                '**/components/**',
              ],
              message: 'core/ не должен зависеть от React, React Flow, Zustand и слоёв UI.',
            },
          ],
        },
      ],
    },
  },
]);
