const PUZZLE_TYPE_MAP = {
  CROSS_MATH: "stage-cross-math-grid",
  SEQUENCE: "stage-sequence-intelligence",
  LOGIC_CIRCUIT: "stage-logic-circuit",
  TANGO: "stage-tango-logic",
  QUEENS: "stage-queens-logic",
  WORD_LOCK: "stage-word-lock",
};

// Backward-compatible aliases.
PUZZLE_TYPE_MAP.CLASSIC = PUZZLE_TYPE_MAP.CROSS_MATH;
PUZZLE_TYPE_MAP.CHALLENGE = PUZZLE_TYPE_MAP.TANGO;

export const PUZZLE_TYPES = Object.freeze(PUZZLE_TYPE_MAP);
export const PUZZLE_TYPE = PUZZLE_TYPES.CROSS_MATH;
export const GRID_SIZE = 4;

const PUZZLE_SEED_SECRET = "capstone-daily-puzzle-v3";

const PUZZLE_CONFIG = {
  [PUZZLE_TYPES.CROSS_MATH]: {
    title: "Cross Math Grid",
    stageNumber: 1,
    givenCount: 10,
    hintLimit: 3,
    clueCount: 0,
    hasSkyscraperClues: false,
    rules: [
      "Fill each row with numbers 1 to 4 without repetition.",
      "Fill each column with numbers 1 to 4 without repetition.",
      "Start with rows/columns where most values are already given.",
    ],
  },
  [PUZZLE_TYPES.SEQUENCE]: {
    title: "Sequence Intelligence",
    stageNumber: 2,
    givenCount: 8,
    hintLimit: 2,
    clueCount: 0,
    hasSkyscraperClues: false,
    rules: [
      "Each row and column must contain 1 to 4 exactly once.",
      "Use elimination chains to infer hidden cells.",
      "Avoid guess-first; propagate constraints step by step.",
    ],
  },
  [PUZZLE_TYPES.LOGIC_CIRCUIT]: {
    title: "Logic Circuit",
    stageNumber: 3,
    givenCount: 7,
    hintLimit: 2,
    clueCount: 12,
    hasSkyscraperClues: true,
    rules: [
      "Each row and column must contain 1 to 4 exactly once.",
      "Edge clues represent visible towers from that direction.",
      "A higher value hides all smaller values behind it.",
    ],
  },
  [PUZZLE_TYPES.TANGO]: {
    title: "Tango Logic",
    stageNumber: 4,
    givenCount: 6,
    hintLimit: 1,
    clueCount: 10,
    hasSkyscraperClues: true,
    rules: [
      "Rows and columns must stay unique.",
      "Work with fewer givens and sparse edge clues.",
      "Check both row and column visibility after each move.",
    ],
  },
  [PUZZLE_TYPES.QUEENS]: {
    title: "Queens Logic",
    stageNumber: 5,
    givenCount: 5,
    hintLimit: 1,
    clueCount: 8,
    hasSkyscraperClues: true,
    rules: [
      "Rows and columns must stay unique.",
      "Only a few edge clues are visible in this stage.",
      "Use contradiction checks before locking a number.",
    ],
  },
  [PUZZLE_TYPES.WORD_LOCK]: {
    title: "Word Lock",
    stageNumber: 6,
    givenCount: 4,
    hintLimit: 1,
    clueCount: 6,
    hasSkyscraperClues: true,
    rules: [
      "Final stage: minimum givens and minimal clue visibility.",
      "All row, column, and visible clue constraints must be valid.",
      "Solve with pure deduction for daily run completion.",
    ],
  },
};

const PUZZLE_TYPE_LIST = Object.keys(PUZZLE_CONFIG);

export const DAILY_STAGES = Object.freeze(
  PUZZLE_TYPE_LIST.map((puzzleType) => ({
    puzzleType,
    title: PUZZLE_CONFIG[puzzleType].title,
    stageNumber: PUZZLE_CONFIG[puzzleType].stageNumber,
  }))
);

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

function normalizePuzzleType(puzzleType) {
  const candidate = String(puzzleType || "").trim();

  if (candidate && PUZZLE_CONFIG[candidate]) {
    return candidate;
  }

  return PUZZLE_TYPE;
}

function createSolutionGrid(dateKey, puzzleType) {
  const random = seededRandom(hashToSeed(`${dateKey}:${puzzleType}:solution:v4`));
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
  const givenCount = PUZZLE_CONFIG[puzzleType]?.givenCount || 8;
  const random = seededRandom(hashToSeed(`${dateKey}:${puzzleType}:givens:v4`));
  const allIndexes = Array.from({ length: GRID_SIZE * GRID_SIZE }, (_, index) => index);
  const givenIndexes = new Set(shuffle(allIndexes, random).slice(0, givenCount));

  return Array.from({ length: GRID_SIZE }, (_, row) =>
    Array.from({ length: GRID_SIZE }, (_, col) => {
      const index = row * GRID_SIZE + col;
      return givenIndexes.has(index) ? solution[row][col] : null;
    })
  );
}

