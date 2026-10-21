// Bundles browser-side dependencies into public/vendor (run at image build time).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';

const out = path.resolve('public/vendor');
fs.mkdirSync(out, { recursive: true });

await build({
  stdin: {
    contents: "import { defineElements } from '@lumieducation/h5p-webcomponents'; defineElements();",
    resolveDir: process.cwd(),
    loader: 'js'
  },
  bundle: true,
  format: 'iife',
  target: 'es2020',
  minify: true,
  outfile: path.join(out, 'h5p-webcomponents.js')
});

for (const f of ['scorm12.min.js', 'scorm2004.min.js']) {
  fs.copyFileSync(path.resolve('node_modules/scorm-again/dist', f), path.join(out, f));
}
const fonts = path.resolve('public/assets/fonts');
fs.mkdirSync(fonts, { recursive: true });
fs.copyFileSync(path.resolve('node_modules/geist/dist/fonts/geist-sans/Geist-Variable.woff2'), path.join(fonts, 'Geist-Variable.woff2'));
fs.copyFileSync(path.resolve('node_modules/geist/dist/fonts/geist-mono/GeistMono-Variable.woff2'), path.join(fonts, 'GeistMono-Variable.woff2'));
console.log('vendor bundle written to', out);
