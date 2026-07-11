// prevent iOS long-press callout / context menu from breaking the illusion
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- Clock ---------------- */
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function updateClock() {
  const now = new Date();
  const h = now.getHours();
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  document.getElementById('greeting-date').textContent = dateStr;
  document.getElementById('greeting-text').textContent =
    h < 12 ? 'Good morning' : h < 18 ? 'Good afternoon' : 'Good evening';
}
updateClock();
setInterval(updateClock, 1000 * 15);

/* ---------------- Screen switching ---------------- */
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

/* ---------------- Lock screen / passcode ---------------- */
let entered = [];
const dotsWrap = document.getElementById('dots');
const dots = document.querySelectorAll('#dots .dot');

function renderDots() {
  dots.forEach((d, i) => d.classList.toggle('filled', i < entered.length));
}

let missCount = 0;      // digit 1 - 1: number of "not detected" scans before "detected"
let targetNumber = '00'; // digits 2-3: number revealed on detection

// hidden gate: passcode only works if the top-left corner is tapped
// twice before any digits are entered. No visual cue is given.
let secretTaps = 0;
let secretArmed = false;

document.getElementById('secret-zone').addEventListener('click', () => {
  if (entered.length > 0) return;
  secretTaps++;
  if (secretTaps >= 2) secretArmed = true;
});

function handleDigit(d) {
  if (entered.length >= 6) return;
  entered.push(d);
  renderDots();
  if (entered.length === 6) {
    if (secretArmed) {
      missCount = parseInt(entered[0], 10) - 1;
      targetNumber = entered[1] + entered[2];
      // digits 4-6 are intentionally unused
      setTimeout(unlock, 250);
    } else {
      setTimeout(rejectPasscode, 250);
    }
  }
}

function handleDelete() {
  entered.pop();
  renderDots();
}

document.getElementById('keypad').addEventListener('click', e => {
  const key = e.target.closest('.key');
  if (!key || !key.dataset.key) return;
  handleDigit(key.dataset.key);
});
document.getElementById('del-key').addEventListener('click', handleDelete);

function rejectPasscode() {
  dotsWrap.classList.add('shake');
  setTimeout(() => {
    dotsWrap.classList.remove('shake');
    entered = [];
    renderDots();
    secretTaps = 0;
    secretArmed = false;
  }, 400);
}

function resetLockScreen() {
  entered = [];
  renderDots();
  secretTaps = 0;
  secretArmed = false;
}

function unlock() {
  resetLockScreen();
  showScreen('screen-home');
}

document.querySelectorAll('[data-nav-home]').forEach(btn => {
  btn.addEventListener('click', () => showScreen('screen-home'));
});

document.getElementById('logout-btn').addEventListener('click', () => {
  resetLockScreen();
  resetThumbScreen();
  resetDetectScreen();
  showScreen('screen-lock');
});

document.getElementById('start-scan-card').addEventListener('click', () => {
  resetThumbScreen();
  resetDetectScreen();
  showScreen('screen-thumb');
});

/* ---------------- Thumbprint hold-to-scan ---------------- */
const thumbBtn = document.getElementById('thumb-btn');
const ringProgress = document.getElementById('ring-progress');
const thumbSub = document.getElementById('thumb-sub');
const thumbSuccess = document.getElementById('thumb-success');

const RING_CIRCUMFERENCE = 339.3;
const HOLD_MS = 3000;

let holdRAF = null;
let holdStart = null;
let holding = false;

function setRing(fraction) {
  ringProgress.style.strokeDashoffset = String(RING_CIRCUMFERENCE * (1 - fraction));
}

function holdStep(ts) {
  if (!holding) return;
  if (holdStart === null) holdStart = ts;
  const elapsed = ts - holdStart;
  const fraction = Math.min(1, elapsed / HOLD_MS);
  setRing(fraction);
  if (fraction >= 1) {
    completeScan();
    return;
  }
  holdRAF = requestAnimationFrame(holdStep);
}

function startHold() {
  if (thumbSuccess.classList.contains('show')) return;
  holding = true;
  holdStart = null;
  thumbBtn.classList.add('holding');
  thumbSub.textContent = 'Keep holding...';
  holdRAF = requestAnimationFrame(holdStep);
}

function cancelHold() {
  if (!holding) return;
  holding = false;
  cancelAnimationFrame(holdRAF);
  thumbBtn.classList.remove('holding');
  setRing(0);
  thumbSub.textContent = 'Touch and hold sensor';
}

function completeScan() {
  holding = false;
  cancelAnimationFrame(holdRAF);
  thumbBtn.classList.remove('holding');
  thumbBtn.classList.add('success');
  thumbSub.style.opacity = '0';
  thumbSuccess.classList.add('show');
}

function resetThumbScreen() {
  holding = false;
  cancelAnimationFrame(holdRAF);
  thumbBtn.classList.remove('holding', 'success');
  setRing(0);
  thumbSub.style.opacity = '1';
  thumbSub.textContent = 'Touch and hold sensor';
  thumbSuccess.classList.remove('show');
}

thumbBtn.addEventListener('pointerdown', e => { e.preventDefault(); startHold(); });
thumbBtn.addEventListener('pointerup', cancelHold);
thumbBtn.addEventListener('pointercancel', cancelHold);
thumbBtn.addEventListener('pointerleave', cancelHold);

document.getElementById('proceed-btn').addEventListener('click', () => {
  showScreen('screen-detect');
});