function countVisibleTowers(line) {
  let highest = 0;
  let visible = 0;

  for (const tower of line) {
    if (tower > highest) {
      highest = tower;
      visible += 1;
    }
  }

  return visible;
}

function createSkyscraperClues(solution) {
  const top = [];
  const bottom = [];
  const left = [];
  const right = [];

  for (let row = 0; row < GRID_SIZE; row += 1) {
    const line = solution[row];
    left.push(countVisibleTowers(line));
    right.push(countVisibleTowers([...line].reverse()));
  }

  for (let col = 0; col < GRID_SIZE; col += 1) {
    const line = Array.from({ length: GRID_SIZE }, (_, row) => solution[row][col]);
    top.push(countVisibleTowers(line));
    bottom.push(countVisibleTowers([...line].reverse()));
  }

  return { top, right, bottom, left };
}

function createEmptyClues() {
  return {
    top: Array.from({ length: GRID_SIZE }, () => null),
    right: Array.from({ length: GRID_SIZE }, () => null),
    bottom: Array.from({ length: GRID_SIZE }, () => null),
    left: Array.from({ length: GRID_SIZE }, () => null),
  };
}

function applyClueMask(fullClues, dateKey, puzzleType, clueCount) {
  const maxClues = GRID_SIZE * 4;

  if (!Number.isInteger(clueCount) || clueCount <= 0) {
    return createEmptyClues();
  }

  if (clueCount >= maxClues) {
    return fullClues;
  }

  const random = seededRandom(hashToSeed(`${dateKey}:${puzzleType}:clues:v4`));
  const sideOrder = shuffle(["top", "right", "bottom", "left"], random);
  const pool = [];

  for (const side of ["top", "right", "bottom", "left"]) {
    for (let index = 0; index < GRID_SIZE; index += 1) {
      pool.push({ side, index });
    }
  }

  const selected = [];
  const used = new Set();

  // Keep at least one clue on each side when possible.
  for (const side of sideOrder) {
    if (selected.length >= clueCount) {
      break;
    }

    const sideCandidates = pool.filter((item) => item.side === side);
    const chosen = sideCandidates[Math.floor(random() * sideCandidates.length)];
    const key = `${chosen.side}-${chosen.index}`;

    if (!used.has(key)) {
      used.add(key);
      selected.push(chosen);
    }
  }

  const remaining = shuffle(pool, random);
  for (const item of remaining) {
    if (selected.length >= clueCount) {
      break;
    }

    const key = `${item.side}-${item.index}`;
    if (!used.has(key)) {
      used.add(key);
      selected.push(item);
    }
  }

  const masked = createEmptyClues();
  for (const { side, index } of selected) {
    masked[side][index] = fullClues[side][index];
  }

  return masked;
}

