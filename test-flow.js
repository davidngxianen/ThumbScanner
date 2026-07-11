const puppeteer = require('puppeteer');
const path = require('path');

const SHOT_DIR = path.join(__dirname, 'test-shots');
require('fs').mkdirSync(SHOT_DIR, { recursive: true });

function sleep(ms) { return new Promise(r => setTimeout(r, ms)); }

(async () => {
  const browser = await puppeteer.launch({ headless: 'new' });
  const page = await browser.newPage();
  const errors = [];
  page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
  page.on('console', msg => { if (msg.type() === 'error') errors.push('CONSOLE: ' + msg.text()); });

  await page.setViewport({ width: 390, height: 844, isMobile: true, hasTouch: true });
  await page.goto('http://localhost:8791/index.html', { waitUntil: 'networkidle0' });
  await page.screenshot({ path: path.join(SHOT_DIR, '1-lock.png') });

  // digit1=3 -> missCount = 3-1 = 2 ; digits2-3 = 0,5 -> target "05"
  for (const d of ['3', '0', '5', '1', '1', '1']) {
    await page.click(`.key[data-key="${d}"]`);
    await sleep(80);
  }
  await sleep(500);
  await page.screenshot({ path: path.join(SHOT_DIR, '2-home.png') });
  const homeActive = await page.$eval('#screen-home', el => el.classList.contains('active'));
  console.log('home screen active after passcode:', homeActive);

  await page.click('#start-scan-card');
  await sleep(400);
  await page.screenshot({ path: path.join(SHOT_DIR, '3-thumb.png') });

  // home icon nav-back test from thumb screen
  await page.click('#screen-thumb .home-btn');
  await sleep(400);
  const backToHome = await page.$eval('#screen-home', el => el.classList.contains('active'));
  console.log('home-btn from thumb screen returned to home:', backToHome);

  // go to thumb again and complete the hold
  await page.click('#start-scan-card');
  await sleep(400);
  const thumbBox = await page.$eval('#thumb-btn', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.touchscreen.touchStart(thumbBox.x, thumbBox.y);
  await sleep(3200);
  await page.touchscreen.touchEnd();
  await sleep(300);
  await page.screenshot({ path: path.join(SHOT_DIR, '4-thumb-success.png') });

  await page.click('#proceed-btn');
  await sleep(400);
  await page.screenshot({ path: path.join(SHOT_DIR, '5-detect.png') });

  // home icon nav-back test from detect screen
  await page.click('#screen-detect .home-btn');
  await sleep(400);
  const backToHome2 = await page.$eval('#screen-home', el => el.classList.contains('active'));
  console.log('home-btn from detect screen returned to home:', backToHome2);

  // redo the whole run to verify reset-on-reentry works, then check miss count = 2
  await page.click('#start-scan-card');
  await sleep(400);
  const thumbBox2 = await page.$eval('#thumb-btn', el => {
    const r = el.getBoundingClientRect();
    return { x: r.x + r.width / 2, y: r.y + r.height / 2 };
  });
  await page.touchscreen.touchStart(thumbBox2.x, thumbBox2.y);
  await sleep(3200);
  await page.touchscreen.touchEnd();
  await sleep(300);
  await page.click('#proceed-btn');
  await sleep(400);

  for (let i = 1; i <= 2; i++) {
    await page.click('#scan-action');
    await sleep(1600);
    const status = await page.$eval('#pad-status', el => el.textContent);
    console.log(`status after scan ${i} (missCount=2 expected 'Not Detected' for first 2):`, status);
  }
  await page.click('#scan-action');
  await sleep(1600);
  const statusDetected = await page.$eval('#pad-status', el => el.textContent);
  console.log('status after scan 3 (expected Detected):', statusDetected);
  await sleep(1700);
  await page.screenshot({ path: path.join(SHOT_DIR, '6-final-number.png') });
  const finalNumber = await page.$eval('#result-number', el => el.textContent);
  console.log('final number (expected 05):', finalNumber);

  console.log('CONSOLE/PAGE ERRORS:', errors.length ? errors : 'none');
  await browser.close();
})();
