const BOARD_SIZE = 6;
const MIN_PATCH_AREA = 2;
const MAX_PATCH_AREA = 8;
const MAX_SOLUTIONS = 2;
const MAX_PARTITION_NODES = 20_000;

const DIFFICULTY_PATCH_COUNTS = {
  facile: [5, 7],
  moyen: [7, 10],
  difficile: [5, 8],
};

const DIFFICULTY_BLANK_AREAS = {
  facile: [0, 0],
  moyen: [1, 1],
  difficile: [2, 3],
};

const DIFFICULTY_BLANK_SHAPES = {
  facile: [1, 1],
  moyen: [1, 2],
  difficile: [2, 3],
};

function createRandom(seed) {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(values, random) {
  const result = [...values];
  for (let index = result.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [result[index], result[swapIndex]] = [result[swapIndex], result[index]];
  }
  return result;
}

function getShape(height, width) {
  if (height === width) return 'square';
  return width > height ? 'wide' : 'tall';
}

function getDimensions(size) {
  const dimensions = [];
  for (let height = 1; height <= size; height += 1) {
    for (let width = 1; width <= size; width += 1) {
      const area = height * width;
      if (area >= MIN_PATCH_AREA && area <= MAX_PATCH_AREA) {
        dimensions.push({ height, width, area });
      }
    }
  }
  return dimensions;
}

function rectangleCells(top, left, height, width, size) {
  return Array.from({ length: height * width }, (_, offset) => {
    const row = top + Math.floor(offset / width);
    const col = left + (offset % width);
    return row * size + col;
  });
}

function createRectangle(top, left, height, width, size) {
  const cells = rectangleCells(top, left, height, width, size);
  return {
    top,
    left,
    height,
    width,
    area: cells.length,
    shape: getShape(height, width),
    cells,
    mask: cells.reduce((mask, cell) => mask | (1n << BigInt(cell)), 0n),
  };
}

function generatePartition(size, patchCount, random) {
  const dimensions = getDimensions(size);
  const occupied = Array(size * size).fill(false);
  const patches = [];
  let exploredNodes = 0;

  function fill() {
    exploredNodes += 1;
    if (exploredNodes > MAX_PARTITION_NODES) return false;

    const firstCell = occupied.findIndex((value) => !value);
    if (firstCell < 0) {
      return patches.length === patchCount;
    }
    if (patches.length >= patchCount) return false;

    const remainingCells = occupied.filter((value) => !value).length;
    const remainingPatches = patchCount - patches.length;
    if (remainingCells < remainingPatches * MIN_PATCH_AREA) return false;

    const row = Math.floor(firstCell / size);
    const col = firstCell % size;
    const availableDimensions = dimensions.filter(({ height, width, area }) => {
      if (area > remainingCells - MIN_PATCH_AREA * (remainingPatches - 1)) return false;
      if (row + height > size || col + width > size) return false;
      for (let patchRow = row; patchRow < row + height; patchRow += 1) {
        for (let patchCol = col; patchCol < col + width; patchCol += 1) {
          if (occupied[patchRow * size + patchCol]) return false;
        }
      }
      return true;
    });
    const candidates = shuffle(availableDimensions, random);

    for (const { height, width } of candidates) {
      const patch = createRectangle(row, col, height, width, size);
      patch.cells.forEach((cell) => {
        occupied[cell] = true;
      });
      patches.push(patch);
      if (fill()) return true;
      patches.pop();
      patch.cells.forEach((cell) => {
        occupied[cell] = false;
      });
    }
    return false;
  }

  return fill() ? patches : null;
}

function createClues(solutionPatches, difficulty, random) {
  const [minimumBlankAreas, maximumBlankAreas] = DIFFICULTY_BLANK_AREAS[difficulty];
  const blankAreaCount =
    minimumBlankAreas +
    Math.floor(random() * (maximumBlankAreas - minimumBlankAreas + 1));
  const [minimumBlankShapes, maximumBlankShapes] =
    DIFFICULTY_BLANK_SHAPES[difficulty];
  const blankShapeCount =
    minimumBlankShapes +
    Math.floor(random() * (maximumBlankShapes - minimumBlankShapes + 1));
  const hiddenAreaIds = new Set(
    shuffle(
      solutionPatches
        .map((patch, index) => ({ patch, index }))
        .filter(({ patch }) => patch.shape !== 'square')
        .map(({ index }) => index),
      random,
    ).slice(0, blankAreaCount),
  );
  const hiddenShapeIds = new Set(
    shuffle(
      solutionPatches
        .map((patch, index) => ({ patch, index }))
        .filter(({ index }) => !hiddenAreaIds.has(index))
        .map(({ index }) => index),
      random,
    ).slice(0, blankShapeCount),
  );

  return solutionPatches.map((patch, index) => {
    const clueCell = patch.cells[Math.floor(random() * patch.cells.length)];
    return {
      id: index,
      row: Math.floor(clueCell / BOARD_SIZE),
      col: clueCell % BOARD_SIZE,
      area: hiddenAreaIds.has(index) ? null : patch.area,
      shape: hiddenShapeIds.has(index) ? null : patch.shape,
    };
  });
}

function getCandidates(clue, size, occupied = 0n) {
  const candidates = [];
  for (let height = 1; height <= size; height += 1) {
    for (let width = 1; width <= size; width += 1) {
      if (
        height * width < MIN_PATCH_AREA ||
        (clue.area != null && height * width !== clue.area) ||
        height * width > MAX_PATCH_AREA ||
        (clue.shape != null && getShape(height, width) !== clue.shape)
      ) {
        continue;
      }
      for (let top = Math.max(0, clue.row - height + 1); top <= clue.row; top += 1) {
        for (
          let left = Math.max(0, clue.col - width + 1);
          left <= clue.col;
          left += 1
        ) {
          if (top + height > size || left + width > size) continue;
          const rectangle = createRectangle(top, left, height, width, size);
          if ((rectangle.mask & occupied) === 0n) candidates.push(rectangle);
        }
      }
    }
  }
  return candidates;
}

export function checkPatchesPlacement(puzzle, placements, rectangle) {
  if (
    !puzzle ||
    puzzle.game !== 'patches' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.clues) ||
    !Array.isArray(placements) ||
    !rectangle
  ) {
    throw new TypeError('Grille Patches ou placements invalides.');
  }

  const { top, left, height, width } = rectangle;
  if (
    ![top, left, height, width].every(Number.isInteger) ||
    top < 0 ||
    left < 0 ||
    height < 1 ||
    width < 1 ||
    top + height > puzzle.size ||
    left + width > puzzle.size
  ) {
    return { valid: false, reason: 'patchesSelectionOutside' };
  }

  const containedClues = puzzle.clues.filter(
    ({ row, col }) =>
      row >= top &&
      row < top + height &&
      col >= left &&
      col < left + width,
  );
  if (containedClues.length === 0) {
    return { valid: false, reason: 'patchesSelectionNoClue' };
  }
  if (containedClues.length > 1) {
    return { valid: false, reason: 'patchesSelectionManyClues' };
  }

  const [clue] = containedClues;
  if (placements.some(({ clueId }) => clueId === clue.id)) {
    return { valid: false, reason: 'patchesSelectionUsedClue' };
  }
  if (height * width < MIN_PATCH_AREA) {
    return { valid: false, reason: 'patchesSelectionArea' };
  }
  if (clue.area != null && height * width !== clue.area) {
    return { valid: false, reason: 'patchesSelectionArea' };
  }
  if (height * width > MAX_PATCH_AREA) {
    return { valid: false, reason: 'patchesSelectionArea' };
  }
  if (clue.shape != null && getShape(height, width) !== clue.shape) {
    return { valid: false, reason: 'patchesSelectionShape' };
  }

  const selectedCells = new Set(rectangleCells(top, left, height, width, puzzle.size));
  if (
    placements.some(({ top: placedTop, left: placedLeft, height: placedHeight, width: placedWidth }) =>
      rectangleCells(placedTop, placedLeft, placedHeight, placedWidth, puzzle.size)
        .some((cell) => selectedCells.has(cell)),
    )
  ) {
    return { valid: false, reason: 'patchesSelectionOverlap' };
  }

  return { valid: true, clueId: clue.id };
}

