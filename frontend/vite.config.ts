import { defineConfig, loadEnv } from 'vite'
import { apiBaseUrlConfigurationError } from './src/lib/deployment-config'
import { supabaseConfigurationError } from './src/lib/supabase-config'
import path from 'path'
import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [
    {
      name: 'validate-public-deployment-environment',
      apply: 'build',
      config(_config, { mode }) {
        const env = { ...loadEnv(mode, process.cwd(), 'VITE_'), ...process.env }
        const error = apiBaseUrlConfigurationError(env.VITE_API_BASE_URL || '')
          || supabaseConfigurationError(env.VITE_SUPABASE_URL || '', env.VITE_SUPABASE_PUBLISHABLE_KEY || env.VITE_SUPABASE_ANON_KEY || '')
        if (error) throw new Error(`Cannot build: ${error}`)
      },
    },
    // The React and Tailwind plugins are both required for Make, even if
    // Tailwind is not being actively used – do not remove them
    react(),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      // Alias @ to the src directory
      '@': path.resolve(__dirname, './src'),
    },
  },

  // File types to support raw imports. Never add .css, .tsx, or .ts files to this.
  assetsInclude: ['**/*.svg', '**/*.csv'],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('motion') || id.includes('framer-motion')) return 'motion'
          if (id.includes('@supabase') || id.includes('axios')) return 'data-client'
          if (id.includes('react-router') || id.includes('react-dom') || id.includes('/react/')) return 'react-core'
          if (id.includes('@radix-ui')) return 'radix-ui'
          return 'react-core'
        },
      },
    },
  },
})
