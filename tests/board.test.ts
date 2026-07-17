import { describe, expect, it } from 'vitest';

import {
  createEmptyBoard,
  getStone,
  orthogonalNeighbors,
  pointToIndex,
  setStone,
} from '../src/domain/board';
import { BOARD_SIZE } from '../src/domain/types';

describe('createEmptyBoard', () => {
  it('creates a board with one cell per intersection of a nine-line board', () => {
    const board = createEmptyBoard();

    expect(board).toHaveLength(BOARD_SIZE * BOARD_SIZE);
  });

  it('leaves every intersection empty', () => {
    const board = createEmptyBoard();

    expect(board.every((stone) => stone === null)).toBe(true);
  });
});

describe('pointToIndex', () => {
  it('maps the top-left corner to index 0', () => {
    expect(pointToIndex(0, 0)).toBe(0);
  });

  it('maps coordinates row-major: row 0 fills indices before row 1', () => {
    expect(pointToIndex(0, 8)).toBe(8);
    expect(pointToIndex(1, 0)).toBe(9);
  });

  it('maps an interior point as row * BOARD_SIZE + column', () => {
    expect(pointToIndex(4, 6)).toBe(4 * BOARD_SIZE + 6);
  });

  it('maps the bottom-right corner to the last index', () => {
    expect(pointToIndex(8, 8)).toBe(BOARD_SIZE * BOARD_SIZE - 1);
  });

  it.each([
    [-1, 0],
    [0, -1],
    [9, 0],
    [0, 9],
  ])('rejects out-of-range coordinates (%i, %i)', (row, column) => {
    expect(() => pointToIndex(row, column)).toThrow(RangeError);
  });

  it.each([
    [0.5, 0],
    [0, 2.5],
    [0.5, 2.5],
  ])('rejects non-integer coordinates (%d, %d)', (row, column) => {
    expect(() => pointToIndex(row, column)).toThrow(RangeError);
  });
});

describe('getStone', () => {
  it('returns null for an empty intersection', () => {
    const board = createEmptyBoard();

    expect(getStone(board, 2, 3)).toBeNull();
  });

  it('returns the stone stored at the row-major index', () => {
    const board = setStone(createEmptyBoard(), 2, 3, 'black');

    expect(getStone(board, 2, 3)).toBe('black');
  });

  it.each([
    [-1, 4],
    [4, -1],
    [9, 4],
    [4, 9],
  ])('rejects out-of-range coordinates (%i, %i)', (row, column) => {
    const board = createEmptyBoard();

    expect(() => getStone(board, row, column)).toThrow(RangeError);
  });

  it.each([
    [0.5, 3],
    [2, 2.5],
  ])('rejects non-integer coordinates (%d, %d)', (row, column) => {
    const board = createEmptyBoard();

    expect(() => getStone(board, row, column)).toThrow(RangeError);
  });
});

describe('setStone', () => {
  it('places a stone at the requested intersection', () => {
    const board = setStone(createEmptyBoard(), 5, 1, 'white');

    expect(getStone(board, 5, 1)).toBe('white');
  });

  it('returns a new board and leaves the original untouched', () => {
    const original = createEmptyBoard();

    const updated = setStone(original, 5, 1, 'white');

    expect(updated).not.toBe(original);
    expect(getStone(original, 5, 1)).toBeNull();
  });

  it('does not disturb other intersections', () => {
    const withBlack = setStone(createEmptyBoard(), 0, 0, 'black');

    const withBoth = setStone(withBlack, 8, 8, 'white');

    expect(getStone(withBoth, 0, 0)).toBe('black');
    expect(getStone(withBoth, 8, 8)).toBe('white');
  });

  it('can clear an intersection by setting null', () => {
    const withStone = setStone(createEmptyBoard(), 4, 4, 'black');

    const cleared = setStone(withStone, 4, 4, null);

    expect(getStone(cleared, 4, 4)).toBeNull();
  });

  it.each([
    [-1, 0],
    [0, -1],
    [9, 0],
    [0, 9],
  ])('rejects out-of-range coordinates (%i, %i)', (row, column) => {
    const board = createEmptyBoard();

    expect(() => setStone(board, row, column, 'black')).toThrow(RangeError);
  });

  it.each([
    [0.5, 1],
    [5, 2.5],
  ])('rejects non-integer coordinates (%d, %d)', (row, column) => {
    const board = createEmptyBoard();

    expect(() => setStone(board, row, column, 'black')).toThrow(RangeError);
  });
});

describe('orthogonalNeighbors', () => {
  const sorted = (points: ReadonlyArray<{ row: number; column: number }>) =>
    [...points].sort((a, b) => a.row - b.row || a.column - b.column);

  it('returns two neighbors for the top-left corner', () => {
    expect(sorted(orthogonalNeighbors(0, 0))).toEqual([
      { row: 0, column: 1 },
      { row: 1, column: 0 },
    ]);
  });

  it('returns two neighbors for the bottom-right corner', () => {
    expect(sorted(orthogonalNeighbors(8, 8))).toEqual([
      { row: 7, column: 8 },
      { row: 8, column: 7 },
    ]);
  });

  it('returns three neighbors for an edge point', () => {
    expect(sorted(orthogonalNeighbors(0, 4))).toEqual([
      { row: 0, column: 3 },
      { row: 0, column: 5 },
      { row: 1, column: 4 },
    ]);
  });

  it('returns four neighbors for an interior point', () => {
    expect(sorted(orthogonalNeighbors(4, 4))).toEqual([
      { row: 3, column: 4 },
      { row: 4, column: 3 },
      { row: 4, column: 5 },
      { row: 5, column: 4 },
    ]);
  });

  it('never returns coordinates outside the board', () => {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        for (const neighbor of orthogonalNeighbors(row, column)) {
          expect(neighbor.row).toBeGreaterThanOrEqual(0);
          expect(neighbor.row).toBeLessThan(BOARD_SIZE);
          expect(neighbor.column).toBeGreaterThanOrEqual(0);
          expect(neighbor.column).toBeLessThan(BOARD_SIZE);
        }
      }
    }
  });
});
