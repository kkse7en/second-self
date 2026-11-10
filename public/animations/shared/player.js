// One complete drawing and hold take about 1.3s, excluding asset initialization.
const PLAYBACK_RATE = 8;
let previousFrame = null, completedCycle = false;
function notify(type) { parent.postMessage({ channel: 'second-self:painting', type }, '*'); }
window.addEventListener('error', () => notify('error'), true);
window.addEventListener('unhandledrejection', () => notify('error'));
document.addEventListener('visibilitychange', () => { previousFrame = null; });
function setup() {
  engine.setup();
  document.querySelector('canvas')?.addEventListener('webglcontextlost', () => notify('error'));
}
function draw() {
  const now = performance.now();
  const delta = !document.hidden && previousFrame !== null ? Math.min(now - previousFrame, 100) * PLAYBACK_RATE : 0;
  previousFrame = document.hidden ? null : now;
  if (engine.draw(delta) && !completedCycle) { completedCycle = true; notify('cycle-complete'); }
}
