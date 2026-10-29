import test from 'node:test';
import assert from 'node:assert/strict';
import {
  countQueensSolutions,
  createQueensPuzzle,
  findLogicalQueensHint,
  validateQueens,
} from '../src/games/queens.js';
import { QUEENS_REGION_COLORS } from '../src/games/queens-colors.js';

test('génère une grille reproductible à solution unique pour chaque graine', () => {
  for (const seed of [1, 2, 17, 128, 500, 1000, 0xffffffff]) {
    const puzzle = createQueensPuzzle(seed);

    assert.equal(puzzle.level, seed);
    assert.equal(
      puzzle.size,
      { facile: 8, moyen: 9, difficile: 10 }[puzzle.difficulty],
    );
    assert.equal(puzzle.regions.length, puzzle.size);
    assert.ok(puzzle.regions.every((row) => row.length === puzzle.size));
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
    () => validateQueens(puzzle, [{ row: puzzle.size, col: 0 }]),
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
  const expectedSizes = { facile: 8, moyen: 9, difficile: 10 };
  for (const difficulty of Object.keys(expectedSizes)) {
    const puzzle = createQueensPuzzle(123, difficulty);
    assert.equal(puzzle.difficulty, difficulty);
    assert.equal(puzzle.size, expectedSizes[difficulty]);
    assert.equal(countQueensSolutions(puzzle), 1);
  }
});

test('attribue une couleur distincte à chaque région jusqu’à la grille 10x10', () => {
  assert.equal(QUEENS_REGION_COLORS.length, 10);
  assert.equal(new Set(QUEENS_REGION_COLORS).size, QUEENS_REGION_COLORS.length);

  for (const size of [8, 9, 10]) {
    assert.equal(new Set(QUEENS_REGION_COLORS.slice(0, size)).size, size);
  }
});

test('limite à une seule région d’une case dans les grilles difficiles', () => {
  for (const seed of [1, 42, 123, 500, 1000]) {
    const puzzle = createQueensPuzzle(seed, 'difficile');
    const regionCounts = new Map();

    for (const row of puzzle.regions) {
      for (const region of row) {
        regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
      }
    }

    assert.ok(
      [...regionCounts.values()].filter((count) => count === 1).length <= 1,
    );
  }
});

test('chaque région Queens est contiguë horizontalement ou verticalement', () => {
  for (const difficulty of ['facile', 'moyen', 'difficile']) {
    for (const seed of [1, 2, 17, 42, 123, 500, 1000, 0xffffffff]) {
      const puzzle = createQueensPuzzle(seed, difficulty);
      const cellsByRegion = new Map();
      for (let row = 0; row < puzzle.size; row += 1) {
        for (let col = 0; col < puzzle.size; col += 1) {
          const region = puzzle.regions[row][col];
          if (!cellsByRegion.has(region)) cellsByRegion.set(region, []);
          cellsByRegion.get(region).push({ row, col });
        }
      }

      for (const [region, cells] of cellsByRegion) {
        const visited = new Set([`${cells[0].row},${cells[0].col}`]);
        const pending = [cells[0]];
        while (pending.length > 0) {
          const { row, col } = pending.pop();
          for (const [rowDelta, colDelta] of [
            [-1, 0],
            [1, 0],
            [0, -1],
            [0, 1],
          ]) {
            const neighborRow = row + rowDelta;
            const neighborCol = col + colDelta;
            const key = `${neighborRow},${neighborCol}`;
            if (
              neighborRow >= 0 &&
              neighborRow < puzzle.size &&
              neighborCol >= 0 &&
              neighborCol < puzzle.size &&
              puzzle.regions[neighborRow][neighborCol] === region &&
              !visited.has(key)
            ) {
              visited.add(key);
              pending.push({ row: neighborRow, col: neighborCol });
            }
          }
        }
        assert.equal(visited.size, cells.length, `Région ${region} non contiguë`);
      }
    }
  }
});

test('déduit les croix uniquement à partir des contraintes visibles de la grille', () => {
  const puzzle = createQueensPuzzle(42);
  const cross = findLogicalQueensHint(puzzle);

  assert.ok(cross);
  assert.match(cross.explanation, /Il ne reste qu’une seule case possible/);
  assert.match(cross.explanation, /région colorée/);
});

test('déduit une croix d’une reine déjà posée et explique la règle visible', () => {
  const puzzle = createQueensPuzzle(42);
  const queen = { row: 0, col: 0 };
  const cross = findLogicalQueensHint(puzzle, {
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
  const cross = findLogicalQueensHint(puzzle, { excluded });

  assert.ok(cross);
  assert.equal(cross.row, 1);
  assert.equal(cross.col, 0);
  assert.match(cross.explanation, /Il ne reste qu’une seule case possible/);
  assert.match(cross.explanation, /touche la reine/);
});

test('ne déduit pas de croix à partir de la solution cachée', () => {
  const puzzle = createQueensPuzzle(500);
  const excluded = [];
  const placements = [];
  let hint;

  while (
    (hint = findLogicalQueensHint(puzzle, {
      placements,
      excluded,
    }))
  ) {
    assert.equal(hint.solverDerived, undefined);
    const alreadyPlaced = placements.some(
      ({ row, col }) => row === hint.row && col === hint.col,
    );
    assert.equal(alreadyPlaced, false);
    assert.ok(
      !excluded.some(({ row, col }) => row === hint.row && col === hint.col),
      'Un indice ne doit pas répéter une croix déjà visible.',
    );
    if (hint.placeQueen) {
      placements.push({ row: hint.row, col: hint.col });
    } else {
      excluded.push({ row: hint.row, col: hint.col });
    }
  }

  assert.equal(excluded.length + placements.length, puzzle.size ** 2);
  assert.equal(countQueensSolutions(puzzle, { placements, excluded }), 1);
  assert.equal(
    findLogicalQueensHint(puzzle, { placements, excluded }),
    null,
  );
});
