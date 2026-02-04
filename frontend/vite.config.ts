import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'

export default defineConfig(({ mode }) => {
    const env = loadEnv(mode, process.cwd(), '')
    const apiTarget = env.VITE_API_URL || 'http://localhost:3001'
    const allowedHosts = env.VITE_ALLOWED_HOSTS
        ? env.VITE_ALLOWED_HOSTS.split(',').map((host) => host.trim()).filter(Boolean)
        : []

    return {
        plugins: [react()],
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
            },
        },
        server: {
            allowedHosts,
            proxy: {
                '/api': {
                    target: apiTarget,
                    changeOrigin: true,
                },
            },
        },
    }
})
