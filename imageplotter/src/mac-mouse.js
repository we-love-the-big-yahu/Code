'use strict';
// Only normal macOS mouse events are used. No game process access or injection.
class MacMouse {
  constructor() {
    if (process.platform !== 'darwin') throw new Error('Mouse drawing requires macOS.');
    const koffi = require('koffi');
    const graphics = koffi.load('/System/Library/Frameworks/CoreGraphics.framework/CoreGraphics');
    const services = koffi.load('/System/Library/Frameworks/ApplicationServices.framework/ApplicationServices');
    const foundation = koffi.load('/System/Library/Frameworks/CoreFoundation.framework/CoreFoundation');
    const Point = koffi.struct('ImagePlotterPoint', { x: 'double', y: 'double' });
    this.create = graphics.func('CGEventCreateMouseEvent', 'void *', ['void *', 'uint32_t', Point, 'uint32_t']);
    this.post = graphics.func('CGEventPost', 'void', ['uint32_t', 'void *']);
    this.release = foundation.func('CFRelease', 'void', ['void *']);
    this.event = graphics.func('CGEventCreate', 'void *', ['void *']);
    this.location = graphics.func('CGEventGetLocation', Point, ['void *']);
    this.trusted = services.func('AXIsProcessTrusted', 'bool', []);
    this.pressure = graphics.func('CGEventSetDoubleValueField', 'void', ['void *', 'uint32_t', 'double']);
    const objc = koffi.load('/usr/lib/libobjc.A.dylib');
    const getClass = objc.func('objc_getClass', 'void *', ['str']);
    const selector = objc.func('sel_registerName', 'void *', ['str']);
    this.sendObject = objc.func('objc_msgSend', 'void *', ['void *', 'void *']);
    this.sendPid = objc.func('objc_msgSend', 'int32_t', ['void *', 'void *']);
    this.workspace = this.sendObject(getClass('NSWorkspace'), selector('sharedWorkspace'));
    this.frontSelector = selector('frontmostApplication'); this.pidSelector = selector('processIdentifier');
    this.ownPid = process.pid;
    this.last = null;
  }
  hasPermission() { return this.trusted(); }
  frontmostPid() {
    const application = this.sendObject(this.workspace, this.frontSelector);
    return application ? this.sendPid(application, this.pidSelector) : 0;
  }
  position() {
    const event = this.event(null); if (!event) throw new Error('Cannot read the mouse position.');
    try { return this.location(event); } finally { this.release(event); }
  }
  send(type, x, y) {
    if (!Number.isFinite(x) || !Number.isFinite(y)) throw new Error('Invalid mouse coordinates.');
    const event = this.create(null, type, { x, y }, 0);
    if (!event) throw new Error('Cannot create a macOS mouse event.');
    try { if (type === 1 || type === 6) this.pressure(event, 2, 1); this.post(0, event); this.last = { x, y }; }
    finally { this.release(event); }
  }
  move(x, y) { this.send(5, x, y); }
  down(x, y) { this.send(1, x, y); }
  drag(x, y) { this.send(6, x, y); }
  up() { const p = this.last || this.position(); this.send(2, p.x, p.y); }
}
module.exports = { MacMouse };
