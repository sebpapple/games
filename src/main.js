import { createRouter } from './router.js';
import {
  createQueensPuzzle,
  findLogicalQueensCross,
  validateQueens,
} from './games/queens.js';
import { createZipPuzzle, validateZip } from './games/zip.js';
import {
  createTangoPuzzle,
  findLogicalTangoHint,
  validateTango,
} from './games/tango.js';
import { recordLevelCompletion } from './progress.js';

const app = document.querySelector('#app');
const GAME_NAMES = {
  patches: 'Patches',
  zip: 'Zip',
  queens: 'Queens',
  tango: 'Tango',
};
const REGION_COLORS = [
  '#8db7f5',
  '#f9c58f',
  '#c5a0d6',
  '#a4d39c',
  '#f17f6e',
  '#b7b39d',
  '#e4ef80',
  '#d8d8d8',
];
const AVAILABLE_GAMES = new Set(['queens', 'zip', 'tango']);

let router;
let activeGameState = null;

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  })[character]);
}

function renderHome() {
  activeGameState = null;
  app.innerHTML = `
    <main class="shell">
      <header class="topbar">
        <a class="brand" href="#/">Grid Games</a>
        <span class="offline-label"><span></span> Jouable hors ligne</span>
      </header>
      <section class="hero">
        <p class="eyebrow">PAUSE LOGIQUE</p>
        <h1>Un jeu. Une grille.<br />À vous de jouer.</h1>
        <p class="intro">Quatre défis de logique à retrouver, même sans connexion.</p>
      </section>
      <section class="game-list" aria-label="Choisir un jeu">
        ${Object.entries(GAME_NAMES).map(([game, name]) => `
          <a class="game-card ${AVAILABLE_GAMES.has(game) ? 'available' : 'coming-soon'}"
             href="#/game/${game}/random" ${AVAILABLE_GAMES.has(game) ? '' : 'aria-disabled="true"'}>
            <span class="game-title">${name}</span>
            <span class="game-description">${game === 'queens' ? 'Une reine par ligne, colonne et région.' : game === 'zip' ? 'Reliez les nœuds et remplissez toute la grille.' : game === 'tango' ? 'Équilibrez soleils et lunes selon les règles.' : 'Moteur de jeu à venir'}</span>
            <span class="card-arrow" aria-hidden="true">${AVAILABLE_GAMES.has(game) ? '→' : '·'}</span>
          </a>
        `).join('')}
      </section>
      <footer class="site-footer">Progression sauvegardée sur cet appareil.</footer>
    </main>
  `;

  for (const link of app.querySelectorAll('.coming-soon')) {
    link.addEventListener('click', (event) => event.preventDefault());
  }
}

