const BOARD_SIZE = 6;
const HARD_CANDIDATE_COUNT = 12;
const MAX_SOLUTIONS = 2;

const RELATION_COUNTS = {
  facile: 2,
  moyen: 3,
  difficile: 4,
};

const TARGET_GIVEN_COUNTS = {
  facile: 18,
  moyen: 12,
  difficile: 7,
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
  const shuffled = [...values];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapIndex]] = [
      shuffled[swapIndex],
      shuffled[index],
    ];
  }
  return shuffled;
}

function hasTriple(mask, row, size) {
  const value = (mask >> row) & 1;
  return row >= 2 &&
    value === ((mask >> (row - 1)) & 1) &&
    value === ((mask >> (row - 2)) & 1);
}

function getRowPatterns(size) {
  const patterns = [];
  for (let mask = 0; mask < 2 ** size; mask += 1) {
    let suns = 0;
    for (let col = 0; col < size; col += 1) suns += (mask >> col) & 1;
    if (suns !== size / 2) continue;
    if (Array.from({ length: size }, (_, col) => col).some((col) => hasTriple(mask, col, size))) continue;
    patterns.push(mask);
  }
  return patterns;
}

function toGrid(rowMasks, size) {
  return rowMasks.map((mask) =>
    Array.from({ length: size }, (_, col) => ((mask >> col) & 1 ? 'sun' : 'moon')),
  );
}

function isPartialGridValid(grid, row, col) {
  const value = grid[row][col];
  const rowSuns = grid[row].filter((cell) => cell === 'sun').length;
  const rowMoons = grid[row].filter((cell) => cell === 'moon').length;
  const colSuns = grid.reduce((count, cells) => count + (cells[col] === 'sun' ? 1 : 0), 0);
  const colMoons = grid.reduce((count, cells) => count + (cells[col] === 'moon' ? 1 : 0), 0);
  if (rowSuns > grid.length / 2 || rowMoons > grid.length / 2) return false;
  if (colSuns > grid.length / 2 || colMoons > grid.length / 2) return false;
  if (
    col >= 2 &&
    grid[row][col - 1] === value &&
    grid[row][col - 2] === value
  ) return false;
  if (
    row >= 2 &&
    grid[row - 1][col] === value &&
    grid[row - 2][col] === value
  ) return false;
  return true;
}

function generateSolution(size, random) {
  const patterns = shuffle(getRowPatterns(size), random);
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  const rowMasks = [];

  function placeRow(row) {
    if (row === size) {
      return Array.from({ length: size }, (_, col) =>
        grid.filter((cells) => cells[col] === 'sun').length === size / 2,
      ).every(Boolean);
    }
    for (const mask of patterns) {
      const candidate = Array.from({ length: size }, (_, col) =>
        (mask >> col) & 1 ? 'sun' : 'moon',
      );
      if (candidate.some((value, col) => {
        grid[row][col] = value;
        const valid = isPartialGridValid(grid, row, col);
        grid[row][col] = null;
        return !valid;
      })) continue;

      grid[row] = candidate;
      rowMasks.push(mask);
      if (placeRow(row + 1)) return true;
      rowMasks.pop();
      grid[row] = Array(size).fill(null);
    }
    return false;
  }

  if (!placeRow(0)) {
    throw new Error('Impossible de générer une solution Tango.');
  }
  return toGrid(rowMasks, size);
}

function getAllRelations(grid, random) {
  const relations = [];
  for (let row = 0; row < grid.length; row += 1) {
    for (let col = 0; col < grid.length; col += 1) {
      if (col + 1 < grid.length) {
        relations.push({
          row,
          col,
          direction: 'right',
          type: grid[row][col] === grid[row][col + 1] ? 'equal' : 'different',
        });
      }
      if (row + 1 < grid.length) {
        relations.push({
          row,
          col,
          direction: 'down',
          type: grid[row][col] === grid[row + 1][col] ? 'equal' : 'different',
        });
      }
    }
  }
  return shuffle(relations, random);
}

function relationsMatch(grid, relations, row, col) {
  return relations.every((relation) => {
    const otherRow = relation.row + (relation.direction === 'down' ? 1 : 0);
    const otherCol = relation.col + (relation.direction === 'right' ? 1 : 0);
    const first = grid[relation.row][relation.col];
    const second = grid[otherRow][otherCol];
    if (first == null || second == null) return true;
    const matches = first === second;
    return relation.type === 'equal' ? matches : !matches;
  });
}