function countSolutions(puzzle, limit = MAX_SOLUTIONS) {
  const { size, clues } = puzzle;
  const fullMask = (1n << BigInt(size * size)) - 1n;
  let count = 0;
  let searchNodes = 0;

  function search(remaining, occupied) {
    searchNodes += 1;
    if (occupied === fullMask) {
      if (remaining.length === 0) count += 1;
      return count >= limit;
    }
    if (remaining.length === 0) return false;

    let selectedClueIndex = -1;
    let selectedCandidates = null;
    for (let index = 0; index < remaining.length; index += 1) {
      const candidates = getCandidates(remaining[index], size, occupied);
      if (candidates.length === 0) return false;
      if (!selectedCandidates || candidates.length < selectedCandidates.length) {
        selectedClueIndex = index;
        selectedCandidates = candidates;
        if (candidates.length === 1) break;
      }
    }

    const clue = remaining[selectedClueIndex];
    const nextRemaining = remaining.filter(({ id }) => id !== clue.id);
    for (const candidate of selectedCandidates) {
      if (search(nextRemaining, occupied | candidate.mask)) return true;
    }
    return false;
  }

  search(clues, 0n);
  return { count, searchNodes };
}

const DIFFICULTIES = Object.keys(DIFFICULTY_PATCH_COUNTS);