function renderGame(route) {
  if (route.game === 'tango') {
    renderTangoGame(route);
    return;
  }

  if (route.game === 'zip') {
    renderZipGame(route);
    return;
  }

  if (route.game !== 'queens') {
    activeGameState = null;
    app.innerHTML = `
      <main class="shell">
        <header class="topbar">
          <a class="brand" href="#/">Grid Games</a>
          <a class="back-link" href="#/">Tous les jeux</a>
        </header>
        <section class="placeholder">
          <p class="eyebrow">${escapeHtml(GAME_NAMES[route.game])}</p>
          <h1>Ce jeu arrive bientôt.</h1>
          <p>Le socle est prêt ; ce moteur sera ajouté dans une prochaine étape.</p>
          <a class="primary-button" href="#/">Retour aux jeux</a>
        </section>
      </main>
    `;
    return;
  }

  const selectedDifficulty = route.difficulty ?? 'aleatoire';
  const puzzle = createQueensPuzzle(route.seed, selectedDifficulty);
  activeGameState = {
    puzzle,
    placements: [],
    cellStates: new Map(),
    hintMessage: '',
    hintCells: new Set(),
    dragging: null,
    suppressClick: false,
    startedAt: Date.now(),
    completed: false,
  };

  app.innerHTML = `
    <main class="shell game-shell">
      <header class="topbar">
        <a class="brand" href="#/">Grid Games</a>
        <a class="back-link" href="#/">Tous les jeux</a>
      </header>
      <section class="game-heading">
        <div>
          <p class="eyebrow">JEU 01 · LOGIQUE</p>
          <h1>Queens</h1>
          <div class="level-meta">
            <span class="difficulty-badge difficulty-${puzzle.difficulty}">${capitalize(puzzle.difficulty)}</span>
          </div>
          <p class="game-instructions">Placez une reine par ligne, colonne et région. Les reines ne peuvent pas se toucher.</p>
        </div>
        <div class="level-control">
          <label class="difficulty-select-label" for="difficulty-select">Difficulté</label>
          <select class="difficulty-select" id="difficulty-select" aria-label="Choisir la difficulté">
            <option value="aleatoire" ${selectedDifficulty === 'aleatoire' ? 'selected' : ''}>Aléatoire</option>
            <option value="facile" ${selectedDifficulty === 'facile' ? 'selected' : ''}>Facile</option>
            <option value="moyen" ${selectedDifficulty === 'moyen' ? 'selected' : ''}>Moyen</option>
            <option value="difficile" ${selectedDifficulty === 'difficile' ? 'selected' : ''}>Difficile</option>
          </select>
          <button class="secondary-button random-level-button" id="random-level" type="button">Nouveau niveau aléatoire <span aria-hidden="true">↻</span></button>
        </div>
      </section>
      <section class="play-area">
        <div class="board-wrap">
          <div id="queens-board" class="queens-board" role="grid" aria-label="Grille Queens générée aléatoirement"></div>
          <div class="game-status" id="game-status" role="status" aria-live="polite"></div>
          <div class="game-actions">
            <div class="action-buttons">
              <button class="secondary-button" id="clear-board" type="button">Effacer</button>
              <button class="secondary-button hint-button" id="queens-hint" type="button">Indice</button>
            </div>
          </div>
        </div>
        <aside class="rules-card">
          <span class="rules-icon" aria-hidden="true">♛</span>
          <h2>Comment jouer</h2>
          <ol>
            <li>Une seule reine sur chaque ligne.</li>
            <li>Une seule reine sur chaque colonne et région colorée.</li>
            <li>Aucune reine ne doit toucher une autre, même en diagonale.</li>
          </ol>
          <p>Cliquez une fois pour marquer une case, une deuxième fois pour placer une reine, puis une troisième fois pour l’effacer. Faites glisser pour ajouter ou retirer plusieurs croix d’un coup.</p>
        </aside>
      </section>
    </main>
  `;

  app.querySelector('#random-level').addEventListener('click', () => {
    router.navigateRandom('queens', selectedDifficulty);
  });
  app.querySelector('#difficulty-select').addEventListener('change', (event) => {
    router.navigateRandom('queens', event.target.value);
  });
  app.querySelector('#clear-board').addEventListener('click', clearQueensBoard);
  app.querySelector('#queens-hint').addEventListener('click', revealQueensHint);
  const board = app.querySelector('#queens-board');
  board.addEventListener('click', handleQueensBoardClick);
  board.addEventListener('pointerdown', handleQueensPointerDown);
  board.addEventListener('pointermove', handleQueensPointerMove);
  board.addEventListener('pointerup', finishQueensPointer);
  board.addEventListener('pointercancel', finishQueensPointer);
  renderQueensBoard();
}

function renderZipGame(route) {
  const selectedDifficulty = route.difficulty ?? 'aleatoire';
  const puzzle = createZipPuzzle(route.seed, selectedDifficulty);
  activeGameState = {
    game: 'zip',
    puzzle,
    path: [puzzle.checkpoints[0]],
    dragging: null,
    suppressClick: false,
    message: '',
    startedAt: Date.now(),
    completed: false,
  };

  app.innerHTML = `
    <main class="shell game-shell">
      <header class="topbar">
        <a class="brand" href="#/">Grid Games</a>
        <a class="back-link" href="#/">Tous les jeux</a>
      </header>
      <section class="game-heading">
        <div>
          <p class="eyebrow">JEU 02 · PARCOURS</p>
          <h1>Zip</h1>
          <div class="level-meta">
            <span class="difficulty-badge difficulty-${puzzle.difficulty}">${capitalize(puzzle.difficulty)}</span>
          </div>
          <p class="game-instructions">Reliez les nœuds numérotés dans l’ordre, passez une seule fois par chaque case, évitez les murs et terminez sur le dernier chiffre.</p>
        </div>
        <div class="level-control">
          <label class="difficulty-select-label" for="zip-difficulty">Difficulté</label>
          <select class="difficulty-select" id="zip-difficulty" aria-label="Choisir la difficulté">
            <option value="aleatoire" ${selectedDifficulty === 'aleatoire' ? 'selected' : ''}>Aléatoire</option>
            <option value="facile" ${selectedDifficulty === 'facile' ? 'selected' : ''}>Facile</option>
            <option value="moyen" ${selectedDifficulty === 'moyen' ? 'selected' : ''}>Moyen</option>
            <option value="difficile" ${selectedDifficulty === 'difficile' ? 'selected' : ''}>Difficile</option>
          </select>
          <button class="secondary-button random-level-button" id="zip-new-game" type="button">Nouvelle grille <span aria-hidden="true">↻</span></button>
        </div>
      </section>
      <section class="play-area">
        <div class="board-wrap">
          <div id="zip-board" class="zip-board" role="grid" aria-label="Grille Zip de ${puzzle.size} par ${puzzle.size}"></div>
          <div class="game-status" id="zip-status" role="status" aria-live="polite"></div>
          <div class="game-actions">
            <div class="action-buttons">
              <button class="secondary-button" id="zip-undo" type="button">Annuler</button>
              <button class="secondary-button" id="zip-reset" type="button">Recommencer</button>
            </div>
          </div>
        </div>
        <aside class="rules-card">
          <span class="rules-icon" aria-hidden="true">↝</span>
          <h2>Comment jouer</h2>
          <ol>
            <li>Commencez au nœud 1 et reliez les numéros dans l’ordre.</li>
            <li>Avancez uniquement vers une case voisine, horizontalement ou verticalement.</li>
            <li>Le chemin ne peut ni se croiser ni repasser sur une case.</li>
            <li>Les traits épais sont des murs : il est interdit de les franchir.</li>
            <li>Remplissez toutes les cases et terminez obligatoirement sur le chiffre le plus élevé.</li>
          </ol>
          <p>Cliquez sur une case voisine ou faites glisser le chemin. Cliquez sur l’étape précédente pour revenir en arrière.</p>
        </aside>
      </section>
    </main>
  `;

  app.querySelector('#zip-new-game').addEventListener('click', () => {
    router.navigateRandom('zip', selectedDifficulty);
  });
  app.querySelector('#zip-difficulty').addEventListener('change', (event) => {
    router.navigateRandom('zip', event.target.value);
  });
  app.querySelector('#zip-undo').addEventListener('click', undoZipStep);
  app.querySelector('#zip-reset').addEventListener('click', resetZipPath);
  const board = app.querySelector('#zip-board');
  board.addEventListener('click', handleZipBoardClick);
  board.addEventListener('pointerdown', handleZipPointerDown);
  board.addEventListener('pointermove', handleZipPointerMove);
  board.addEventListener('pointerup', finishZipPointer);
  board.addEventListener('pointercancel', finishZipPointer);
  renderZipBoard();
}

