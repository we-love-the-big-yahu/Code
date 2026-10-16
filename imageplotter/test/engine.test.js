'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const { DrawingEngine } = require('../src/drawing-engine');
const plan = { version: 1, width: 100, height: 100, paths: [[[0.2, 0.2], [0.8, 0.2], [0.8, 0.8]], [[0.1, 0.9], [0.9, 0.9]]] };
const area = { x: 50, y: 50, width: 100, height: 100 };
function mock() {
  const events = [], mouse = { point: { x: 20, y: 20 }, position() { return this.point; } };
  for (const type of ['move', 'down', 'drag', 'up']) mouse[type] = (...args) => { events.push([type, ...args]); if (args.length) mouse.point = { x: args[0], y: args[1] }; };
  const engine = new DrawingEngine(mouse, { wait: async () => {} }); return { mouse, engine, events };
}
test('actual drawing sends bounded drags and releases the button after every stroke', async () => {
  const { engine, events } = mock(); const result = await engine.run(plan, area);
  assert.equal(result.completed, 2); assert.equal(result.stopped, false); assert.equal(engine.running, false);
  assert.equal(events.filter(e => e[0] === 'down').length, 2); assert.equal(events.filter(e => e[0] === 'up').length, 2);
  let down = false;
  for (const [type, x, y] of events) {
    if (type === 'down') { assert.equal(down, false); down = true; }
    if (type === 'drag') assert.equal(down, true);
    if (type === 'up') { assert.equal(down, true); down = false; }
    if (x !== undefined) { assert.ok(x > 50 && x < 150); assert.ok(y > 50 && y < 150); }
  }
});
test('cancelling in the countdown produces no mouse input', async () => {
  const { engine, events } = mock(); engine.on('progress', p => { if (p.phase === 'countdown') engine.stop(); });
  const result = await engine.run(plan, area); assert.equal(result.stopped, true); assert.deepEqual(events, []);
});
test('emergency stop during a stroke releases the button immediately', async () => {
  const { engine, mouse, events } = mock();
  mouse.drag = (x, y) => { events.push(['drag', x, y]); engine.stop(); };
  const result = await engine.run(plan, area); assert.equal(result.stopped, true);
  assert.equal(events.filter(e => e[0] === 'drag').length, 1); assert.equal(events.at(-1)[0], 'up'); assert.equal(engine.down, false);
});
test('a native failure releases the button and reports an error', async () => {
  const { engine, mouse, events } = mock(); mouse.drag = () => { throw new Error('native error'); };
  await assert.rejects(engine.run(plan, area), /native error/); assert.equal(events.at(-1)[0], 'up'); assert.equal(engine.running, false);
});
test('top-left corner stops automation, but a second display with negative coordinates does not', async () => {
  const a = mock(); a.mouse.point = { x: 1, y: 1 };
  assert.equal((await a.engine.run(plan, area)).stopped, true); assert.equal(a.events.length, 0);
  const b = mock(); b.mouse.point = { x: -800, y: 1 };
  assert.equal((await b.engine.run(plan, area)).stopped, false);
});
test('concurrent runs are rejected and no drawing starts for an invalid plan', async () => {
  const { engine } = mock(); let release; engine.wait = () => new Promise(resolve => { release = resolve; });
  const run = engine.run(plan, area); await assert.rejects(engine.run(plan, area), /already running/);
  engine.stop(); release(); assert.equal((await run).stopped, true);
  await assert.rejects(engine.run({}, area), /invalid/); assert.equal(engine.running, false);
});

test('changing the active application stops drawing and releases the mouse', async () => {
  const { engine, mouse, events } = mock(); let pid = 100;
  mouse.frontmostPid = () => pid; mouse.ownPid = 200;
  mouse.drag = (x, y) => { events.push(['drag', x, y]); pid = 101; };
  const result = await engine.run(plan, area);
  assert.equal(result.stopped, true); assert.match(result.message, /active application changed/);
  assert.equal(events.at(-1)[0], 'up'); assert.equal(events.filter(e => e[0] === 'drag').length, 1);
});
test('drawing does not start while ImagePlotter remains the active app', async () => {
  const { engine, mouse, events } = mock(); mouse.frontmostPid = () => 200; mouse.ownPid = 200;
  await assert.rejects(engine.run(plan, area), /Focus the target drawing app/); assert.equal(events.length, 0);
});
