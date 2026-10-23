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
import {
  getCurrentLanguage,
  getCurrentLocale,
  getLanguage,
  getLanguageOptions,
  getGameName,
  setLanguage,
  translate as t,
} from './i18n.js';

const app = document.querySelector('#app');
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
let currentRoute = null;

getLanguage();

function renderLanguageSelector() {
  const languages = getLanguageOptions();
  const selectedLanguage = languages.find(({ code }) => code === getCurrentLanguage());
  const options = languages.map(({ code, name }) =>
    `<button class="language-option" type="button" data-language="${code}" ${code === getCurrentLanguage() ? 'aria-current="true"' : ''}>
      ${renderFlagIcon(code)}<span>${name}</span>
    </button>`,
  ).join('');
  return `<details class="language-picker">
    <summary class="language-trigger" aria-label="${t('language')}: ${selectedLanguage.name}">
      ${renderFlagIcon(getCurrentLanguage())}<span>${selectedLanguage.name}</span>
    </summary>
    <div class="language-menu">${options}</div>
  </details>`;
}

function attachLanguageSelector() {
  app.querySelectorAll('.language-option').forEach((option) => {
    option.addEventListener('click', () => {
      const previousState = activeGameState;
      setLanguage(option.dataset.language);
      render(currentRoute);
      if (previousState && activeGameState?.game === previousState.game) {
        activeGameState = previousState;
        if (previousState.hintData) {
          previousState.hintMessage =
            previousState.game === 'tango'
              ? formatTangoHint(previousState.hintData)
              : formatQueensHint(previousState.hintData);
        } else if (previousState.hintMessage) {
          previousState.hintMessage = t(
            previousState.game === 'tango' ? 'tangoNoHint' : 'queensNoHint',
          );
        }
        if (previousState.game === 'zip') renderZipBoard();
        else if (previousState.game === 'tango') renderTangoBoard();
        else renderQueensBoard();
      }
    });
  });
}

function renderFlagIcon(language) {
  const flags = {
    fr: '<path fill="#1b3c8c" d="M0 0h12v24H0z"/><path fill="#fff" d="M12 0h12v24H12z"/><path fill="#ed2939" d="M24 0h12v24H24z"/>',
    en: '<path fill="#1b3c8c" d="M0 0h36v24H0z"/><path stroke="#fff" stroke-width="6" d="m0 0 36 24M36 0 0 24"/><path stroke="#c8102e" stroke-width="2.5" d="m0 0 36 24M36 0 0 24"/><path stroke="#fff" stroke-width="9" d="M18 0v24M0 12h36"/><path stroke="#c8102e" stroke-width="5" d="M18 0v24M0 12h36"/>',
    de: '<path fill="#111" d="M0 0h36v8H0z"/><path fill="#d00" d="M0 8h36v8H0z"/><path fill="#ffce00" d="M0 16h36v8H0z"/>',
    es: '<path fill="#aa151b" d="M0 0h36v24H0z"/><path fill="#f1bf00" d="M0 6h36v12H0z"/><path fill="#aa151b" d="M0 18h36v6H0z"/>',
    it: '<path fill="#009246" d="M0 0h12v24H0z"/><path fill="#fff" d="M12 0h12v24H12z"/><path fill="#ce2b37" d="M24 0h12v24H24z"/>',
    zh: '<path fill="#de2910" d="M0 0h36v24H0z"/><path fill="#ffde00" d="m8 4 1.2 3.4 3.6.1-2.9 2.1 1.1 3.4L8 11l-3 2 1.1-3.4-2.9-2.1 3.6-.1z"/>',
  };
  return `<svg class="language-flag" viewBox="0 0 36 24" aria-hidden="true" focusable="false">${flags[language]}</svg>`;
}

