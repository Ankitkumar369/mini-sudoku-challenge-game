import { GRID_SIZE } from "../../shared/dailyPuzzle";

function ClueCell({ value, violation, align = "center" }) {
  return (
    <span
      className={`flex h-8 w-8 items-center justify-center rounded-md text-xs font-semibold sm:h-9 sm:w-9 sm:text-sm ${
        violation
          ? "border border-[rgba(255,98,124,0.7)] bg-[rgba(255,98,124,0.22)] text-[#ffd6df]"
          : "border border-[rgba(255,255,255,0.12)] bg-[rgba(13,22,58,0.8)] text-[rgba(202,214,255,0.92)]"
      } ${align === "start" ? "justify-start" : align === "end" ? "justify-end" : ""}`}
    >
      {Number.isInteger(value) ? value : "-"}
    </span>
  );
}

export default function PuzzleGrid({ puzzle, grid, onUpdate, validationState }) {
  if (!puzzle) {
    return null;
  }

  const conflictKeys = new Set(validationState?.conflictCellKeys || []);
  const clueViolationKeys = new Set(validationState?.clueViolationKeys || []);
  const hasClues = Boolean(puzzle.clues);

  const boardColumns = hasClues
    ? "grid-cols-[2rem_repeat(4,minmax(0,1fr))_2rem] sm:grid-cols-[2.25rem_repeat(4,minmax(0,1fr))_2.25rem]"
    : "grid-cols-4";

  return (
    <div className={`grid w-full max-w-sm gap-1.5 ${boardColumns}`}>
      {hasClues ? (
        <>
          <span aria-hidden className="h-8 w-8 sm:h-9 sm:w-9" />
          {puzzle.clues.top.map((value, colIndex) => (
            <ClueCell
              key={`top-${colIndex}`}
              value={value}
              violation={clueViolationKeys.has(`top-${colIndex}`)}
            />
          ))}
          <span aria-hidden className="h-8 w-8 sm:h-9 sm:w-9" />
        </>
      ) : null}

      {grid.map((row, rowIndex) => (
        <div key={`row-${rowIndex}`} className={`contents`}>
          {hasClues ? (
            <ClueCell
              value={puzzle.clues.left[rowIndex]}
              violation={clueViolationKeys.has(`left-${rowIndex}`)}
            />
          ) : null}

          {row.map((cell, colIndex) => {
            const isGiven = puzzle.givens[rowIndex][colIndex] !== null;
            const value = cell === null ? "" : String(cell);
            const isConflict = conflictKeys.has(`${rowIndex}-${colIndex}`);

            return (
              <input
                key={`${rowIndex}-${colIndex}`}
                type="text"
                inputMode="numeric"
                maxLength={1}
                value={value}
                onChange={(event) => onUpdate(rowIndex, colIndex, event.target.value)}
                disabled={isGiven}
                aria-label={`Cell ${rowIndex + 1}-${colIndex + 1}`}
                className={`h-12 rounded-xl border text-center text-lg font-semibold outline-none transition sm:h-14 sm:text-xl ${
                  isGiven
                    ? "cursor-not-allowed border-[rgba(72,97,168,0.7)] bg-[rgba(55,77,138,0.5)] text-[#f4f7ff]"
                    : isConflict
                    ? "border-[rgba(255,98,124,0.74)] bg-[rgba(120,26,44,0.36)] text-[#ffd6df]"
                    : "border-[rgba(166,188,255,0.35)] bg-[rgba(9,23,65,0.9)] text-[#f7fbff] focus:border-[#52d0ff]"
                }`}
              />
            );
          })}

          {hasClues ? (
            <ClueCell
              value={puzzle.clues.right[rowIndex]}
              violation={clueViolationKeys.has(`right-${rowIndex}`)}
            />
          ) : null}
        </div>
      ))}

      {hasClues ? (
        <>
          <span aria-hidden className="h-8 w-8 sm:h-9 sm:w-9" />
          {puzzle.clues.bottom.map((value, colIndex) => (
            <ClueCell
              key={`bottom-${colIndex}`}
              value={value}
              violation={clueViolationKeys.has(`bottom-${colIndex}`)}
            />
          ))}
          <span aria-hidden className="h-8 w-8 sm:h-9 sm:w-9" />
        </>
      ) : null}
    </div>
  );
}
