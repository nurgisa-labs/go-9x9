import { orthogonalNeighbors, pointToIndex } from './board';
import { BOARD_SIZE, type Board, type Player, type Stone } from './types';

/** Fixed white compensation from the game brief (Chinese area rules). */
export const WHITE_KOMI = 7.5;

export type AreaScore = {
  readonly black: number;
  readonly white: number;
  readonly whiteKomi: number;
  readonly winner: Player;
};

/**
 * Chinese area score: each player owns their living stones plus every empty
 * region bordered exclusively by their color. Regions touching both colors
 * (or nothing at all, as on an empty board) are neutral. `deadPoints` holds
 * board indices of stones agreed dead; they are cleared on a virtual copy so
 * the scored position never mutates the input board. A draw is impossible
 * under the fixed 7.5 komi, so the winner is always decided.
 */
export function scoreArea(
  board: Board,
  deadPoints: ReadonlySet<number>,
): AreaScore {
  const virtual: Stone[] = board.map((stone, index) =>
    deadPoints.has(index) ? null : stone,
  );

  let black = 0;
  let white = 0;

  for (const stone of virtual) {
    if (stone === 'black') {
      black += 1;
    } else if (stone === 'white') {
      white += 1;
    }
  }

  const visited = new Set<number>();

  for (let index = 0; index < virtual.length; index += 1) {
    if (virtual[index] !== null || visited.has(index)) {
      continue;
    }

    const region = collectEmptyRegion(virtual, index, visited);

    if (region.owner === 'black') {
      black += region.size;
    } else if (region.owner === 'white') {
      white += region.size;
    }
  }

  return {
    black,
    white,
    whiteKomi: WHITE_KOMI,
    winner: black > white + WHITE_KOMI ? 'black' : 'white',
  };
}

type EmptyRegion = {
  readonly size: number;
  /** The sole bordering color, or null when mixed or borderless. */
  readonly owner: Player | null;
};

function collectEmptyRegion(
  virtual: readonly Stone[],
  start: number,
  visited: Set<number>,
): EmptyRegion {
  const borders = new Set<Player>();
  const stack: number[] = [start];
  visited.add(start);
  let size = 0;

  while (stack.length > 0) {
    const index = stack.pop() as number;
    size += 1;

    const row = Math.floor(index / BOARD_SIZE);
    const column = index % BOARD_SIZE;

    for (const neighbor of orthogonalNeighbors(row, column)) {
      const neighborIndex = pointToIndex(neighbor.row, neighbor.column);
      const stone = virtual[neighborIndex] ?? null;

      if (stone === null) {
        if (!visited.has(neighborIndex)) {
          visited.add(neighborIndex);
          stack.push(neighborIndex);
        }
      } else {
        borders.add(stone);
      }
    }
  }

  const [sole] = borders;

  return { size, owner: borders.size === 1 ? (sole ?? null) : null };
}
