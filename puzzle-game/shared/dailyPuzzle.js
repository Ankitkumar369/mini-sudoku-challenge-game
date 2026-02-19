export const PUZZLE_TYPES = Object.freeze({
  CLASSIC: "latin-square-classic",
  CHALLENGE: "latin-square-challenge",
});

export const PUZZLE_TYPE = PUZZLE_TYPES.CLASSIC;
export const GRID_SIZE = 4;
const PUZZLE_SEED_SECRET = "capstone-daily-puzzle-v1";

const PUZZLE_CONFIG = {
  [PUZZLE_TYPES.CLASSIC]: {
    title: "Classic 4x4",
    givenCount: 9,
    hintLimit: 3,
  },
  [PUZZLE_TYPES.CHALLENGE]: {
    title: "Challenge 4x4",
    givenCount: 7,
    hintLimit: 2,
  },
};

const PUZZLE_TYPE_LIST = Object.keys(PUZZLE_CONFIG);

function toDateKey(value) {
  const source = value instanceof Date ? value : new Date(value);

  if (Number.isNaN(source.getTime())) {
    return toDateKey(new Date());
  }

  const year = source.getFullYear();
  const month = String(source.getMonth() + 1).padStart(2, "0");
  const day = String(source.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function rightRotate(value, amount) {
  return (value >>> amount) | (value << (32 - amount));
}

// Synchronous SHA-256 to keep deterministic seed generation in both client and API runtime.
function sha256Hex(text) {
  const maxWord = 2 ** 32;
  const words = [];
  const hash = [];
  const k = [];
  const primeMarks = {};
  let primeCounter = 0;

  for (let candidate = 2; primeCounter < 64; candidate += 1) {
    if (primeMarks[candidate]) {
      continue;
    }

    for (let step = candidate; step < 313; step += candidate) {
      primeMarks[step] = true;
    }

    hash[primeCounter] = (candidate ** 0.5 * maxWord) | 0;
    k[primeCounter] = (candidate ** (1 / 3) * maxWord) | 0;
    primeCounter += 1;
  }

  const input = `${text}\x80`;

  for (let i = 0; i < input.length; i += 1) {
    const code = input.charCodeAt(i);
    words[i >> 2] = words[i >> 2] || 0;
    words[i >> 2] |= code << ((3 - (i % 4)) * 8);
  }

  while ((words.length % 16) !== 14) {
    words.push(0);
  }

  const bitLength = text.length * 8;
  words.push((bitLength / maxWord) | 0);
  words.push(bitLength);

  for (let blockStart = 0; blockStart < words.length; blockStart += 16) {
    const schedule = words.slice(blockStart, blockStart + 16);
    const previousHash = hash.slice();

    for (let i = 0; i < 64; i += 1) {
      const w15 = schedule[i - 15];
      const w2 = schedule[i - 2];

      const scheduleWord =
        i < 16
          ? schedule[i]
          : (schedule[i - 16] +
              (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
              schedule[i - 7] +
              (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
            0;

      schedule[i] = scheduleWord;

      const a = hash[0];
      const b = hash[1];
      const c = hash[2];
      const d = hash[3];
      const e = hash[4];
      const f = hash[5];
      const g = hash[6];
      const h = hash[7];

      const sigma1 = rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (h + sigma1 + ch + k[i] + scheduleWord) | 0;
      const sigma0 = rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (sigma0 + maj) | 0;

      hash[0] = (temp1 + temp2) | 0;
      hash[1] = a;
      hash[2] = b;
      hash[3] = c;
      hash[4] = (d + temp1) | 0;
      hash[5] = e;
      hash[6] = f;
      hash[7] = g;
    }

    for (let i = 0; i < 8; i += 1) {
      hash[i] = (hash[i] + previousHash[i]) | 0;
    }
  }

  let result = "";

  for (let i = 0; i < hash.length; i += 1) {
    const chunk = hash[i];

    for (let shift = 3; shift >= 0; shift -= 1) {
      const byte = (chunk >> (shift * 8)) & 255;
      result += byte.toString(16).padStart(2, "0");
    }
  }

  return result;
}

function hashToSeed(text) {
  const hex = sha256Hex(`${text}:${PUZZLE_SEED_SECRET}`);
  return Number.parseInt(hex.slice(0, 8), 16) >>> 0;
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

function normalizePuzzleType(puzzleType, dateKey) {
  const candidate = String(puzzleType || "").trim();

  if (candidate && PUZZLE_CONFIG[candidate]) {
    return candidate;
  }

  const index = hashToSeed(`${dateKey}:type:v2`) % PUZZLE_TYPE_LIST.length;
  return PUZZLE_TYPE_LIST[index];
}

function createSolutionGrid(dateKey, puzzleType) {
  const random = seededRandom(hashToSeed(`${dateKey}:${puzzleType}:solution:v2`));
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

function createGivensGrid(solution, dateKey, puzzleType) {
  const givenCount = PUZZLE_CONFIG[puzzleType]?.givenCount || 9;
  const random = seededRandom(hashToSeed(`${dateKey}:${puzzleType}:givens:v2`));
  const allIndexes = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index);
  const givenIndexes = new Set(shuffle(allIndexes, random).slice(0, givenCount));

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

export function getPuzzleTypeForDate(dateKey = getTodayDateKey()) {
  const safeDateKey = toDateKey(dateKey);
  return normalizePuzzleType("", safeDateKey);
}

export function getPuzzleConfig(puzzleType) {
  const safeType = normalizePuzzleType(puzzleType, getTodayDateKey());
  return {
    puzzleType: safeType,
    ...PUZZLE_CONFIG[safeType],
  };
}

export function createDailyPuzzle(dateKey = getTodayDateKey(), puzzleType = "") {
  const safeDateKey = toDateKey(dateKey);
  const safeType = normalizePuzzleType(puzzleType, safeDateKey);
  const config = PUZZLE_CONFIG[safeType];
  const solution = createSolutionGrid(safeDateKey, safeType);
  const givens = createGivensGrid(solution, safeDateKey, safeType);

  return {
    date: safeDateKey,
    puzzleType: safeType,
    puzzleTitle: config.title,
    size: GRID_SIZE,
    hintLimit: config.hintLimit,
    givens,
  };
}

export function getSolutionForDate(dateKey = getTodayDateKey(), puzzleType = "") {
  const safeDateKey = toDateKey(dateKey);
  const safeType = normalizePuzzleType(puzzleType, safeDateKey);
  return createSolutionGrid(safeDateKey, safeType);
}

export function evaluateSubmission(dateKey, rawGrid, puzzleType = "") {
  const safeDateKey = toDateKey(dateKey);
  const puzzle = createDailyPuzzle(safeDateKey, puzzleType);
  const grid = normalizeGrid(rawGrid);
  const solution = getSolutionForDate(safeDateKey, puzzle.puzzleType);

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

export function findHintCell(dateKey, rawGrid, puzzleType = "") {
  const result = evaluateSubmission(dateKey, rawGrid, puzzleType);

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
