const esbuild = require('esbuild');
const fs = require('fs');
const path = require('path');

const isWatch = process.argv.includes('--watch');
const target = process.argv.find(a => a === 'main' || a === 'renderer') || 'all';

async function buildMain() {
  const ctx = await esbuild.context({
    entryPoints: ['src/main/index.ts'],
    bundle: true,
    platform: 'node',
    outdir: 'dist/main',
    external: ['electron', 'node-pty', 'electron-store', 'electron-updater'],
    format: 'cjs',
    sourcemap: true,
  });

  if (isWatch) {
    await ctx.watch();
    console.log('Watching main...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }
}

async function buildRenderer() {
  const ctx = await esbuild.context({
    entryPoints: ['src/renderer/index.tsx'],
    bundle: true,
    outdir: 'dist/renderer',
    format: 'iife',
    sourcemap: true,
    loader: {
      '.tsx': 'tsx',
      '.ts': 'tsx',
    },
    define: {
      'process.env.NODE_ENV': '"production"',
    },
    // Don't bundle node modules used via window.require
    external: ['electron'],
  });

  if (isWatch) {
    await ctx.watch();
    console.log('Watching renderer...');
  } else {
    await ctx.rebuild();
    await ctx.dispose();
  }

  // Copy index.html to dist/renderer
  const htmlSrc = path.join(__dirname, '..', 'src', 'renderer', 'index.html');
  const htmlDst = path.join(__dirname, '..', 'dist', 'renderer', 'index.html');
  fs.mkdirSync(path.dirname(htmlDst), { recursive: true });

  let html = fs.readFileSync(htmlSrc, 'utf8');
  // Update script type from module to regular (esbuild IIFE output)
  html = html.replace('type="module" ', '');
  fs.writeFileSync(htmlDst, html);

  // Copy xterm CSS
  const xtermCssSrc = path.join(__dirname, '..', 'node_modules', '@xterm', 'xterm', 'css', 'xterm.css');
  if (fs.existsSync(xtermCssSrc)) {
    fs.copyFileSync(xtermCssSrc, path.join(__dirname, '..', 'dist', 'renderer', 'xterm.css'));
  }

  // Copy app CSS
  const appCssSrc = path.join(__dirname, '..', 'src', 'renderer', 'styles', 'global.css');
  fs.copyFileSync(appCssSrc, path.join(__dirname, '..', 'dist', 'renderer', 'index.css'));
}

async function main() {
  fs.mkdirSync('dist/main', { recursive: true });
  fs.mkdirSync('dist/renderer', { recursive: true });

  if (target === 'all' || target === 'main') await buildMain();
  if (target === 'all' || target === 'renderer') await buildRenderer();

  if (!isWatch) console.log('Build complete.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
