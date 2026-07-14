/** `usePaginatedQuery` accumulates newest-first pages (research.md §5). Reverse purely for
 * display so the chat pane renders oldest-at-top, newest-at-bottom. */
export function reverseForDisplay<T>(messages: readonly T[]): T[] {
  return [...messages].reverse();
}
