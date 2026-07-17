import { getStone, pointToIndex } from '../domain/board';
import type { GameState } from '../domain/game';
import { BOARD_SIZE, type Player, type Point } from '../domain/types';

export type BoardView = {
  readonly element: HTMLElement;
  render(state: GameState): void;
};

const STONE_NAMES: Record<Player, string> = {
  black: 'чёрный',
  white: 'белый',
};

/** Traditional 9×9 star points; purely decorative. */
const HOSHI_POINTS = [
  [2, 2],
  [2, 6],
  [4, 4],
  [6, 2],
  [6, 6],
] as const;

const HOSHI_INDICES: ReadonlySet<number> = new Set(
  HOSHI_POINTS.map(([row, column]) => row * BOARD_SIZE + column),
);

/**
 * A 9×9 grid of real buttons: one per intersection, created once and
 * re-labelled on every render. Clicks are forwarded as board points;
 * what the click means (move or dead-group toggle) is decided outside.
 */
export function createBoardView(
  onIntersection: (point: Point) => void,
): BoardView {
  const element = document.createElement('div');
  element.className = 'board';
  element.setAttribute('role', 'group');
  element.setAttribute('aria-label', 'Доска го 9 на 9');

  const buttons: HTMLButtonElement[] = [];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'intersection';
      button.classList.toggle('edge-top', row === 0);
      button.classList.toggle('edge-bottom', row === BOARD_SIZE - 1);
      button.classList.toggle('edge-left', column === 0);
      button.classList.toggle('edge-right', column === BOARD_SIZE - 1);
      button.classList.toggle(
        'hoshi',
        HOSHI_INDICES.has(pointToIndex(row, column)),
      );
      button.addEventListener('click', () => onIntersection({ row, column }));

      buttons.push(button);
      element.append(button);
    }
  }

  const render = (state: GameState): void => {
    for (let row = 0; row < BOARD_SIZE; row += 1) {
      for (let column = 0; column < BOARD_SIZE; column += 1) {
        const index = pointToIndex(row, column);
        const button = buttons[index];

        if (button === undefined) {
          continue;
        }

        const stone = getStone(state.board, row, column);
        const isDead = state.deadPoints.has(index);

        let label = `ряд ${row + 1}, столбец ${column + 1}, ${
          stone === null ? 'пусто' : STONE_NAMES[stone]
        }`;

        if (isDead) {
          label += ', группа отмечена мёртвой';
        }

        button.setAttribute('aria-label', label);
        button.classList.toggle('has-black', stone === 'black');
        button.classList.toggle('has-white', stone === 'white');
        button.classList.toggle('is-dead', isDead);

        // In mark-dead only stones can be toggled; after finish the board
        // is inert. During play every intersection stays clickable so an
        // illegal attempt produces a readable explanation, not silence.
        button.disabled =
          state.phase === 'finished' ||
          (state.phase === 'mark-dead' && stone === null);
      }
    }
  };

  return { element, render };
}
