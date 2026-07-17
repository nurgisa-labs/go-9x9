import {
  confirmScoring,
  createGame,
  pass,
  playMove,
  toggleDeadGroup,
} from '../domain/game';
import type { GameState } from '../domain/game';
import type { Point } from '../domain/types';
import { createBoardView } from './board-view';
import { createStatusView } from './status-view';

/**
 * Owns the single GameState and wires the two views to domain actions.
 * All Go rules live in src/domain; the UI only forwards clicks and
 * re-renders whatever state the domain returns.
 */
export function mountApp(root: HTMLElement): void {
  let state: GameState = createGame();

  const rerender = (): void => {
    boardView.render(state);
    statusView.render(state);
  };

  const apply = (next: GameState): void => {
    const phaseChanged = state.phase !== next.phase;
    state = next;
    rerender();
    // Move focus only after rerender, so the announcement line reflects the
    // new phase and the action button that held focus may already be hidden.
    if (phaseChanged) {
      statusView.focusPhaseAnnouncement();
    }
  };

  const boardView = createBoardView((point: Point) => {
    if (state.phase === 'play') {
      apply(playMove(state, point));
    } else if (state.phase === 'mark-dead') {
      apply(toggleDeadGroup(state, point));
    }
  });

  const statusView = createStatusView({
    onPass: () => apply(pass(state)),
    onConfirmScoring: () => apply(confirmScoring(state)),
  });

  const heading = document.createElement('h1');
  heading.textContent = 'Го 9×9 — два игрока за одним экраном';

  const layout = document.createElement('div');
  layout.className = 'layout';
  // Status panel comes first in DOM/tab order so keyboard and screen-reader
  // users reach the game state before the 81 board intersections; CSS grid
  // areas (.layout) restore the visual order: board left/top, status right/bottom.
  layout.append(statusView.element, boardView.element);

  const app = document.createElement('main');
  app.className = 'app';
  app.append(heading, layout);

  root.replaceChildren(app);
  rerender();
}
