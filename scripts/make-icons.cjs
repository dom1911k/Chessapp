// Renders the Android launcher icons from assets/*.svg using Playwright's Chromium.
// Usage: node scripts/make-icons.cjs   (only needed when the icon design changes)
const { chromium } = require('playwright');
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const res = path.join(root, 'android/app/src/main/res');
const fg = fs.readFileSync(path.join(root, 'assets/icon-foreground.svg'), 'utf8');
const bgSvg = fs.readFileSync(path.join(root, 'assets/icon-background.svg'), 'utf8');
const body = (svg) => svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
const inner = body(fg);
const bgInner = body(bgSvg).replace(/id="bg"/g, 'id="bgfill"').replace(/url\(#bg\)/g, 'url(#bgfill)');
const densities = { mdpi: 1, hdpi: 1.5, xhdpi: 2, xxhdpi: 3, xxxhdpi: 4 };

const svg = (shape) => {
  // Legacy icons: shrink the 108dp adaptive artwork so the 72dp visible area fills the icon.
  const vb = shape ? '18 18 72 72' : '0 0 108 108';
  const clip = shape === 'round' ? '<clipPath id="c"><circle cx="54" cy="54" r="36"/></clipPath>' : shape === 'square' ? '<clipPath id="c"><rect x="18" y="18" width="72" height="72" rx="14"/></clipPath>' : '';
  const bg = shape ? `<defs>${clip}</defs><g clip-path="url(#c)">${bgInner}</g>` : '';
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${vb}" width="100%" height="100%">${bg}${inner}</svg>`;
};

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  const render = async (markup, size, file) => {
    await page.setViewportSize({ width: size, height: size });
    await page.setContent(`<html><body style="margin:0;background:transparent">${markup}</body></html>`);
    fs.mkdirSync(path.dirname(file), { recursive: true });
    await page.screenshot({ path: file, omitBackground: true });
  };
  for (const [d, k] of Object.entries(densities)) {
    await render(svg(null), Math.round(108 * k), path.join(res, `mipmap-${d}/ic_launcher_foreground.png`));
    await render(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="100%" height="100%">${bgInner}</svg>`, Math.round(108 * k), path.join(res, `mipmap-${d}/ic_launcher_background.png`));
    await render(svg('square'), Math.round(48 * k), path.join(res, `mipmap-${d}/ic_launcher.png`));
    await render(svg('round'), Math.round(48 * k), path.join(res, `mipmap-${d}/ic_launcher_round.png`));
  }
  await render(svg('square'), 512, path.join(root, 'assets/icon-512.png'));
  // Web app / iPhone home-screen icons (iOS rounds the corners itself, so these are full squares).
  const full = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="9 9 90 90" width="100%" height="100%">${bgInner}${inner}</svg>`;
  const maskable = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 108 108" width="100%" height="100%">${bgInner}${inner}</svg>`;
  await render(full, 180, path.join(root, 'public/apple-touch-icon.png'));
  await render(full, 192, path.join(root, 'public/pwa-192.png'));
  await render(full, 512, path.join(root, 'public/pwa-512.png'));
  await render(maskable, 512, path.join(root, 'public/pwa-maskable-512.png'));
  // Web favicon: the same artwork as a single SVG.
  fs.writeFileSync(path.join(root, 'public/icon.svg'), svg('square').replace(' width="100%" height="100%"', ''));
  await browser.close();
  console.log('icons written');
})();
