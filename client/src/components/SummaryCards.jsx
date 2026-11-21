export default function SummaryCards({ stats, activeFilter, onSelectFilter }) {
  if (!stats || !stats.counts) return null;

  const { counts, sentiment, needsReplyCount, agreementPercent, mismatchCount } = stats;

  const handleCardClick = (filterType, filterValue) => {
    if (!onSelectFilter) return;
    if (activeFilter?.type === filterType && activeFilter?.value === filterValue) {
      onSelectFilter(null); // Deselect if already active
    } else {
      onSelectFilter({ type: filterType, value: filterValue });
    }
  };

  const handleKeyDown = (e, filterType, filterValue) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleCardClick(filterType, filterValue);
    }
  };

  return (
    <div className="summary-cards-grid">
      {/* 1. Total Analysed */}
      <div
        className={`stat-card stat-card-interactive ${!activeFilter ? 'is-active' : ''}`}
        onClick={() => onSelectFilter && onSelectFilter(null)}
        onKeyDown={(e) => e.key === 'Enter' && onSelectFilter && onSelectFilter(null)}
        role="button"
        tabIndex={0}
        title="Show all reviews"
      >
        <div className="stat-card-header">
          <span className="stat-label">Total Analysed</span>
          <span className="card-filter-hint">{!activeFilter ? 'Active' : 'Show All'}</span>
        </div>
        <div className="stat-value">{counts.analysed}</div>
        <span className="stat-subtext">of {counts.totalRows} uploaded rows</span>
      </div>

      {/* 2. Positive Sentiment */}
      <div
        className={`stat-card stat-card-interactive card-positive ${
          activeFilter?.type === 'sentiment' && activeFilter?.value === 'positive' ? 'is-active' : ''
        }`}
        onClick={() => handleCardClick('sentiment', 'positive')}
        onKeyDown={(e) => handleKeyDown(e, 'sentiment', 'positive')}
        role="button"
        tabIndex={0}
        title="Click to filter by positive sentiment"
      >
        <div className="stat-card-header">
          <span className="stat-label">Positive Sentiment</span>
          <span className="card-filter-hint">
            {activeFilter?.type === 'sentiment' && activeFilter?.value === 'positive' ? 'Filtered' : 'Filter'}
          </span>
        </div>
        <div className="stat-value text-positive">{sentiment.positive.percent}%</div>
        <span className="stat-subtext">{sentiment.positive.count} reviews</span>
      </div>

      {/* 3. Neutral Sentiment */}
      <div
        className={`stat-card stat-card-interactive card-neutral ${
          activeFilter?.type === 'sentiment' && activeFilter?.value === 'neutral' ? 'is-active' : ''
        }`}
        onClick={() => handleCardClick('sentiment', 'neutral')}
        onKeyDown={(e) => handleKeyDown(e, 'sentiment', 'neutral')}
        role="button"
        tabIndex={0}
        title="Click to filter by neutral sentiment"
      >
        <div className="stat-card-header">
          <span className="stat-label">Neutral Sentiment</span>
          <span className="card-filter-hint">
            {activeFilter?.type === 'sentiment' && activeFilter?.value === 'neutral' ? 'Filtered' : 'Filter'}
          </span>
        </div>
        <div className="stat-value text-neutral">{sentiment.neutral.percent}%</div>
        <span className="stat-subtext">{sentiment.neutral.count} reviews</span>
      </div>

      {/* 4. Negative Sentiment */}
      <div
        className={`stat-card stat-card-interactive card-negative ${
          activeFilter?.type === 'sentiment' && activeFilter?.value === 'negative' ? 'is-active' : ''
        }`}
        onClick={() => handleCardClick('sentiment', 'negative')}
        onKeyDown={(e) => handleKeyDown(e, 'sentiment', 'negative')}
        role="button"
        tabIndex={0}
        title="Click to filter by negative sentiment"
      >
        <div className="stat-card-header">
          <span className="stat-label">Negative Sentiment</span>
          <span className="card-filter-hint">
            {activeFilter?.type === 'sentiment' && activeFilter?.value === 'negative' ? 'Filtered' : 'Filter'}
          </span>
        </div>
        <div className="stat-value text-negative">{sentiment.negative.percent}%</div>
        <span className="stat-subtext">{sentiment.negative.count} reviews</span>
      </div>

      {/* 5. Needs Attention */}
      <div
        className={`stat-card stat-card-interactive card-reply ${
          activeFilter?.type === 'needsReply' ? 'is-active' : ''
        }`}
        onClick={() => handleCardClick('needsReply', true)}
        onKeyDown={(e) => handleKeyDown(e, 'needsReply', true)}
        role="button"
        tabIndex={0}
        title="Click to filter by actionable issues needing attention"
      >
        <div className="stat-card-header">
          <span className="stat-label">Needs Attention</span>
          <span className="card-filter-hint">
            {activeFilter?.type === 'needsReply' ? 'Filtered' : 'Filter'}
          </span>
        </div>
        <div className="stat-value text-warning">{needsReplyCount}</div>
        <span className="stat-subtext">actionable customer issues</span>
      </div>

      {/* 6. Rating vs Text Agreement */}
      <div
        className={`stat-card stat-card-interactive card-agreement ${
          activeFilter?.type === 'onlyMismatches' ? 'is-active' : ''
        }`}
        onClick={() => handleCardClick('onlyMismatches', true)}
        onKeyDown={(e) => handleKeyDown(e, 'onlyMismatches', true)}
        role="button"
        tabIndex={0}
        title="Click to filter by rating vs sentiment mismatches"
      >
        <div className="stat-card-header">
          <span className="stat-label">Rating Agreement</span>
          <span className="card-filter-hint">
            {activeFilter?.type === 'onlyMismatches' ? 'Filtered' : 'Filter'}
          </span>
        </div>
        <div className="stat-value text-agreement">
          {agreementPercent != null ? `${agreementPercent}%` : '—'}
        </div>
        <span className="stat-subtext">
          of ratings match text sentiment — {mismatchCount > 0 ? `${mismatchCount} strong mismatch${mismatchCount > 1 ? 'es' : ''}` : '0 mismatches'}
        </span>
      </div>
    </div>
  );
}
