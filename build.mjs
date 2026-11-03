// Bundles src/ into one self-contained page: dist/index.html.
// three.js stays external and loads from the jsDelivr CDN through the import map in the template.
import { build } from 'esbuild';
import fs from 'node:fs';

const minify = process.argv.includes('--minify');
const result = await build({
  entryPoints: ['src/main.js'],
  bundle: true,
  format: 'esm',
  external: ['three', 'three/addons/*'],
  target: 'es2020',
  minify,
  write: false,
  legalComments: 'none',
  logLevel: 'warning',
});
const js = result.outputFiles[0].text.replace(/<\/script/gi, '<\\/script');
const tpl = fs.readFileSync('src/index.template.html', 'utf8');
if (!tpl.includes('/*__GAME_BUNDLE__*/')) throw new Error('template is missing the /*__GAME_BUNDLE__*/ marker');
const html = tpl.replace('/*__GAME_BUNDLE__*/', () => js);
fs.mkdirSync('dist', { recursive: true });
fs.writeFileSync('dist/index.html', html);
console.log(`dist/index.html ${(html.length / 1024).toFixed(1)} KB`);
