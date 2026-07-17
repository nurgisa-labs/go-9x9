import type { GameState } from '../domain/game';
import { scoreArea } from '../domain/scoring';
import type { AreaScore } from '../domain/scoring';
import type { Player } from '../domain/types';

export type StatusView = {
  readonly element: HTMLElement;
  render(state: GameState): void;
  /**
   * Moves keyboard focus to the phase announcement line. Used when a phase
   * transition hides the action button that previously held focus, so the
   * focus never silently falls back to <body>.
   */
  focusPhaseAnnouncement(): void;
};

type StatusHandlers = {
  readonly onPass: () => void;
  readonly onConfirmScoring: () => void;
};

const PLAYER_NAMES: Record<Player, string> = {
  black: 'чёрные',
  white: 'белые',
};

const REJECTION_MESSAGES: Record<
  NonNullable<GameState['lastMoveRejection']>,
  string
> = {
  occupied: 'Недопустимый ход: это пересечение уже занято.',
  suicide:
    'Недопустимый ход: своя группа осталась бы без свобод (самоубийство запрещено).',
  'repeat-position':
    'Недопустимый ход: такая позиция на доске уже была — повтор позиции запрещён.',
};

const formatScore = (value: number): string => value.toLocaleString('ru-RU');

/**
 * Text panel next to the board: whose turn it is, the current phase,
 * a readable explanation for a rejected move, the phase-specific action
 * button and — once the game is finished — the transparent area score.
 */
export function createStatusView(handlers: StatusHandlers): StatusView {
  const element = document.createElement('section');
  element.className = 'status';
  element.setAttribute('aria-label', 'Состояние партии');

  const turnLine = document.createElement('p');
  turnLine.className = 'status__turn';
  turnLine.setAttribute('role', 'status');
  // Programmatic focus target for phase transitions; stays out of tab order.
  turnLine.tabIndex = -1;

  // The hint carries meaningful state changes (one-pass warning, mark-dead
  // instructions), so it is a polite atomic live region like error/result.
  const hint = document.createElement('p');
  hint.className = 'status__hint';
  hint.setAttribute('role', 'status');
  hint.setAttribute('aria-live', 'polite');
  hint.setAttribute('aria-atomic', 'true');

  // Live regions stay mounted and exposed to assistive tech at all times:
  // empty ones are hidden with a visually-hidden CSS pattern on :empty,
  // never via `hidden`/`display: none`/`visibility: hidden`, which would
  // remove them from the accessibility tree.
  const error = document.createElement('p');
  error.className = 'status__error';
  error.setAttribute('role', 'status');
  error.setAttribute('aria-live', 'polite');
  error.setAttribute('aria-atomic', 'true');

  const passButton = document.createElement('button');
  passButton.type = 'button';
  passButton.className = 'action';
  passButton.textContent = 'Пас';
  passButton.addEventListener('click', handlers.onPass);

  const confirmButton = document.createElement('button');
  confirmButton.type = 'button';
  confirmButton.className = 'action';
  confirmButton.textContent = 'Игроки согласовали счёт';
  confirmButton.addEventListener('click', handlers.onConfirmScoring);

  const result = document.createElement('div');
  result.className = 'status__result';
  result.setAttribute('role', 'status');
  result.setAttribute('aria-live', 'polite');
  result.setAttribute('aria-atomic', 'true');

  element.append(turnLine, hint, error, passButton, confirmButton, result);

  const render = (state: GameState): void => {
    if (state.phase === 'play') {
      turnLine.textContent = `Фаза: игра. Ходят ${PLAYER_NAMES[state.currentPlayer]}.`;
      hint.textContent =
        state.consecutivePasses === 1
          ? 'Был один пас. Ещё один пас подряд завершит игру.'
          : 'Кликните свободное пересечение, чтобы поставить камень.';
    } else if (state.phase === 'mark-dead') {
      turnLine.textContent = 'Фаза: отметка мёртвых групп.';
      hint.textContent =
        'Оба игрока за одним экраном вместе решают, какие группы мертвы: клик по камню отмечает или снимает отметку со всей его группы.';
    } else {
      turnLine.textContent = 'Фаза: партия завершена.';
      hint.textContent = '';
    }

    if (state.lastMoveRejection === null) {
      error.textContent = '';
    } else {
      const message = REJECTION_MESSAGES[state.lastMoveRejection];
      // Toggle an invisible trailing space when the same illegal move is
      // attempted again: aria-atomic re-announces only on content change.
      error.textContent =
        error.textContent === message ? `${message} ` : message;
    }

    passButton.hidden = state.phase !== 'play';
    confirmButton.hidden = state.phase !== 'mark-dead';

    if (state.phase === 'finished') {
      result.replaceChildren(
        buildScoreReport(scoreArea(state.board, state.deadPoints)),
      );
    } else {
      result.replaceChildren();
    }
  };

  const focusPhaseAnnouncement = (): void => {
    turnLine.focus();
  };

  return { element, render, focusPhaseAnnouncement };
}

function buildScoreReport(score: AreaScore): DocumentFragment {
  const fragment = document.createDocumentFragment();

  const list = document.createElement('dl');
  list.className = 'score';

  const rows: ReadonlyArray<readonly [string, string]> = [
    ['Чёрные: камни и территория', formatScore(score.black)],
    ['Белые: камни и территория', formatScore(score.white)],
    ['Коми белых', formatScore(score.whiteKomi)],
    ['Белые с учётом коми', formatScore(score.white + score.whiteKomi)],
  ];

  for (const [term, value] of rows) {
    const dt = document.createElement('dt');
    dt.textContent = term;

    const dd = document.createElement('dd');
    dd.textContent = value;

    list.append(dt, dd);
  }

  const winner = document.createElement('p');
  winner.className = 'score__winner';
  winner.textContent = `Победили ${PLAYER_NAMES[score.winner]}.`;

  fragment.append(list, winner);

  return fragment;
}
