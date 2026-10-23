import test from 'node:test';
import assert from 'node:assert/strict';
import { selectRandomPuzzleSeed } from '../src/router.js';

test('génère une graine aléatoire sans répéter la graine courante', () => {
  const originalRandom = Math.random;
  try {
    Math.random = () => 0;
    assert.equal(selectRandomPuzzleSeed(), 1);
    assert.equal(selectRandomPuzzleSeed(1), 2);

    Math.random = () => 0.999999;
    const randomSeed = Math.floor(0.999999 * 0xffffffff) + 1;
    assert.equal(selectRandomPuzzleSeed(randomSeed), randomSeed + 1);
  } finally {
    Math.random = originalRandom;
  }
});

test('les graines aléatoires restent dans la plage 32 bits non signée', () => {
  const originalRandom = Math.random;
  try {
    for (const randomValue of [0, 0.25, 0.5, 0.75, 0.999999]) {
      Math.random = () => randomValue;
      const seed = selectRandomPuzzleSeed();
      assert.ok(Number.isInteger(seed));
      assert.ok(seed >= 1 && seed <= 0xffffffff);
    }
  } finally {
    Math.random = originalRandom;
  }
});
