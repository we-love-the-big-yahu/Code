'use strict';
const { EventEmitter } = require('node:events');
const { project, estimate } = require('./planner');
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));
class DrawingEngine extends EventEmitter {
  constructor(mouse, clock = {}) {
    super(); this.mouse = mouse; this.wait = clock.wait || wait;
    this.running = false; this.cancelled = false; this.down = false; this.targetPid = null;
  }
  stop() {
    this.cancelled = true;
    if (this.down) {
      try { this.mouse.up(); this.down = false; }
      catch { this.emit('progress', { phase: 'error', message: 'Mouse release failed. Click and release the physical mouse button.' }); }
    }
  }
  check() {
    if (this.cancelled) throw new Error('Drawing stopped.');
    if (this.targetPid !== null && this.mouse.frontmostPid() !== this.targetPid) { this.stop(); throw new Error('Stopped because the active application changed.'); }
    const p = this.mouse.position();
    if (p.x >= 0 && p.x <= 3 && p.y >= 0 && p.y <= 3) { this.stop(); throw new Error('Stopped at the top-left corner.'); }
  }
  async pause(ms) {
    for (let left = ms; left > 0; left -= 20) { this.check(); await this.wait(Math.min(20, left)); }
  }
  async run(plan, area, settings = {}) {
    if (this.running) throw new Error('A drawing is already running.');
    const paths = project(plan, area), speed = Math.max(100, Math.min(1600, Number(settings.speed) || 400));
    const countdown = Math.max(3, Math.min(10, Number(settings.countdown) || 5));
    this.running = true; this.cancelled = false; this.targetPid = null;
    let completed = 0;
    try {
      for (let second = countdown; second > 0; second--) {
        this.emit('progress', { phase: 'countdown', seconds: second, total: paths.length, completed: 0 });
        await this.pause(1000);
      }
      if (this.mouse.frontmostPid) {
        this.targetPid = this.mouse.frontmostPid();
        if (!this.targetPid || this.targetPid === this.mouse.ownPid) throw new Error('Focus the target drawing app during the countdown, then try again.');
      }
      for (const path of paths) {
        this.check(); this.mouse.move(...path[0]); await this.pause(25);
        this.check(); this.down = true; this.mouse.down(...path[0]); await this.pause(20);
        for (let i = 1; i < path.length; i++) {
          const a = path[i - 1], b = path[i], d = Math.hypot(b[0] - a[0], b[1] - a[1]);
          const steps = Math.max(1, Math.ceil(d / 2)), delay = Math.max(4, d / speed * 1000 / steps);
          for (let j = 1; j <= steps; j++) {
            this.check(); this.mouse.drag(a[0] + (b[0] - a[0]) * j / steps, a[1] + (b[1] - a[1]) * j / steps);
            await this.pause(delay);
          }
        }
        this.mouse.up(); this.down = false; await this.pause(40); completed++;
        this.emit('progress', { phase: 'drawing', total: paths.length, completed });
      }
      return { completed, total: paths.length, stopped: false };
    } catch (error) {
      if (this.cancelled) return { completed, total: paths.length, stopped: true, message: error.message };
      throw error;
    } finally {
      try { if (this.down) this.mouse.up(); } finally { this.down = false; this.running = false; }
    }
  }
}
module.exports = { DrawingEngine, estimate };