function renderTangoGame(route) {
  const selectedDifficulty = route.difficulty ?? 'aleatoire';
  const puzzle = createTangoPuzzle(route.seed, selectedDifficulty);
  const grid = puzzle.givens.map((row) => [...row]);
  activeGameState = {
    game: 'tango',
    puzzle,
    grid,
    fixedCells: new Set(
      puzzle.givens.flatMap((row, rowIndex) =>
        row.flatMap((value, colIndex) =>
          value ? [`${rowIndex},${colIndex}`] : [],
        ),
      ),
    ),
    startedAt: Date.now(),
    completed: false,
    warningTimer: null,
    showWarnings: false,
    hintCell: null,
    hintMessage: '',
  };

  app.innerHTML = `
    <main class="shell game-shell">
      <header class="topbar">
        <a class="brand" href="#/">Grid Games</a>
        <a class="back-link" href="#/">Tous les jeux</a>
      </header>
      <section class="game-heading">
        <div>
          <p class="eyebrow">JEU 03 · ÉQUILIBRE</p>
          <h1>Tango</h1>
          <div class="level-meta">
            <span class="difficulty-badge difficulty-${puzzle.difficulty}">${capitalize(puzzle.difficulty)}</span>
          </div>
          <p class="game-instructions">Remplissez chaque ligne et colonne avec autant de soleils que de lunes. Pas plus de deux symboles identiques à la suite.</p>
        </div>
        <div class="level-control">
          <label class="difficulty-select-label" for="tango-difficulty">Difficulté</label>
          <select class="difficulty-select" id="tango-difficulty" aria-label="Choisir la difficulté">
            <option value="aleatoire" ${selectedDifficulty === 'aleatoire' ? 'selected' : ''}>Aléatoire</option>
            <option value="facile" ${selectedDifficulty === 'facile' ? 'selected' : ''}>Facile</option>
            <option value="moyen" ${selectedDifficulty === 'moyen' ? 'selected' : ''}>Moyen</option>
            <option value="difficile" ${selectedDifficulty === 'difficile' ? 'selected' : ''}>Difficile</option>
          </select>
          <button class="secondary-button random-level-button" id="tango-new-game" type="button">Nouveau niveau aléatoire <span aria-hidden="true">↻</span></button>
        </div>
      </section>
      <section class="play-area">
        <div class="board-wrap">
          <div id="tango-board" class="tango-board" style="--tango-size:${puzzle.size}" role="grid" aria-label="Grille Tango de ${puzzle.size} par ${puzzle.size}"></div>
          <div class="game-status" id="tango-status" role="status" aria-live="polite"></div>
          <div class="game-actions">
            <div class="action-buttons">
              <button class="secondary-button" id="tango-reset" type="button">Effacer</button>
              <button class="secondary-button hint-button" id="tango-hint" type="button">Indice</button>
            </div>
          </div>
        </div>
        <aside class="rules-card">
          <span class="rules-icon" aria-hidden="true">${renderTangoSymbol('sun')}</span>
          <h2>Comment jouer</h2>
          <ol>
            <li>Chaque ligne et colonne contient autant de soleils que de lunes.</li>
            <li>Il ne peut pas y avoir trois symboles identiques consécutifs.</li>
            <li>Les signes « = » imposent deux symboles identiques ; « × » impose deux symboles différents.</li>
          </ol>
          <p>Cliquez sur une case pour alterner entre soleil, lune et case vide. Les cases préremplies sont verrouillées.</p>
        </aside>
      </section>
    </main>
  `;

  app.querySelector('#tango-new-game').addEventListener('click', () => {
    router.navigateRandom('tango', selectedDifficulty);
  });
  app.querySelector('#tango-difficulty').addEventListener('change', (event) => {
    router.navigateRandom('tango', event.target.value);
  });
  app.querySelector('#tango-reset').addEventListener('click', resetTangoBoard);
  app.querySelector('#tango-hint').addEventListener('click', revealTangoHint);
  app.querySelector('#tango-board').addEventListener('click', handleTangoBoardClick);
  renderTangoBoard();
}

