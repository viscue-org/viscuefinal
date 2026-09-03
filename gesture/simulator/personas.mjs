import { createPrng } from './prng.mjs';

const DEVICES = ['mouse', 'touch', 'stylus'];
const VIEWPORTS = [{ width: 1280, height: 720 }, { width: 1440, height: 900 }, { width: 1920, height: 1080 }, { width: 2560, height: 1440 }];
const DENSITIES = ['sparse', 'balanced', 'dense'];
const seedIndex = seed => typeof seed === 'number' && Number.isFinite(seed) ? Math.abs(Math.trunc(seed)) : typeof seed === 'bigint' ? Number((seed < 0n ? -seed : seed) % 9007199254740991n) : Array.from(String(seed ?? '')).reduce((total, character) => total + character.codePointAt(0), 0);
const rounded = value => Number(value.toFixed(8));

export function generatePersona(personaSeed) {
  const prng = createPrng(`persona:${String(personaSeed)}`); const index = seedIndex(personaSeed); const viewport = VIEWPORTS[prng.int(VIEWPORTS.length)];
  const identity = `${prng.nextUint64().toString(16).padStart(16, '0')}${prng.nextUint64().toString(16).padStart(16, '0')}`;
  return Object.freeze({
    persona_id: `persona_${identity}`, device: DEVICES[index % DEVICES.length], skill: rounded(0.2 + prng() * 0.78), velocity: rounded(0.35 + prng() * 1.4), jitter: rounded(0.002 + prng() * 0.07),
    hesitation: rounded(prng() * 0.35), correction: rounded(prng() * 0.18), overshoot: rounded(prng() * 0.16), handedness: prng() < 0.12 ? 'left' : 'right', viewport: Object.freeze({ ...viewport }), zoom: rounded(0.75 + prng() * 0.75), density_preference: DENSITIES[prng.int(DENSITIES.length)],
  });
}