export function createPatchesPuzzle(seed, requestedDifficulty = 'aleatoire') {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new RangeError('La graine Patches doit être un entier positif sur 32 bits.');
  }
  if (requestedDifficulty !== 'aleatoire' && !DIFFICULTIES.includes(requestedDifficulty)) {
    throw new RangeError('Difficulté Patches invalide.');
  }

  const difficultyRandom = createRandom(seed);
  const difficulty =
    requestedDifficulty === 'aleatoire'
      ? DIFFICULTIES[Math.floor(difficultyRandom() * DIFFICULTIES.length)]
      : requestedDifficulty;
  const [minimumPatches, maximumPatches] = DIFFICULTY_PATCH_COUNTS[difficulty];
  const attemptCount = 300;

  for (let attempt = 0; attempt < attemptCount; attempt += 1) {
    const attemptSeed = (seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
    const attemptRandom = createRandom(attemptSeed);
    const targetPatchCount =
      minimumPatches +
      Math.floor(attemptRandom() * (maximumPatches - minimumPatches + 1));
    const solutionPatches = generatePartition(
      BOARD_SIZE,
      targetPatchCount,
      attemptRandom,
    );
    if (!solutionPatches) continue;

    const clues = createClues(solutionPatches, difficulty, attemptRandom);
    const puzzle = {
      game: 'patches',
      seed,
      level: seed,
      size: BOARD_SIZE,
      difficulty,
      clues,
      solution: solutionPatches.map(({ top, left, height, width }) => ({
        top,
        left,
        height,
        width,
      })),
    };
    const result = countSolutions(puzzle);
    if (result.count === 1) {
      return puzzle;
    }
  }

  throw new Error(
    `Impossible de générer une grille Patches ${difficulty} à solution unique après ${attemptCount} essais.`,
  );
}

