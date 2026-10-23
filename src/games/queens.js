const BOARD_SIZE = 8;
const MAX_GENERATION_ATTEMPTS = 5000;

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

function generateSolution(random) {
  const columns = Array(BOARD_SIZE).fill(-1);
  const usedColumns = new Set();

  function place(row) {
    if (row === BOARD_SIZE) return true;

    for (const column of shuffle(
      Array.from({ length: BOARD_SIZE }, (_, index) => index),
      random,
    )) {
      if (usedColumns.has(column)) continue;
      if (row > 0 && Math.abs(columns[row - 1] - column) <= 1) continue;

      columns[row] = column;
      usedColumns.add(column);
      if (place(row + 1)) return true;
      usedColumns.delete(column);
      columns[row] = -1;
    }

    return false;
  }

  if (!place(0)) {
    throw new Error('Impossible de générer une solution Queens valide.');
  }

  return columns.map((col, row) => ({ row, col }));
}

function generateRegions(solution, random) {
  const regions = Array.from({ length: BOARD_SIZE }, () =>
    Array(BOARD_SIZE).fill(-1),
  );
  const frontier = [];

  for (let region = 0; region < solution.length; region += 1) {
    const { row, col } = solution[region];
    regions[row][col] = region;
    frontier.push({ row, col });
  }

  const directions = [
    [-1, 0],
    [1, 0],
    [0, -1],
    [0, 1],
  ];

  while (frontier.length > 0) {
    const index = Math.floor(random() * frontier.length);
    const cell = frontier.splice(index, 1)[0];

    for (const [rowDelta, colDelta] of directions) {
      const row = cell.row + rowDelta;
      const col = cell.col + colDelta;
      if (
        row >= 0 &&
        row < BOARD_SIZE &&
        col >= 0 &&
        col < BOARD_SIZE &&
        regions[row][col] === -1
      ) {
        const neighboringRegions = new Set();
        for (const [neighborRowDelta, neighborColDelta] of directions) {
          const neighborRow = row + neighborRowDelta;
          const neighborCol = col + neighborColDelta;
          if (
            neighborRow >= 0 &&
            neighborRow < BOARD_SIZE &&
            neighborCol >= 0 &&
            neighborCol < BOARD_SIZE &&
            regions[neighborRow][neighborCol] !== -1
          ) {
            neighboringRegions.add(regions[neighborRow][neighborCol]);
          }
        }

        const choices = [...neighboringRegions];
        regions[row][col] = choices[Math.floor(random() * choices.length)];
        frontier.push({ row, col });
      }
    }
  }

  return regions;
}

function countSolutions(puzzle, placements = [], excluded = [], stopAfter = 2) {
  const { size, regions } = puzzle;
  const excludedKeys = new Set(excluded.map(({ row, col }) => `${row},${col}`));
  const fixedByRow = new Map();

  for (const { row, col } of placements) {
    if (!fixedByRow.has(row)) fixedByRow.set(row, []);
    fixedByRow.get(row).push(col);
  }

  const columnCounts = Array(size).fill(0);
  const regionCounts = new Map();
  const fixedQueens = [];
  for (const [row, columns] of fixedByRow) {
    if (columns.length !== 1) return { count: 0, nodes: 0 };
    const col = columns[0];
    const region = regions[row][col];
    if (excludedKeys.has(`${row},${col}`)) {
      return { count: 0, nodes: 0 };
    }
    columnCounts[col] += 1;
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    fixedQueens.push({ row, col });
  }

  if (
    columnCounts.some((count) => count > 1) ||
    [...regionCounts.values()].some((count) => count > 1)
  ) {
    return { count: 0, nodes: 0 };
  }
  fixedQueens.sort((a, b) => a.row - b.row);
  for (let index = 1; index < fixedQueens.length; index += 1) {
    if (
      fixedQueens[index].row - fixedQueens[index - 1].row <= 1 &&
      Math.abs(fixedQueens[index].col - fixedQueens[index - 1].col) <= 1
    ) {
      return { count: 0, nodes: 0 };
    }
  }

  columnCounts.fill(0);
  regionCounts.clear();
  const placementsByRow = Array.from({ length: size }, () => []);
  for (const queen of fixedQueens) placementsByRow[queen.row].push(queen.col);
  const solutionColumns = Array(size).fill(-1);
  let count = 0;
  let nodes = 0;

  function visit(row) {
    if (count >= stopAfter) return;
    if (row === size) {
      count += 1;
      return;
    }

    const fixedColumns = placementsByRow[row];
    const candidateColumns =
      fixedColumns.length > 0
        ? fixedColumns
        : Array.from({ length: size }, (_, col) => col);

    for (const col of candidateColumns) {
      nodes += 1;
      const key = `${row},${col}`;
      const region = regions[row][col];
      if (
        excludedKeys.has(key) ||
        columnCounts[col] > 0 ||
        regionCounts.has(region) ||
        (row > 0 &&
          solutionColumns[row - 1] >= 0 &&
          Math.abs(solutionColumns[row - 1] - col) <= 1)
      ) {
        continue;
      }

      columnCounts[col] += 1;
      regionCounts.set(region, 1);
      solutionColumns[row] = col;
      visit(row + 1);
      solutionColumns[row] = -1;
      columnCounts[col] -= 1;
      regionCounts.delete(region);
      if (count >= stopAfter) return;
    }
  }

  visit(0);
  return { count, nodes };
}

