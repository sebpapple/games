const BOARD_SIZE = 6;
const MAX_GENERATION_NODES = 500_000;

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

function getNeighbors(index, size) {
  const row = Math.floor(index / size);
  const col = index % size;
  return [
    row > 0 ? index - size : -1,
    row < size - 1 ? index + size : -1,
    col > 0 ? index - 1 : -1,
    col < size - 1 ? index + 1 : -1,
  ].filter((neighbor) => neighbor >= 0);
}

function generateFallbackPath(size, random) {
  const path = Array.from({ length: size * size }, (_, index) => {
    const row = Math.floor(index / size);
    const offset = index % size;
    return {
      row,
      col: row % 2 === 0 ? offset : size - 1 - offset,
    };
  });
  const rotations = Math.floor(random() * 4);
  const reflect = random() < 0.5;
  const transformed = path.map(({ row, col }) => {
    let nextRow = row;
    let nextCol = reflect ? size - 1 - col : col;
    for (let rotation = 0; rotation < rotations; rotation += 1) {
      [nextRow, nextCol] = [nextCol, size - 1 - nextRow];
    }
    return { row: nextRow, col: nextCol };
  });

  return random() < 0.5 ? transformed.reverse() : transformed;
}

function generateHamiltonianPath(size, random) {
  const cellCount = size * size;
  const start = Math.floor(random() * cellCount);
  const path = [start];
  const visited = new Set(path);
  let exploredNodes = 0;

  function visit(current) {
    exploredNodes += 1;
    if (path.length === cellCount) return true;
    if (exploredNodes > MAX_GENERATION_NODES) return false;

    const candidates = getNeighbors(current, size)
      .filter((neighbor) => !visited.has(neighbor))
      .map((neighbor) => ({
        neighbor,
        onwardDegree: getNeighbors(neighbor, size).filter(
          (next) => !visited.has(next),
        ).length,
        tieBreaker: random(),
      }))
      .sort(
        (left, right) =>
          left.onwardDegree - right.onwardDegree ||
          left.tieBreaker - right.tieBreaker,
      );

    for (const { neighbor } of candidates) {
      visited.add(neighbor);
      path.push(neighbor);
      if (visit(neighbor)) return true;
      path.pop();
      visited.delete(neighbor);
    }
    return false;
  }

  if (!visit(start)) return generateFallbackPath(size, random);

  return path.map((index) => ({
    row: Math.floor(index / size),
    col: index % size,
  }));
}

const CHECKPOINT_COUNTS = {
  facile: 10,
  moyen: 9,
  difficile: 7,
};

const WALL_COUNTS = {
  facile: 0,
  moyen: 4,
  difficile: 9,
};

const WALL_CHANCES = {
  facile: 0,
  moyen: 0.55,
  difficile: 1,
};

function edgeKey(first, second, size) {
  const firstIndex = first.row * size + first.col;
  const secondIndex = second.row * size + second.col;
  return `${Math.min(firstIndex, secondIndex)}:${Math.max(firstIndex, secondIndex)}`;
}

function generateWalls(path, random, size, difficulty) {
  if (random() >= WALL_CHANCES[difficulty]) return [];

  const pathEdges = new Set(
    path.slice(1).map((cell, index) => edgeKey(path[index], cell, size)),
  );
  const candidates = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      const cell = { row, col };
      if (col < size - 1) {
        const next = { row, col: col + 1 };
        if (!pathEdges.has(edgeKey(cell, next, size))) {
          candidates.push({ row, col, direction: 'right' });
        }
      }
      if (row < size - 1) {
        const next = { row: row + 1, col };
        if (!pathEdges.has(edgeKey(cell, next, size))) {
          candidates.push({ row, col, direction: 'down' });
        }
      }
    }
  }

  for (let index = candidates.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [candidates[index], candidates[swapIndex]] = [
      candidates[swapIndex],
      candidates[index],
    ];
  }
  return candidates.slice(0, WALL_COUNTS[difficulty]);
}

function generateCheckpoints(path, random, difficulty) {
  const interiorIndexes = Array.from(
    { length: path.length - 2 },
    (_, index) => index + 1,
  );

  for (let index = interiorIndexes.length - 1; index > 0; index -= 1) {
    const swapIndex = Math.floor(random() * (index + 1));
    [interiorIndexes[index], interiorIndexes[swapIndex]] = [
      interiorIndexes[swapIndex],
      interiorIndexes[index],
    ];
  }

  const checkpointIndexes = [
    0,
    ...interiorIndexes.slice(0, CHECKPOINT_COUNTS[difficulty] - 2),
    path.length - 1,
  ].sort((left, right) => left - right);

  return checkpointIndexes.map((pathIndex, index) => ({
    number: index + 1,
    pathIndex,
    row: path[pathIndex].row,
    col: path[pathIndex].col,
  }));
}

