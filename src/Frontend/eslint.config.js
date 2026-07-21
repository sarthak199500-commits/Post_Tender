import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      globals: globals.browser,
    },
    rules: {
      // This experimental rule flags the standard fetch-then-setState pattern in
      // useEffect even when the setState happens after an await. This codebase
      // fetches data in effects throughout; re-enable if/when we adopt a data
      // fetching library (React Query etc.).
      'react-hooks/set-state-in-effect': 'off',
    },
  },
])
