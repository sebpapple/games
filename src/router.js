const GAME_IDS = new Set(['patches', 'zip', 'queens', 'tango']);
const MAX_PUZZLE_SEED = 0xffffffff;

export function selectRandomPuzzleSeed(excludedSeed) {
  let seed = Math.floor(Math.random() * MAX_PUZZLE_SEED) + 1;
  if (seed === excludedSeed) {
    seed = seed === MAX_PUZZLE_SEED ? 1 : seed + 1;
  }

  return seed;
}

function parseLocation(hash) {
  const parts = hash.replace(/^#\/?/, '').split('/').filter(Boolean);

  if (parts.length === 0) {
    return { name: 'home' };
  }

  if (parts[0] === 'game' && parts.length <= 3) {
    const game = parts[1] ?? 'queens';
    if (!GAME_IDS.has(game)) return { name: 'not-found' };

    const [seedSegment, query = ''] = (parts[2] ?? 'random').split('?');
    const parsedSeed = Number.parseInt(seedSegment, 10);
    const seed = seedSegment === 'random'
      ? selectRandomPuzzleSeed()
      : Number.isFinite(parsedSeed)
        ? Math.min(MAX_PUZZLE_SEED, Math.max(1, parsedSeed))
        : selectRandomPuzzleSeed();
    const params = new URLSearchParams(query);
    const requestedDifficulty = params.get('difficulty');
    const difficulty = ['facile', 'moyen', 'difficile'].includes(requestedDifficulty)
      ? requestedDifficulty
      : 'aleatoire';

    return { name: 'game', game, seed, difficulty };
  }

  return { name: 'not-found' };
}

export function createRouter(render) {
  if (typeof render !== 'function') {
    throw new TypeError('Le routeur attend une fonction de rendu.');
  }

  const onChange = () => render(parseLocation(window.location.hash));
  window.addEventListener('hashchange', onChange);

  return {
    navigate(path) {
      const normalizedPath = path.startsWith('/') ? path : `/${path}`;
      window.location.hash = normalizedPath;
    },
    navigateRandom(game, difficulty = 'aleatoire') {
      const currentRoute = parseLocation(window.location.hash);
      const excludedSeed =
        currentRoute.name === 'game' && currentRoute.game === game
          ? currentRoute.seed
          : undefined;
      const seed = selectRandomPuzzleSeed(excludedSeed);
      const query =
        difficulty === 'aleatoire' ? '' : `?difficulty=${encodeURIComponent(difficulty)}`;
      this.navigate(`/game/${game}/${seed}${query}`);
    },
    getCurrentRoute: () => parseLocation(window.location.hash),
    destroy() {
      window.removeEventListener('hashchange', onChange);
    },
  };
}
