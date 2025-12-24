import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';

export default defineConfig({
  plugins: [
    dts({
      include: ['src/**/*'],
      outDir: 'dist',
      rollupTypes: true,
    }),
  ],
  build: {
    lib: {
      entry: 'src/index.ts',
      name: 'EdgeTTS',
      formats: ['es', 'cjs'],
      fileName: (format: string) => {
        return format === 'es' ? 'index.js' : 'index.cjs';
      },
    },
    rollupOptions: {
      output: {
        globals: {},
      },
    },
    target: 'es2020',
    minify: false,
    sourcemap: true,
  },
});