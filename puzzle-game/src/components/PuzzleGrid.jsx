export default function PuzzleGrid({ puzzle, grid, onUpdate }) {
  if (!puzzle) {
    return null;
  }

  return (
    <div className="grid w-full max-w-md grid-cols-4 gap-2">
      {grid.map((row, rowIndex) =>
        row.map((cell, colIndex) => {
          const isGiven = puzzle.givens[rowIndex][colIndex] !== null;
          const value = cell === null ? "" : String(cell);

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
              className={`h-14 rounded-xl border text-center text-xl font-semibold outline-none transition ${
                isGiven
                  ? "cursor-not-allowed border-[rgba(44,49,136,0.65)] bg-[rgba(44,49,136,0.35)] text-[#e8e6e6]"
                  : "border-[rgba(248,201,180,0.35)] bg-[rgba(12,26,75,0.9)] text-[#f8c9b4] focus:border-[#eb5b2c]"
              }`}
            />
          );
        })
      )}
    </div>
  );
}
