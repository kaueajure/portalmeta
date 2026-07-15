import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig, loadEnv} from 'vite';

export default defineConfig(({mode}) => {
  const env = loadEnv(mode, '.', '');
  return {
    plugins: [react(), tailwindcss()],
    define: {
      'process.env.GEMINI_API_KEY': JSON.stringify(env.GEMINI_API_KEY),
    },
    resolve: {
      alias: {
        '@': path.resolve(__dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio via DISABLE_HMR env var.
      // Do not modifyâfile watching is disabled to prevent flickering during agent edits.
      hmr: process.env.DISABLE_HMR !== 'true',
    },
    build: {
      rollupOptions: {
        output: {
          manualChunks(id) {
            const normalizedId = id.replace(/\\/g, '/');
            if (!normalizedId.includes('/node_modules/')) return undefined;

            if (normalizedId.includes('/recharts/')) return 'charts';
            if (normalizedId.includes('/@hello-pangea/dnd/')) return 'dnd';
            if (
              normalizedId.includes('/socket.io-client/') ||
              normalizedId.includes('/engine.io-client/')
            ) return 'socket';
            if (normalizedId.includes('/motion/')) return 'motion';
            if (normalizedId.includes('/lucide-react/')) return 'icons';
            if (normalizedId.includes('/@uiw/react-md-editor/')) return 'markdown-editor';
            if (
              normalizedId.includes('/@uiw/react-markdown-preview/') ||
              normalizedId.includes('/react-markdown/')
            ) return 'markdown-preview';
            if (
              /\/node_modules\/(rehype|remark|micromark|mdast-|hast-|unist-|unified|property-information|html-|space-separated|comma-separated|vfile|devlop|decode-named|character-entities|zwitch|trim-lines|markdown-table|ccount)\//.test(normalizedId)
            ) return 'markdown-core';

            return undefined;
          },
        },
      },
    },
  };
});
