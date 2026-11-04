// The fake Web Audio context for the node tests (scripts/test-audio.mjs, scripts/test-audio-hour.mjs). It lives in
// src/audio-fake.js since Phase 5, so the browser's audio.debug.hour(script) runs the same long-session counter.
export { FakeAudioContext } from '../src/audio-fake.js';
