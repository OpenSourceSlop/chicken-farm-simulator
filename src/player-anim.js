// Procedural animation for the farmer rig: idle (breathing, weight shift, looking around),
// walk and run cycles blended by speed, lean into turns. The pelvis height is solved from the
// leg angles each frame so the supporting boot stays on the ground (that gives the body bob).
import { DIMS } from './player-model.js';

const TAU = Math.PI * 2;
const clamp = (v, a, b) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (e0, e1, x) => { const t = clamp((x - e0) / (e1 - e0), 0, 1); return t * t * (3 - 2 * t); };
const damp = (a, b, k, dt) => a + (b - a) * (1 - Math.exp(-k * dt));
const pos = (v) => (v > 0 ? v : 0);

const WALK_CYCLE = 2.5; // metres travelled per full stride (two steps) when walking
const RUN_CYCLE = 3.3;
const TOE_Z = -0.21, HEEL_Z = 0.09; // sole extent around the ankle (model units)

function legAngles(p, run, out) {
  const a = TAU * p;
  const s = Math.sin(a);
  const wh = 0.46 * s;
  const wk = -(0.07 + 0.95 * pos(Math.cos(a + 0.35)) ** 2);
  const rh = 0.78 * s + 0.12;
  const rk = -(0.32 + 1.5 * pos(Math.cos(a + 0.6)) ** 1.3);
  out.hip = lerp(wh, rh, run);
  out.knee = lerp(wk, rk, run);
  out.ankle = -(out.hip + out.knee) * lerp(0.8, 0.6, run) + lerp(0.16, 0.3, run) * s;
  return out;
}

// How far below the hip joint the lowest point of the boot sole hangs.
function legReach(l) {
  const f = l.hip + l.knee + l.ankle; // absolute foot pitch
  const cy = Math.cos(f), sy = Math.sin(f);
  const toe = -DIMS.ankle * cy - TOE_Z * sy;
  const heel = -DIMS.ankle * cy - HEEL_Z * sy;
  return DIMS.thigh * Math.cos(l.hip) + DIMS.shin * Math.cos(l.hip + l.knee) - Math.min(toe, heel);
}

