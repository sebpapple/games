import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countQueensSolutions,
  createQueensPuzzle,
  findLogicalQueensCross,
  validateQueens,
} from '../src/games/queens.js';

test('génère une grille reproductible à solution unique pour chaque graine', () => {
  for (const seed of [1, 2, 17, 128, 500, 1000, 0xffffffff]) {
    const puzzle = createQueensPuzzle(seed);

    assert.equal(puzzle.level, seed);
    assert.equal(puzzle.regions.length, 8);
    assert.ok(puzzle.regions.every((row) => row.length === 8));
    assert.ok(['facile', 'moyen', 'difficile'].includes(puzzle.difficulty));
    assert.equal(countQueensSolutions(puzzle), 1);
    assert.equal('solution' in puzzle, false);
  }
});

test('refuse les graines hors plage et les placements hors grille', () => {
  assert.throws(() => createQueensPuzzle(0), RangeError);
  assert.throws(() => createQueensPuzzle(0x100000000), RangeError);

  const puzzle = createQueensPuzzle(1);
  assert.throws(
    () => validateQueens(puzzle, [{ row: 8, col: 0 }]),
    RangeError,
  );
});

test('signale les reines en conflit sans déclarer la grille gagnée', () => {
  const puzzle = createQueensPuzzle(1);
  const result = validateQueens(puzzle, [
    { row: 0, col: 0 },
    { row: 1, col: 1 },
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.complete, false);
  assert.equal(result.won, false);
  assert.equal(result.conflicts.length, 2);
});

test('les contraintes impossibles ne laissent aucune solution', () => {
  const puzzle = createQueensPuzzle(42);
  assert.equal(
    countQueensSolutions(puzzle, {
      placements: [
        { row: 0, col: 0 },
        { row: 0, col: 1 },
      ],
    }),
    0,
  );
});

test('génère un défi correspondant à la difficulté demandée', () => {
  for (const difficulty of ['facile', 'moyen', 'difficile']) {
    const puzzle = createQueensPuzzle(123, difficulty);
    assert.equal(puzzle.difficulty, difficulty);
    assert.equal(countQueensSolutions(puzzle), 1);
  }
});

test('déduit les croix uniquement à partir des contraintes visibles de la grille', () => {
  const puzzle = createQueensPuzzle(42);
  const cross = findLogicalQueensCross(puzzle);

  assert.ok(cross);
  assert.match(cross.explanation, /Il ne reste qu’une seule case possible/);
  assert.match(cross.explanation, /région colorée/);
});

test('déduit une croix d’une reine déjà posée et explique la règle visible', () => {
  const puzzle = createQueensPuzzle(42);
  const queen = { row: 0, col: 0 };
  const cross = findLogicalQueensCross(puzzle, {
    placements: [queen],
  });

  assert.ok(cross);
  assert.equal(cross.row, queen.row);
  assert.notEqual(cross.col, queen.col);
  assert.match(cross.explanation, /cette case se trouve sur la ligne 1 de la reine/);
});

test('déduit une croix quand les marques ne laissent qu’une position de reine', () => {
  const puzzle = {
    game: 'queens',
    size: 4,
    regions: Array.from({ length: 4 }, () => [0, 1, 2, 3]),
  };
  const remaining = 1;
  const excluded = Array.from({ length: puzzle.size }, (_, col) => col)
    .filter((col) => col !== remaining)
    .map((col) => ({ row: 0, col }));
  const cross = findLogicalQueensCross(puzzle, { excluded });

  assert.ok(cross);
  assert.equal(cross.row, 1);
  assert.equal(cross.col, 0);
  assert.match(cross.explanation, /Il ne reste qu’une seule case possible/);
  assert.match(cross.explanation, /touche la reine/);
});
