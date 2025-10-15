import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'

export default tseslint.config(
  js.configs.recommended,
  
  ...tseslint.configs.recommended,
  
  {
    files: ['**/*.{js,mjs,cjs,ts,mts,cts}'],
    languageOptions: {
      globals: {
        ...globals.browser,
        ...globals.node,
      },
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    rules: {
      'semi': ['error', 'never'],
      'quotes': ['error', 'single', { avoidEscape: true }],
      'indent': ['error', 2, { SwitchCase: 1 }],
      'comma-dangle': ['error', 'always-multiline'],
      'space-infix-ops': 'error',
      'space-unary-ops': 'error',
      'arrow-spacing': 'error',
      'key-spacing': ['error', { beforeColon: false, afterColon: true }],
      
      'object-curly-spacing': ['error', 'always'],
      'array-bracket-spacing': ['error', 'never'],
      'comma-spacing': ['error', { before: false, after: true }],

      '@typescript-eslint/no-explicit-any': 'warn',
      
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
      
      '@typescript-eslint/no-empty-interface': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'warn',
      '@typescript-eslint/consistent-type-imports': [
        'error',
        {
          prefer: 'type-imports',
          fixStyle: 'separate-type-imports',
        },
      ],
      'prefer-const': 'error',
      'no-var': 'error',
      'eqeqeq': ['error', 'always', { null: 'ignore' }],
      'no-console': ['warn', { allow: ['warn', 'error', 'info', 'debug'] }],
      'require-await': 'warn',
      'no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      '@typescript-eslint/no-empty-function': ['error', { allow: ['arrowFunctions'] }],
      'arrow-parens': ['error', 'always'],
      'max-len': [
        'warn',
        {
          code: 120,
          ignoreUrls: true,
          ignoreStrings: true,
          ignoreTemplateLiterals: true,
          ignoreRegExpLiterals: true,
        },
      ],
      'consistent-return': 'warn',
      'no-duplicate-imports': 'error',
      'prefer-template': 'warn',
      'no-nested-ternary': 'warn',
    },
  },
  
  {
    files: ['**/*.js', '**/*.mjs', '**/*.cjs'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  
  {
    files: ['**/page-scripts/**/*.js', '**/bot/**/*.js'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/no-unused-vars': 'off',
      'no-console': 'off',
    },
  },
  
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/data/**',
      '**/.bun/**',
      '**/logs/**',
    ],
  },
)