/* ---------------- Detection screen ---------------- */
const scanField = document.getElementById('scan-field');
const padStatus = document.getElementById('pad-status');
const resultNumber = document.getElementById('result-number');
const scanAction = document.getElementById('scan-action');

const SCAN_MS = 3000;
const CALC_MS = 3000;

let attempts = 0;
let finished = false;

function resetDetectScreen() {
  attempts = 0;
  finished = false;
  scanField.classList.remove('scanning');
  padStatus.className = 'detect-status';
  padStatus.textContent = '';
  resultNumber.classList.remove('show');
  resultNumber.textContent = '';
  scanAction.classList.remove('hidden');
  scanAction.disabled = false;
}

scanAction.addEventListener('click', () => {
  if (finished || scanAction.disabled) return;
  runScan();
});

function runScan() {
  scanAction.disabled = true;
  padStatus.className = 'detect-status';
  padStatus.textContent = 'Scanning...';
  resultNumber.classList.remove('show');
  scanField.classList.add('scanning');

  setTimeout(() => {
    attempts++;
    if (attempts <= missCount) {
      scanField.classList.remove('scanning');
      padStatus.textContent = 'Not Detected';
      padStatus.classList.add('not-detected');
      scanAction.disabled = false;
    } else {
      padStatus.textContent = 'Detected';
      padStatus.classList.add('detected');
      finished = true;
      setTimeout(runCalculation, 650);
    }
  }, SCAN_MS);
}

function runCalculation() {
  padStatus.className = 'detect-status calculating';
  padStatus.textContent = 'Calculating...';

  setTimeout(startNumberReveal, CALC_MS);
}

function startNumberReveal() {
  padStatus.className = 'detect-status';
  padStatus.textContent = '';
  resultNumber.classList.add('show');

  let ticks = 0;
  const maxTicks = 14;
  const interval = setInterval(() => {
    resultNumber.textContent = String(Math.floor(Math.random() * 100)).padStart(2, '0');
    ticks++;
    if (ticks >= maxTicks) {
      clearInterval(interval);
      resultNumber.textContent = targetNumber;
      scanAction.classList.add('hidden');
      recordScanResult(parseInt(targetNumber, 10));
    }
  }, 90);
}

/* ---------------- Live scan activity (home dashboard) ---------------- */
const HISTORY_KEY = 'vitalscan-scan-history';
const HISTORY_LIMIT = 20;

const insightBadge = document.getElementById('insight-badge');
const insightCount = document.getElementById('insight-count');
const insightAvg = document.getElementById('insight-avg');
const insightChart = document.getElementById('insight-chart');
const insightEmpty = document.getElementById('insight-empty');

function loadScanHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    return Array.isArray(arr) ? arr.slice(-HISTORY_LIMIT) : [];
  } catch {
    return [];
  }
}

function recordScanResult(value) {
  const history = loadScanHistory();
  history.push(value);
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)));
  renderInsightChart();
}

let insightTooltip = null;
let insightTooltipTimer = null;

function showInsightTooltip(bar) {
  if (!insightTooltip) {
    insightTooltip = document.createElement('div');
    insightTooltip.className = 'insight-tooltip';
    document.querySelector('.insight-card').appendChild(insightTooltip);
  }
  const barRect = bar.getBoundingClientRect();
  const cardRect = document.querySelector('.insight-card').getBoundingClientRect();
  insightTooltip.textContent = bar.dataset.value;
  insightTooltip.style.left = `${barRect.left - cardRect.left + barRect.width / 2}px`;
  insightTooltip.style.top = `${barRect.top - cardRect.top}px`;
  insightTooltip.classList.add('show');
  clearTimeout(insightTooltipTimer);
  insightTooltipTimer = setTimeout(() => insightTooltip.classList.remove('show'), 1600);
}

insightChart.addEventListener('click', e => {
  const point = e.target.closest('.insight-point');
  if (point) showInsightTooltip(point);
});

function renderInsightChart() {
  const history = loadScanHistory();

  if (!history.length) {
    insightCount.textContent = '0';
    insightAvg.textContent = '--';
    insightBadge.classList.add('hidden');
    insightEmpty.classList.remove('hidden');
    insightChart.classList.add('hidden');
    insightChart.innerHTML = '';
    return;
  }

  insightBadge.classList.remove('hidden');
  insightEmpty.classList.add('hidden');
  insightChart.classList.remove('hidden');

  insightCount.textContent = String(history.length);
  const avg = Math.round(history.reduce((a, b) => a + b, 0) / history.length);
  insightAvg.textContent = String(avg);

  const W = 200, BASE_Y = 60, TOP_PAD = 4;
  const slot = W / HISTORY_LIMIT;
  const points = history.map((val, i) => ({
    x: i * slot + slot / 2,
    y: BASE_Y - (val / 100) * (BASE_Y - TOP_PAD),
    val,
  }));

  let markup = `<line x1="0" y1="${BASE_Y}" x2="${W}" y2="${BASE_Y}" class="insight-baseline" />`;

  if (points.length > 1) {
    const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(2)} ${p.y.toFixed(2)}`).join(' ');
    const last = points[points.length - 1];
    const areaPath = `${linePath} L ${last.x.toFixed(2)} ${BASE_Y} L ${points[0].x.toFixed(2)} ${BASE_Y} Z`;
    markup += `<path d="${areaPath}" class="insight-area" />`;
    markup += `<path d="${linePath}" class="insight-line" />`;
  }

  points.forEach(p => {
    markup += `<circle class="insight-point" data-value="${p.val}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.6" />`;
  });

  insightChart.innerHTML = markup;
}

renderInsightChart();