export function countQueensSolutions(puzzle, options = {}) {
  if (
    !puzzle ||
    puzzle.game !== 'queens' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.regions) ||
    puzzle.regions.length !== puzzle.size ||
    puzzle.regions.some(
      (row) => !Array.isArray(row) || row.length !== puzzle.size,
    )
  ) {
    throw new TypeError('Grille Queens invalide.');
  }

  const placements = options.placements ?? [];
  const excluded = options.excluded ?? [];
  if (!Array.isArray(placements) || !Array.isArray(excluded)) {
    throw new TypeError('Les contraintes Queens doivent être des listes de cases.');
  }

  for (const cell of [...placements, ...excluded]) {
    if (
      !Number.isInteger(cell?.row) ||
      !Number.isInteger(cell?.col) ||
      cell.row < 0 ||
      cell.row >= puzzle.size ||
      cell.col < 0 ||
      cell.col >= puzzle.size
    ) {
      throw new RangeError('Chaque contrainte doit se trouver dans la grille.');
    }
  }

  return countSolutions(puzzle, placements, excluded).count;
}

export function findLogicalQueensCross(puzzle, options = {}) {
  const placements = options.placements ?? [];
  const excluded = options.excluded ?? [];
  const excludedKeys = new Set(excluded.map(({ row, col }) => `${row},${col}`));
  const queenKeys = new Set(placements.map(({ row, col }) => `${row},${col}`));
  const regions = new Map();

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const region = puzzle.regions[row][col];
      if (!regions.has(region)) regions.set(region, []);
      regions.get(region).push({ row, col });
    }
  }

  function getQueenConflict(row, col) {
    for (const queen of placements) {
      const reason = getPairConflict(queen, { row, col });
      if (reason) return reason;
    }
    return null;
  }

  function getPairConflict(queen, cell) {
    if (queen.row === cell.row && queen.col === cell.col) return null;
    if (queen.row === cell.row) {
      return `se trouve sur la ligne ${queen.row + 1} de la reine`;
    }
    if (queen.col === cell.col) {
      return `se trouve dans la colonne ${queen.col + 1} de la reine`;
    }
    if (
      puzzle.regions[queen.row][queen.col] ===
      puzzle.regions[cell.row][cell.col]
    ) {
      return 'se trouve dans la même région colorée que la reine';
    }
    if (
      Math.abs(queen.row - cell.row) <= 1 &&
      Math.abs(queen.col - cell.col) <= 1
    ) {
      return 'touche la reine';
    }
    return null;
  }

  for (let row = 0; row < puzzle.size; row += 1) {
    for (let col = 0; col < puzzle.size; col += 1) {
      const key = `${row},${col}`;
      if (queenKeys.has(key) || excludedKeys.has(key)) continue;
      const reason = getQueenConflict(row, col);
      if (reason) {
        return {
          row,
          col,
          explanation: `Cochez la ligne ${row + 1}, colonne ${col + 1} : cette case ${reason}.`,
        };
      }
    }
  }

  const units = [
    ...Array.from({ length: puzzle.size }, (_, row) => ({
      cells: Array.from({ length: puzzle.size }, (_, col) => ({ row, col })),
      description: `la ligne ${row + 1}`,
    })),
    ...Array.from({ length: puzzle.size }, (_, col) => ({
      cells: Array.from({ length: puzzle.size }, (_, row) => ({ row, col })),
      description: `la colonne ${col + 1}`,
    })),
    ...[...regions.entries()].map(([region, cells], index) => ({
      cells,
      description: `la région colorée ${index + 1}`,
      region,
    })),
  ];

  for (const unit of units) {
    if (unit.cells.some(({ row, col }) => queenKeys.has(`${row},${col}`))) {
      continue;
    }

    const candidates = unit.cells.filter(({ row, col }) => {
      const key = `${row},${col}`;
      return !excludedKeys.has(key) && !getQueenConflict(row, col);
    });
    if (candidates.length !== 1) continue;

    const forcedQueen = candidates[0];
    for (let row = 0; row < puzzle.size; row += 1) {
      for (let col = 0; col < puzzle.size; col += 1) {
        const key = `${row},${col}`;
        if (queenKeys.has(key) || excludedKeys.has(key)) continue;

        const reason = getPairConflict(forcedQueen, { row, col });
        if (reason) {
          return {
            row,
            col,
            explanation: `Il ne reste qu’une seule case possible dans ${unit.description} : ligne ${forcedQueen.row + 1}, colonne ${forcedQueen.col + 1}. Une reine doit y être placée ; cochez cette case, car elle ${reason}.`,
          };
        }
      }
    }
  }

  return null;
}

