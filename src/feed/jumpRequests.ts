// The picker and the Random feed ask the Read tab to jump through this channel.
// The request is held until a Read screen takes it, so it isn't lost if that screen
// mounts after the request rather than already being open.
import type { ChapterRef } from '@/esv/books';

export interface JumpTarget {
  ref: ChapterRef;
  /** Verse to open on. */
  verse: number;
}

type Listener = () => void;
const listeners = new Set<Listener>();
let pending: JumpTarget | null = null;

export function requestJump(target: JumpTarget): void {
  pending = target;
  listeners.forEach((l) => l());
}

/** Returns the waiting jump, if any, and clears it. */
export function takePendingJump(): JumpTarget | null {
  const target = pending;
  pending = null;
  return target;
}

export function onJumpRequest(listener: Listener): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
