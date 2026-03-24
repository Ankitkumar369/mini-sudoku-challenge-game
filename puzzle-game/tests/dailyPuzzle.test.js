import test from "node:test";
import assert from "node:assert/strict";
import {
  GRID_SIZE,
  PUZZLE_TYPES,
  createDailyPuzzle,
  createInitialGrid,
  evaluateSubmission,
  findHintCell,
  getGridValidationState,
  getPuzzleTypeForDate,
  getSolutionForDate,
} from "../shared/dailyPuzzle.js";

function countGivens(givens) {
  let count = 0;

  for (const row of givens) {
    for (const value of row) {
      if (value !== null) {
        count += 1;
      }
    }
  }

  return count;
}

test("createDailyPuzzle is deterministic for the same date", () => {
  const first = createDailyPuzzle("2026-02-11");
  const second = createDailyPuzzle("2026-02-11");

  assert.deepEqual(first, second);
  assert.equal(first.size, GRID_SIZE);
  assert.equal(first.date, "2026-02-11");
  assert.ok(countGivens(first.givens) >= 4 && countGivens(first.givens) <= 10);
  assert.ok(Object.values(PUZZLE_TYPES).includes(first.puzzleType));
});

test("evaluateSubmission solves correctly with full solution", () => {
  const date = "2026-02-11";
  const solution = getSolutionForDate(date);
  const evaluation = evaluateSubmission(date, solution);

  assert.equal(evaluation.solved, true);
  assert.equal(evaluation.correctEditableCells, evaluation.totalEditableCells);
});

test("evaluateSubmission marks incomplete grid as unsolved", () => {
  const date = "2026-02-11";
  const puzzle = createDailyPuzzle(date);
  const incomplete = createInitialGrid(puzzle.givens);
  const evaluation = evaluateSubmission(date, incomplete);

  assert.equal(evaluation.solved, false);
  assert.ok(evaluation.correctEditableCells < evaluation.totalEditableCells);
});

test("findHintCell returns a valid missing cell and null for solved puzzle", () => {
  const date = "2026-02-11";
  const puzzle = createDailyPuzzle(date);
  const incomplete = createInitialGrid(puzzle.givens);
  const hint = findHintCell(date, incomplete, puzzle.puzzleType);

  assert.ok(hint);
  assert.ok(Number.isInteger(hint.row));
  assert.ok(Number.isInteger(hint.col));
  assert.ok(Number.isInteger(hint.value));
  assert.ok(hint.value >= 1 && hint.value <= GRID_SIZE);

  const solved = getSolutionForDate(date);
  const solvedHint = findHintCell(date, solved, puzzle.puzzleType);
  assert.equal(solvedHint, null);
});

test("getPuzzleTypeForDate can resolve different types across days", () => {
  const typeA = getPuzzleTypeForDate("2026-02-11");
  const typeB = getPuzzleTypeForDate("2026-02-12");

  assert.ok(Object.values(PUZZLE_TYPES).includes(typeA));
  assert.ok(Object.values(PUZZLE_TYPES).includes(typeB));
});

test("challenge puzzle includes deterministic skyscraper clues", () => {
  const puzzle = createDailyPuzzle("2026-02-11", PUZZLE_TYPES.CHALLENGE);

  assert.ok(puzzle.clues);
  assert.equal(puzzle.clues.top.length, GRID_SIZE);
  assert.equal(puzzle.clues.right.length, GRID_SIZE);
  assert.equal(puzzle.clues.bottom.length, GRID_SIZE);
  assert.equal(puzzle.clues.left.length, GRID_SIZE);
});

test("grid validation flags duplicate violations", () => {
  const puzzle = createDailyPuzzle("2026-02-11", PUZZLE_TYPES.CLASSIC);
  const grid = createInitialGrid(puzzle.givens);

  grid[0][0] = 1;
  grid[0][1] = 1;

  const state = getGridValidationState("2026-02-11", grid, PUZZLE_TYPES.CLASSIC);

  assert.equal(state.hasConflicts, true);
  assert.ok(state.duplicateCount > 0);
  assert.ok(state.conflictCellKeys.length > 0);
});
