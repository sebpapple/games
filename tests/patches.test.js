import test from 'node:test';
import assert from 'node:assert/strict';
import {
  checkPatchesPlacement,
  countPatchesSolutions,
  createPatchesPuzzle,
  findLogicalPatchesHint,
  validatePatches,
} from '../src/games/patches.js';

function getSolutionPlacements(puzzle) {
  return puzzle.solution.map((patch, clueId) => ({ ...patch, clueId }));
}

function getPatchShape({ height, width }) {
  if (height === width) return 'square';
  return width > height ? 'wide' : 'tall';
}

test('génère des grilles Patches déterministes et uniques à chaque difficulté', () => {
  for (const difficulty of ['facile', 'moyen', 'difficile']) {
    for (const seed of [1, 17, 42, 128, 1000, 0xffffffff]) {
      const puzzle = createPatchesPuzzle(seed, difficulty);
      const duplicate = createPatchesPuzzle(seed, difficulty);

      assert.deepEqual(puzzle, duplicate);
      assert.equal(puzzle.size, 6);
      assert.equal(puzzle.difficulty, difficulty);
      assert.ok(
        puzzle.solution.every(({ height, width }) => height * width >= 2 && height * width <= 8),
      );
      const hiddenAreaClues = puzzle.clues.flatMap((clue, clueId) =>
        clue.area == null ? [{ clue, clueId }] : [],
      );
      if (difficulty === 'difficile') {
        assert.ok(hiddenAreaClues.length >= 2 && hiddenAreaClues.length <= 3);
      } else {
        assert.equal(hiddenAreaClues.length, difficulty === 'moyen' ? 1 : 0);
      }
      assert.ok(
        hiddenAreaClues.every(({ clue, clueId }) =>
          clue.shape !== 'square' &&
          clue.shape === getPatchShape(puzzle.solution[clueId]),
        ),
      );
      assert.equal(countPatchesSolutions(puzzle).count, 1);
      assert.equal(validatePatches(puzzle, getSolutionPlacements(puzzle)).won, true);
    }
  }
});

test('génère des niveaux aléatoires valides pour une série de graines', () => {
  for (let seed = 1; seed <= 1000; seed += 1) {
    const puzzle = createPatchesPuzzle(seed);
    assert.ok(['facile', 'moyen', 'difficile'].includes(puzzle.difficulty));
    assert.ok(
      puzzle.solution.every(({ height, width }) => height * width >= 2 && height * width <= 8),
    );
    assert.equal(countPatchesSolutions(puzzle).count, 1);
    assert.equal(validatePatches(puzzle, getSolutionPlacements(puzzle)).won, true);
  }
});

test('refuse les graines et niveaux de difficulté invalides', () => {
  assert.throws(() => createPatchesPuzzle(0), RangeError);
  assert.throws(() => createPatchesPuzzle(0x100000000), RangeError);
  assert.throws(() => createPatchesPuzzle(1, 'expert'), RangeError);
});

