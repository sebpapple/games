const STORAGE_KEY = 'grid-games-progress-v1';

function readProgress() {
  try {
    const value = localStorage.getItem(STORAGE_KEY);
    return value ? JSON.parse(value) : {};
  } catch (error) {
    console.error('Impossible de lire la progression locale.', error);
    throw error;
  }
}

export function getLevelProgress(game, level) {
  return readProgress()[game]?.[level] ?? null;
}

export function recordLevelCompletion(game, level, elapsedSeconds) {
  if (!Number.isFinite(elapsedSeconds) || elapsedSeconds < 0) {
    throw new RangeError('Le temps de jeu doit être positif ou nul.');
  }

  const progress = readProgress();
  const previous = progress[game]?.[level];
  const recordSeconds =
    previous?.recordSeconds == null
      ? elapsedSeconds
      : Math.min(previous.recordSeconds, elapsedSeconds);

  progress[game] ??= {};
  progress[game][level] = {
    completed: true,
    recordSeconds,
    completedAt: new Date().toISOString(),
  };

  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (error) {
    console.error('Impossible de sauvegarder la progression locale.', error);
    throw error;
  }

  return progress[game][level];
}
