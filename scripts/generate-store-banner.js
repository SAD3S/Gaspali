/**
 * Bannière Play Store (1024×500) à partir des captures de docs/store/captures.
 * Usage : node scripts/generate-store-banner.js (Playwright + Chromium).
 */
const { chromium } = require('playwright');
const fs = require('fs');
const shot = fs.readFileSync(require('path').join(__dirname, '..', 'docs', 'store') + '/captures/1-accueil.png').toString('base64');
const shot2 = fs.readFileSync(require('path').join(__dirname, '..', 'docs', 'store') + '/captures/4-planning.png').toString('base64');
const html = `<html><head><style>
@import url('https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:wght@800&family=DM+Sans:wght@500&display=swap');
body{margin:0;width:1024px;height:500px;overflow:hidden;background:linear-gradient(135deg,#2A8F5C,#17603C);font-family:'DM Sans',sans-serif;position:relative}
.txt{position:absolute;left:64px;top:120px;color:#fff;width:470px}
.logo{width:76px;height:76px;border-radius:22px;background:#fff;display:flex;align-items:center;justify-content:center;margin-bottom:22px}
h1{font-family:'Bricolage Grotesque',sans-serif;font-weight:800;font-size:68px;margin:0;letter-spacing:-1px}
p{font-size:26px;margin:10px 0 0;opacity:.92;line-height:1.3}
.phone{position:absolute;width:236px;border-radius:30px;border:7px solid #0F1613;box-shadow:0 24px 60px rgba(0,0,0,.35);overflow:hidden;background:#0F1613}
.phone img{display:block;width:100%}
</style></head><body>
<div class="txt"><div class="logo"><svg width="46" height="46" viewBox="0 0 24 24" fill="none" stroke="#1F7A4D" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M11 20A7 7 0 0 1 9.8 6.1C15.5 5 17 4.48 19 2c1 2 2 4.18 2 8 0 5.5-4.78 10-10 10Z"/><path d="M2 21c0-3 1.85-5.36 5.08-6C9.5 14.52 12 13 13 12"/></svg></div>
<h1>Gaspalli</h1><p>Moins de gaspi, plus de goût.<br/>Le frigo partagé de tout le foyer.</p></div>
<div class="phone" style="left:590px;top:70px;transform:rotate(-4deg)"><img src="data:image/png;base64,${shot}"/></div>
<div class="phone" style="left:790px;top:110px;transform:rotate(5deg)"><img src="data:image/png;base64,${shot2}"/></div>
</body></html>`;
(async () => {
  const b = await chromium.launch();
  const p = await b.newPage({ viewport: { width: 1024, height: 500 } });
  await p.setContent(html, { waitUntil: 'networkidle' }).catch(() => {});
  await p.waitForTimeout(1500);
  await p.screenshot({ path: require('path').join(__dirname, '..', 'docs', 'store') + '/banniere-1024x500.png' });
  await b.close();
})();
