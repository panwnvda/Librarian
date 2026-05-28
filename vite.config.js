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

export default defineConfig({
  base: './',
  plugins: [react(), stripCrossorigin],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  build: {
    // Split a few heavy, self-contained dependency groups out of the main
    // bundle so the initial parse cost is lower and the browser doesn't
    // need to hold the entire 2.8 MB app entry in memory at boot. Each
    // group only references itself + React (which lives in the entry), so
    // the circular-vendor problem the previous manualChunks attempt hit
    // can't recur — there are no edges *between* these chunks.
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return;
          if (/[\\/](@codemirror|@lezer|@uiw[\\/]react-codemirror)[\\/]/.test(id)) return 'codemirror';
          if (/[\\/]jszip[\\/]/.test(id)) return 'jszip';
          if (/[\\/](react-markdown|remark-[^/]+|rehype-[^/]+|micromark[^/]*|mdast-[^/]+|hast-[^/]+|unified|unist-[^/]+|vfile[^/]*)[\\/]/.test(id)) return 'markdown';
        },
      },
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
});