function renderZipBoard() {
  const state = activeGameState;
  const board = app.querySelector('#zip-board');
  if (!state || state.game !== 'zip' || !board) return;

  const validation = validateZip(state.puzzle, state.path);
  const pathIndexes = new Map(
    state.path.map((cell, index) => [`${cell.row},${cell.col}`, index]),
  );
  const checkpoints = new Map(
    state.puzzle.checkpoints.map((checkpoint) => [
      `${checkpoint.row},${checkpoint.col}`,
      checkpoint.number,
    ]),
  );
  const wallEdges = new Set(
    (state.puzzle.walls ?? []).map(
      ({ row, col, direction }) => `${row},${col},${direction}`,
    ),
  );

  board.innerHTML = Array.from({ length: state.puzzle.size }, (_, row) =>
    Array.from({ length: state.puzzle.size }, (_, col) => {
      const key = `${row},${col}`;
      const pathIndex = pathIndexes.get(key);
      const checkpoint = checkpoints.get(key);
      const isPath = pathIndex !== undefined;
      const content = checkpoint ? `<span class="zip-node">${checkpoint}</span>` : '';
      const wallClasses = [
        wallEdges.has(`${row},${col},right`) ? 'has-wall-right' : '',
        wallEdges.has(`${row},${col},down`) ? 'has-wall-down' : '',
      ].filter(Boolean).join(' ');
      const stateLabel = checkpoint
        ? `nœud ${checkpoint}`
        : isPath
          ? `étape ${pathIndex + 1} du chemin`
          : 'case vide';
      return `<button class="zip-cell ${isPath ? 'is-path' : ''} ${checkpoint ? 'is-checkpoint' : ''} ${wallClasses}"
        type="button" role="gridcell" aria-label="Ligne ${row + 1}, colonne ${col + 1}, ${stateLabel}"
        data-row="${row}" data-col="${col}" style="--zip-cell-index:${row * state.puzzle.size + col}">${content}</button>`;
    }),
  ).flat().join('');
  board.insertAdjacentHTML('beforeend', createZipPathSvg(state));

  const status = app.querySelector('#zip-status');
  if (validation.won && !state.completed) {
    state.completed = true;
    const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    recordLevelCompletion('zip', state.puzzle.seed, elapsedSeconds);
    status.className = 'game-status success';
    status.textContent = `Bravo ! Grille terminée en ${formatDuration(elapsedSeconds)}.`;
  } else {
    status.className = `game-status ${state.message ? 'error' : ''}`;
    status.textContent =
      state.message ||
      `${validation.visitedCount} / ${state.puzzle.size ** 2} cases parcourues · Nœud ${getZipCheckpointProgress(state)} / ${state.puzzle.checkpoints.length}`;
  }
  board.classList.toggle('is-complete', state.completed);
  app.querySelector('#zip-undo').disabled =
    state.completed || state.path.length <= 1;
  app.querySelector('#zip-reset').disabled =
    state.completed || state.path.length <= 1;
}

