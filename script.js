// prevent iOS long-press callout / context menu from breaking the illusion
document.addEventListener('contextmenu', e => e.preventDefault());

/* ---------------- Clock ---------------- */
const DAYS = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
const MONTHS = ['January','February','March','April','May','June','July','August','September','October','November','December'];

function updateClock() {
  const now = new Date();
  const h = now.getHours();
  const m = now.getMinutes();
  const h12 = ((h + 11) % 12) + 1;
  const dateStr = `${DAYS[now.getDay()]}, ${MONTHS[now.getMonth()]} ${now.getDate()}`;

  document.getElementById('clock').textContent = `${h12}:${String(m).padStart(2, '0')}`;
  document.getElementById('date').textContent = dateStr;
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
const dots = document.querySelectorAll('#dots .dot');

function renderDots() {
  dots.forEach((d, i) => d.classList.toggle('filled', i < entered.length));
}

let missCount = 0;      // digit 1 - 1: number of "not detected" scans before "detected"
let targetNumber = '00'; // digits 2-3: number revealed on detection

function handleDigit(d) {
  if (entered.length >= 6) return;
  entered.push(d);
  renderDots();
  if (entered.length === 6) {
    missCount = parseInt(entered[0], 10) - 1;
    targetNumber = entered[1] + entered[2];
    // digits 4-6 are intentionally unused
    setTimeout(unlock, 250);
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

function unlock() {
  showScreen('screen-home');
}

document.querySelectorAll('[data-nav-home]').forEach(btn => {
  btn.addEventListener('click', () => showScreen('screen-home'));
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
const scanPad = document.getElementById('scan-pad');
const padStatus = document.getElementById('pad-status');
const padSweep = document.getElementById('pad-sweep');
const resultNumber = document.getElementById('result-number');
const scanAction = document.getElementById('scan-action');

let attempts = 0;
let finished = false;

function resetDetectScreen() {
  attempts = 0;
  finished = false;
  scanPad.classList.remove('scanning');
  padStatus.className = 'pad-status';
  padStatus.textContent = 'Place object above sensor';
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
  padStatus.className = 'pad-status';
  padStatus.textContent = 'Scanning...';
  resultNumber.classList.remove('show');
  scanPad.classList.add('scanning');

  setTimeout(() => {
    scanPad.classList.remove('scanning');
    attempts++;
    if (attempts <= missCount) {
      padStatus.textContent = 'Not Detected';
      padStatus.classList.add('not-detected');
      scanAction.disabled = false;
    } else {
      padStatus.textContent = 'Detected';
      padStatus.classList.add('detected');
      finished = true;
      setTimeout(runCalculation, 650);
    }
  }, 1400);
}

function runCalculation() {
  padStatus.textContent = 'Calculating...';
  padStatus.classList.add('calculating');
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
    }
  }, 90);
}
