import test from 'node:test';
import assert from 'node:assert/strict';
import { createZipPuzzle, validateZip } from '../src/games/zip.js';

test('génère un parcours ZIP déterministe qui remplit toute la grille', () => {
  for (const seed of [1, 2, 17, 128, 500, 1000, 0xffffffff]) {
    const puzzle = createZipPuzzle(seed);
    const repeated = createZipPuzzle(seed);

    assert.deepEqual(puzzle, repeated);
    assert.equal(puzzle.size, 6);
    assert.equal(puzzle.pathColors.length, 2);
    assert.match(puzzle.pathColors[0], /^#[\da-f]{6}$/i);
    assert.match(puzzle.pathColors[1], /^#[\da-f]{6}$/i);
    assert.notEqual(puzzle.pathColors[0], puzzle.pathColors[1]);
    assert.ok(['facile', 'moyen', 'difficile'].includes(puzzle.difficulty));
    assert.ok(puzzle.checkpoints.length <= 10);
    assert.equal(puzzle.solution.length, puzzle.size ** 2);
    assert.equal(
      new Set(puzzle.solution.map(({ row, col }) => `${row},${col}`)).size,
      puzzle.size ** 2,
    );
    assert.equal(puzzle.checkpoints[0].pathIndex, 0);
    assert.equal(puzzle.checkpoints.at(-1).pathIndex, puzzle.size ** 2 - 1);
    assert.equal(puzzle.checkpoints.at(-1).number, puzzle.checkpoints.length);
    assert.deepEqual(
      { row: puzzle.checkpoints.at(-1).row, col: puzzle.checkpoints.at(-1).col },
      puzzle.solution.at(-1),
    );
    assert.equal(validateZip(puzzle, [puzzle.checkpoints[0]]).valid, true);
    const solutionEdges = new Set(
      puzzle.solution.slice(1).map((cell, index) => {
        const previous = puzzle.solution[index];
        const from = previous.row * puzzle.size + previous.col;
        const to = cell.row * puzzle.size + cell.col;
        return `${Math.min(from, to)}:${Math.max(from, to)}`;
      }),
    );
    for (const wall of puzzle.walls) {
      const from = wall.row * puzzle.size + wall.col;
      const to = wall.direction === 'right' ? from + 1 : from + puzzle.size;
      assert.equal(
        solutionEdges.has(`${Math.min(from, to)}:${Math.max(from, to)}`),
        false,
        'Un mur ne doit jamais bloquer le parcours gagnant.',
      );
    }
    const completed = validateZip(puzzle, puzzle.solution);
    assert.equal(completed.won, true);
    assert.deepEqual(
      puzzle.solution.at(-1),
      { row: puzzle.checkpoints.at(-1).row, col: puzzle.checkpoints.at(-1).col },
    );
  }
});

test('génère chaque difficulté demandée avec le nœud le plus élevé à la fin', () => {
  const expectedCheckpointCounts = {
    facile: 10,
    moyen: 9,
    difficile: 7,
  };

  for (const [difficulty, checkpointCount] of Object.entries(expectedCheckpointCounts)) {
    const puzzle = createZipPuzzle(42, difficulty);
    assert.equal(puzzle.difficulty, difficulty);
    assert.equal(puzzle.checkpoints.length, checkpointCount);
    assert.equal(puzzle.checkpoints.at(-1).number, checkpointCount);
    assert.equal(
      puzzle.checkpoints.at(-1).pathIndex,
      puzzle.solution.length - 1,
    );
    assert.equal(validateZip(puzzle, puzzle.solution).won, true);
  }
  assert.throws(() => createZipPuzzle(1, 'expert'), RangeError);
});

test('génère et respecte les murs ZIP sans bloquer la solution', () => {
  const difficult = createZipPuzzle(42, 'difficile');
  assert.equal(difficult.walls.length, 9);
  assert.equal(validateZip(difficult, difficult.solution).won, true);

  const blockedPuzzle = {
    game: 'zip',
    size: 2,
    checkpoints: [
      { number: 1, pathIndex: 0, row: 0, col: 0 },
      { number: 2, pathIndex: 3, row: 1, col: 1 },
    ],
    walls: [{ row: 0, col: 0, direction: 'right' }],
  };
  const result = validateZip(blockedPuzzle, [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
  ]);
  assert.equal(result.valid, false);
  assert.match(result.reason, /mur empêche/);
});

test('chaque graine générée possède un parcours gagnant pour chaque difficulté', () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    for (const difficulty of ['facile', 'moyen', 'difficile']) {
      const puzzle = createZipPuzzle(seed, difficulty);
      const result = validateZip(puzzle, puzzle.solution);
      assert.equal(
        result.won,
        true,
        `La graine ${seed} (${difficulty}) doit être finissable.`,
      );
    }
  }
});

