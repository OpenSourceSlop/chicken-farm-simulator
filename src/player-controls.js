// The camera's input rates and the Camera settings (PHASE5.md §4.5): turn and zoom speed multiply the drag / arrow-key turn
// and the wheel / + − zoom; the inverts flip the drag and the wheel. No DOM and no three.js here (scripts/test-settings.mjs
// checks the numbers in node). Owner: package "settings".
//
//   const cc = createCameraControls(settings)   follows settings 'camera.*' live (subscribe), defaults without settings
//   cc.orbit(px)        yaw change (rad) of a horizontal drag of px pixels (positive px = a drag to the right)
//   cc.keyTurn(axis, dt) yaw change of the arrow keys held for dt seconds (axis +1 = left, -1 = right)
//   cc.wheel(delta)     the zoom factor of a wheel delta (pixels): distance × factor
//   cc.keyZoom(axis, dt) the zoom factor of + / − held for dt seconds (axis +1 = out, -1 = in)
//   cc.values           { rotateSpeed, zoomSpeed, invertRotate, invertZoom } now
export const ORBIT_PER_PX = 0.0055; // rad per dragged pixel
export const KEY_TURN = 1.7;        // rad/s with the arrow keys
export const KEY_ZOOM = 1.3;        // zoom speed with + and - (log units per second)
export const WHEEL_ZOOM = 0.0015;   // per wheel pixel (a notch of 100 = 16 %)

const CAMERA_DEFAULTS = { rotateSpeed: 1, zoomSpeed: 1, invertRotate: false, invertZoom: false };

export function createCameraControls(settings = null) {
  const v = { ...CAMERA_DEFAULTS };
  const read = () => {
    for (const k of Object.keys(CAMERA_DEFAULTS)) {
      try { const x = settings?.get?.(`camera.${k}`); if (x != null) v[k] = x; } catch { /* the default */ }
    }
  };
  read();
  const off = settings?.subscribe?.(read, 'camera') || (() => {});
  return {
    get values() { return { ...v }; },
    // a drag to the right turns the view clockwise (the farmer's yaw falls), as since Phase 1
    orbit: (px) => -px * ORBIT_PER_PX * v.rotateSpeed * (v.invertRotate ? -1 : 1),
    keyTurn: (axis, dt) => axis * KEY_TURN * v.rotateSpeed * dt,
    wheel: (delta) => Math.exp(delta * WHEEL_ZOOM * v.zoomSpeed * (v.invertZoom ? -1 : 1)),
    keyZoom: (axis, dt) => Math.exp(axis * KEY_ZOOM * v.zoomSpeed * dt),
    dispose: off,
  };
}
