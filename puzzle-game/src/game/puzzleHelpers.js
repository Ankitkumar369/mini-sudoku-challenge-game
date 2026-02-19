// Imports: shared puzzle constants used by pure helper functions.
import { GRID_SIZE, createInitialGrid } from "../../shared/dailyPuzzle";

export function normalizeCellValue(value) {
  const number = Number(value);
  return Number.isInteger(number) && number >= 1 && number <= GRID_SIZE ? number : null;
}

export function sanitizeGridFromProgress(givens, rawGrid) {
  const initial = createInitialGrid(givens);

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (givens[row][col] !== null) {
        initial[row][col] = givens[row][col];
      } else {
        initial[row][col] = normalizeCellValue(rawGrid?.[row]?.[col]);
      }
    }
  }

  return initial;
}

export function calculateScore(solved, hintsUsed, elapsedSeconds) {
  if (!solved) {
    return 0;
  }

  const hintPenalty = hintsUsed * 10;
  const timePenalty = Math.floor(elapsedSeconds / 20);
  return Math.max(10, 100 - hintPenalty - timePenalty);
}

export function deriveDifficultyLevel(solved, hintsUsed, elapsedSeconds, score) {
  if (!solved) {
    return 0;
  }

  if (score >= 95 && hintsUsed === 0 && elapsedSeconds <= 180) {
    return 3;
  }

  if (score >= 75 && hintsUsed <= 1 && elapsedSeconds <= 360) {
    return 2;
  }

  return 1;
}

export function toErrorMessage(error) {
  return error instanceof Error ? error.message : "Unexpected puzzle error";
}

export function isOnline() {
  if (typeof navigator === "undefined") {
    return true;
  }

  return navigator.onLine;
}

export function calculateElapsedSeconds(startedAt, nowMs) {
  if (!startedAt) {
    return 0;
  }

  return Math.max(0, Math.floor((nowMs - startedAt) / 1000));
}