test('la graine 995819834 reste finissable', () => {
  for (const difficulty of ['aleatoire', 'facile', 'moyen', 'difficile']) {
    const puzzle = createZipPuzzle(995819834, difficulty);
    assert.equal(
      validateZip(puzzle, puzzle.solution).won,
      true,
      `La graine doit être finissable en difficulté ${difficulty}.`,
    );
  }
});

test('refuse d’atteindre le dernier nœud avant d’avoir rempli la grille', () => {
  const puzzle = {
    game: 'zip',
    size: 2,
    checkpoints: [
      { number: 1, pathIndex: 0, row: 0, col: 0 },
      { number: 2, pathIndex: 1, row: 0, col: 1 },
      { number: 3, pathIndex: 3, row: 1, col: 1 },
    ],
  };
  const result = validateZip(puzzle, [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
  ]);

  assert.equal(result.valid, false);
  assert.equal(result.won, false);
  assert.match(result.reason, /dernier chiffre ne peut être rejoint/);
});

test('rejette une étape diagonale et un passage sur un futur nœud', () => {
  const puzzle = createZipPuzzle(29);
  const start = puzzle.checkpoints[0];
  const diagonal = validateZip(puzzle, [
    start,
    { row: start.row + 1, col: start.col + 1 },
  ]);
  assert.equal(diagonal.valid, false);
  assert.match(diagonal.reason, /voisine/);

  const orderedPuzzle = {
    game: 'zip',
    size: 2,
    checkpoints: [
      { number: 1, pathIndex: 0, row: 0, col: 0 },
      { number: 2, pathIndex: 1, row: 0, col: 1 },
      { number: 3, pathIndex: 3, row: 1, col: 1 },
    ],
  };
  const jumped = validateZip(orderedPuzzle, [
    orderedPuzzle.checkpoints[0],
    { row: 1, col: 0 },
    orderedPuzzle.checkpoints[2],
  ]);
  assert.equal(jumped.valid, false);
  assert.match(jumped.reason, /dans l’ordre/);
});

test('rejette un chemin qui repasse sur une case déjà visitée', () => {
  const puzzle = createZipPuzzle(29);
  const [start, next] = puzzle.solution;
  const result = validateZip(puzzle, [
    start,
    next,
    start,
  ]);

  assert.equal(result.valid, false);
  assert.match(result.reason, /repasser/);
});

test('refuse de continuer après avoir atteint le dernier numéro', () => {
  const puzzle = {
    game: 'zip',
    size: 2,
    checkpoints: [
      { number: 1, pathIndex: 0, row: 0, col: 0 },
      { number: 2, pathIndex: 1, row: 0, col: 1 },
      { number: 3, pathIndex: 3, row: 1, col: 1 },
    ],
  };
  const path = [
    { row: 0, col: 0 },
    { row: 0, col: 1 },
    { row: 1, col: 1 },
    { row: 1, col: 0 },
  ];
  const result = validateZip(puzzle, path);

  assert.equal(result.valid, false);
  assert.equal(result.won, false);
  assert.match(result.reason, /dernier chiffre ne peut être rejoint/);
});

test('refuse les graines et cases en dehors de la grille', () => {
  assert.throws(() => createZipPuzzle(0), RangeError);
  assert.throws(() => createZipPuzzle(0x100000000), RangeError);

  const puzzle = createZipPuzzle(1);
  assert.throws(
    () => validateZip(puzzle, [{ row: -1, col: 0 }]),
    RangeError,
  );
});
