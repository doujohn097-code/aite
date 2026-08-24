export const PULL_THRESHOLD = 72;
export const PULL_MAX = 132;
export const PULL_SURFACE_PX = 4;

export function resistPull(distance: number, max = PULL_MAX): number {
  if (distance <= 0) return 0;
  const eased = Math.pow(distance, 0.82) * 0.62;
  return Math.min(max, eased);
}

export function isMostlyVertical(
  dx: number,
  dy: number,
  slop = 10
): boolean {
  if (dy < slop) return false;
  return Math.abs(dy) > Math.abs(dx) * 1.15;
}

export function elementScrollTop(el: HTMLElement | Window): number {
  if (el === window)
    return window.scrollY || document.documentElement.scrollTop || 0;
  return (el as HTMLElement).scrollTop;
}

export function isScrollableOverflow(el: HTMLElement): boolean {
  const style = window.getComputedStyle(el);
  const overflowY = style.overflowY;
  return (
    (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
    el.scrollHeight > el.clientHeight + 2
  );
}

export function findScrollParent(
  target: EventTarget | null,
  stopAt?: HTMLElement | null
): HTMLElement | Window {
  let node =
    target instanceof Element ? (target as HTMLElement) : null;

  while (node && node !== document.body && node !== document.documentElement) {
    if (stopAt && node === stopAt) return node;
    if (isScrollableOverflow(node)) return node;
    node = node.parentElement;
  }

  return stopAt ?? window;
}

/** Only the top edge of the intended scroller — never mid-list. */
export function isAtScrollSurface(
  target: EventTarget | null,
  root?: HTMLElement | null,
  slack = PULL_SURFACE_PX
): boolean {
  const scroller = findScrollParent(target, root ?? undefined);
  if (elementScrollTop(scroller) > slack) return false;
  if (root && scroller !== root && scroller !== window)
    return elementScrollTop(root) <= slack;
  if (root) return elementScrollTop(root) <= slack;
  return elementScrollTop(window) <= slack;
}

export function shouldArmPull(input: {
  disabled?: boolean;
  refreshing?: boolean;
  atSurface: boolean;
}): boolean {
  return !input.disabled && !input.refreshing && input.atSurface;
}
