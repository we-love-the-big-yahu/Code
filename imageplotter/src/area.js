'use strict';
let start = null, rect = null;
const box = document.getElementById('selection');
window.addEventListener('pointerdown', event => { if (event.button === 0) { start = { x: event.clientX, y: event.clientY }; rect = null; } });
window.addEventListener('pointermove', event => {
  if (!start) return;
  const x = Math.max(0, Math.min(innerWidth, event.clientX)), y = Math.max(0, Math.min(innerHeight, event.clientY));
  rect = { x: Math.min(start.x, x), y: Math.min(start.y, y), width: Math.abs(x - start.x), height: Math.abs(y - start.y) };
  Object.assign(box.style, { display: 'block', left: `${rect.x}px`, top: `${rect.y}px`, width: `${rect.width}px`, height: `${rect.height}px` });
});
window.addEventListener('pointerup', () => { if (start && rect && rect.width >= 30 && rect.height >= 30) window.areaPicker.choose(rect); start = null; });
window.addEventListener('keydown', event => { if (event.key === 'Escape') window.areaPicker.cancel(); });
