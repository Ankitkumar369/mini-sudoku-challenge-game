import test from "node:test";
import assert from "node:assert/strict";
import {
  GRID_SIZE,
  createDailyPuzzle,
  createInitialGrid,
  evaluateSubmission,
  findHintCell,
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
  assert.equal(countGivens(first.givens), 9);
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
  const hint = findHintCell(date, incomplete);

  assert.ok(hint);
  assert.ok(Number.isInteger(hint.row));
  assert.ok(Number.isInteger(hint.col));
  assert.ok(Number.isInteger(hint.value));
  assert.ok(hint.value >= 1 && hint.value <= GRID_SIZE);

  const solved = getSolutionForDate(date);
  const solvedHint = findHintCell(date, solved);
  assert.equal(solvedHint, null);
});