function renderTangoBoard() {
  const state = activeGameState;
  const board = app.querySelector('#tango-board');
  if (!state || state.game !== 'tango' || !board) return;

  const validation = validateTango(state.puzzle, state.grid);
  const conflicts = new Set(validation.conflicts.map(({ row, col }) => `${row},${col}`));
  const showWarnings = state.showWarnings;
  board.innerHTML = state.grid.flatMap((row, rowIndex) =>
    row.map((value, colIndex) => {
      const key = `${rowIndex},${colIndex}`;
      const fixed = state.fixedCells.has(key);
      const marker = value ? renderTangoSymbol(value) : '';
      const symbolLabel = value === 'sun' ? 'soleil' : value === 'moon' ? 'lune' : 'vide';
      const hinted = state.hintCell?.row === rowIndex && state.hintCell?.col === colIndex;
      return `<button class="tango-cell ${value ? `is-${value}` : ''} ${fixed ? 'is-fixed' : ''} ${showWarnings && conflicts.has(key) ? 'has-conflict' : ''} ${hinted ? 'is-hinted' : ''}"
        type="button" role="gridcell" aria-label="Ligne ${rowIndex + 1}, colonne ${colIndex + 1}, ${symbolLabel}${fixed ? ', indice fixe' : ''}"
        aria-pressed="${Boolean(value)}" ${fixed || state.completed ? 'disabled' : ''}
        data-row="${rowIndex}" data-col="${colIndex}">${marker}</button>`;
    }),
  ).join('');
  const relationMarkup = state.puzzle.relations.map(
    ({ row, col, direction, type }) => {
      const x =
        ((col + (direction === 'right' ? 1 : 0.5)) / state.puzzle.size) * 100;
      const y =
        ((row + (direction === 'down' ? 1 : 0.5)) / state.puzzle.size) * 100;
      return `<span class="tango-relation" style="--relation-x:${x}%;--relation-y:${y}%" aria-hidden="true">${type === 'equal' ? '=' : '×'}</span>`;
    },
  ).join('');
  board.insertAdjacentHTML(
    'beforeend',
    `<div class="tango-relations" aria-hidden="true">${relationMarkup}</div>`,
  );

  const status = app.querySelector('#tango-status');
  if (validation.won && !state.completed) {
    state.completed = true;
    const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    recordLevelCompletion('tango', state.puzzle.level, elapsedSeconds);
    status.className = 'game-status success';
    status.textContent = `Bravo ! Niveau terminé en ${formatDuration(elapsedSeconds)}.`;
    board.classList.add('is-complete');
    board.querySelectorAll('.tango-cell').forEach((cell) => {
      cell.disabled = true;
    });
  } else if (state.hintMessage) {
    status.className = 'game-status hint';
    status.textContent = state.hintMessage;
  } else if (!validation.valid && showWarnings) {
    status.className = 'game-status error';
    status.textContent = 'Certaines cases enfreignent les règles. Corrigez les cases en rouge.';
  } else if (state.completed) {
    status.className = 'game-status success';
    status.textContent = 'Niveau terminé. Bien joué !';
  } else {
    status.className = 'game-status';
    status.textContent = `${validation.filledCount} / ${state.puzzle.size ** 2} cases remplies`;
  }
  app.querySelector('#tango-reset').disabled =
    state.completed || validation.filledCount === state.fixedCells.size;
}

function handleTangoBoardClick(event) {
  const cell = event.target.closest('.tango-cell');
  const state = activeGameState;
  if (!cell || !state || state.game !== 'tango' || state.completed) return;

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const key = `${row},${col}`;
  if (state.fixedCells.has(key)) return;

  const nextValue = { empty: 'sun', sun: 'moon', moon: 'empty' };
  const currentValue = state.grid[row][col] ?? 'empty';
  state.grid[row][col] = nextValue[currentValue] === 'empty'
    ? null
    : nextValue[currentValue];
  window.clearTimeout(state.warningTimer);
  state.warningTimer = null;
  state.showWarnings = false;
  state.hintCell = null;
  state.hintMessage = '';
  renderTangoBoard();
  const currentState = state;
  state.warningTimer = window.setTimeout(() => {
    if (activeGameState !== currentState || currentState.completed) return;
    currentState.showWarnings = true;
    currentState.warningTimer = null;
    renderTangoBoard();
  }, 1500);
}

function revealTangoHint() {
  const state = activeGameState;
  if (!state || state.game !== 'tango' || state.completed) return;

  window.clearTimeout(state.warningTimer);
  state.warningTimer = null;
  state.showWarnings = false;
  const hint = findLogicalTangoHint(state.puzzle, state.grid);
  if (hint) {
    state.hintCell = { row: hint.row, col: hint.col };
    state.hintMessage = `Indice — ligne ${hint.row + 1}, colonne ${hint.col + 1} : cette case doit contenir ${hint.value === 'sun' ? 'un soleil' : 'une lune'}. ${hint.explanation}`;
  } else {
    state.hintCell = null;
    state.hintMessage =
      'Aucune case ne peut être déduite avec certitude à partir des indices et des symboles actuellement posés.';
  }
  renderTangoBoard();
}

function resetTangoBoard() {
  const state = activeGameState;
  if (!state || state.game !== 'tango' || state.completed) return;
  window.clearTimeout(state.warningTimer);
  state.warningTimer = null;
  state.showWarnings = false;
  state.hintCell = null;
  state.hintMessage = '';
  state.grid = state.puzzle.givens.map((row) => [...row]);
  renderTangoBoard();
}

