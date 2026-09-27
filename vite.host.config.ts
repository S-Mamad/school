import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({base:'./',plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname)}},build:{outDir:'dist'},server:{host:'127.0.0.1',watch:{ignored:['**/work/**','**/outputs/**']}}});