function difficultyLabel(difficulty) {
  return t({
    facile: 'easy',
    moyen: 'medium',
    difficile: 'hard',
  }[difficulty] ?? 'random');
}

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
        <div class="topbar-actions">
          ${renderLanguageSelector()}
        </div>
      </header>
      <section class="hero">
        <p class="eyebrow">${t('eyebrow')}</p>
        <h1>${t('heroTitle')}</h1>
        <p class="intro">${t('intro')}</p>
      </section>
      <section class="game-list" aria-label="${t('chooseGame')}">
        ${['patches', 'zip', 'queens', 'tango'].map((game) => `
          <a class="game-card ${AVAILABLE_GAMES.has(game) ? 'available' : 'coming-soon'}"
             href="#/game/${game}/random" ${AVAILABLE_GAMES.has(game) ? '' : 'aria-disabled="true"'}>
            <span class="game-title">${getGameName(game)}</span>
            <span class="game-description">${t(`${game}Description`)}</span>
            <span class="card-arrow" aria-hidden="true">${AVAILABLE_GAMES.has(game) ? '→' : '·'}</span>
          </a>
        `).join('')}
      </section>
    </main>
  `;

  attachLanguageSelector();
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
          <div class="topbar-actions">
            <a class="back-link" href="#/">${t('allGames')}</a>
            ${renderLanguageSelector()}
          </div>
        </header>
        <section class="placeholder">
          <p class="eyebrow">${escapeHtml(getGameName(route.game))}</p>
          <h1>${t('comingSoon')}</h1>
          <p>${t('comingSoonBody')}</p>
          <a class="primary-button" href="#/">${t('home')}</a>
        </section>
      </main>
    `;
    attachLanguageSelector();
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
    hintData: null,
    dragging: null,
    suppressClick: false,
    startedAt: Date.now(),
    completed: false,
  };

  app.innerHTML = `
    <main class="shell game-shell">
      <header class="topbar">
        <a class="brand" href="#/">Grid Games</a>
        <div class="topbar-actions">
          <a class="back-link" href="#/">${t('allGames')}</a>
          ${renderLanguageSelector()}
        </div>
      </header>
      <section class="game-heading">
        <div>
          <p class="eyebrow">01 · ${t('gameLogic')}</p>
          <h1>Queens</h1>
          <div class="level-meta">
            <span class="difficulty-badge difficulty-${puzzle.difficulty}">${difficultyLabel(puzzle.difficulty)}</span>
          </div>
          <p class="game-instructions">${t('queensInstructions')}</p>
        </div>
        <div class="level-control">
          <label class="difficulty-select-label" for="difficulty-select">${t('difficulty')}</label>
          <select class="difficulty-select" id="difficulty-select" aria-label="${t('selectDifficulty')}">
            <option value="aleatoire" ${selectedDifficulty === 'aleatoire' ? 'selected' : ''}>${t('random')}</option>
            <option value="facile" ${selectedDifficulty === 'facile' ? 'selected' : ''}>${t('easy')}</option>
            <option value="moyen" ${selectedDifficulty === 'moyen' ? 'selected' : ''}>${t('medium')}</option>
            <option value="difficile" ${selectedDifficulty === 'difficile' ? 'selected' : ''}>${t('hard')}</option>
          </select>
          <button class="secondary-button random-level-button" id="random-level" type="button">${t('newRandomLevel')} <span aria-hidden="true">↻</span></button>
        </div>
      </section>
      <section class="play-area">
        <div class="board-wrap">
          <div id="queens-board" class="queens-board" role="grid" aria-label="${t('randomGridLabel')}"></div>
          <div class="game-status" id="game-status" role="status" aria-live="polite"></div>
          <div class="game-actions">
            <div class="action-buttons">
              <button class="secondary-button" id="clear-board" type="button">${t('erase')}</button>
              <button class="secondary-button hint-button" id="queens-hint" type="button">${t('hint')}</button>
            </div>
          </div>
        </div>
        <aside class="rules-card">
          <span class="rules-icon" aria-hidden="true">♛</span>
          <h2>${t('howToPlay')}</h2>
          <ol>
            <li>${t('queenRuleRow')}</li>
            <li>${t('queenRuleColumn')}</li>
            <li>${t('queenRuleTouch')}</li>
          </ol>
          <p>${t('queenHowTo')}</p>
        </aside>
      </section>
    </main>
  `;

  attachLanguageSelector();
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
        <div class="topbar-actions">
          <a class="back-link" href="#/">${t('allGames')}</a>
          ${renderLanguageSelector()}
        </div>
      </header>
      <section class="game-heading">
        <div>
          <p class="eyebrow">02 · ${t('gamePath')}</p>
          <h1>Zip</h1>
          <div class="level-meta">
            <span class="difficulty-badge difficulty-${puzzle.difficulty}">${difficultyLabel(puzzle.difficulty)}</span>
          </div>
          <p class="game-instructions">${t('zipInstructions')}</p>
        </div>
        <div class="level-control">
          <label class="difficulty-select-label" for="zip-difficulty">${t('difficulty')}</label>
          <select class="difficulty-select" id="zip-difficulty" aria-label="${t('selectDifficulty')}">
            <option value="aleatoire" ${selectedDifficulty === 'aleatoire' ? 'selected' : ''}>${t('random')}</option>
            <option value="facile" ${selectedDifficulty === 'facile' ? 'selected' : ''}>${t('easy')}</option>
            <option value="moyen" ${selectedDifficulty === 'moyen' ? 'selected' : ''}>${t('medium')}</option>
            <option value="difficile" ${selectedDifficulty === 'difficile' ? 'selected' : ''}>${t('hard')}</option>
          </select>
          <button class="secondary-button random-level-button" id="zip-new-game" type="button">${t('newGrid')} <span aria-hidden="true">↻</span></button>
        </div>
      </section>
      <section class="play-area">
        <div class="board-wrap">
          <div id="zip-board" class="zip-board" role="grid" aria-label="${t('zipGridLabel', { size: puzzle.size })}"></div>
          <div class="game-status" id="zip-status" role="status" aria-live="polite"></div>
          <div class="game-actions">
            <div class="action-buttons">
              <button class="secondary-button" id="zip-reset" type="button">${t('restart')}</button>
            </div>
          </div>
        </div>
        <aside class="rules-card">
          <span class="rules-icon" aria-hidden="true">↝</span>
          <h2>${t('howToPlay')}</h2>
          <ol>
            <li>${t('zipRuleNumbers')}</li>
            <li>${t('zipRuleNeighbor')}</li>
            <li>${t('zipRuleNoCross')}</li>
            <li>${t('zipRuleWalls')}</li>
            <li>${t('zipRuleFinish')}</li>
          </ol>
          <p>${t('zipHowTo')}</p>
        </aside>
      </section>
    </main>
  `;

  attachLanguageSelector();
  app.querySelector('#zip-new-game').addEventListener('click', () => {
    router.navigateRandom('zip', selectedDifficulty);
  });
  app.querySelector('#zip-difficulty').addEventListener('change', (event) => {
    router.navigateRandom('zip', event.target.value);
  });
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
    hintData: null,
  };

  app.innerHTML = `
    <main class="shell game-shell">
      <header class="topbar">
        <a class="brand" href="#/">Grid Games</a>
        <div class="topbar-actions">
          <a class="back-link" href="#/">${t('allGames')}</a>
          ${renderLanguageSelector()}
        </div>
      </header>
      <section class="game-heading">
        <div>
          <p class="eyebrow">03 · ${t('gameBalance')}</p>
          <h1>Tango</h1>
          <div class="level-meta">
            <span class="difficulty-badge difficulty-${puzzle.difficulty}">${difficultyLabel(puzzle.difficulty)}</span>
          </div>
          <p class="game-instructions">${t('tangoInstructions')}</p>
        </div>
        <div class="level-control">
          <label class="difficulty-select-label" for="tango-difficulty">${t('difficulty')}</label>
          <select class="difficulty-select" id="tango-difficulty" aria-label="${t('selectDifficulty')}">
            <option value="aleatoire" ${selectedDifficulty === 'aleatoire' ? 'selected' : ''}>${t('random')}</option>
            <option value="facile" ${selectedDifficulty === 'facile' ? 'selected' : ''}>${t('easy')}</option>
            <option value="moyen" ${selectedDifficulty === 'moyen' ? 'selected' : ''}>${t('medium')}</option>
            <option value="difficile" ${selectedDifficulty === 'difficile' ? 'selected' : ''}>${t('hard')}</option>
          </select>
          <button class="secondary-button random-level-button" id="tango-new-game" type="button">${t('newRandomLevel')} <span aria-hidden="true">↻</span></button>
        </div>
      </section>
      <section class="play-area">
        <div class="board-wrap">
          <div id="tango-board" class="tango-board" style="--tango-size:${puzzle.size}" role="grid" aria-label="${t('tangoGridLabel', { size: puzzle.size })}"></div>
          <div class="game-status" id="tango-status" role="status" aria-live="polite"></div>
          <div class="game-actions">
            <div class="action-buttons">
              <button class="secondary-button" id="tango-reset" type="button">${t('erase')}</button>
              <button class="secondary-button hint-button" id="tango-hint" type="button">${t('hint')}</button>
            </div>
          </div>
        </div>
        <aside class="rules-card">
          <span class="rules-icon" aria-hidden="true">${renderTangoSymbol('sun')}</span>
          <h2>${t('howToPlay')}</h2>
          <ol>
            <li>${t('tangoRuleBalance')}</li>
            <li>${t('tangoRuleTriple')}</li>
            <li>${t('tangoRuleRelations')}</li>
          </ol>
          <p>${t('tangoHowTo')}</p>
        </aside>
      </section>
    </main>
  `;

  attachLanguageSelector();
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
  board.innerHTML = Array.from({ length: state.puzzle.size }, (_, row) =>
    Array.from({ length: state.puzzle.size }, (_, col) => {
      const key = `${row},${col}`;
      const pathIndex = pathIndexes.get(key);
      const checkpoint = checkpoints.get(key);
      const isPath = pathIndex !== undefined;
      const content = checkpoint ? `<span class="zip-node">${checkpoint}</span>` : '';
      const stateLabel = checkpoint
        ? t('zipNode', { number: checkpoint })
        : isPath
          ? t('zipStep', { number: pathIndex + 1 })
          : t('emptyCell');
      return `<button class="zip-cell ${isPath ? 'is-path' : ''} ${checkpoint ? 'is-checkpoint' : ''}"
        type="button" role="gridcell" aria-label="${t('rowColumn', { row: row + 1, col: col + 1, state: stateLabel })}"
        data-row="${row}" data-col="${col}" style="--zip-cell-index:${row * state.puzzle.size + col}">${content}</button>`;
    }),
  ).flat().join('');
  board.insertAdjacentHTML('beforeend', createZipPathSvg(state));
  board.insertAdjacentHTML('beforeend', createZipWallsSvg(state.puzzle));

  const status = app.querySelector('#zip-status');
  if (validation.won && !state.completed) {
    state.completed = true;
    const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    recordLevelCompletion('zip', state.puzzle.seed, elapsedSeconds);
    status.className = 'game-status success';
    status.textContent = t('zipWin', { time: formatDuration(elapsedSeconds) });
  } else {
    status.className = `game-status ${state.message ? 'error' : ''}`;
    status.textContent =
      (state.message && localizeZipReason(state.message)) ||
      t('zipProgress', {
        visited: validation.visitedCount,
        total: state.puzzle.size ** 2,
        checkpoint: getZipCheckpointProgress(state),
        checkpoints: state.puzzle.checkpoints.length,
      });
  }
  board.classList.toggle('is-complete', state.completed);
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
      const symbolLabel = value === 'sun' ? t('sun') : value === 'moon' ? t('moon') : t('blank');
      const hinted = state.hintCell?.row === rowIndex && state.hintCell?.col === colIndex;
      return `<button class="tango-cell ${value ? `is-${value}` : ''} ${fixed ? 'is-fixed' : ''} ${showWarnings && conflicts.has(key) ? 'has-conflict' : ''} ${hinted ? 'is-hinted' : ''}"
        type="button" role="gridcell" aria-label="${t('rowColumn', { row: rowIndex + 1, col: colIndex + 1, state: `${symbolLabel}${fixed ? `, ${t('fixedHint')}` : ''}` })}"
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
    status.textContent = t('tangoWin', { time: formatDuration(elapsedSeconds) });
    board.classList.add('is-complete');
    board.querySelectorAll('.tango-cell').forEach((cell) => {
      cell.disabled = true;
    });
  } else if (state.hintMessage) {
    status.className = 'game-status hint';
    status.textContent = state.hintMessage;
  } else if (!validation.valid && showWarnings) {
    status.className = 'game-status error';
    status.textContent = t('tangoConflict');
  } else if (state.completed) {
    status.className = 'game-status success';
    status.textContent = t('tangoCompleted');
  } else {
    status.className = 'game-status';
    status.textContent = t('tangoProgress', {
      filled: validation.filledCount,
      total: state.puzzle.size ** 2,
    });
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
  state.hintData = null;
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
    state.hintData = hint;
    state.hintMessage = formatTangoHint(hint);
  } else {
    state.hintCell = null;
    state.hintData = null;
    state.hintMessage = t('tangoNoHint');
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
  state.hintData = null;
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

function createZipWallsSvg(puzzle) {
  const scale = 100;
  const walls = puzzle.walls ?? [];
  const paths = walls.map(({ row, col, direction }) => {
    if (direction === 'right') {
      return `M ${(col + 1) * scale} ${row * scale} V ${(row + 1) * scale}`;
    }
    return `M ${col * scale} ${(row + 1) * scale} H ${(col + 1) * scale}`;
  });

  return `<svg class="zip-walls-svg" viewBox="0 0 ${puzzle.size * scale} ${puzzle.size * scale}" aria-hidden="true">
    <g>${paths.map((path) => `<path d="${path}" />`).join('')}</g>
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
      const stateLabel = hasQueen ? t('queen') : cellState === 'excluded' ? t('eliminated') : t('blank');
      const marker = hasQueen
        ? '<span class="queen-marker" aria-hidden="true">♛</span>'
        : cellState === 'excluded'
          ? '<span class="excluded-marker" aria-hidden="true">×</span>'
          : '';
      return `<button class="queen-cell ${hasConflict ? 'has-conflict' : ''} ${isHinted ? 'is-hinted' : ''}"
        type="button" role="gridcell" aria-label="${t('queensCell', { row: rowIndex + 1, col: colIndex + 1, state: stateLabel })}"
        aria-pressed="${cellState !== 'empty'}" style="--region-color:${REGION_COLORS[region % REGION_COLORS.length]}"
        data-row="${rowIndex}" data-col="${colIndex}">${marker}</button>`;
    }),
  ).join('');
  board.insertAdjacentHTML('beforeend', createQueensRegionsSvg(state.puzzle));

  const hintButton = app.querySelector('#queens-hint');
  hintButton.disabled = state.completed;

  const status = app.querySelector('#game-status');
  if (validation.won && !state.completed) {
    state.completed = true;
    const elapsedSeconds = Math.floor((Date.now() - state.startedAt) / 1000);
    recordLevelCompletion('queens', state.puzzle.level, elapsedSeconds);
    status.className = 'game-status success';
    status.textContent = t('queensWin', { time: formatDuration(elapsedSeconds) });
    board.classList.add('is-complete');
  } else if (!validation.valid) {
    status.className = 'game-status error';
    status.textContent = t('queensConflict');
  } else if (state.completed) {
    status.className = 'game-status success';
    status.textContent = t('tangoCompleted');
  } else {
    status.className = 'game-status';
    status.textContent = state.hintMessage ||
      t('queensProgress', { placed: state.placements.length, total: state.puzzle.size });
    board.classList.remove('is-complete');
  }
}

function createQueensRegionsSvg(puzzle) {
  const scale = 100;
  const { size, regions } = puzzle;
  const horizontal = [];
  const vertical = [];
  for (let row = 0; row < size; row += 1) {
    for (let col = 0; col < size; col += 1) {
      if (col < size - 1 && regions[row][col] !== regions[row][col + 1]) {
        vertical.push({ x: (col + 1) * scale, y1: row * scale, y2: (row + 1) * scale });
      }
      if (row < size - 1 && regions[row][col] !== regions[row + 1][col]) {
        horizontal.push({ y: (row + 1) * scale, x1: col * scale, x2: (col + 1) * scale });
      }
    }
  }

  return `<svg class="queens-regions-svg" viewBox="0 0 ${size * scale} ${size * scale}" aria-hidden="true">
    <g>${vertical.map(({ x, y1, y2 }) => `<path d="M ${x} ${y1} V ${y2}" />`).join('')}${horizontal.map(({ y, x1, x2 }) => `<path d="M ${x1} ${y} H ${x2}" />`).join('')}</g>
  </svg>`;
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
  activeGameState.hintData = null;
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
    state.hintData = cross;
    state.hintMessage = formatQueensHint(cross);
  } else {
    state.hintCells.clear();
    state.hintData = null;
    state.hintMessage = t('queensNoHint');
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
  activeGameState.hintData = null;
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
  activeGameState.hintData = null;
  activeGameState.placements = [];
  activeGameState.cellStates.clear();
  renderQueensBoard();
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;
  return t('timeFormat', {
    minutes,
    seconds: String(remainingSeconds).padStart(2, '0'),
  });
}

function formatTangoHint(hint) {
  return t('tangoHintPrefix', {
    row: hint.row + 1,
    col: hint.col + 1,
    value: t(hint.value === 'sun' ? 'tangoHintMustSun' : 'tangoHintMustMoon'),
    explanation: localizeTangoExplanation(hint.explanation),
  });
}

function formatQueensHint(hint) {
  return t('queensHintPrefix', {
    row: hint.row + 1,
    col: hint.col + 1,
    explanation: localizeQueensExplanation(hint.explanation),
  });
}

function localizeZipReason(reason) {
  const messages = new Map([
    ['Le chemin ne peut pas repasser sur une case déjà traversée.', 'zipReasonVisited'],
    ['Le chemin doit commencer au nœud numéro 1.', 'zipReasonStart'],
    ['Le chemin doit avancer d’une case voisine, sans diagonale.', 'zipReasonAdjacent'],
    ['Un mur empêche de passer par cette liaison.', 'zipReasonWall'],
    ['Le dernier chiffre ne peut être rejoint qu’après avoir parcouru toutes les cases.', 'zipReasonLast'],
    ['Reliez les nœuds numérotés dans l’ordre.', 'zipReasonOrder'],
    ['Le chemin doit se terminer sur le dernier nœud numéroté.', 'zipReasonFinish'],
  ]);
  return messages.has(reason) ? t(messages.get(reason)) : reason;
}

function localizeTangoExplanation(explanation) {
  if (explanation.includes('Le signe « = »')) return t('tangoHintEqual');
  if (explanation.includes('Le signe « × »')) return t('tangoHintDifferent');

  const triple = explanation.match(
    /^Ce symbole créerait trois (soleils|lunes) consécutifs sur la (ligne|colonne) (\d+)\.$/,
  );
  if (triple) {
    return t('tangoHintTriple', {
      symbol: t(triple[1] === 'soleils' ? 'sunPlural' : 'moonPlural'),
      unit: t(triple[2] === 'ligne' ? 'rowName' : 'columnName', { number: triple[3] }),
      number: triple[3],
    });
  }

  const count = explanation.match(
    /^La (ligne|colonne) (\d+) doit contenir (\d+) (soleils|lunes) ; avec ce symbole, il n’y aurait plus assez de cases pour les placer\.$/,
  );
  if (count) {
    return t('tangoHintCount', {
      unit: t(count[1] === 'ligne' ? 'rowName' : 'columnName', { number: count[2] }),
      number: count[2],
      count: count[3],
      symbol: t(count[4] === 'soleils' ? 'sunPlural' : 'moonPlural'),
    });
  }
  return explanation;
}

function localizeQueensExplanation(explanation) {
  const direct = explanation.match(
    /^Cochez la ligne (\d+), colonne (\d+) : cette case (.*)\.$/,
  );
  if (direct) {
    return t('queensHintDirect', {
      row: direct[1],
      col: direct[2],
      reason: localizeQueensConflict(direct[3]),
    });
  }

  const forced = explanation.match(
    /^Il ne reste qu’une seule case possible dans (la ligne|la colonne|la région colorée) (\d+) : ligne (\d+), colonne (\d+)\. Une reine doit y être placée ; cochez cette case, car elle (.*)\.$/,
  );
  if (forced) {
    return t('queensHintForced', {
      unit: t(
        forced[1] === 'la ligne'
          ? 'queensRowUnit'
          : forced[1] === 'la colonne'
            ? 'queensColumnUnit'
            : 'queensRegionUnit',
        { number: forced[2] },
      ),
      row: forced[3],
      col: forced[4],
      reason: localizeQueensConflict(forced[5]),
    });
  }
  return explanation;
}

function localizeQueensConflict(reason) {
  const sameRow = reason.match(/^se trouve sur la ligne (\d+) de la reine$/);
  if (sameRow) return t('queensConflictRow', { row: sameRow[1] });
  const sameColumn = reason.match(/^se trouve dans la colonne (\d+) de la reine$/);
  if (sameColumn) return t('queensConflictColumn', { col: sameColumn[1] });
  if (reason === 'se trouve dans la même région colorée que la reine') {
    return t('queensConflictRegion');
  }
  if (reason === 'touche la reine') return t('queensConflictTouch');
  return reason;
}

function render(route) {
  currentRoute = route;
  document.documentElement.lang = getCurrentLocale().split('-')[0];
  document.body.dataset.gameTheme =
    route.name === 'game' ? route.game : 'home';
  if (route.name === 'home') {
    renderHome();
  } else if (route.name === 'game') {
    renderGame(route);
  } else {
    app.innerHTML = `<main class="shell"><h1>${t('pageNotFound')}</h1><a href="#/">${t('home')}</a>${renderLanguageSelector()}</main>`;
    attachLanguageSelector();
  }
}

router = createRouter(render);
render(router.getCurrentRoute());

if ('serviceWorker' in navigator && import.meta.env.PROD) {
  navigator.serviceWorker.register('./sw.js').catch((error) => {
    console.error('Impossible d’enregistrer le Service Worker.', error);
  });
}
