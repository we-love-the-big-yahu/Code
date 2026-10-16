'use strict';
const test = require('node:test'), assert = require('node:assert/strict');
const P = require('../src/planner');
function fixture(w = 48, h = 40, shape = () => false) {
  const data = new Uint8ClampedArray(w * h * 4);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) {
    const i = (y * w + x) * 4, c = shape(x, y) ? 0 : 255;
    data[i] = data[i + 1] = data[i + 2] = c; data[i + 3] = 255;
  } return data;
}
test('rectangle and circle become nonempty normalized stroke plans', () => {
  for (const shape of [(x, y) => x >= 9 && x < 37 && y >= 8 && y < 32, (x, y) => (x - 24) ** 2 + (y - 20) ** 2 < 120]) {
    const data = fixture(48, 40, shape), plan = P.planImage(data, 48, 40);
    assert.ok(plan.paths.length > 0); assert.equal(P.validatePlan(plan), true);
    assert.deepEqual(plan, P.planImage(data, 48, 40));
  }
});
test('blank and fully transparent images produce no unwanted marks', () => {
  assert.equal(P.planImage(fixture(), 48, 40).paths.length, 0);
  assert.equal(P.planImage(new Uint8ClampedArray(48 * 40 * 4), 48, 40, { mode: 'sketch' }).paths.length, 0);
});
test('shaded sketch includes hatching for filled dark regions', () => {
  const data = fixture(48, 40, (x, y) => x > 10 && x < 37 && y > 6 && y < 34);
  assert.ok(P.planImage(data, 48, 40, { mode: 'sketch' }).paths.length > P.planImage(data, 48, 40).paths.length);
});
test('vector contours preserve a closed loop without hundreds of tiny strokes', () => {
  const data = fixture(48, 40, (x, y) => {
    const r = (x - 24) ** 2 + (y - 20) ** 2; return r > 95 && r < 140;
  });
  const plan = P.planImage(data, 48, 40);
  assert.ok(plan.paths.length >= 2 && plan.paths.length < 12);
  for (const path of plan.paths) assert.deepEqual(path[0], path.at(-1));
});
test('canvas projection respects bounds, aspect ratio, and negative display coordinates', () => {
  const plan = { version: 1, width: 100, height: 50, paths: [[[0, 0], [1, 1]]] };
  const area = { x: -900, y: 100, width: 500, height: 400 }, rect = P.fitRect(area, 100, 50);
  assert.equal(rect.width / rect.height, 2);
  const paths = P.project(plan, area);
  for (const [x, y] of paths.flat()) { assert.ok(x >= -895 - 1e-8 && x <= -405 + 1e-8); assert.ok(y >= 105 && y <= 495); }
});
test('invalid IPC plans and target areas are rejected', () => {
  const plan = { version: 1, width: 100, height: 50, paths: [[[0, 0], [1, 1]]] };
  for (const bad of [null, {}, { ...plan, paths: [] }, { ...plan, paths: [[[0, 0], [NaN, 0]]] }, { ...plan, paths: [[[0, 0], [1.1, 0]]] }, { ...plan, width: -1 }]) assert.throws(() => P.validatePlan(bad));
  assert.throws(() => P.fitRect({ x: 0, y: 0, width: 5, height: 100 }, 100, 100));
  assert.throws(() => P.fitRect({ x: NaN, y: 0, width: 100, height: 100 }, 100, 100));
});
test('estimated time increases at a slower drawing speed', () => {
  const plan = { version: 1, width: 100, height: 100, paths: [[[0, 0], [1, 1]]] }, area = { x: 20, y: 20, width: 1000, height: 1000 };
  assert.ok(P.estimate(plan, area, 100) > P.estimate(plan, area, 1000));
});
test('simplification preserves endpoints without mutating source', () => {
  const points = [[0, 0], [1, 1], [2, 2], [3, 3]];
  assert.deepEqual(P.simplify(points), [[0, 0], [3, 3]]); assert.equal(points.length, 4);
});
