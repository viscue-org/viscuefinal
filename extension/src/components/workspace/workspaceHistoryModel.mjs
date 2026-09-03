export function createHistoryExport(snapshot) {
  const timestamp = Number.isFinite(snapshot?.timestamp) ? snapshot.timestamp : Date.now();
  const safeTimestamp = new Date(timestamp).toISOString().replace(/[:.]/g, '-');
  return {
    filename: `viscue-workspace-${safeTimestamp}.json`,
    mimeType: 'application/json',
    contents: JSON.stringify(snapshot, null, 2),
  };
}
