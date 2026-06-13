import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  server: {
    proxy: {
      '/sessions':      'http://localhost:8000',
      '/clients':       'http://localhost:8000',
      '/ai':            'http://localhost:8000',
      '/health':        'http://localhost:8000',
      '/registrations': 'http://localhost:8000',
    },
  },
})
