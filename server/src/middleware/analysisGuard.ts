// Track in-progress analysis generations to prevent concurrent analysis for same portfolio
const activeAnalyses = new Map<number, Promise<void>>();

export function isActiveAnalysis(portfolioId: number): boolean {
  return activeAnalyses.has(portfolioId);
}

export function trackAnalysis(portfolioId: number, promise: Promise<void>): void {
  activeAnalyses.set(portfolioId, promise);
}

export function cleanupAnalysis(portfolioId: number): void {
  activeAnalyses.delete(portfolioId);
}

// Atomic check-and-track to prevent race conditions. Returns false if already tracked.
export function checkAndTrack(portfolioId: number): boolean {
  if (activeAnalyses.has(portfolioId)) {
    return false;
  }
  activeAnalyses.set(portfolioId, Promise.resolve());
  return true;
}
