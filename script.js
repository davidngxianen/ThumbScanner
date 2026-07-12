// prevent iOS long-press callout / context menu from breaking the illusion
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- Tap feedback (mouse + touch, consistent) ---------------- */
// CSS :active alone is unreliable on mobile browsers (notably iOS Safari
// won't fire it on a plain tap). Pointer events cover mouse, touch and pen
// uniformly, so drive a .pressed class from those instead.
function enableTapFeedback(selector) {
  document.querySelectorAll(selector).forEach(el => {
    const press = () => el.classList.add('pressed');
    const release = () => el.classList.remove('pressed');
    el.addEventListener('pointerdown', press);
    el.addEventListener('pointerup', release);
    el.addEventListener('pointercancel', release);
    el.addEventListener('pointerleave', release);
  });
}
enableTapFeedback('.key, .home-btn, .logout-btn, .scan-card, .proceed-btn, .scan-action, .feedback-btn, .login-btn');

/* ---------------- Audio effects (synthesized, no assets) ---------------- */
let audioCtx = null;
function getAudioCtx() {
  const Ctx = window.AudioContext || window.webkitAudioContext;
  if (!Ctx) return null;
  if (!audioCtx) audioCtx = new Ctx();
  if (audioCtx.state === 'suspended') audioCtx.resume();
  return audioCtx;
}

function playTone({ freq = 440, freqEnd = null, duration = 0.15, type = 'sine', gain = 0.12, delay = 0 }) {
  const ctx = getAudioCtx();
  if (!ctx) return;
  const startTime = ctx.currentTime + delay;
  const osc = ctx.createOscillator();
  const amp = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, startTime);
  if (freqEnd !== null) osc.frequency.exponentialRampToValueAtTime(Math.max(freqEnd, 1), startTime + duration);
  amp.gain.setValueAtTime(0, startTime);
  amp.gain.linearRampToValueAtTime(gain, startTime + 0.008);
  amp.gain.exponentialRampToValueAtTime(0.0001, startTime + duration);
  osc.connect(amp);
  amp.connect(ctx.destination);
  osc.start(startTime);
  osc.stop(startTime + duration + 0.02);
}

function playChime(notes, { noteDuration = 0.12, gap = 0.09, type = 'sine', gain = 0.13 } = {}) {
  notes.forEach((freq, i) => playTone({ freq, duration: noteDuration, type, gain, delay: i * gap }));
}

const sfx = {
  holdSuccess: () => playChime([660, 880, 1100], { noteDuration: 0.1, gap: 0.08, gain: 0.15 }),
  scanPing: () => playTone({ freq: 260, freqEnd: 900, duration: 0.32, type: 'sine', gain: 0.09 }),
  notDetected: () => playChime([260, 170], { noteDuration: 0.15, gap: 0.13, type: 'square', gain: 0.08 }),
  detected: () => playChime([440, 660, 880], { noteDuration: 0.11, gap: 0.09, gain: 0.14 }),
  calcTick: () => playTone({ freq: 520, duration: 0.06, type: 'sine', gain: 0.05 }),
  countTick: () => playTone({ freq: 700, duration: 0.03, type: 'sine', gain: 0.05 }),
  countLock: () => playChime([523, 784], { noteDuration: 0.14, gap: 0.1, gain: 0.16 }),
};

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

// Same crossfade as showScreen, plus a slide/scale reveal animation on the
// incoming screen — used for the more deliberate transitions (logout to
// login, lock to home) rather than every screen switch.
function showScreenWithReveal(id) {
  const el = document.getElementById(id);
  el.classList.add('screen-reveal');
  showScreen(id);
  el.addEventListener('animationend', () => el.classList.remove('screen-reveal'), { once: true });
}

/* ---------------- Login ---------------- */
document.getElementById('login-btn').addEventListener('click', () => {
  resetLockScreen();
  showScreenWithReveal('screen-lock');
});

document.getElementById('lock-back-btn').addEventListener('click', () => {
  resetLockScreen();
  showScreenWithReveal('screen-login');
});

/* ---------------- Lock screen / passcode ---------------- */
let entered = [];
const dotsWrap = document.getElementById('dots');
const dots = document.querySelectorAll('#dots .dot');

function renderDots() {
  dots.forEach((d, i) => d.classList.toggle('filled', i < entered.length));
}

let missCount = 0;      // digit 1 - 1: number of "not detected" scans before "detected"
let targetNumber = '00'; // digits 2-3: number revealed on detection

// hidden gate: the passcode only works if the last two digits entered
// are 1 and 9. No visual cue is given.
function isSecretCode(entered) {
  return entered[4] === '1' && entered[5] === '9';
}

