const source = await fetch('./app-v25.js?v=28', { cache: 'no-store' });
if (!source.ok) throw new Error(`Impossibile caricare app-v25.js: ${source.status}`);

let code = await source.text();
code = code
  .replace('color:0xf1efe9', 'color:0xe6e1d8')
  .replace(
    './assets/casa_homestyler.glb?v=28',
    new URL('./assets/casa_homestyler.glb?v=29', window.location.href).href
  );

const moduleUrl = URL.createObjectURL(new Blob([code], { type: 'text/javascript' }));
try {
  await import(moduleUrl);
} finally {
  URL.revokeObjectURL(moduleUrl);
}
