import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { viteSingleFile } from 'vite-plugin-singlefile';
import path from 'path';
import { execSync } from 'child_process';
import fs from 'fs';
import type { Plugin } from 'vite';

// Get version from environment, git tag, or package.json
function getVersion(): string {
  // 1. Environment variable (set by GitHub Actions)
  if (process.env.VERSION) {
    return process.env.VERSION;
  }

  // 2. Try git tag
  try {
    const execOpts = { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] as const };

    try {
      const gitTagExact = execSync('git describe --tags --exact-match', execOpts).trim();
      if (gitTagExact) return gitTagExact;
    } catch {
      // ignore
    }

    try {
      const gitTag = execSync('git describe --tags', execOpts).trim();
      if (gitTag) return gitTag;
    } catch {
      // ignore
    }
  } catch {
    // Git not available or no tags
  }

  // 3. Fall back to package.json version
  try {
    const pkg = JSON.parse(fs.readFileSync(path.resolve(__dirname, 'package.json'), 'utf8'));
    if (pkg.version && pkg.version !== '0.0.0') {
      return pkg.version;
    }
  } catch {
    // package.json not readable
  }

  return 'dev';
}

function copyIndexToManagementHtml(): Plugin {
  return {
    name: 'copy-index-to-management-html',
    apply: 'build',
    closeBundle() {
      try {
        const distDir = path.resolve(__dirname, 'dist');
        const indexPath = path.join(distDir, 'index.html');
        const managementPath = path.join(distDir, 'management.html');
        if (!fs.existsSync(indexPath)) return;
        fs.copyFileSync(indexPath, managementPath);
      } catch {
        // ignore
      }
    },
  };
}

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [
    react(),
    copyIndexToManagementHtml(),
    viteSingleFile({
      removeViteModuleLoader: true
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(getVersion())
  },
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src')
    }
  },
  css: {
    modules: {
      localsConvention: 'camelCase',
      generateScopedName: '[name]__[local]___[hash:base64:5]'
    },
    preprocessorOptions: {
      scss: {
        additionalData: `@use "@/styles/variables.scss" as *;`
      }
    }
  },
  build: {
    target: 'es2020',
    outDir: 'dist',
    assetsInlineLimit: 100000000,
    chunkSizeWarningLimit: 100000000,
    cssCodeSplit: false,
    rollupOptions: {
      output: {
        inlineDynamicImports: true,
        manualChunks: undefined
      }
    }
  }
});