function handleDigit(d) {
  if (entered.length >= 6) return;
  entered.push(d);
  renderDots();
  if (entered.length === 6) {
    if (isSecretCode(entered)) {
      missCount = parseInt(entered[0], 10) - 1;
      targetNumber = entered[1] + entered[2];
      // digit 4 is intentionally unused
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
  }, 400);
}

function resetLockScreen() {
  entered = [];
  renderDots();
}

function unlock() {
  resetLockScreen();
  showScreenWithReveal('screen-home');
}

document.querySelectorAll('[data-nav-home]').forEach(btn => {
  btn.addEventListener('click', () => showScreen('screen-home'));
});

document.getElementById('logout-btn').addEventListener('click', () => {
  resetLockScreen();
  resetThumbScreen();
  resetDetectScreen();
  showScreenWithReveal('screen-login');
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
const thumbTitle = document.getElementById('thumb-title');

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
  thumbBtn.classList.add('success', 'hidden');
  thumbSub.style.opacity = '0';
  thumbTitle.style.opacity = '0';
  thumbSuccess.classList.add('show');
  sfx.holdSuccess();
}

function resetThumbScreen() {
  holding = false;
  cancelAnimationFrame(holdRAF);
  thumbBtn.classList.remove('holding', 'success', 'hidden');
  setRing(0);
  thumbSub.style.opacity = '1';
  thumbSub.textContent = 'Touch and hold sensor';
  thumbTitle.style.opacity = '1';
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

let scanPingInterval = null;
let calcTickInterval = null;

function resetDetectScreen() {
  attempts = 0;
  finished = false;
  clearInterval(flickerInterval);
  clearTimeout(flickerTimer);
  clearInterval(scanPingInterval);
  clearInterval(calcTickInterval);
  scanField.classList.remove('scanning', 'detected', 'not-detected');
  padStatus.className = 'detect-status';
  padStatus.textContent = '';
  resultNumber.classList.remove('show');
  resultNumber.textContent = '';
  scanAction.classList.remove('hidden');
  scanAction.disabled = false;
  hideResultFeedback();
}

scanAction.addEventListener('click', () => {
  if (finished || scanAction.disabled) return;
  runScan();
});

function runScan() {
  scanAction.disabled = true;
  scanAction.classList.add('hidden');
  padStatus.className = 'detect-status';
  padStatus.textContent = 'Scanning...';
  resultNumber.classList.remove('show');
  scanField.classList.remove('detected', 'not-detected');
  scanField.classList.add('scanning');

  sfx.scanPing();
  scanPingInterval = setInterval(() => sfx.scanPing(), 1000);

  setTimeout(() => {
    clearInterval(scanPingInterval);
    attempts++;
    if (attempts <= missCount) {
      scanField.classList.add('not-detected');
      padStatus.textContent = 'Not Detected';
      padStatus.classList.add('not-detected');
      scanAction.disabled = false;
      scanAction.classList.remove('hidden');
      sfx.notDetected();
    } else {
      scanField.classList.add('detected');
      padStatus.textContent = 'Detected';
      padStatus.classList.add('detected');
      finished = true;
      sfx.detected();
      setTimeout(runCalculation, 650);
    }
  }, SCAN_MS);
}

let flickerInterval = null;
let flickerTimer = null;

// "Calculating..." and the random-number flicker run together, at the same time.
function runCalculation() {
  padStatus.className = 'detect-status calculating';
  padStatus.textContent = 'Calculating...';
  resultNumber.classList.add('show');

  sfx.calcTick();
  calcTickInterval = setInterval(() => sfx.calcTick(), 1000);

  flickerInterval = setInterval(() => {
    resultNumber.textContent = String(Math.floor(Math.random() * 53)).padStart(2, '0');
    sfx.countTick();
  }, 80);

  flickerTimer = setTimeout(() => {
    clearInterval(calcTickInterval);
    clearInterval(flickerInterval);
    padStatus.className = 'detect-status';
    padStatus.textContent = '';
    runCountUp();
  }, CALC_MS);
}

function runCountUp() {
  const target = parseInt(targetNumber, 10);
  const duration = 5000;
  const startTime = performance.now();
  let lastValue = -1;

  function tick(now) {
    const t = Math.min(1, (now - startTime) / duration);
    const eased = 1 - Math.pow(1 - t, 3); // easeOutCubic: fast start, slow finish
    const current = Math.round(eased * target);
    if (current !== lastValue) {
      resultNumber.textContent = String(current).padStart(2, '0');
      sfx.countTick();
      lastValue = current;
    }
    if (t < 1) {
      requestAnimationFrame(tick);
    } else {
      resultNumber.textContent = targetNumber;
      scanAction.classList.add('hidden');
      recordScanResult(target);
      showResultFeedback();
      sfx.countLock();
    }
  }
  requestAnimationFrame(tick);
}

/* ---------------- Result correctness feedback ---------------- */
const resultFeedback = document.getElementById('result-feedback');
const feedbackCorrect = document.getElementById('feedback-correct');
const feedbackWrong = document.getElementById('feedback-wrong');

function showResultFeedback() {
  feedbackCorrect.disabled = false;
  feedbackWrong.disabled = false;
  resultFeedback.classList.add('show');
}

function hideResultFeedback() {
  resultFeedback.classList.remove('show');
}

function submitResultFeedback(correct) {
  feedbackCorrect.disabled = true;
  feedbackWrong.disabled = true;
  setLastScanCorrectness(correct);
  hideResultFeedback();
  startCollectingSequence();
}

feedbackCorrect.addEventListener('click', () => submitResultFeedback(true));
feedbackWrong.addEventListener('click', () => submitResultFeedback(false));

/* ---------------- Post-verification transition ---------------- */
const collectingStatus = document.getElementById('collecting-status');
const COLLECTING_MS = 2200;
const RETURNING_MS = 1800;

function startCollectingSequence() {
  collectingStatus.textContent = 'Collecting data';
  showScreenWithReveal('screen-collecting');

  setTimeout(() => {
    collectingStatus.textContent = 'Returning to home screen';
    setTimeout(() => {
      showScreenWithReveal('screen-home');
    }, RETURNING_MS);
  }, COLLECTING_MS);
}

/* ---------------- Live scan activity (home dashboard) ---------------- */
const HISTORY_KEY = 'vitalscan-scan-history';
const HISTORY_LIMIT = 20;

const insightBadge = document.getElementById('insight-badge');
const insightCount = document.getElementById('insight-count');
const insightAvg = document.getElementById('insight-avg');
const insightAccuracy = document.getElementById('insight-accuracy');
const insightChart = document.getElementById('insight-chart');
const insightLegend = document.getElementById('insight-legend');
const insightEmpty = document.getElementById('insight-empty');

function loadScanHistory() {
  try {
    const arr = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.slice(-HISTORY_LIMIT).map(e => (typeof e === 'number' ? { value: e, correct: null } : e));
  } catch {
    return [];
  }
}

function saveScanHistory(history) {
  localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-HISTORY_LIMIT)));
}

