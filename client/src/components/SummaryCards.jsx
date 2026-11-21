export default function SummaryCards({ stats }) {
  if (!stats || !stats.counts) return null;

  const { counts, sentiment, needsReplyCount } = stats;

  return (
    <div className="summary-cards-grid">
      <div className="stat-card">
        <span className="stat-label">Total Analysed</span>
        <div className="stat-value">{counts.analysed}</div>
        <span className="stat-subtext">of {counts.totalRows} uploaded rows</span>
      </div>

      <div className="stat-card card-positive">
        <span className="stat-label">Positive Sentiment</span>
        <div className="stat-value text-positive">{sentiment.positive.percent}%</div>
        <span className="stat-subtext">{sentiment.positive.count} reviews</span>
      </div>

      <div className="stat-card card-neutral">
        <span className="stat-label">Neutral Sentiment</span>
        <div className="stat-value text-neutral">{sentiment.neutral.percent}%</div>
        <span className="stat-subtext">{sentiment.neutral.count} reviews</span>
      </div>

      <div className="stat-card card-negative">
        <span className="stat-label">Negative Sentiment</span>
        <div className="stat-value text-negative">{sentiment.negative.percent}%</div>
        <span className="stat-subtext">{sentiment.negative.count} reviews</span>
      </div>

      <div className="stat-card card-reply">
        <span className="stat-label">Needs Attention</span>
        <div className="stat-value text-warning">{needsReplyCount}</div>
        <span className="stat-subtext">actionable customer issues</span>
      </div>
    </div>
  );
}