function renderTangoSymbol(value) {
  if (value === 'sun') {
    return `<svg class="tango-symbol" viewBox="0 0 48 48" focusable="false">
      <g class="tango-sun-rays">
        <path d="M24 2v6M24 40v6M2 24h6M40 24h6M8.45 8.45l4.25 4.25m22.6 22.6 4.25 4.25m0-31.1-4.25 4.25m-22.6 22.6-4.25 4.25" />
      </g>
      <circle class="tango-sun-disc" cx="24" cy="24" r="11.5" />
    </svg>`;
  }
  return `<svg class="tango-symbol" viewBox="0 0 48 48" focusable="false">
    <path class="tango-moon-shape" d="M35.9 31.4A17.5 17.5 0 0 1 16.6 7.2 18.5 18.5 0 1 0 40.8 26.5a17.3 17.3 0 0 1-4.9 4.9Z" />
  </svg>`;
}

function createZipPathSvg(state) {
  const scale = 100;
  const points = state.path.map(({ row, col }) => ({
    x: col * scale + scale / 2,
    y: row * scale + scale / 2,
  }));
  const pathData = points
    .map(({ x, y }, index) => `${index === 0 ? 'M' : 'L'} ${x} ${y}`)
    .join(' ');

  return `<svg class="zip-path-svg" style="--zip-path-hue: ${state.puzzle.pathHue}" viewBox="0 0 ${state.puzzle.size * scale} ${state.puzzle.size * scale}" aria-hidden="true">
    <path class="zip-path-line" d="${pathData}" />
  </svg>`;
}

function getZipCheckpointProgress(state) {
  return state.path.reduce((progress, cell) => {
    const checkpoint = state.puzzle.checkpoints[progress];
    return checkpoint?.row === cell.row && checkpoint?.col === cell.col
      ? progress + 1
      : progress;
  }, 0);
}

function handleZipBoardClick(event) {
  const state = activeGameState;
  if (!state || state.game !== 'zip') return;
  if (state.suppressClick) {
    state.suppressClick = false;
    event.preventDefault();
    return;
  }

  const cell = event.target.closest('.zip-cell');
  if (cell) {
    visitZipCell(Number(cell.dataset.row), Number(cell.dataset.col));
  }
}

function handleZipPointerDown(event) {
  const cell = event.target.closest('.zip-cell');
  if (
    !activeGameState ||
    activeGameState.game !== 'zip' ||
    !cell ||
    event.button !== 0
  ) {
    return;
  }

  activeGameState.dragging = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    moved: false,
  };
}

function handleZipPointerMove(event) {
  const state = activeGameState;
  const drag = state?.game === 'zip' ? state.dragging : null;
  if (!drag || drag.pointerId !== event.pointerId || !(event.buttons & 1)) return;
  if (Math.hypot(event.clientX - drag.x, event.clientY - drag.y) < 5 && !drag.moved) {
    return;
  }
  if (!drag.moved) event.currentTarget.setPointerCapture(event.pointerId);
  drag.moved = true;

  const board = event.currentTarget;
  const bounds = board.getBoundingClientRect();
  const cellSize = bounds.width / state.puzzle.size;
  const steps = Math.max(
    1,
    Math.ceil(
      Math.hypot(event.clientX - drag.lastX, event.clientY - drag.lastY) /
        (cellSize / 3),
    ),
  );

  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = drag.lastX + (event.clientX - drag.lastX) * progress;
    const y = drag.lastY + (event.clientY - drag.lastY) * progress;
    const cell = document.elementFromPoint(x, y)?.closest('.zip-cell');
    if (cell && board.contains(cell)) {
      visitZipCell(Number(cell.dataset.row), Number(cell.dataset.col), true);
    }
  }

  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
}

function finishZipPointer(event) {
  const state = activeGameState;
  if (
    !state ||
    state.game !== 'zip' ||
    !state.dragging ||
    state.dragging.pointerId !== event.pointerId
  ) {
    return;
  }
  if (state.dragging.moved) {
    state.suppressClick = true;
    setTimeout(() => {
      if (activeGameState === state) state.suppressClick = false;
    }, 0);
  }
  state.dragging = null;
}

function visitZipCell(row, col, fromDrag = false) {
  const state = activeGameState;
  if (!state || state.game !== 'zip' || state.completed) return;

  const path = state.path;
  const last = path[path.length - 1];
  const existingPathIndex = path.findIndex(
    (cell) => cell.row === row && cell.col === col,
  );
  if (existingPathIndex >= 0) {
    if (fromDrag) return;
    if (existingPathIndex < path.length - 1) {
      path.splice(existingPathIndex + 1);
    }
    state.message = '';
    renderZipBoard();
    return;
  }
  if (last.row === row && last.col === col) return;

  if (path.some((cell) => cell.row === row && cell.col === col)) {
    if (!fromDrag) state.message = 'Le chemin ne peut pas repasser sur une case déjà traversée.';
    renderZipBoard();
    return;
  }

  const candidate = { row, col };
  const nextPath = [...path, candidate];
  const validation = validateZip(state.puzzle, nextPath);
  if (!validation.valid) {
    if (!fromDrag) state.message = validation.reason;
    renderZipBoard();
    return;
  }

  path.push(candidate);
  state.message = '';
  renderZipBoard();
}