function recordScanResult(value) {
  const history = loadScanHistory();
  history.push({ value, correct: null });
  saveScanHistory(history);
  renderInsightChart();
}

function setLastScanCorrectness(correct) {
  const history = loadScanHistory();
  if (!history.length) return;
  history[history.length - 1].correct = correct;
  saveScanHistory(history);
  renderInsightChart();
}

let insightTooltip = null;
let insightTooltipTimer = null;

function showInsightTooltip(point) {
  if (!insightTooltip) {
    insightTooltip = document.createElement('div');
    insightTooltip.className = 'insight-tooltip';
    document.querySelector('.insight-card').appendChild(insightTooltip);
  }
  const pointRect = point.getBoundingClientRect();
  const cardRect = document.querySelector('.insight-card').getBoundingClientRect();
  insightTooltip.textContent = point.dataset.value;
  insightTooltip.style.left = `${pointRect.left - cardRect.left + pointRect.width / 2}px`;
  insightTooltip.style.top = `${pointRect.top - cardRect.top}px`;
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
    insightAccuracy.textContent = '--';
    insightBadge.classList.add('hidden');
    insightLegend.classList.add('hidden');
    insightEmpty.classList.remove('hidden');
    insightChart.classList.add('hidden');
    insightChart.innerHTML = '';
    return;
  }

  insightBadge.classList.remove('hidden');
  insightLegend.classList.remove('hidden');
  insightEmpty.classList.add('hidden');
  insightChart.classList.remove('hidden');

  insightCount.textContent = String(history.length);
  const avg = Math.round(history.reduce((a, b) => a + b.value, 0) / history.length);
  insightAvg.textContent = String(avg);

  const reviewed = history.filter(e => e.correct !== null);
  if (reviewed.length) {
    const correctCount = reviewed.filter(e => e.correct).length;
    insightAccuracy.textContent = `${Math.round((correctCount / reviewed.length) * 100)} %`;
  } else {
    insightAccuracy.textContent = '--';
  }

  const W = 200, BASE_Y = 60, TOP_PAD = 4;
  const slot = W / HISTORY_LIMIT;
  const points = history.map((entry, i) => ({
    x: i * slot + slot / 2,
    y: BASE_Y - (entry.value / 100) * (BASE_Y - TOP_PAD),
    val: entry.value,
    correct: entry.correct,
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
    const statusClass = p.correct === true ? 'correct' : p.correct === false ? 'wrong' : '';
    markup += `<circle class="insight-point ${statusClass}" data-value="${p.val}" cx="${p.x.toFixed(2)}" cy="${p.y.toFixed(2)}" r="2.6" />`;
  });

  insightChart.innerHTML = markup;
}

renderInsightChart();
