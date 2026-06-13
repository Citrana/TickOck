// Strips the Convex request prefix from mutation errors so only the human-readable
// message is shown in toasts. Example raw format:
// "[CONVEX M(...)] [Request ID: ...] Server Error Uncaught Error: <msg> at handler..."
export function parseConvexError(err: unknown, fallback: string): string {
  if (!(err instanceof Error)) return fallback;
  const match = err.message.match(/Uncaught Error: ([\s\S]+?)(?:\s+at handler|\s+Called by|$)/);
  if (match?.[1]) return match[1].trim();
  return err.message.split('\n')[0] ?? fallback;
}
