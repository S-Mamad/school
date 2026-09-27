import {defineConfig} from 'vite';
import react from '@vitejs/plugin-react';
import path from 'node:path';
export default defineConfig({base:'./',plugins:[react()],resolve:{alias:{'@':path.resolve(import.meta.dirname)}},build:{outDir:'dist',rolldownOptions:{output:{codeSplitting:{groups:[{name:'react',test:/[\\/]node_modules[\\/](react|react-dom|scheduler)[\\/]/,priority:30},{name:'icons',test:/[\\/]node_modules[\\/]lucide-react[\\/]/,priority:25},{name:'ui',test:/[\\/]node_modules[\\/](@base-ui|radix-ui|@radix-ui)[\\/]/,priority:20},{name:'vendor',test:/[\\/]node_modules[\\/]/,priority:10}]}}}},server:{host:'127.0.0.1',watch:{ignored:['**/work/**','**/outputs/**']}}});
