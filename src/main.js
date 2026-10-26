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
import {
  checkPatchesPlacement,
  createPatchesPuzzle,
  findLogicalPatchesHint,
  validatePatches,
} from './games/patches.js';
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
const PATCH_COLORS = [
  '#c9dda1',
  '#b8d5ef',
  '#f1d0a6',
  '#d3bce5',
  '#efbdb7',
  '#a9d8ce',
  '#e5e7a0',
  '#eabbd5',
  '#b9c7e8',
  '#d7c9aa',
  '#a9d1e0',
  '#d8d7bb',
  '#d6b7ab',
];
const AVAILABLE_GAMES = new Set(['patches', 'queens', 'zip', 'tango']);

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
        if (previousState.game === 'patches') renderPatchesBoard();
        else if (previousState.game === 'zip') renderZipBoard();
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
             href="#/game/${game}/random" data-game="${game}" ${AVAILABLE_GAMES.has(game) ? '' : 'aria-disabled="true"'}>
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
  for (const link of app.querySelectorAll('.game-card.available')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      openLevelPicker(link.dataset.game);
    });
  }
}

function renderGame(route) {
  if (route.game === 'patches') {
    renderPatchesGame(route);
    return;
  }

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
    game: 'queens',
    requestedDifficulty: selectedDifficulty,
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
          <button class="secondary-button random-level-button" id="random-level" type="button">${t('newGrid')}</button>
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

function renderPatchesGame(route) {
  const selectedDifficulty = route.difficulty ?? 'aleatoire';
  const puzzle = createPatchesPuzzle(route.seed, selectedDifficulty);
  activeGameState = {
    game: 'patches',
    requestedDifficulty: selectedDifficulty,
    puzzle,
    placements: [],
    selection: null,
    dragging: null,
    suppressClick: false,
    message: '',
    hintData: null,
    startedAt: Date.now(),
    completed: false,
    completionTime: null,
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
          <p class="eyebrow">04 · ${t('gameTiling')}</p>
          <h1>Patches</h1>
          <div class="level-meta">
            <span class="difficulty-badge difficulty-${puzzle.difficulty}">${difficultyLabel(puzzle.difficulty)}</span>
          </div>
          <p class="game-instructions">${t('patchesInstructions')}</p>
        </div>
        <div class="level-control">
          <label class="difficulty-select-label" for="patches-difficulty">${t('difficulty')}</label>
          <select class="difficulty-select" id="patches-difficulty" aria-label="${t('selectDifficulty')}">
            <option value="aleatoire" ${selectedDifficulty === 'aleatoire' ? 'selected' : ''}>${t('random')}</option>
            <option value="facile" ${selectedDifficulty === 'facile' ? 'selected' : ''}>${t('easy')}</option>
            <option value="moyen" ${selectedDifficulty === 'moyen' ? 'selected' : ''}>${t('medium')}</option>
            <option value="difficile" ${selectedDifficulty === 'difficile' ? 'selected' : ''}>${t('hard')}</option>
          </select>
          <button class="secondary-button random-level-button" id="patches-new-game" type="button">${t('newGrid')}</button>
        </div>
      </section>
      <section class="play-area">
        <div class="board-wrap">
          <div id="patches-board" class="patches-board" role="grid" aria-label="${t('patchesGridLabel', { size: puzzle.size })}"></div>
          <div class="game-status" id="patches-status" role="status" aria-live="polite"></div>
          <div class="game-actions">
            <div class="action-buttons">
              <button class="secondary-button" id="patches-reset" type="button">${t('restart')}</button>
              <button class="secondary-button" id="patches-undo" type="button">${t('undo')}</button>
              <button class="secondary-button hint-button" id="patches-hint" type="button">${t('hint')}</button>
            </div>
          </div>
        </div>
        <details class="rules-card patches-rules-card" open>
          <summary class="patches-rules-heading">
            <span class="rules-icon patches-rules-icon" aria-hidden="true">▦</span>
            <h2>${t('howToPlay')}</h2>
            <span class="patches-rules-chevron" aria-hidden="true"></span>
          </summary>
          <p class="patches-rules-intro">${t('patchesRuleCover')}</p>
          <ul class="patches-shape-legend">
            <li><span class="patches-shape-icon shape-square" aria-hidden="true"></span>${t('patchesShapeSquare')}</li>
            <li><span class="patches-shape-icon shape-tall" aria-hidden="true"></span>${t('patchesShapeTall')}</li>
            <li><span class="patches-shape-icon shape-wide" aria-hidden="true"></span>${t('patchesShapeWide')}</li>
          </ul>
          <p class="patches-rules-note">${t('patchesRuleArea')}</p>
          <p>${t('patchesHowTo')}</p>
        </details>
      </section>
    </main>
  `;

  attachLanguageSelector();
  app.querySelector('#patches-new-game').addEventListener('click', () => {
    router.navigateRandom('patches', selectedDifficulty);
  });
  app.querySelector('#patches-difficulty').addEventListener('change', (event) => {
    router.navigateRandom('patches', event.target.value);
  });
  app.querySelector('#patches-reset').addEventListener('click', resetPatchesBoard);
  app.querySelector('#patches-undo').addEventListener('click', undoPatchesPlacement);
  app.querySelector('#patches-hint').addEventListener('click', revealPatchesHint);
  const board = app.querySelector('#patches-board');
  board.addEventListener('click', handlePatchesBoardClick);
  board.addEventListener('pointerdown', handlePatchesPointerDown);
  board.addEventListener('pointermove', handlePatchesPointerMove);
  board.addEventListener('pointerup', finishPatchesPointer);
  board.addEventListener('pointercancel', finishPatchesPointer);
  renderPatchesBoard();
}

function renderZipGame(route) {
  const selectedDifficulty = route.difficulty ?? 'aleatoire';
  const puzzle = createZipPuzzle(route.seed, selectedDifficulty);
  activeGameState = {
    game: 'zip',
    requestedDifficulty: selectedDifficulty,
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
          <button class="secondary-button random-level-button" id="zip-new-game" type="button">${t('newGrid')}</button>
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
    requestedDifficulty: selectedDifficulty,
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
          <button class="secondary-button random-level-button" id="tango-new-game" type="button">${t('newGrid')}</button>
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

function renderPatchesBoard() {
  const state = activeGameState;
  const board = app.querySelector('#patches-board');
  if (!state || state.game !== 'patches' || !board) return;

  const { puzzle, placements } = state;
  const validation = validatePatches(puzzle, placements);
  const placementByCell = new Map();
  for (const placement of placements) {
    for (let row = placement.top; row < placement.top + placement.height; row += 1) {
      for (let col = placement.left; col < placement.left + placement.width; col += 1) {
        placementByCell.set(`${row},${col}`, placement);
      }
    }
  }
  const clueByCell = new Map(
    puzzle.clues.map((clue) => [`${clue.row},${clue.col}`, clue]),
  );
  const selection = state.selection;
  const selectedClue = selection && puzzle.clues.find(
    ({ row, col }) =>
      row >= selection.top &&
      row < selection.top + selection.height &&
      col >= selection.left &&
      col < selection.left + selection.width,
  );
  const selectionColor = selectedClue
    ? PATCH_COLORS[selectedClue.id % PATCH_COLORS.length]
    : '#cbd3d9';
  const hintedCells = new Set();
  if (state.hintData) {
    for (
      let row = state.hintData.top;
      row < state.hintData.top + state.hintData.height;
      row += 1
    ) {
      for (
        let col = state.hintData.left;
        col < state.hintData.left + state.hintData.width;
        col += 1
      ) {
        hintedCells.add(`${row},${col}`);
      }
    }
  }

  board.innerHTML = Array.from({ length: puzzle.size }, (_, row) =>
    Array.from({ length: puzzle.size }, (_, col) => {
      const key = `${row},${col}`;
      const placement = placementByCell.get(key);
      const clue = clueByCell.get(key);
      const shape = clue ? t(`patchesShape${capitalize(clue.shape)}`) : '';
      const clueColor = clue
        ? PATCH_COLORS[clue.id % PATCH_COLORS.length]
        : placement
          ? PATCH_COLORS[placement.clueId % PATCH_COLORS.length]
          : '';
      const isSelecting = selection &&
        row >= selection.top &&
        row < selection.top + selection.height &&
        col >= selection.left &&
        col < selection.left + selection.width;
      const cellState = clue
        ? t('patchesCellClue', {
            area: clue.area == null ? t('patchesUnknownArea') : clue.area,
            shape,
          })
        : placement
          ? t('patchesPartPlaced')
          : t('emptyCell');
      const clueMarker = clue
        ? `<span class="patches-clue-mark" aria-hidden="true">
            <span class="patches-shape-icon shape-${clue.shape}"></span>
            ${clue.area == null ? '' : `<span class="patches-clue-area">${clue.area}</span>`}
          </span>`
        : '';
      const patchEdges = placement
        ? [
            ['top', row > 0 ? placementByCell.get(`${row - 1},${col}`) : null],
            ['right', col < puzzle.size - 1 ? placementByCell.get(`${row},${col + 1}`) : null],
            ['bottom', row < puzzle.size - 1 ? placementByCell.get(`${row + 1},${col}`) : null],
            ['left', col > 0 ? placementByCell.get(`${row},${col - 1}`) : null],
          ]
            .filter(([, neighbor]) => neighbor?.clueId !== placement.clueId)
            .map(([edge]) => `patch-edge-${edge}`)
            .join(' ')
        : '';
      return `<button class="patches-cell ${placement ? 'is-occupied' : ''} ${patchEdges} ${clue ? 'has-clue' : ''} ${hintedCells.has(key) ? 'is-hinted' : ''} ${isSelecting ? 'is-selecting' : ''}"
        type="button" role="gridcell"
        aria-label="${t('rowColumn', { row: row + 1, col: col + 1, state: cellState })}"
        aria-pressed="${Boolean(placement)}" ${state.completed ? 'disabled' : ''}
        data-row="${row}" data-col="${col}"
        ${placement ? `data-patch-id="${placement.clueId}"` : ''}
        style="--patch-cell-index:${row * puzzle.size + col};${clueColor ? `--patch-color:${clueColor}` : ''}${isSelecting ? `;--patch-selection-color:${selectionColor}` : ''}">${clueMarker}</button>`;
    }),
  ).flat().join('');

  const status = app.querySelector('#patches-status');
  if (validation.won && !state.completed) {
    state.completed = true;
    state.completionTime = Math.floor((Date.now() - state.startedAt) / 1000);
    recordLevelCompletion('patches', puzzle.level, state.completionTime);
  }
  status.hidden = state.completed || (!state.message && !state.hintData);
  if (status.hidden) {
    status.className = 'game-status';
    status.textContent = '';
  } else if (state.message) {
    status.className = `game-status ${state.message === 'patchesNoHint' ? 'hint' : 'error'}`;
    status.textContent = t(state.message);
  } else if (state.hintData) {
    status.className = 'game-status hint';
    status.textContent = formatPatchesHint(state.hintData);
  }

  app.querySelector('#patches-reset').disabled =
    state.completed || placements.length === 0;
  app.querySelector('#patches-undo').disabled =
    state.completed || placements.length === 0;
  app.querySelector('#patches-hint').disabled = state.completed;
  renderVictoryDialog(state);
}

function handlePatchesBoardClick(event) {
  const state = activeGameState;
  if (!state || state.game !== 'patches' || state.completed) return;
  if (state.suppressClick) {
    state.suppressClick = false;
    event.preventDefault();
    return;
  }

  const cell = event.target.closest('.patches-cell');
  if (!cell) return;

  const row = Number(cell.dataset.row);
  const col = Number(cell.dataset.col);
  const existingPatchId = cell.dataset.patchId;
  if (existingPatchId !== undefined) {
    state.placements = state.placements.filter(
      ({ clueId }) => clueId !== Number(existingPatchId),
    );
    state.message = '';
    state.hintData = null;
    state.selection = null;
    renderPatchesBoard();
    return;
  }

  tryPlacePatchesRectangle({ top: row, left: col, height: 1, width: 1 });
}

function handlePatchesPointerDown(event) {
  const state = activeGameState;
  const cell = event.target.closest('.patches-cell');
  if (!state || state.game !== 'patches' || state.completed || !cell || event.button !== 0) {
    return;
  }

  state.dragging = {
    pointerId: event.pointerId,
    startX: event.clientX,
    startY: event.clientY,
    row: Number(cell.dataset.row),
    col: Number(cell.dataset.col),
    moved: false,
  };
}

function handlePatchesPointerMove(event) {
  const state = activeGameState;
  const drag = state?.game === 'patches' ? state.dragging : null;
  if (!drag || drag.pointerId !== event.pointerId || !(event.buttons & 1)) return;
  if (!drag.moved && Math.hypot(event.clientX - drag.startX, event.clientY - drag.startY) < 5) {
    return;
  }

  if (!drag.moved) event.currentTarget.setPointerCapture(event.pointerId);
  drag.moved = true;
  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.patches-cell');
  if (!cell || !event.currentTarget.contains(cell)) return;

  state.selection = createPatchesSelection(
    drag.row,
    drag.col,
    Number(cell.dataset.row),
    Number(cell.dataset.col),
  );
  state.message = '';
  state.hintData = null;
  renderPatchesBoard();
}

function finishPatchesPointer(event) {
  const state = activeGameState;
  const drag = state?.game === 'patches' ? state.dragging : null;
  if (!drag || drag.pointerId !== event.pointerId) return;

  state.dragging = null;
  if (event.type === 'pointercancel') {
    state.selection = null;
    renderPatchesBoard();
    return;
  }
  if (!drag.moved) return;

  const cell = document.elementFromPoint(event.clientX, event.clientY)?.closest('.patches-cell');
  const endRow = cell && event.currentTarget.contains(cell)
    ? Number(cell.dataset.row)
    : drag.row;
  const endCol = cell && event.currentTarget.contains(cell)
    ? Number(cell.dataset.col)
    : drag.col;
  const rectangle = createPatchesSelection(drag.row, drag.col, endRow, endCol);
  state.selection = rectangle;
  state.suppressClick = true;
  window.setTimeout(() => {
    if (activeGameState === state) state.suppressClick = false;
  }, 0);
  tryPlacePatchesRectangle(rectangle);
}

function createPatchesSelection(startRow, startCol, endRow, endCol) {
  return {
    top: Math.min(startRow, endRow),
    left: Math.min(startCol, endCol),
    height: Math.abs(endRow - startRow) + 1,
    width: Math.abs(endCol - startCol) + 1,
  };
}

function tryPlacePatchesRectangle(rectangle) {
  const state = activeGameState;
  if (!state || state.game !== 'patches' || state.completed) return;

  const result = checkPatchesPlacement(state.puzzle, state.placements, rectangle);
  state.selection = rectangle;
  state.hintData = null;
  if (!result.valid) {
    state.message = result.reason;
    renderPatchesBoard();
    return;
  }

  state.placements.push({ ...rectangle, clueId: result.clueId });
  state.selection = null;
  state.message = '';
  renderPatchesBoard();
}

function revealPatchesHint() {
  const state = activeGameState;
  if (!state || state.game !== 'patches' || state.completed) return;

  state.selection = null;
  state.message = '';
  state.hintData = findLogicalPatchesHint(state.puzzle, state.placements);
  if (!state.hintData) state.message = 'patchesNoHint';
  renderPatchesBoard();
}

function resetPatchesBoard() {
  const state = activeGameState;
  if (!state || state.game !== 'patches' || state.completed) return;
  state.placements = [];
  state.selection = null;
  state.message = '';
  state.hintData = null;
  renderPatchesBoard();
}

function undoPatchesPlacement() {
  const state = activeGameState;
  if (!state || state.game !== 'patches' || state.completed) return;
  state.placements.pop();
  state.selection = null;
  state.message = '';
  state.hintData = null;
  renderPatchesBoard();
}

function formatPatchesHint(hint) {
  const clue = activeGameState.puzzle.clues.find(({ id }) => id === hint.clueId);
  return t('patchesHintPrefix', {
    row: clue.row + 1,
    col: clue.col + 1,
    area: clue.area,
    height: hint.height,
    width: hint.width,
    shape: t(`patchesShape${capitalize(clue.shape)}`),
  });
}

function capitalize(value) {
  return value.charAt(0).toUpperCase() + value.slice(1);
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
    state.completionTime = elapsedSeconds;
    recordLevelCompletion('zip', state.puzzle.seed, elapsedSeconds);
  }
  status.hidden = state.completed || !state.message;
  if (state.completed) {
    status.className = 'game-status';
    status.textContent = '';
  } else {
    status.className = `game-status ${state.message ? 'error' : ''}`;
    status.textContent = state.message ? localizeZipReason(state.message) : '';
  }
  app.querySelector('#zip-reset').disabled =
    state.completed || state.path.length <= 1;
  renderVictoryDialog(state);
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
    state.completionTime = elapsedSeconds;
    recordLevelCompletion('tango', state.puzzle.level, elapsedSeconds);
    board.querySelectorAll('.tango-cell').forEach((cell) => {
      cell.disabled = true;
    });
  }
  status.hidden =
    state.completed ||
    (!state.hintMessage && (validation.valid || !showWarnings));
  if (state.completed) {
    status.className = 'game-status';
    status.textContent = '';
  } else if (state.hintMessage) {
    status.className = 'game-status hint';
    status.textContent = state.hintMessage;
  } else if (!validation.valid && showWarnings) {
    status.className = 'game-status error';
    status.textContent = t('tangoConflict');
  } else {
    status.className = 'game-status';
    status.textContent = '';
  }
  app.querySelector('#tango-reset').disabled =
    state.completed || validation.filledCount === state.fixedCells.size;
  renderVictoryDialog(state);
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
    state.completionTime = elapsedSeconds;
    recordLevelCompletion('queens', state.puzzle.level, elapsedSeconds);
  }
  status.hidden =
    state.completed || (validation.valid && !state.hintMessage);
  if (status.hidden) {
    status.className = 'game-status';
    status.textContent = '';
  } else if (!validation.valid) {
    status.className = 'game-status error';
    status.textContent = t('queensConflict');
  } else {
    status.className = 'game-status hint';
    status.textContent = state.hintMessage;
  }
  renderVictoryDialog(state);
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

function renderVictoryDialog(state) {
  if (!state.completed || app.querySelector('#victory-dialog')) return;

  const fireworkMarkup = Array.from({ length: 3 }, (_, burstIndex) => `
    <span class="firework-burst burst-${burstIndex + 1}" aria-hidden="true">
      ${Array.from({ length: 10 }, (_, particleIndex) => `
        <i style="--spark-angle:${particleIndex * 36}deg;--spark-delay:${particleIndex * 35}ms"></i>
      `).join('')}
    </span>
  `).join('');

  app.insertAdjacentHTML(
    'beforeend',
    `<dialog class="victory-dialog" id="victory-dialog" aria-labelledby="victory-title">
      <div class="victory-fireworks" aria-hidden="true">${fireworkMarkup}</div>
      <div class="victory-content">
        <span class="victory-icon" aria-hidden="true">✦</span>
        <h2 id="victory-title">${t('victoryCongrats')}</h2>
        <p class="victory-time">${t('victoryTime', {
          time: formatDuration(state.completionTime),
        })}</p>
        <div class="victory-actions">
          <button class="secondary-button victory-home" type="button">${t('victoryHome')}</button>
          <button class="primary-button victory-replay" type="button">${t('replay')}</button>
        </div>
      </div>
    </dialog>`,
  );

  const dialog = app.querySelector('#victory-dialog');
  dialog.addEventListener('close', () => {
    if (activeGameState === state) {
      app.querySelector('#victory-dialog')?.remove();
    }
  });
  dialog.showModal();
  dialog.querySelector('.victory-replay').focus();
  dialog.querySelector('.victory-replay').addEventListener('click', () => {
    dialog.close();
    openLevelPicker(state.game, state.requestedDifficulty);
  });
  dialog.querySelector('.victory-home').addEventListener('click', () => {
    dialog.close();
    router.navigate('/');
  });
}

function openLevelPicker(game, difficulty = 'aleatoire') {
  const difficulties = ['aleatoire', 'facile', 'moyen', 'difficile'];
  let selectedDifficulty = difficulty;
  const pickerMarkup = `
    <dialog class="level-picker-dialog" id="level-picker-dialog" aria-labelledby="level-picker-title">
      <div class="level-picker-form">
        <p class="eyebrow">${escapeHtml(getGameName(game))}</p>
        <h2 id="level-picker-title">${t('chooseDifficultyTitle')}</h2>
        <p class="level-picker-description">${t('chooseDifficultyDescription')}</p>
        <div class="difficulty-choices" role="group" aria-label="${t('difficulty')}">
          ${difficulties.map((option) => `
            <button
              class="difficulty-choice difficulty-choice-${option}"
              type="button"
              data-difficulty="${option}"
              aria-pressed="${option === selectedDifficulty}"
            >${t({ aleatoire: 'random', facile: 'easy', moyen: 'medium', difficile: 'hard' }[option])}</button>
          `).join('')}
        </div>
        <div class="level-picker-actions">
          <button class="secondary-button" type="button" data-dismiss-level-picker>${t('cancel')}</button>
          <button class="primary-button" type="button" data-start-game>${t('startGame')}</button>
        </div>
      </div>
    </dialog>`;
  const existingDialog = app.querySelector('#victory-dialog, #level-picker-dialog');
  existingDialog?.close();
  app.querySelector('#level-picker-dialog')?.remove();
  app.insertAdjacentHTML('beforeend', pickerMarkup);

  const dialog = app.querySelector('#level-picker-dialog');
  dialog.addEventListener('close', () => dialog.remove(), { once: true });
  dialog.querySelector('[data-dismiss-level-picker]').addEventListener('click', () => {
    dialog.close();
  });
  dialog.querySelectorAll('[data-difficulty]').forEach((button) => {
    button.addEventListener('click', () => {
      selectedDifficulty = button.dataset.difficulty;
      dialog.querySelectorAll('[data-difficulty]').forEach((choice) => {
        choice.setAttribute(
          'aria-pressed',
          String(choice.dataset.difficulty === selectedDifficulty),
        );
      });
    });
  });
  dialog.querySelector('[data-start-game]').addEventListener('click', () => {
    dialog.close();
    router.navigateRandom(game, selectedDifficulty);
  });
  dialog.showModal();
  dialog.querySelector(`[data-difficulty="${difficulty}"]`).focus();
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