test('autorise seulement les pièces qui respectent les indices et les placements existants', () => {
  const puzzle = {
    game: 'patches',
    size: 3,
    clues: [
      { id: 0, row: 0, col: 0, area: 4, shape: 'square' },
      { id: 1, row: 1, col: 1, area: 2, shape: 'wide' },
    ],
  };
  const existingPlacement = {
    clueId: 0,
    top: 0,
    left: 0,
    height: 2,
    width: 2,
  };
  const singleCluePuzzle = { ...puzzle, clues: [puzzle.clues[0]] };

  assert.deepEqual(
    checkPatchesPlacement(singleCluePuzzle, [], {
      top: 0,
      left: 0,
      height: 2,
      width: 2,
    }),
    { valid: true, clueId: 0 },
  );
  assert.equal(
    checkPatchesPlacement(puzzle, [], {
      top: 0,
      left: 0,
      height: 1,
      width: 1,
    }).reason,
    'patchesSelectionArea',
  );
  assert.equal(
    checkPatchesPlacement(puzzle, [], {
      top: 1,
      left: 1,
      height: 2,
      width: 1,
    }).reason,
    'patchesSelectionShape',
  );
  assert.equal(
    checkPatchesPlacement(puzzle, [], {
      top: 2,
      left: 0,
      height: 1,
      width: 2,
    }).reason,
    'patchesSelectionNoClue',
  );
  assert.equal(
    checkPatchesPlacement(puzzle, [existingPlacement], {
      top: 1,
      left: 0,
      height: 1,
      width: 2,
    }).reason,
    'patchesSelectionOverlap',
  );
  assert.equal(
    checkPatchesPlacement(singleCluePuzzle, [existingPlacement], {
      top: 0,
      left: 0,
      height: 2,
      width: 2,
    }).reason,
    'patchesSelectionUsedClue',
  );

  const variableAreaPuzzle = {
    game: 'patches',
    size: 6,
    clues: [{ id: 0, row: 0, col: 0, area: null, shape: 'wide' }],
  };
  assert.equal(
    checkPatchesPlacement(variableAreaPuzzle, [], {
      top: 0,
      left: 0,
      height: 1,
      width: 3,
    }).valid,
    true,
  );
  assert.equal(
    checkPatchesPlacement(variableAreaPuzzle, [], {
      top: 0,
      left: 0,
      height: 2,
      width: 5,
    }).reason,
    'patchesSelectionArea',
  );
  assert.equal(
    checkPatchesPlacement(
      { ...variableAreaPuzzle, clues: [{ id: 0, row: 0, col: 0, area: null, shape: 'square' }] },
      [],
      { top: 0, left: 0, height: 1, width: 1 },
    ).reason,
    'patchesSelectionArea',
  );
  const singletonPuzzle = {
    game: 'patches',
    size: 2,
    clues: [{ id: 0, row: 0, col: 0, area: 1, shape: 'square' }],
  };
  assert.equal(
    validatePatches(singletonPuzzle, [{
      clueId: 0,
      top: 0,
      left: 0,
      height: 1,
      width: 1,
    }]).valid,
    false,
  );
});

test('les indices Patches reposent uniquement sur les indices visibles', () => {
  const puzzle = {
    game: 'patches',
    size: 2,
    clues: [{ id: 0, row: 0, col: 0, area: 4, shape: 'square' }],
    solution: [],
  };

  const hint = findLogicalPatchesHint(puzzle, []);
  assert.deepEqual(
    { clueId: hint.clueId, top: hint.top, left: hint.left, height: hint.height, width: hint.width },
    { clueId: 0, top: 0, left: 0, height: 2, width: 2 },
  );
  assert.equal(
    findLogicalPatchesHint({ ...puzzle, solution: undefined }, [])?.clueId,
    hint.clueId,
  );

  const cluesInsideSameCandidate = {
    game: 'patches',
    size: 2,
    clues: [{ id: 0, row: 0, col: 0, area: 2, shape: 'wide' }],
  };
  assert.equal(findLogicalPatchesHint(cluesInsideSameCandidate, [])?.clueId, 0);
});

test('signale les placements incomplets et les conflits sans déclarer la victoire', () => {
  const puzzle = createPatchesPuzzle(42);
  const partial = getSolutionPlacements(puzzle).slice(0, 1);
  const partialValidation = validatePatches(puzzle, partial);

  assert.equal(partialValidation.valid, true);
  assert.equal(partialValidation.complete, false);
  assert.equal(partialValidation.won, false);

  const overlapping = [
    partial[0],
    {
      ...puzzle.solution[1],
      clueId: 1,
      top: partial[0].top,
      left: partial[0].left,
      height: 1,
      width: 1,
    },
  ];
  assert.equal(validatePatches(puzzle, overlapping).won, false);
});
