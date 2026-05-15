import path from 'node:path'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Strip `crossorigin` attributes from the built index.html. Vite emits them
// on every <script type="module"> and <link rel="modulepreload"> tag, which
// is the correct behaviour over http(s) but silently breaks Electron's
// production build: Chromium loads dist/index.html via `file://`, treats
// the requested chunks as opaque-origin CORS requests, and refuses them —
// the result is a blank/gray app window with no visible error. Stripping
// the attribute makes the browser fetch the modules as same-origin file
// URLs the way Electron expects.
const stripCrossorigin = {
  name: 'strip-crossorigin-for-electron',
  enforce: 'post',
  transformIndexHtml(html) {
    return html.replace(/\s+crossorigin(?==|>|\s)/g, '');
  },
};

// Split the main bundle into vendor chunks so the browser can parse
// them in parallel and cache them independently across deploys. Pure
// build-output config — runtime behavior is unchanged (same modules
// execute in the same order, just delivered as multiple files).
function manualChunks(id) {
  if (!id.includes('node_modules')) return undefined;
  // Keep these as separate dynamic chunks (one per language grammar).
  // Forcing them into a single vendor chunk would convert lazy loading
  // back into eager loading and grow the initial payload by ~10 MB.
  if (id.includes('/shiki/') || id.includes('/@shikijs/')) return undefined;
  if (id.includes('/@codemirror/lang-') || id.includes('/@lezer/')) return undefined;

  if (id.includes('/@blocknote/')) return 'vendor-blocknote';
  if (id.includes('/prosemirror-')) return 'vendor-prosemirror';
  if (id.includes('/@mantine/')) return 'vendor-mantine';
  if (id.includes('/@radix-ui/')) return 'vendor-radix';
  if (id.includes('/@tiptap/')) return 'vendor-tiptap';
  if (id.includes('/react-router')) return 'vendor-react-router';
  if (id.includes('/react-dom/') || id.match(/\/react\/[^/]*$/) || id.includes('/scheduler/')) return 'vendor-react';
  if (id.includes('/lucide-react/')) return 'vendor-icons';
  if (id.includes('/react-markdown/') || id.includes('/remark-') || id.includes('/rehype-') || id.includes('/mdast-') || id.includes('/hast-') || id.includes('/unist-') || id.includes('/micromark')) return 'vendor-markdown';
  if (id.includes('/@codemirror/') || id.includes('/codemirror/')) return 'vendor-codemirror';
  if (id.includes('/@hello-pangea/')) return 'vendor-dnd';
  return 'vendor-misc';
}

export default defineConfig({
  base: './',
  plugins: [react(), stripCrossorigin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  // Pre-bundle these dependencies in dev so Firefox/Chrome don't have to
  // fetch thousands of individual ES modules over the dev server. Vite
  // turns each entry into a single optimized file that gets served to
  // the browser, which dramatically cuts dev-mode load + parse time.
  // Pure dev-server config — no runtime/feature impact.
  optimizeDeps: {
    include: [
      '@blocknote/core',
      '@blocknote/react',
      '@blocknote/mantine',
      '@mantine/core',
      '@mantine/hooks',
      'react',
      'react-dom',
      'react-dom/client',
      'react-router-dom',
      'lucide-react',
      'react-markdown',
      'remark-gfm',
      'remark-breaks',
      'rehype-raw',
      '@hello-pangea/dnd',
    ],
  },
  build: {
    rollupOptions: {
      output: { manualChunks },
    },
  },
});
