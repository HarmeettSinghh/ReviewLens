export default function UploadSummary({ summary }) {
  if (!summary) return null;

  const seconds = (summary.durationMs / 1000).toFixed(1);

  return (
    <div className="upload-summary-bar">
      <span className="summary-pill pill-total">
        <strong>{summary.totalRows}</strong> rows
      </span>
      <span className="summary-divider">·</span>
      <span className="summary-item">
        <strong>{summary.analysedCount}</strong> analysed
      </span>
      <span className="summary-divider">·</span>
      <span className="summary-item">
        <strong>{summary.duplicateCount}</strong> duplicates skipped
      </span>
      <span className="summary-divider">·</span>
      <span className="summary-item">
        <strong>{summary.skippedCount}</strong> empty skipped
      </span>
      <span className="summary-divider">·</span>
      <span className="summary-item">
        <strong>{summary.failedCount}</strong> failed
      </span>
      <span className="summary-divider">·</span>
      <span className="summary-pill pill-ai">
        <strong>{summary.aiCalls}</strong> AI calls made
      </span>
      <span className="summary-divider">·</span>
      <span className="summary-pill pill-cache">
        <strong>{summary.cacheHits}</strong> served from cache
      </span>
      <span className="summary-divider">·</span>
      <span className="summary-item time-item">
        ⚡ <strong>{seconds}s</strong> total processing time
      </span>
    </div>
  );
}
