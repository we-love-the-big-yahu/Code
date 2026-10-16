importScripts('vendor/imagetracer.js', 'planner.js');
self.onmessage = event => {
  const { id, rgba, width, height, options } = event.data;
  try { self.postMessage({ id, plan: DrawingPlanner.planImage(new Uint8ClampedArray(rgba), width, height, options) }); }
  catch (error) { self.postMessage({ id, error: error.message }); }
};