export function createFarmerAnimator(model, rand = Math.random) {
  const j = model.joints;
  const restReach = DIMS.thigh + DIMS.shin + DIMS.ankle;
  const base = {};
  for (const [k, g] of Object.entries(j)) base[k] = g.position.clone();
  const st = {
    phase: 0, move: 0, run: 0, t: 0, roll: 0,
    look: 0, lookT: 0, pitch: 0, pitchT: 0, lookTimer: 2 + rand() * 2,
  };
  const L = { hip: 0, knee: 0, ankle: 0 };
  const R = { hip: 0, knee: 0, ankle: 0 };

  function idleLook(dt) {
    st.lookTimer -= dt;
    if (st.lookTimer <= 0) {
      if (st.lookT === 0 && st.pitchT === 0) {
        const r = rand();
        if (r < 0.35) { st.pitchT = -0.32; st.lookT = (rand() - 0.5) * 0.5; } // glance down at the floor
        else { st.lookT = (rand() < 0.5 ? -1 : 1) * (0.45 + rand() * 0.45); st.pitchT = -0.05; }
        st.lookTimer = 1.4 + rand() * 1.6;
      } else {
        st.lookT = 0; st.pitchT = 0;
        st.lookTimer = 3 + rand() * 4;
      }
    }
  }

  // speed: actual ground speed (m/s); turnRate: body yaw rate (rad/s).
  // Returns 'L' or 'R' on the frame a boot strikes the ground while moving, else null.
  function update(dt, speed, turnRate = 0) {
    st.t += dt;
    st.move = damp(st.move, smooth(0.05, 1.2, speed), 9, dt);
    st.run = damp(st.run, smooth(4.4, 6.1, speed), 6, dt);
    const m = st.move, run = st.run, idle = 1 - m;

    const prev = st.phase;
    if (speed > 0.01) st.phase = (st.phase + (dt * speed) / lerp(WALK_CYCLE, RUN_CYCLE, run)) % 1;
    let step = null;
    if (m > 0.4 && dt > 0) {
      const crossed = (q) => (prev < q && st.phase >= q) || (prev > st.phase && (prev < q || st.phase >= q));
      if (crossed(0.25)) step = 'L';
      else if (crossed(0.75)) step = 'R';
    }

    // Legs
    legAngles(st.phase, run, L);
    legAngles(st.phase + 0.5, run, R);
    for (const l of [L, R]) { l.hip *= m; l.knee = l.knee * m - 0.03 * idle; l.ankle = l.ankle * m + 0.03 * idle; }
    j.hipL.rotation.set(L.hip, 0, -0.035);
    j.kneeL.rotation.x = L.knee;
    j.ankleL.rotation.set(L.ankle, 0, 0.035);
    j.hipR.rotation.set(R.hip, 0, 0.035);
    j.kneeR.rotation.x = R.knee;
    j.ankleR.rotation.set(R.ankle, 0, -0.035);

    // Pelvis height: the longer leg touches the ground; running adds a flight phase.
    const reach = Math.max(legReach(L), legReach(R));
    const a = TAU * st.phase;
    const flight = run * m * 0.055 * pos(Math.sin(2 * a - 0.9));
    const breath = Math.sin((TAU * st.t) / 3.6);
    const sway = Math.sin((TAU * st.t) / 7.5);
    j.pelvis.position.set(
      base.pelvis.x + 0.012 * sway * idle,
      base.pelvis.y - (restReach - reach) + flight,
      base.pelvis.z,
    );
    j.pelvis.rotation.set(
      -0.06 * run * m,
      -0.09 * Math.sin(a) * m * (1 - 0.4 * run),
      0.035 * Math.cos(a) * m * (1 - 0.5 * run) + 0.015 * sway * idle,
    );

    // Torso: lean forward when running, counter-twist against the hips, breathe when idle
    j.spine.rotation.set(
      -(0.035 + 0.2 * run) * m + 0.018 * breath * idle - 0.02 * m * Math.abs(Math.cos(a)),
      0.17 * Math.sin(a) * m,
      -j.pelvis.rotation.z * 1.1,
    );
    const lift = 0.006 * breath * idle;
    j.shoulderL.position.set(base.shoulderL.x, base.shoulderL.y + lift, base.shoulderL.z);
    j.shoulderR.position.set(base.shoulderR.x, base.shoulderR.y + lift, base.shoulderR.z);

    // Arms swing opposite to the legs; elbows bend more when running
    const armAmp = lerp(0.42, 0.8, run) * m;
    const armL = -Math.sin(a) * armAmp + 0.05 * run * m;
    const armR = Math.sin(a) * armAmp + 0.05 * run * m;
    const out = 0.07 + 0.06 * run * m + 0.01 * breath * idle;
    j.shoulderL.rotation.set(armL, 0, -out);
    j.shoulderR.rotation.set(armR, 0, out);
    const elBase = lerp(0.18, 1.35, run) * m + 0.12 * idle;
    j.elbowL.rotation.x = elBase + lerp(0.35, 0.2, run) * pos(armL / Math.max(armAmp, 0.01)) * m;
    j.elbowR.rotation.x = elBase + lerp(0.35, 0.2, run) * pos(armR / Math.max(armAmp, 0.01)) * m;

    // Head: steady while walking (counter the torso twist), look around when idle
    idleLook(dt);
    st.look = damp(st.look, st.lookT * idle, 3.2, dt);
    st.pitch = damp(st.pitch, st.pitchT * idle, 3.2, dt);
    j.neck.rotation.set(
      st.pitch + 0.12 * run * m + 0.01 * breath * idle,
      st.look - (j.pelvis.rotation.y + j.spine.rotation.y),
      -j.spine.rotation.z * 0.5,
    );

    // Lean into turns (pivot at the feet)
    const rollT = clamp(turnRate * speed * 0.03, -0.2, 0.2);
    st.roll = damp(st.roll, rollT, 8, dt);
    model.rig.rotation.z = st.roll;
    return step;
  }

  return { update, state: st };
}
