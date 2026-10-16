/* Pure image planning shared by the preview worker and the test runner. */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory(require('./vendor/imagetracer.js'));
  else root.DrawingPlanner = factory(root.ImageTracer);
})(typeof self === 'undefined' ? globalThis : self, function (tracer) {
  'use strict';
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const distance = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1]);

  function simplify(points, tolerance = 0.65) {
    if (points.length <= 2) return points.slice();
    const keep = new Uint8Array(points.length); keep[0] = keep[points.length - 1] = 1;
    const stack = [[0, points.length - 1]], square = tolerance * tolerance;
    while (stack.length) {
      const [a, b] = stack.pop(), p = points[a], q = points[b];
      const dx = q[0] - p[0], dy = q[1] - p[1], length = dx * dx + dy * dy;
      let furthest = -1, best = square;
      for (let i = a + 1; i < b; i++) {
        const t = length ? clamp(((points[i][0] - p[0]) * dx + (points[i][1] - p[1]) * dy) / length, 0, 1) : 0;
        const d = (points[i][0] - p[0] - t * dx) ** 2 + (points[i][1] - p[1] - t * dy) ** 2;
        if (d > best) { best = d; furthest = i; }
      }
      if (furthest >= 0) { keep[furthest] = 1; stack.push([a, furthest], [furthest, b]); }
    }
    return points.filter((_, i) => keep[i]);
  }

  function grayscale(rgba, width, height) {
    if (!Number.isInteger(width) || !Number.isInteger(height) || width < 3 || height < 3 || width * height > 300000 || rgba.length !== width * height * 4) throw new Error('Invalid image dimensions.');
    const gray = new Uint8Array(width * height);
    for (let i = 0; i < gray.length; i++) {
      const a = rgba[i * 4 + 3] / 255;
      gray[i] = Math.round((0.2126 * rgba[i * 4] + 0.7152 * rgba[i * 4 + 1] + 0.0722 * rgba[i * 4 + 2]) * a + 255 * (1 - a));
    }
    return gray;
  }

  function contours(gray, width, height, sensitivity) {
    const rgba = new Uint8ClampedArray(width * height * 4), threshold = 90 + clamp(sensitivity, 1, 100) * 1.4;
    for (let i = 0; i < gray.length; i++) {
      const value = gray[i] < threshold ? 0 : 255;
      rgba[i * 4] = rgba[i * 4 + 1] = rgba[i * 4 + 2] = value; rgba[i * 4 + 3] = 255;
    }
    const traced = tracer.imagedataToTracedata({ width, height, data: rgba }, {
      pal: [{ r: 0, g: 0, b: 0, a: 255 }, { r: 255, g: 255, b: 255, a: 255 }],
      colorsampling: 0, numberofcolors: 2, pathomit: 6, ltres: 0.8, qtres: 0.8, rightangleenhance: true
    });
    return (traced.layers[0] || []).map(path => {
      const points = [];
      for (const s of path.segments) {
        if (!points.length) points.push([s.x1, s.y1]);
        if (s.type === 'L') points.push([s.x2, s.y2]);
        else {
          const length = Math.hypot(s.x2 - s.x1, s.y2 - s.y1) + Math.hypot(s.x3 - s.x2, s.y3 - s.y2);
          const steps = Math.max(2, Math.ceil(length / 1.5));
          for (let j = 1; j <= steps; j++) {
            const t = j / steps, u = 1 - t;
            points.push([u * u * s.x1 + 2 * u * t * s.x2 + t * t * s.x3, u * u * s.y1 + 2 * u * t * s.y2 + t * t * s.y3]);
          }
        }
      }
      return simplify(points, 0.3);
    }).filter(path => path.length >= 2);
  }

  function hatch(gray, w, h, density = 4) {
    const strokes = [], step = clamp(Math.round(density), 2, 10);
    for (let y = 0, row = 0; y < h; y += step, row++) {
      const paths = []; let start = -1;
      for (let x = 0; x <= w; x++) {
        const shade = x < w ? gray[y * w + x] : 255;
        const dark = shade < 80 || (shade < 155 && row % 2 === 0) || (shade < 210 && row % 4 === 0);
        if (dark && start < 0) start = x;
        if (!dark && start >= 0) { if (x - start >= 2) paths.push([[start, y], [x - 1, y]]); start = -1; }
      }
      if (row % 2) { paths.reverse(); for (const p of paths) p.reverse(); }
      strokes.push(...paths);
    }
    return strokes;
  }

  function order(strokes) {
    const remaining = strokes.slice(), output = []; let current = [0, 0];
    while (remaining.length) {
      let best = Infinity, index = 0, reverse = false;
      for (let i = 0; i < remaining.length; i++) {
        const first = distance(current, remaining[i][0]), last = distance(current, remaining[i].at(-1));
        if (first < best) { best = first; index = i; reverse = false; }
        if (last < best) { best = last; index = i; reverse = true; }
      }
      const [path] = remaining.splice(index, 1); const oriented = reverse ? path.slice().reverse() : path;
      output.push(oriented); current = oriented.at(-1);
    }
    return output;
  }

  function planImage(rgba, width, height, options = {}) {
    const gray = grayscale(rgba, width, height);
    const mode = options.mode === 'sketch' ? 'sketch' : 'outline';
    let paths = contours(gray, width, height, Number(options.sensitivity) || 65);
    if (mode === 'sketch') paths.push(...hatch(gray, width, height, Number(options.density) || 4));
    const truncated = paths.length > 4500;
    if (truncated) paths = paths.sort((a, b) => b.length - a.length).slice(0, 4500);
    paths = order(paths).map(path => path.map(([x, y]) => [clamp(x / width, 0, 1), clamp(y / height, 0, 1)]));
    return { version: 1, width, height, mode, paths, truncated };
  }

  function validatePlan(plan) {
    if (!plan || plan.version !== 1 || !Number.isInteger(plan.width) || !Number.isInteger(plan.height) || plan.width < 3 || plan.height < 3 || plan.width > 600 || plan.height > 600 || !Array.isArray(plan.paths) || !plan.paths.length || plan.paths.length > 4500) throw new Error('The drawing plan is empty or invalid.');
    let total = 0;
    for (const path of plan.paths) {
      if (!Array.isArray(path) || path.length < 2) throw new Error('Invalid drawing stroke.');
      total += path.length; if (total > 200000) throw new Error('The drawing is too complex. Reduce detail.');
      for (const p of path) if (!Array.isArray(p) || p.length !== 2 || p.some(n => typeof n !== 'number' || !Number.isFinite(n) || n < 0 || n > 1)) throw new Error('A drawing point is out of bounds.');
    }
    return true;
  }

  function fitRect(area, width, height) {
    if (!area || [area.x, area.y, area.width, area.height, width, height].some(n => typeof n !== 'number' || !Number.isFinite(n)) || area.width < 30 || area.height < 30 || width <= 0 || height <= 0) throw new Error('Choose a canvas at least 30 × 30 pixels.');
    const margin = 5, scale = Math.min((area.width - margin * 2) / width, (area.height - margin * 2) / height);
    return { x: area.x + (area.width - width * scale) / 2, y: area.y + (area.height - height * scale) / 2, width: width * scale, height: height * scale };
  }
  function project(plan, area) {
    validatePlan(plan); const rect = fitRect(area, plan.width, plan.height);
    return plan.paths.map(path => path.map(([x, y]) => [rect.x + x * rect.width, rect.y + y * rect.height]));
  }
  function estimate(plan, area, speed) {
    const paths = project(plan, area); speed = clamp(Number(speed) || 400, 100, 1600);
    let ms = paths.length * 85;
    for (const path of paths) for (let i = 1; i < path.length; i++) {
      const d = distance(path[i - 1], path[i]); ms += Math.max(d / speed * 1000, Math.ceil(d / 2) * 4);
    }
    return Math.ceil(ms / 1000);
  }
  return { planImage, validatePlan, project, fitRect, estimate, simplify, grayscale, contours, hatch, order };
});