export function validatePatches(puzzle, placements) {
  if (
    !puzzle ||
    puzzle.game !== 'patches' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.clues) ||
    !Array.isArray(placements)
  ) {
    throw new TypeError('Grille Patches ou placements invalides.');
  }

  const { size, clues } = puzzle;
  const clueById = new Map(clues.map((clue) => [clue.id, clue]));
  const covered = Array(size * size).fill(null);
  const usedClues = new Set();
  const conflicts = new Set();
  const validPlacements = [];

  for (const placement of placements) {
    const { clueId, top, left, height, width } = placement ?? {};
    const clue = clueById.get(clueId);
    if (!clue) throw new RangeError('Chaque pièce Patches doit correspondre à un indice.');
    if (usedClues.has(clueId)) {
      conflicts.add(clueId);
      continue;
    }
    if (
      ![top, left, height, width].every(Number.isInteger) ||
      top < 0 ||
      left < 0 ||
      height < 1 ||
      width < 1 ||
      top + height > size ||
      left + width > size
    ) {
      throw new RangeError('Chaque pièce Patches doit rester dans la grille.');
    }

    const cells = rectangleCells(top, left, height, width, size);
    const shapeMatches =
      clue.shape == null || getShape(height, width) === clue.shape;
    const areaMatches = clue.area == null || cells.length === clue.area;
    const areaInRange =
      cells.length >= MIN_PATCH_AREA && cells.length <= MAX_PATCH_AREA;
    const containsClue =
      clue.row >= top &&
      clue.row < top + height &&
      clue.col >= left &&
      clue.col < left + width;
    const overlappedCells = cells.filter((cell) => covered[cell] !== null);
    if (
      !shapeMatches ||
      !areaMatches ||
      !areaInRange ||
      !containsClue ||
      overlappedCells.length > 0
    ) {
      conflicts.add(clueId);
      overlappedCells.forEach((cell) => {
        conflicts.add(covered[cell]);
      });
    }

    usedClues.add(clueId);
    validPlacements.push({ clueId, top, left, height, width });
    cells.forEach((cell) => {
      covered[cell] = clueId;
    });
  }

  const filledCount = covered.filter((clueId) => clueId !== null).length;
  const complete = filledCount === size * size && usedClues.size === clues.length;
  const valid = conflicts.size === 0;
  return {
    valid,
    complete,
    won: valid && complete,
    conflicts: [...conflicts],
    filledCount,
    placedCount: usedClues.size,
  };
}

export function findLogicalPatchesHint(puzzle, placements) {
  if (
    !puzzle ||
    puzzle.game !== 'patches' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.clues) ||
    !Array.isArray(placements)
  ) {
    throw new TypeError('Grille Patches ou placements invalides.');
  }

  const occupied = placements.reduce(
    (mask, { top, left, height, width }) => {
      const rectangle = createRectangle(top, left, height, width, puzzle.size);
      return mask | rectangle.mask;
    },
    0n,
  );
  const placedClues = new Set(placements.map(({ clueId }) => clueId));

  for (const clue of puzzle.clues) {
    if (placedClues.has(clue.id)) continue;
    const candidates = getCandidates(clue, puzzle.size, occupied).filter((candidate) =>
      puzzle.clues.every(
        (otherClue) =>
          otherClue.id === clue.id ||
          otherClue.row < candidate.top ||
          otherClue.row >= candidate.top + candidate.height ||
          otherClue.col < candidate.left ||
          otherClue.col >= candidate.left + candidate.width,
      ),
    );
    if (candidates.length === 1) {
      const { top, left, height, width } = candidates[0];
      return {
        clueId: clue.id,
        top,
        left,
        height,
        width,
        explanation:
          clue.area == null
            ? `L’indice ${clue.shape ?? 'de forme libre'} ne peut couvrir qu’un seul rectangle libre.`
            : `L’indice ${clue.area}${clue.shape ? ` ${clue.shape}` : ''} ne peut couvrir qu’un seul rectangle libre.`,
      };
    }
  }
  return null;
}

export function countPatchesSolutions(puzzle, limit = MAX_SOLUTIONS) {
  return countSolutions(puzzle, limit);
}