function undoZipStep() {
  const state = activeGameState;
  if (!state || state.game !== 'zip' || state.completed || state.path.length <= 1) return;
  state.path.pop();
  state.message = '';
  renderZipBoard();
}

function resetZipPath() {
  const state = activeGameState;
  if (!state || state.game !== 'zip' || state.completed) return;
  state.path = [state.puzzle.checkpoints[0]];
  state.message = '';
  renderZipBoard();
}

function renderQueensBoard() {
  const state = activeGameState;
  const board = app.querySelector('#queens-board');
  if (!state || !board) return;

  const validation = validateQueens(state.puzzle, state.placements);
  const conflictKeys = new Set(validation.conflicts.map(({ row, col }) => `${row},${col}`));
  const placementKeys = new Set(state.placements.map(({ row, col }) => `${row},${col}`));
  board.innerHTML = state.puzzle.regions.flatMap((row, rowIndex) =>
    row.map((region, colIndex) => {
      const key = `${rowIndex},${colIndex}`;
      const cellState = state.cellStates.get(key) ?? 'empty';
      const hasQueen = placementKeys.has(key);
      const hasConflict = conflictKeys.has(key);
      const isHinted = state.hintCells.has(key);
      const regionEdgeRight =
        colIndex < state.puzzle.size - 1 && region !== row[colIndex + 1];
      const regionEdgeBottom =
        rowIndex < state.puzzle.size - 1 &&
        region !== state.puzzle.regions[rowIndex + 1][colIndex];
      const stateLabel = hasQueen ? 'reine' : cellState === 'excluded' ? 'éliminée' : 'vide';
      const marker = hasQueen
        ? '<span class="queen-marker" aria-hidden="true">♛</span>'
        : cellState === 'excluded'
          ? '<span class="excluded-marker" aria-hidden="true">×</span>'
          : '';
      return `<button class="queen-cell ${hasConflict ? 'has-conflict' : ''} ${isHinted ? 'is-hinted' : ''} ${regionEdgeRight ? 'region-edge-right' : ''} ${regionEdgeBottom ? 'region-edge-bottom' : ''}"
        type="button" role="gridcell" aria-label="Ligne ${rowIndex + 1}, colonne ${colIndex + 1}, ${stateLabel}"
        aria-pressed="${cellState !== 'empty'}" style="--region-color:${REGION_COLORS[region % REGION_COLORS.length]}"
        data-row="${rowIndex}" data-col="${colIndex}">${marker}</button>`;
    }),
  ).join('');

  const hintButton = app.querySelector('#queens-hint');
  hintButton.disabled = state.completed;

  const status = app.querySelector('#game-status');
  if (validation.won && !state.completed) {
    state.completed = true;
    const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    recordLevelCompletion('queens', state.puzzle.level, elapsedSeconds);
    status.className = 'game-status success';
    status.textContent = `Bravo ! Niveau terminé en ${formatDuration(elapsedSeconds)}.`;
    board.classList.add('is-complete');
  } else if (!validation.valid) {
    status.className = 'game-status error';
    status.textContent = 'Conflit : vérifiez les cases en rouge.';
  } else if (state.completed) {
    status.className = 'game-status success';
    status.textContent = 'Niveau terminé. Bien joué !';
  } else {
    status.className = 'game-status';
    status.textContent = state.hintMessage ||
      `${state.placements.length} / ${state.puzzle.size} reines placées`;
    board.classList.remove('is-complete');
  }
}

function handleQueensBoardClick(event) {
  if (!activeGameState) return;
  if (activeGameState.suppressClick) {
    activeGameState.suppressClick = false;
    event.preventDefault();
    return;
  }

  const cell = event.target.closest('.queen-cell');
  if (cell) {
    toggleQueen(Number(cell.dataset.row), Number(cell.dataset.col));
  }
}

function handleQueensPointerDown(event) {
  const cell = event.target.closest('.queen-cell');
  if (!activeGameState || !cell || event.button !== 0) return;

  activeGameState.dragging = {
    pointerId: event.pointerId,
    x: event.clientX,
    y: event.clientY,
    lastX: event.clientX,
    lastY: event.clientY,
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
    moved: false,
    mode: activeGameState.cellStates.get(`${cell.dataset.row},${cell.dataset.col}`) === 'excluded'
      ? 'remove'
      : 'add',
  };
}