function countSolutions(puzzle, limit = MAX_SOLUTIONS) {
  const { size, givens, relations } = puzzle;
  const patterns = getRowPatterns(size);
  const grid = Array.from({ length: size }, () => Array(size).fill(null));
  let solutions = 0;

  function placeRow(row) {
    if (row === size) {
      const balancedColumns = Array.from({ length: size }, (_, col) =>
        grid.filter((cells) => cells[col] === 'sun').length === size / 2,
      ).every(Boolean);
      if (balancedColumns && relationsMatch(grid, relations)) solutions += 1;
      return solutions >= limit;
    }
    for (const mask of patterns) {
      const candidate = Array.from({ length: size }, (_, col) =>
        (mask >> col) & 1 ? 'sun' : 'moon',
      );
      if (candidate.some((value, col) => {
        const given = givens[row][col];
        if (given && given !== value) return true;
        grid[row][col] = value;
        const valid = isPartialGridValid(grid, row, col);
        grid[row][col] = null;
        return !valid;
      })) continue;

      grid[row] = candidate;
      if (relationsMatch(grid, relations, row)) {
        if (placeRow(row + 1)) return true;
      }
      grid[row] = Array(size).fill(null);
    }
    return false;
  }

  placeRow(0);
  return solutions;
}

function makeGivens(solution, relations, random, difficulty) {
  const cells = shuffle(
    Array.from({ length: solution.length ** 2 }, (_, index) => ({
      row: Math.floor(index / solution.length),
      col: index % solution.length,
    })),
    random,
  );
  const givens = Array.from({ length: solution.length }, () =>
    Array(solution.length).fill(null),
  );
  const puzzle = { size: solution.length, givens, relations };
  for (const { row, col } of cells) {
    givens[row][col] = solution[row][col];
    if (
      givens.flat().filter(Boolean).length >= TARGET_GIVEN_COUNTS[difficulty] &&
      countSolutions(puzzle) === 1
    ) break;
  }
  return givens;
}

export function createTangoPuzzle(seed, requestedDifficulty = 'aleatoire') {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new RangeError('La graine Tango doit être un entier positif sur 32 bits.');
  }
  if (
    requestedDifficulty !== 'aleatoire' &&
    !Object.hasOwn(TARGET_GIVEN_COUNTS, requestedDifficulty)
  ) {
    throw new RangeError('Difficulté Tango invalide.');
  }

  const difficulties = Object.keys(TARGET_GIVEN_COUNTS);
  const difficultyRandom = createRandom(seed);
  const difficulty =
    requestedDifficulty === 'aleatoire'
      ? difficulties[Math.floor(difficultyRandom() * difficulties.length)]
      : requestedDifficulty;
  const size = BOARD_SIZE;
  const candidateCount =
    difficulty === 'difficile' ? HARD_CANDIDATE_COUNT : 1;
  let bestPuzzle = null;
  let fewestGivens = Number.POSITIVE_INFINITY;

  for (let attempt = 0; attempt < candidateCount; attempt += 1) {
    const attemptSeed = (seed + Math.imul(attempt, 0x9e3779b9)) >>> 0;
    const random = createRandom(attemptSeed);
    const solution = generateSolution(size, random);
    const relations = getAllRelations(solution, random)
      .slice(0, RELATION_COUNTS[difficulty]);
    const givens = makeGivens(solution, relations, random, difficulty);
    const puzzle = {
      game: 'tango',
      seed,
      level: seed,
      size,
      difficulty,
      givens,
      relations,
      solution,
    };
    const givenCount = givens.flat().filter(Boolean).length;
    if (givenCount < fewestGivens) {
      bestPuzzle = puzzle;
      fewestGivens = givenCount;
    }
  }

  if (!bestPuzzle || countSolutions(bestPuzzle) !== 1) {
    throw new Error('Impossible de générer une grille Tango à solution unique.');
  }
  return bestPuzzle;
}

export function validateTango(puzzle, grid) {
  if (
    !puzzle ||
    puzzle.game !== 'tango' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.givens) ||
    !Array.isArray(puzzle.relations) ||
    !Array.isArray(grid) ||
    grid.length !== puzzle.size ||
    grid.some((row) => !Array.isArray(row) || row.length !== puzzle.size)
  ) {
    throw new TypeError('Grille Tango ou placements invalides.');
  }

  const { size, givens, relations } = puzzle;
  const conflicts = new Set();
  const addConflict = (row, col) => conflicts.add(`${row},${col}`);

  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const value = grid[row][col];
      if (value !== null && value !== 'sun' && value !== 'moon') {
        throw new TypeError('Chaque case Tango doit contenir un soleil, une lune ou être vide.');
      }
      if (givens[row][col] && value !== givens[row][col]) {
        addConflict(row, col);
      }
      if (col >= 2 && value && value === grid[row][col - 1] && value === grid[row][col - 2]) {
        addConflict(row, col);
        addConflict(row, col - 1);
        addConflict(row, col - 2);
      }
      if (row >= 2 && value && value === grid[row - 1][col] && value === grid[row - 2][col]) {
        addConflict(row, col);
        addConflict(row - 1, col);
        addConflict(row - 2, col);
      }
    }
  }

  for (let index = 0; index < size; index += 1) {
    const row = grid[index];
    const column = grid.map((cells) => cells[index]);
    for (const unit of [row, column]) {
      const suns = unit.filter((cell) => cell === 'sun').length;
      const moons = unit.filter((cell) => cell === 'moon').length;
      const incomplete = unit.includes(null);
      if (suns > size / 2 || moons > size / 2 || (!incomplete && suns !== size / 2)) {
        unit.forEach((_, position) => {
          const rowIndex = unit === row ? index : position;
          const colIndex = unit === row ? position : index;
          if (grid[rowIndex][colIndex]) addConflict(rowIndex, colIndex);
        });
      }
    }
  }

  for (const relation of relations) {
    const nextRow = relation.row + (relation.direction === 'down' ? 1 : 0);
    const nextCol = relation.col + (relation.direction === 'right' ? 1 : 0);
    const first = grid[relation.row][relation.col];
    const second = grid[nextRow][nextCol];
    if (first && second && (relation.type === 'equal') !== (first === second)) {
      addConflict(relation.row, relation.col);
      addConflict(nextRow, nextCol);
    }
  }

  const complete = grid.every((row) => row.every(Boolean));
  const valid = conflicts.size === 0;
  return {
    valid,
    complete,
    won: valid && complete,
    conflicts: [...conflicts].map((key) => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    }),
    filledCount: grid.flat().filter(Boolean).length,
  };
}

