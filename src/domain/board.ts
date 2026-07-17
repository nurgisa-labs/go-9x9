import { BOARD_SIZE, type Board, type Point, type Stone } from './types';

const isInBounds = (row: number, column: number): boolean =>
  Number.isInteger(row) &&
  Number.isInteger(column) &&
  row >= 0 &&
  row < BOARD_SIZE &&
  column >= 0 &&
  column < BOARD_SIZE;

export function createEmptyBoard(): Board {
  return Array.from({ length: BOARD_SIZE * BOARD_SIZE }, () => null);
}

export function pointToIndex(row: number, column: number): number {
  if (!isInBounds(row, column)) {
    throw new RangeError(`Point (${row}, ${column}) is outside the board`);
  }

  return row * BOARD_SIZE + column;
}

export function getStone(board: Board, row: number, column: number): Stone {
  return board[pointToIndex(row, column)] ?? null;
}

export function setStone(
  board: Board,
  row: number,
  column: number,
  stone: Stone,
): Board {
  const index = pointToIndex(row, column);
  const next = [...board];
  next[index] = stone;

  return next;
}

export function orthogonalNeighbors(row: number, column: number): Point[] {
  const candidates: Point[] = [
    { row: row - 1, column },
    { row: row + 1, column },
    { row, column: column - 1 },
    { row, column: column + 1 },
  ];

  return candidates.filter((point) => isInBounds(point.row, point.column));
}
