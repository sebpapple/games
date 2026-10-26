import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countTangoSolutions,
  createTangoPuzzle,
  findLogicalTangoHint,
  validateTango,
} from '../src/games/tango.js';

test('génère un puzzle Tango déterministe avec une solution unique', () => {
  for (const seed of [1, 2, 42, 995819834, 0xffffffff]) {
    const puzzle = createTangoPuzzle(seed);
    assert.deepEqual(puzzle, createTangoPuzzle(seed));
    assert.equal(puzzle.size, 6);
    assert.equal(countTangoSolutions(puzzle), 1);
    assert.equal(validateTango(puzzle, puzzle.solution).won, true);
    assert.equal(puzzle.solution.length, puzzle.size);
    assert.ok(puzzle.solution.every((row) => row.length === puzzle.size));
    assert.ok(puzzle.givens.flat().filter(Boolean).length >= 7);
  }
});

test('génère les difficultés demandées avec les relations correspondantes', () => {
  for (const difficulty of ['facile', 'moyen', 'difficile']) {
    const puzzle = createTangoPuzzle(42, difficulty);
    assert.equal(puzzle.difficulty, difficulty);
    assert.equal(puzzle.relations.length, {
      facile: 2,
      moyen: 3,
      difficile: 4,
    }[difficulty]);
    assert.equal(puzzle.size, 6);
    assert.equal(countTangoSolutions(puzzle), 1);
    assert.equal(validateTango(puzzle, puzzle.solution).won, true);
    if (difficulty === 'difficile') {
      assert.ok(
        puzzle.givens.flat().filter(Boolean).length <= 18,
        'Le niveau difficile doit afficher peu de cases préremplies.',
      );
    }
  }
  assert.throws(() => createTangoPuzzle(0), RangeError);
  assert.throws(() => createTangoPuzzle(1, 'expert'), RangeError);
});

test('déduit un indice Tango uniquement depuis les indices et placements visibles', () => {
  const puzzle = {
    game: 'tango',
    size: 6,
    givens: Array.from({ length: 6 }, () => Array(6).fill(null)),
    relations: [],
  };
  const grid = Array.from({ length: 6 }, () => Array(6).fill(null));
  grid[0][0] = 'sun';
  grid[0][1] = 'sun';
  const hint = findLogicalTangoHint(puzzle, grid);

  assert.ok(hint);
  assert.deepEqual({ row: hint.row, col: hint.col }, { row: 0, col: 2 });
  assert.equal(hint.value, 'moon');
  assert.equal(hint.impossible, 'sun');
  assert.match(hint.explanation, /trois soleils consécutifs/);
});

test('ne produit pas de coup forcé si les placements visibles contredisent le puzzle', () => {
  const puzzle = createTangoPuzzle(17, 'facile');
  const grid = puzzle.solution.map((row) => [...row]);
  const editableCell = puzzle.givens.findIndex((row) =>
    row.some((value) => value === null),
  );
  const col = puzzle.givens[editableCell].findIndex((value) => value === null);
  grid[editableCell][col] =
    puzzle.solution[editableCell][col] === 'sun' ? 'moon' : 'sun';

  assert.equal(findLogicalTangoHint(puzzle, grid), null);
});

test('signale les triples, les déséquilibres et les relations violées', () => {
  const puzzle = {
    game: 'tango',
    size: 4,
    givens: Array.from({ length: 4 }, () => Array(4).fill(null)),
    relations: [{ row: 0, col: 0, direction: 'right', type: 'equal' }],
  };
  const grid = [
    ['sun', 'moon', 'sun', 'moon'],
    ['sun', 'sun', 'sun', 'moon'],
    ['moon', 'moon', 'sun', 'moon'],
    ['moon', 'sun', 'moon', 'sun'],
  ];
  const result = validateTango(puzzle, grid);
  assert.equal(result.valid, false);
  assert.equal(result.won, false);
  assert.ok(result.conflicts.length >= 4);
});

test('accepte les placements partiels valides et refuse les symboles invalides', () => {
  const puzzle = createTangoPuzzle(17);
  const grid = puzzle.givens.map((row) => [...row]);
  const result = validateTango(puzzle, grid);
  assert.equal(result.valid, true);
  assert.equal(result.complete, false);
  assert.throws(
    () => validateTango(puzzle, [['other']]),
    TypeError,
  );
});