function createPuzzleClues(solution, dateKey, puzzleType) {
  const config = PUZZLE_CONFIG[puzzleType];

  if (!config?.hasSkyscraperClues) {
    return null;
  }

  const fullClues = createSkyscraperClues(solution);
  return applyClueMask(fullClues, dateKey, puzzleType, config.clueCount);
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

function getLineValues(grid, type, index) {
  if (type === "row") {
    return [...grid[index]];
  }

  return Array.from({ length: GRID_SIZE }, (_, row) => grid[row][index]);
}

function addRowConflicts(targetSet, row) {
  for (let col = 0; col < GRID_SIZE; col += 1) {
    targetSet.add(`${row}-${col}`);
  }
}

function addColConflicts(targetSet, col) {
  for (let row = 0; row < GRID_SIZE; row += 1) {
    targetSet.add(`${row}-${col}`);
  }
}

function evaluateSkyscraperLine(clueValue, lineValues) {
  if (!Number.isInteger(clueValue)) {
    return { violated: false };
  }

  if (lineValues.some((value) => value === null)) {
    return { violated: false };
  }

  const visible = countVisibleTowers(lineValues);
  return {
    violated: visible !== clueValue,
    visible,
  };
}

function validateGridStateFromPuzzle(grid, puzzle) {
  const conflictKeys = new Set();
  const clueViolationKeys = new Set();
  let duplicateCount = 0;
  let clueViolationCount = 0;
  let givenMismatchCount = 0;

  for (let row = 0; row < GRID_SIZE; row += 1) {
    const positions = new Map();

    for (let col = 0; col < GRID_SIZE; col += 1) {
      const value = grid[row][col];
      if (value === null) {
        continue;
      }

      if (!positions.has(value)) {
        positions.set(value, []);
      }

      positions.get(value).push(col);
    }

    for (const cols of positions.values()) {
      if (cols.length > 1) {
        duplicateCount += cols.length;
        for (const col of cols) {
          conflictKeys.add(`${row}-${col}`);
        }
      }
    }
  }

  for (let col = 0; col < GRID_SIZE; col += 1) {
    const positions = new Map();

    for (let row = 0; row < GRID_SIZE; row += 1) {
      const value = grid[row][col];
      if (value === null) {
        continue;
      }

      if (!positions.has(value)) {
        positions.set(value, []);
      }

      positions.get(value).push(row);
    }

    for (const rows of positions.values()) {
      if (rows.length > 1) {
        duplicateCount += rows.length;
        for (const row of rows) {
          conflictKeys.add(`${row}-${col}`);
        }
      }
    }
  }

  for (let row = 0; row < GRID_SIZE; row += 1) {
    for (let col = 0; col < GRID_SIZE; col += 1) {
      const given = puzzle.givens[row][col];
      const value = grid[row][col];

      if (given !== null && value !== null && value !== given) {
        givenMismatchCount += 1;
        conflictKeys.add(`${row}-${col}`);
      }
    }
  }

  if (puzzle.clues) {
    for (let row = 0; row < GRID_SIZE; row += 1) {
      const leftEval = evaluateSkyscraperLine(puzzle.clues.left[row], getLineValues(grid, "row", row));
      const rightEval = evaluateSkyscraperLine(
        puzzle.clues.right[row],
        [...getLineValues(grid, "row", row)].reverse()
      );

      if (leftEval.violated) {
        clueViolationCount += 1;
        clueViolationKeys.add(`left-${row}`);
        addRowConflicts(conflictKeys, row);
      }

      if (rightEval.violated) {
        clueViolationCount += 1;
        clueViolationKeys.add(`right-${row}`);
        addRowConflicts(conflictKeys, row);
      }
    }

    for (let col = 0; col < GRID_SIZE; col += 1) {
      const topEval = evaluateSkyscraperLine(puzzle.clues.top[col], getLineValues(grid, "col", col));
      const bottomEval = evaluateSkyscraperLine(
        puzzle.clues.bottom[col],
        [...getLineValues(grid, "col", col)].reverse()
      );

      if (topEval.violated) {
        clueViolationCount += 1;
        clueViolationKeys.add(`top-${col}`);
        addColConflicts(conflictKeys, col);
      }

      if (bottomEval.violated) {
        clueViolationCount += 1;
        clueViolationKeys.add(`bottom-${col}`);
        addColConflicts(conflictKeys, col);
      }
    }
  }

  return {
    hasConflicts: conflictKeys.size > 0,
    conflictCellKeys: [...conflictKeys],
    clueViolationKeys: [...clueViolationKeys],
    duplicateCount,
    clueViolationCount,
    givenMismatchCount,
  };
}

export function getTodayDateKey() {
  return toDateKey(new Date());
}

export function getPuzzleTypeForDate() {
  return PUZZLE_TYPE;
}

export function getPuzzleConfig(puzzleType) {
  const safeType = normalizePuzzleType(puzzleType);
  return {
    puzzleType: safeType,
    ...PUZZLE_CONFIG[safeType],
  };
}

export function createDailyPuzzle(dateKey = getTodayDateKey(), puzzleType = "") {
  const safeDateKey = toDateKey(dateKey);
  const safeType = normalizePuzzleType(puzzleType);
  const config = PUZZLE_CONFIG[safeType];
  const solution = createSolutionGrid(safeDateKey, safeType);
  const givens = createGivensGrid(solution, safeDateKey, safeType);
  const clues = createPuzzleClues(solution, safeDateKey, safeType);

  return {
    date: safeDateKey,
    puzzleType: safeType,
    puzzleTitle: config.title,
    stageNumber: config.stageNumber,
    size: GRID_SIZE,
    hintLimit: config.hintLimit,
    rules: config.rules,
    clues,
    givens,
  };
}

export function getSolutionForDate(dateKey = getTodayDateKey(), puzzleType = "") {
  const safeDateKey = toDateKey(dateKey);
  const safeType = normalizePuzzleType(puzzleType);
  return createSolutionGrid(safeDateKey, safeType);
}

export function getGridValidationState(dateKey, rawGrid, puzzleType = "") {
  const safeDateKey = toDateKey(dateKey);
  const puzzle = createDailyPuzzle(safeDateKey, puzzleType);
  const grid = normalizeGrid(rawGrid);

  return {
    ...validateGridStateFromPuzzle(grid, puzzle),
    puzzle,
    grid,
  };
}

export function evaluateSubmission(dateKey, rawGrid, puzzleType = "") {
  const safeDateKey = toDateKey(dateKey);
  const puzzle = createDailyPuzzle(safeDateKey, puzzleType);
  const grid = normalizeGrid(rawGrid);
  const solution = getSolutionForDate(safeDateKey, puzzle.puzzleType);
  const validation = validateGridStateFromPuzzle(grid, puzzle);

  let totalEditableCells = 0;
  let correctEditableCells = 0;
  let complete = true;

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

      if (current === null) {
        complete = false;
      }
    }
  }

  const solved = complete && !validation.hasConflicts;

  return {
    solved,
    complete,
    totalEditableCells,
    correctEditableCells,
    ruleViolations: validation.duplicateCount + validation.clueViolationCount,
    solution,
    grid,
    puzzle,
    validation,
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
