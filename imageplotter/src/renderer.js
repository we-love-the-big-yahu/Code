'use strict';
const $ = id => document.getElementById(id), api = window.imagePlotter;
const controls = ['mode', 'detail', 'sensitivity', 'speed', 'choose-area', 'replace'];
let image = null, plan = null, area = null, permission = false, planning = false, drawing = false, original = false;
let revision = 0, imageRevision = 0, refreshTimer, worker;
try { worker = new Worker('planner-worker.js'); } catch { worker = null; }
const status = (message, error = false) => { $('status').textContent = message; $('status').classList.toggle('error', error); };
function labels() {
  const detail = +$('detail').value, speed = +$('speed').value;
  $('detail-label').textContent = detail < 160 ? 'Simple' : detail <= 240 ? 'Balanced' : 'Detailed';
  $('sensitivity-label').textContent = $('sensitivity').value;
  $('speed-label').textContent = speed < 300 ? 'Careful' : speed <= 550 ? 'Steady' : 'Fast';
}
function update() {
  $('start').disabled = !plan?.paths.length || !area || !permission || planning || drawing;
  $('permission-warning').hidden = permission;
  $('area-label').textContent = area ? `${Math.round(area.width)} × ${Math.round(area.height)} canvas selected` : 'No area selected';
  $('stroke-count').textContent = plan ? `${plan.paths.length.toLocaleString()} strokes` : '— strokes';
  let seconds = null;
  try { if (plan?.paths.length && area) seconds = DrawingPlanner.estimate(plan, area, +$('speed').value); } catch { /* No estimate for an incomplete setup. */ }
  $('estimate').textContent = seconds === null ? '—' : seconds < 60 ? `About ${seconds}s` : `About ${Math.ceil(seconds / 60)} min`;
  $('planning').hidden = !planning;
  controls.forEach(id => { $(id).disabled = drawing; });
  $('start').textContent = drawing ? 'Drawing…' : 'Start drawing ↗';
}
function paint() {
  const canvas = $('preview'), bounds = $('dropzone').getBoundingClientRect(), dpr = devicePixelRatio || 1;
  canvas.width = Math.round(bounds.width * dpr); canvas.height = Math.round(bounds.height * dpr);
  const ctx = canvas.getContext('2d'); ctx.fillStyle = '#fff'; ctx.fillRect(0, 0, canvas.width, canvas.height);
  if (!image) return;
  const padding = 24 * dpr, scale = Math.min((canvas.width - padding * 2) / image.width, (canvas.height - padding * 2) / image.height);
  const width = image.width * scale, height = image.height * scale, x = (canvas.width - width) / 2, y = (canvas.height - height) / 2;
  if (original) ctx.drawImage(image, x, y, width, height);
  else if (plan) {
    ctx.strokeStyle = '#1c302d'; ctx.lineWidth = 1.1 * dpr; ctx.lineJoin = ctx.lineCap = 'round';
    for (const stroke of plan.paths) {
      ctx.beginPath(); ctx.moveTo(x + stroke[0][0] * width, y + stroke[0][1] * height);
      for (const p of stroke.slice(1)) ctx.lineTo(x + p[0] * width, y + p[1] * height);
      ctx.stroke();
    }
  }
}
function receive(data) {
  if (data.id !== revision) return;
  planning = false;
  if (data.error) { plan = null; status(data.error, true); }
  else {
    plan = data.plan;
    if (!plan.paths.length) status('No drawable lines found. Try higher sensitivity or Shaded sketch.');
    else status('Preview ready. Select your canvas, brush, and color before starting.');
    $('plan-note').textContent = plan.truncated ? 'Very complex image: some strokes were omitted. Reduce detail for a cleaner result.' : 'The preview shows the strokes that will be drawn, using your current brush color.';
  }
  paint(); update();
}
if (worker) {
  worker.onmessage = event => receive(event.data);
  worker.onerror = () => { worker.terminate(); worker = null; planning = false; rebuild(); };
}
function rebuild() {
  if (!image || drawing) return;
  const id = ++revision, size = +$('detail').value, ratio = Math.min(1, size / Math.max(image.width, image.height));
  const width = Math.max(3, Math.round(image.width * ratio)), height = Math.max(3, Math.round(image.height * ratio));
  const source = document.createElement('canvas'); source.width = width; source.height = height;
  const ctx = source.getContext('2d', { willReadFrequently: true }); ctx.drawImage(image, 0, 0, width, height);
  const data = ctx.getImageData(0, 0, width, height), options = { mode: $('mode').value, sensitivity: +$('sensitivity').value, density: 4 };
  planning = true; plan = null; update();
  if (worker) worker.postMessage({ id, rgba: data.data.buffer, width, height, options }, [data.data.buffer]);
  else setTimeout(() => { try { receive({ id, plan: DrawingPlanner.planImage(data.data, width, height, options) }); } catch (error) { receive({ id, error: error.message }); } }, 20);
}
async function openFile(file) {
  if (!file || drawing) return;
  if (!['image/png', 'image/jpeg', 'image/webp', 'image/gif'].includes(file.type)) { status('Choose a PNG, JPG, WEBP, or GIF image.', true); return; }
  if (file.size > 25 * 1024 * 1024) { status('Choose an image smaller than 25 MB.', true); return; }
  const id = ++imageRevision;
  try {
    const bitmap = await createImageBitmap(file);
    if (id !== imageRevision) { bitmap.close(); return; }
    if (bitmap.width * bitmap.height > 40000000) { bitmap.close(); throw new Error('That image is too large. Resize it below 40 megapixels first.'); }
    image?.close(); image = bitmap; $('file-name').textContent = file.name;
    $('empty').hidden = true; $('preview').hidden = false; $('replace').hidden = false;
    rebuild(); paint();
  } catch (error) { status(error.message || 'The image could not be read.', true); }
}
function chooseFile() { if (!drawing) { $('file-input').value = ''; $('file-input').click(); } }
$('dropzone').addEventListener('click', chooseFile);
$('dropzone').addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); chooseFile(); } });
$('replace').addEventListener('click', chooseFile);
$('file-input').addEventListener('change', event => openFile(event.target.files[0]));
for (const type of ['dragover', 'dragenter']) $('dropzone').addEventListener(type, event => { event.preventDefault(); $('dropzone').classList.add('dragover'); });
$('dropzone').addEventListener('dragleave', () => $('dropzone').classList.remove('dragover'));
$('dropzone').addEventListener('drop', event => { event.preventDefault(); $('dropzone').classList.remove('dragover'); openFile(event.dataTransfer.files[0]); });
for (const id of ['mode', 'detail', 'sensitivity']) $(id).addEventListener('input', () => { labels(); clearTimeout(refreshTimer); refreshTimer = setTimeout(rebuild, 170); });
$('speed').addEventListener('input', () => { labels(); update(); });
$('view-drawing').addEventListener('click', () => { original = false; $('view-drawing').classList.add('selected'); $('view-original').classList.remove('selected'); paint(); });
$('view-original').addEventListener('click', () => { original = true; $('view-original').classList.add('selected'); $('view-drawing').classList.remove('selected'); paint(); });
$('choose-area').addEventListener('click', async () => {
  try { area = await api.chooseArea(); update(); if (area) status('Canvas selected. The image will be centered without stretching.'); }
  catch (error) { status(error.message, true); }
});
$('permission-button').addEventListener('click', async () => { try { await api.permission(); } catch (error) { status(error.message, true); } });
$('start').addEventListener('click', async () => {
  if ($('start').disabled) return;
  drawing = true; update(); status('Switch to the drawing canvas. Starting in 5 seconds…');
  try {
    const result = await api.start(plan, { speed: +$('speed').value });
    status(result.stopped ? `Stopped after ${result.completed} of ${result.total} strokes.` : `Finished drawing ${result.total} strokes.`);
  } catch (error) { status(error.message, true); }
  finally { drawing = false; update(); }
});
api?.onProgress(data => {
  if (data.phase === 'countdown') status(`Starting in ${data.seconds}… Focus your drawing canvas. Escape cancels.`);
  if (data.phase === 'drawing') status(`Drawing stroke ${data.completed} of ${data.total} — Escape stops.`);
  if (data.phase === 'error') status(data.message, true);
});
async function refreshState() {
  if (drawing) return;
  try { const current = await api.state(); permission = current.permission; area = current.area; update(); }
  catch { permission = false; update(); }
}
window.addEventListener('focus', refreshState);
window.addEventListener('resize', paint);
labels(); update(); refreshState(); setInterval(refreshState, 3000);