function handleQueensPointerMove(event) {
  const state = activeGameState;
  const drag = state?.dragging;
  if (!drag || drag.pointerId !== event.pointerId || !(event.buttons & 1)) return;

  const totalDistance = Math.hypot(event.clientX - drag.x, event.clientY - drag.y);
  if (!drag.moved && totalDistance < 5) return;
  if (!drag.moved) {
    event.currentTarget.setPointerCapture(event.pointerId);
  }
  drag.moved = true;

  const board = event.currentTarget;
  const bounds = board.getBoundingClientRect();
  const steps = Math.max(
    1,
    Math.ceil(Math.hypot(event.clientX - drag.lastX, event.clientY - drag.lastY) / (bounds.width / state.puzzle.size / 3)),
  );
  for (let step = 0; step <= steps; step += 1) {
    const progress = step / steps;
    const x = drag.lastX + (event.clientX - drag.lastX) * progress;
    const y = drag.lastY + (event.clientY - drag.lastY) * progress;
    const cell = document.elementFromPoint(x, y)?.closest('.queen-cell');
    if (cell && board.contains(cell)) {
      applyDraggedCross(
        Number(cell.dataset.row),
        Number(cell.dataset.col),
        drag.mode,
      );
    }
  }

  applyDraggedCross(drag.row, drag.col, drag.mode);
  drag.lastX = event.clientX;
  drag.lastY = event.clientY;
  renderQueensBoard();
}

function finishQueensPointer(event) {
  const state = activeGameState;
  if (!state?.dragging || state.dragging.pointerId !== event.pointerId) return;

  if (state.dragging.moved) {
    state.suppressClick = true;
    setTimeout(() => {
      if (activeGameState === state) state.suppressClick = false;
    }, 0);
  }
  state.dragging = null;
}

function applyDraggedCross(row, col, mode) {
  if (!activeGameState) return;
  const key = `${row},${col}`;
  const currentState = activeGameState.cellStates.get(key) ?? 'empty';
  if (currentState === 'queen') return;

  if (mode === 'remove') {
    activeGameState.cellStates.delete(key);
  } else {
    activeGameState.cellStates.set(key, 'excluded');
  }
  activeGameState.completed = false;
  activeGameState.hintMessage = '';
  activeGameState.hintCells.clear();
}

function revealQueensHint() {
  const state = activeGameState;
  if (!state || state.completed) return;

  const excluded = [...state.cellStates]
    .filter(([, cellState]) => cellState === 'excluded')
    .map(([key]) => {
      const [row, col] = key.split(',').map(Number);
      return { row, col };
    });
  const cross = findLogicalQueensCross(state.puzzle, {
    placements: state.placements,
    excluded,
  });

  if (cross) {
    const key = `${cross.row},${cross.col}`;
    state.cellStates.set(key, 'excluded');
    state.hintCells = new Set([key]);
    state.hintMessage = `Indice — cochez la ligne ${cross.row + 1}, colonne ${cross.col + 1}. ${cross.explanation}`;
  } else {
    state.hintCells.clear();
    state.hintMessage =
      'Aucune nouvelle croix ne peut être déduite des reines et des croix actuellement visibles. Posez une reine ou poursuivez vos déductions, puis redemandez un indice.';
  }
  renderQueensBoard();
}

function toggleQueen(row, col) {
  if (!activeGameState) return;
  const key = `${row},${col}`;
  const previousState = activeGameState.cellStates.get(key) ?? 'empty';
  const nextState = {
    empty: 'excluded',
    excluded: 'queen',
    queen: 'empty',
  }[previousState];

  activeGameState.cellStates.set(key, nextState);
  activeGameState.placements = activeGameState.placements.filter(
    (placement) => placement.row !== row || placement.col !== col,
  );
  activeGameState.completed = false;
  activeGameState.hintMessage = '';
  activeGameState.hintCells.clear();
  if (nextState === 'queen') {
    activeGameState.placements.push({ row, col });
  }
  renderQueensBoard();
}

function clearQueensBoard() {
  if (!activeGameState) return;
  activeGameState.completed = false;
  activeGameState.hintMessage = '';
  activeGameState.hintCells.clear();
  activeGameState.placements = [];
  activeGameState.cellStates.clear();
  renderQueensBoard();
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return `${minutes}:${String(remainingSeconds).padStart(2, '0')}`;
}

function capitalize(value) {
  return value.charAt(0).toLocaleUpperCase('fr-FR') + value.slice(1);
}

function render(route) {
  if (route.name === 'home') {
    renderHome();
  } else if (route.name === 'game') {
    renderGame(route);
  } else {
    app.innerHTML = '<main class="shell"><h1>Page introuvable</h1><a href="#/">Accueil</a></main>';
  }
}

router = createRouter(render);
render(router.getCurrentRoute());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch((error) => {
    console.error('Impossible d’enregistrer le Service Worker.', error);
  });
}