export function createZipPuzzle(seed, requestedDifficulty = 'aleatoire') {
  if (!Number.isInteger(seed) || seed < 1 || seed > 0xffffffff) {
    throw new RangeError('La graine ZIP doit être un entier positif sur 32 bits.');
  }
  if (
    requestedDifficulty !== 'aleatoire' &&
    !Object.hasOwn(CHECKPOINT_COUNTS, requestedDifficulty)
  ) {
    throw new RangeError('Difficulté ZIP invalide.');
  }

  const random = createRandom(seed);
  const solution = generateHamiltonianPath(BOARD_SIZE, random);
  const difficulties = Object.keys(CHECKPOINT_COUNTS);
  const difficulty =
    requestedDifficulty === 'aleatoire'
      ? difficulties[Math.floor(random() * difficulties.length)]
      : requestedDifficulty;
  const colorRandom = createRandom((seed ^ 0x9e3779b9) >>> 0);
  const createPuzzle = (path) => ({
    game: 'zip',
    seed,
    size: BOARD_SIZE,
    difficulty,
    pathHue: Math.floor(colorRandom() * 360),
    solution: path,
    checkpoints: generateCheckpoints(path, random, difficulty),
    walls: generateWalls(path, random, BOARD_SIZE, difficulty),
  });

  let puzzle = createPuzzle(solution);
  if (!validateZip(puzzle, puzzle.solution).won) {
    puzzle = createPuzzle(generateFallbackPath(BOARD_SIZE, random));
  }
  if (!validateZip(puzzle, puzzle.solution).won) {
    throw new Error('Impossible de générer une grille ZIP finissable.');
  }
  return puzzle;
}

export function validateZip(puzzle, path) {
  if (
    !puzzle ||
    puzzle.game !== 'zip' ||
    !Number.isInteger(puzzle.size) ||
    !Array.isArray(puzzle.checkpoints) ||
    (puzzle.walls !== undefined && !Array.isArray(puzzle.walls)) ||
    !Array.isArray(path)
  ) {
    throw new TypeError('Grille ZIP ou chemin invalide.');
  }

  const { size, checkpoints } = puzzle;
  const walls = puzzle.walls ?? [];
  if (
    size < 2 ||
    checkpoints.length < 2 ||
    walls.some(
      (wall) =>
        !Number.isInteger(wall.row) ||
        !Number.isInteger(wall.col) ||
        wall.row < 0 ||
        wall.row >= size ||
        wall.col < 0 ||
        wall.col >= size ||
        (wall.direction !== 'right' && wall.direction !== 'down') ||
        (wall.direction === 'right' && wall.col === size - 1) ||
        (wall.direction === 'down' && wall.row === size - 1),
    ) ||
    checkpoints.some(
      (checkpoint, index) =>
        checkpoint.number !== index + 1 ||
        !Number.isInteger(checkpoint.pathIndex) ||
        checkpoint.pathIndex < 0 ||
        checkpoint.pathIndex >= size * size ||
        !Number.isInteger(checkpoint.row) ||
        !Number.isInteger(checkpoint.col) ||
        checkpoint.row < 0 ||
        checkpoint.row >= size ||
        checkpoint.col < 0 ||
        checkpoint.col >= size ||
        (index > 0 &&
          checkpoint.pathIndex <= checkpoints[index - 1].pathIndex),
    )
    || checkpoints[0].pathIndex !== 0
    || checkpoints.at(-1).pathIndex !== size * size - 1
  ) {
    throw new TypeError('Les repères numérotés de la grille ZIP sont invalides.');
  }

  const visited = new Set();
  let nextCheckpoint = 0;
  let reason = '';

  for (let index = 0; index < path.length; index += 1) {
    const cell = path[index];
    if (
      !Number.isInteger(cell?.row) ||
      !Number.isInteger(cell?.col) ||
      cell.row < 0 ||
      cell.row >= size ||
      cell.col < 0 ||
      cell.col >= size
    ) {
      throw new RangeError('Chaque étape du chemin ZIP doit être dans la grille.');
    }

    const key = `${cell.row},${cell.col}`;
    if (visited.has(key)) {
      reason = 'Le chemin ne peut pas repasser sur une case déjà traversée.';
      break;
    }

    if (index === 0) {
      const start = checkpoints[0];
      if (cell.row !== start.row || cell.col !== start.col) {
        reason = 'Le chemin doit commencer au nœud numéro 1.';
        break;
      }
    } else {
      const previous = path[index - 1];
      if (Math.abs(previous.row - cell.row) + Math.abs(previous.col - cell.col) !== 1) {
        reason = 'Le chemin doit avancer d’une case voisine, sans diagonale.';
        break;
      }
      const wall = walls.find((candidate) =>
        previous.row === cell.row
          ? candidate.direction === 'right' &&
            candidate.row === cell.row &&
            candidate.col === Math.min(previous.col, cell.col)
          : candidate.direction === 'down' &&
            candidate.col === cell.col &&
            candidate.row === Math.min(previous.row, cell.row),
      );
      if (wall) {
        reason = 'Un mur empêche de passer par cette liaison.';
        break;
      }
    }

    const checkpoint = checkpoints[nextCheckpoint];
    if (checkpoint && cell.row === checkpoint.row && cell.col === checkpoint.col) {
      if (
        nextCheckpoint === checkpoints.length - 1 &&
        index !== size * size - 1
      ) {
        reason = 'Le dernier chiffre ne peut être rejoint qu’après avoir parcouru toutes les cases.';
        break;
      }
      nextCheckpoint += 1;
    } else if (
      checkpoints.some(
        (future, checkpointIndex) =>
          checkpointIndex > nextCheckpoint &&
          future.row === cell.row &&
          future.col === cell.col,
      )
    ) {
      reason = 'Reliez les nœuds numérotés dans l’ordre.';
      break;
    }

    if (nextCheckpoint === checkpoints.length && index < path.length - 1) {
      reason = 'Le chemin doit se terminer sur le dernier nœud numéroté.';
      break;
    }

    visited.add(key);
  }

  const valid = reason === '';
  const won =
    valid &&
    path.length === size * size &&
    visited.size === size * size &&
    nextCheckpoint === checkpoints.length &&
    path.at(-1)?.row === checkpoints.at(-1).row &&
    path.at(-1)?.col === checkpoints.at(-1).col;

  return {
    valid,
    complete: path.length === size * size,
    won,
    reason,
    visitedCount: visited.size,
  };
}
