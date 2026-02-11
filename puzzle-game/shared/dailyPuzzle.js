export const PUZZLE_TYPE = "latin-square-4";
export const GRID_SIZE = 4;
const GIVEN_COUNT = 9;

function toDateKey(value) {
  const source = value instanceof Date ? value : new Date(value);
  return source.toISOString().slice(0, 10);
}

function hashToSeed(text) {
  let hash = 2166136261;

  for (let i = 0; i < text.length; i += 1) {
    hash ^= text.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }

  return hash >>> 0;
}

function seededRandom(seed) {
  let state = seed || 1;

  return () => {
    state += 0x6d2b79f5;
    let next = Math.imul(state ^ (state >>> 15), 1 | state);
    next ^= next + Math.imul(next ^ (next >>> 7), 61 | next);
    return ((next ^ (next >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle(items, random) {
  const clone = [...items];

  for (let i = clone.length - 1; i > 0; i -= 1) {
    const j = Math.floor(random() * (i + 1));
    [clone[i], clone[j]] = [clone[j], clone[i]];
  }

  return clone;
}

function createBaseGrid() {
  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => ((row + col) % GRID_SIZE) + 1)
  );
}

function createSolutionGrid(dateKey) {
  const random = seededRandom(hashToSeed(dateKey));
  const rowOrder = shuffle([0, 1, 2, 3], random);
  const colOrder = shuffle([0, 1, 2, 3], random);
  const symbols = shuffle([1, 2, 3, 4], random);
  const base = createBaseGrid();

  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => {
      const baseValue = base[rowOrder[row]][colOrder[col]];
      return symbols[baseValue - 1];
    })
  );
}

function createGivensGrid(solution, dateKey) {
  const random = seededRandom(hashToSeed(`${dateKey}:givens`));
  const allIndexes = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index);
  const givenIndexes = new Set(shuffle(allIndexes, random).slice(0, GIVEN_COUNT));

  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => {
      const index = row * GRID_SIZE + col;
      return givenIndexes.has(index) ? solution[row][col] : null;
    })
  );
}

function normalizeGrid(rawGrid) {
  if (!Array.isArray(rawGrid)) {
    return Array.from({ length: GRID_SIZE }, () => Array.from({ length: GRID_SIZE }, () => null));
  }

  return Array.from({ length: GRID_SIZE }, (_, row) => {
    const rawRow = Array.isArray(rawGrid[row]) ? rawGrid[row] : [];
    return Array.from({ length: GRID_SIZE }, (_, col) => {
      const value = Number(rawRow[col]);
      return Number.isInteger(value) && value >= 1 && value <= GRID_SIZE ? value : null;
    });
  });
}

export function getTodayDateKey() {
  return toDateKey(new Date());
}

export function createDailyPuzzle(dateKey = getTodayDateKey()) {
  const safeDateKey = toDateKey(dateKey);
  const solution = createSolutionGrid(safeDateKey);
  const givens = createGivensGrid(solution, safeDateKey);

  return {
    date: safeDateKey,
    puzzleType: PUZZLE_TYPE,
    size: GRID_SIZE,
    givens,
  };
}

export function getSolutionForDate(dateKey = getTodayDateKey()) {
  return createSolutionGrid(toDateKey(dateKey));
}

export function evaluateSubmission(dateKey, rawGrid) {
  const safeDateKey = toDateKey(dateKey);
  const puzzle = createDailyPuzzle(safeDateKey);
  const grid = normalizeGrid(rawGrid);
  const solution = getSolutionForDate(safeDateKey);

  let totalEditableCells = 0;
  let correctEditableCells = 0;
  let solved = true;

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const expected = solution[row][col];
      const current = grid[row][col];
      const isGiven = puzzle.givens[row][col] !== null;

      if (!isGiven) {
        totalEditableCells += 1;

        if (current === expected) {
          correctEditableCells += 1;
        }
      }

      if (current !== expected) {
        solved = false;
      }
    }
  }

  return {
    solved,
    totalEditableCells,
    correctEditableCells,
    solution,
    grid,
    puzzle,
  };
}

export function findHintCell(dateKey, rawGrid) {
  const result = evaluateSubmission(dateKey, rawGrid);

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      if (result.puzzle.givens[row][col] !== null) {
        continue;
      }

      if (result.grid[row][col] !== result.solution[row][col]) {
        return {
          row,
          col,
          value: result.solution[row][col],
        };
      }
    }
  }

  return null;
}

export function createInitialGrid(givens) {
  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => {
      const value = Number(givens?.[row]?.[col]);
      return Number.isInteger(value) ? value : null;
    })
  );
}