function classifyDifficulty(searchNodes) {
  if (searchNodes < 3000) return 'facile';
  if (searchNodes < 5000) return 'moyen';
  return 'difficile';
}

const DIFFICULTIES = new Set(['facile', 'moyen', 'difficile']);

export function createQueensPuzzle(seed, requestedDifficulty = 'aleatoire') {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new RangeError('La graine Queens doit être un entier positif sur 32 bits.');
  }
  if (requestedDifficulty !== 'aleatoire' && !DIFFICULTIES.has(requestedDifficulty)) {
    throw new RangeError('Difficulté Queens invalide.');
  }

  for (let attempt = 0; attempt < MAX_GENERATION_ATTEMPTS; attempt += 1) {
    const attemptSeed = ((seed + attempt - 1) % 0xffffffff) + 1;
    const random = createRandom(attemptSeed);
    const solution = generateSolution(random);
    const puzzle = {
      game: 'queens',
      level: seed,
      size: BOARD_SIZE,
      regions: generateRegions(solution, random),
    };
    const result = countSolutions(puzzle);

    if (result.count === 1) {
      const difficulty = classifyDifficulty(result.nodes);
      if (requestedDifficulty === 'aleatoire' || difficulty === requestedDifficulty) {
        puzzle.difficulty = difficulty;
        return puzzle;
      }
    }
  }

  throw new Error(
    `Impossible de générer une grille Queens ${requestedDifficulty} à solution unique après ${MAX_GENERATION_ATTEMPTS} essais.`,
  );
}

export function validateQueens(puzzle, placements) {
  if (
    !puzzle ||
    puzzle.game !== 'queens' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.regions) ||
    !Array.isArray(placements)
  ) {
    throw new TypeError('Grille Queens ou placements invalides.');
  }

  const { size, regions } = puzzle;
  if (
    regions.length !== size ||
    regions.some((row) => !Array.isArray(row) || row.length !== size)
  ) {
    throw new TypeError('La grille des régions Queens est invalide.');
  }

  const keys = new Set();
  const rowCounts = Array(size).fill(0);
  const colCounts = Array(size).fill(0);
  const regionCounts = new Map();
  const conflicts = new Set();
  const cells = placements.map((placement) => {
    const { row, col } = placement ?? {};
    if (
      !Number.isInteger(row) ||
      !Number.isInteger(col) ||
      row < 0 ||
      row >= size ||
      col < 0 ||
      col >= size
    ) {
      throw new RangeError('Chaque reine doit se trouver dans la grille.');
    }

    const key = `${row},${col}`;
    if (keys.has(key)) conflicts.add(key);
    keys.add(key);
    rowCounts[row] += 1;
    colCounts[col] += 1;
    const region = regions[row][col];
    regionCounts.set(region, (regionCounts.get(region) ?? 0) + 1);
    return { row, col, key, region };
  });

  for (let left = 0; left < cells.length; left += 1) {
    const a = cells[left];

    if (rowCounts[a.row] > 1 || colCounts[a.col] > 1 || regionCounts.get(a.region) > 1) {
      conflicts.add(a.key);
    }

    for (let right = left + 1; right < cells.length; right += 1) {
      const b = cells[right];
      if (Math.abs(a.row - b.row) <= 1 && Math.abs(a.col - b.col) <= 1) {
        conflicts.add(a.key);
        conflicts.add(b.key);
      }
    }
  }

  const complete = cells.length === size;
  const won =
    complete &&
    conflicts.size === 0 &&
    rowCounts.every((count) => count === 1) &&
    colCounts.every((count) => count === 1) &&
    regionCounts.size === size &&
    [...regionCounts.values()].every((count) => count === 1);

  return {
    valid: conflicts.size === 0,
    complete,
    won,
    conflicts: [...conflicts].map((key) => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    }),
  };
}
