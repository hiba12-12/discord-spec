import type { Id } from "../../../convex/_generated/dataModel";

/** Deterministic, symmetric per-pair tie-break for full-mesh perfect negotiation
 * (research.md §4) — both sides compute the same answer without extra signaling. */
export function isPolite(myUserId: Id<"users">, remoteUserId: Id<"users">): boolean {
  return myUserId < remoteUserId;
}

/** Buffers ICE candidates that arrive before `setRemoteDescription()` has resolved, since
 * `addIceCandidate()` throws if called too early and our signaling relay (a Convex table
 * subscription) doesn't guarantee delivery order relative to the offer/answer (research.md §4). */
export class IceCandidateBuffer<T> {
  private pending: T[] = [];
  private remoteDescriptionSet = false;

  markRemoteDescriptionSet(): void {
    this.remoteDescriptionSet = true;
  }

  markRemoteDescriptionUnset(): void {
    this.remoteDescriptionSet = false;
  }

  /** Returns the candidate to apply immediately, or null if it was buffered instead. */
  addOrBuffer(candidate: T): T | null {
    if (this.remoteDescriptionSet) return candidate;
    this.pending.push(candidate);
    return null;
  }

  /** Call once the remote description is set; returns buffered candidates to apply, in order. */
  flush(): T[] {
    this.markRemoteDescriptionSet();
    const flushed = this.pending;
    this.pending = [];
    return flushed;
  }
}
