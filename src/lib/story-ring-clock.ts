import { useSyncExternalStore } from 'react';
import { STORY_RING_FRAMES } from './wavy-circle';

const FRAME_MS = 1600 / STORY_RING_FRAMES;
const listeners = new Set<() => void>();

let frame = 0;
let raf = 0;
let lastStamp = 0;

function loop(now: number): void {
  if (now - lastStamp >= FRAME_MS) {
    lastStamp = now;
    frame = (frame + 1) % STORY_RING_FRAMES;
    listeners.forEach((listener) => listener());
  }
  raf = requestAnimationFrame(loop);
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  if (listeners.size === 1) {
    lastStamp = 0;
    raf = requestAnimationFrame(loop);
  }
  return () => {
    listeners.delete(listener);
    if (!listeners.size) cancelAnimationFrame(raf);
  };
}

function getFrame(): number {
  return frame;
}

function getServerFrame(): number {
  return 0;
}

function subscribeIdle(): () => void {
  return () => undefined;
}

/** Shared clock so every live story ring waves in sync without extra rAF loops. */
export function useStoryRingFrame(active: boolean): number {
  return useSyncExternalStore(
    active ? subscribe : subscribeIdle,
    active ? getFrame : getServerFrame,
    getServerFrame
  );
}
