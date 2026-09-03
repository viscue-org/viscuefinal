import {defineConfig} from 'vite';
import {copyFile,cp,mkdir,readdir,rm} from 'node:fs/promises';
import path from 'node:path';

const root=path.resolve('extension');
const distRoot=path.resolve('dist');
const outDir=path.resolve('dist/extension');
const mirroredRuntime = [
  'background.js', 'background.js.map', 'content.js', 'content.js.map',
  'handoff-contract.js', 'index.js', 'index.js.map', 'popup.js', 'popup.js.map',
  'index.css', 'popup.css', 'content.css', 'index.html', 'popup.html',
  'manifest.json', 'pdf.worker.mjs', 'chunks', 'icons', 'models',
];

function chromeAssets(){
  return{
    name:'viscue-chrome-assets',
    async closeBundle(){
      await mkdir(outDir,{recursive:true});
      await copyFile(path.join(root,'manifest.json'),path.join(outDir,'manifest.json'));
      await copyFile(path.join(root,'content.css'),path.join(outDir,'content.css'));
      await rm(path.join(outDir,'icons'),{recursive:true,force:true});
      await cp(path.join(root,'icons'),path.join(outDir,'icons'),{recursive:true});

      const modelsSource = path.resolve('gesture/runtime/models');
      try {
        await rm(path.join(outDir, 'models'), { recursive: true, force: true });
        await cp(modelsSource, path.join(outDir, 'models'), { recursive: true });
      } catch {}

      for (const name of mirroredRuntime) {
        await rm(path.join(distRoot, name), { recursive: true, force: true });
      }

      // Keep both common unpacked-extension paths valid. Existing installs may
      // point at either `dist` or `dist/extension`.
      const entries=await readdir(outDir,{withFileTypes:true});
      for(const entry of entries){
        const source=path.join(outDir,entry.name);
        const destination=path.join(distRoot,entry.name);
        if(entry.isDirectory()){
          await rm(destination,{recursive:true,force:true});
          await cp(source,destination,{recursive:true});
        }else{
          await copyFile(source,destination);
        }
      }
    }
  };
}

export default defineConfig({
  root,
  base:'./',
  publicDir:false,
  plugins:[chromeAssets()],
  build:{
    outDir,
    emptyOutDir:true,
    sourcemap:false,
    rollupOptions:{
      input:{index:path.join(root,'index.html'),popup:path.join(root,'popup.html'),background:path.join(root,'background.js'),content:path.join(root,'content.js'),'handoff-contract':path.join(root,'handoff-contract.js')},
      output:{entryFileNames:'[name].js',chunkFileNames:'chunks/[name]-[hash].js',assetFileNames:'[name][extname]'}
    }
  }
});
