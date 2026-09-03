const MASK_64 = (1n << 64n) - 1n;
const GOLDEN_GAMMA = 0x9e3779b97f4a7c15n;
const rotateLeft = (value, shift) => ((value << shift) | (value >> (64n - shift))) & MASK_64;

function seedToUint64(seed) {
  if (typeof seed === 'bigint') return seed & MASK_64;
  if (typeof seed === 'number' && Number.isFinite(seed)) return BigInt(Math.trunc(seed)) & MASK_64;
  let hash = 0xcbf29ce484222325n;
  for (const character of String(seed ?? '0')) { hash ^= BigInt(character.codePointAt(0)); hash = (hash * 0x100000001b3n) & MASK_64; }
  return hash;
}
function splitMixStep(state) {
  const nextState = (state + GOLDEN_GAMMA) & MASK_64;
  let value = nextState;
  value = ((value ^ (value >> 30n)) * 0xbf58476d1ce4e5b9n) & MASK_64;
  value = ((value ^ (value >> 27n)) * 0x94d049bb133111ebn) & MASK_64;
  return { state: nextState, value: (value ^ (value >> 31n)) & MASK_64 };
}

/** Stable BigInt SplitMix64-seeded Xoshiro256**; callable form returns [0, 1). */
export function createPrng(seed = 0) {
  const initial = seedToUint64(seed); let splitMixState = initial; let initializationState = initial;
  const initialize = () => { const step = splitMixStep(initializationState); initializationState = step.state; return step.value; };
  const state = [initialize(), initialize(), initialize(), initialize()];
  const nextSplitMix64 = () => { const step = splitMixStep(splitMixState); splitMixState = step.state; return step.value; };
  const nextUint64 = () => {
    const result = (rotateLeft((state[1] * 5n) & MASK_64, 7n) * 9n) & MASK_64; const temporary = (state[1] << 17n) & MASK_64;
    state[2] ^= state[0]; state[3] ^= state[1]; state[1] ^= state[2]; state[0] ^= state[3]; state[2] ^= temporary; state[3] = rotateLeft(state[3], 45n);
    return result;
  };
  const random = () => Number(nextUint64() >> 11n) / 9007199254740992;
  const prng = () => random();
  prng.nextSplitMix64 = nextSplitMix64; prng.nextUint64 = nextUint64; prng.random = random;
  prng.int = maximum => { if (!Number.isSafeInteger(maximum) || maximum <= 0) throw new RangeError('maximum must be a positive safe integer'); return Number(nextUint64() % BigInt(maximum)); };
  prng.pick = values => { if (!Array.isArray(values) || values.length === 0) throw new RangeError('cannot pick from an empty list'); return values[prng.int(values.length)]; };
  prng.bool = probability => random() < probability;
  return Object.freeze(prng);
}