export function countTangoSolutions(puzzle, limit = MAX_SOLUTIONS) {
  return countSolutions(puzzle, limit);
}

export function findLogicalTangoHint(puzzle, grid) {
  if (
    !puzzle ||
    puzzle.game !== 'tango' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.givens) ||
    !Array.isArray(puzzle.relations) ||
    !Array.isArray(grid) ||
    grid.length !== puzzle.size ||
    grid.some((row) => !Array.isArray(row) || row.length !== puzzle.size)
  ) {
    throw new TypeError('Grille Tango ou placements invalides.');
  }

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      if (grid[row][col] !== null || puzzle.givens[row][col] !== null) continue;

      const contradictions = ['sun', 'moon'].map((value) => ({
        value,
        reason: getVisibleRuleContradiction(puzzle, grid, row, col, value),
      }));
      const impossible = contradictions.find(({ reason }) => reason);
      const possible = contradictions.find(({ reason }) => !reason);
      if (impossible && possible) {
        return {
          row,
          col,
          value: possible.value,
          impossible: impossible.value,
          explanation: impossible.reason,
        };
      }
    }
  }
  return null;
}

function getVisibleRuleContradiction(puzzle, grid, row, col, value) {
  const size = puzzle.size;
  const otherValue = value === 'sun' ? 'moon' : 'sun';
  const candidateAt = (candidateRow, candidateCol) =>
    candidateRow === row && candidateCol === col
      ? value
      : grid[candidateRow][candidateCol];

  for (const [cells, unitName] of [
    [Array.from({ length: size }, (_, index) => [row, index]), `ligne ${row + 1}`],
    [Array.from({ length: size }, (_, index) => [index, col]), `colonne ${col + 1}`],
  ]) {
    const values = cells.map(([cellRow, cellCol]) =>
      candidateAt(cellRow, cellCol),
    );
    const otherCount = values.filter((cell) => cell === otherValue).length;
    const emptyCount = values.filter((cell) => cell === null).length;
    if (otherCount + emptyCount < size / 2) {
      return `La ${unitName} doit contenir ${size / 2} ${otherValue === 'sun' ? 'soleils' : 'lunes'} ; avec ce symbole, il n’y aurait plus assez de cases pour les placer.`;
    }
  }

  for (let startCol = Math.max(0, col - 2); startCol <= Math.min(col, size - 3); startCol += 1) {
    const triple = [0, 1, 2].map((offset) =>
      candidateAt(row, startCol + offset),
    );
    if (triple.every((cell) => cell === value)) {
      return `Ce symbole créerait trois ${value === 'sun' ? 'soleils' : 'lunes'} consécutifs sur la ligne ${row + 1}.`;
    }
  }
  for (let startRow = Math.max(0, row - 2); startRow <= Math.min(row, size - 3); startRow += 1) {
    const triple = [0, 1, 2].map((offset) =>
      candidateAt(startRow + offset, col),
    );
    if (triple.every((cell) => cell === value)) {
      return `Ce symbole créerait trois ${value === 'sun' ? 'soleils' : 'lunes'} consécutifs sur la colonne ${col + 1}.`;
    }
  }

  for (const relation of puzzle.relations) {
    const nextRow = relation.row + (relation.direction === 'down' ? 1 : 0);
    const nextCol = relation.col + (relation.direction === 'right' ? 1 : 0);
    const touchesCandidate =
      (relation.row === row && relation.col === col) ||
      (nextRow === row && nextCol === col);
    if (!touchesCandidate) continue;
    const first = candidateAt(relation.row, relation.col);
    const second = candidateAt(nextRow, nextCol);
    if (first === null || second === null) continue;
    const matches = first === second;
    if ((relation.type === 'equal') !== matches) {
      return relation.type === 'equal'
        ? 'Le signe « = » impose le même symbole dans les deux cases voisines.'
        : 'Le signe « × » impose des symboles différents dans les deux cases voisines.';
    }
  }

  return null;
}
