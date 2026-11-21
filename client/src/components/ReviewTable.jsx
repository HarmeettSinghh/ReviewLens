import { useState, useMemo, Fragment } from 'react';
import { formatTopic } from '../formatters';

export default function ReviewTable({
  reviews = [],
  products = [],
  filters = {},
  onFilterChange,
  onSuggestReply,
}) {
  const [expandedRowId, setExpandedRowId] = useState(null);
  const [prevFilters, setPrevFilters] = useState(filters);
  const [showOriginalTextMap, setShowOriginalTextMap] = useState({});

  // Reset expanded row whenever filter props change
  if (filters !== prevFilters) {
    setPrevFilters(filters);
    setExpandedRowId(null);
  }

  // Destructure active filter controls with fallbacks
  const {
    product = 'ALL',
    sentiment = 'ALL',
    topic = 'ALL',
    onlyMismatches = false,
    needsReplyOnly = false,
    search = '',
  } = filters;

  // Extract all distinct topics that appear in any review
  const availableTopics = useMemo(() => {
    const topicSet = new Set();
    reviews.forEach((r) => {
      if (Array.isArray(r.topics)) {
        r.topics.forEach((t) => topicSet.add(t));
      }
    });
    return Array.from(topicSet).sort();
  }, [reviews]);

  // Distinct products list (combine passed list or derive from reviews)
  const productOptions = useMemo(() => {
    if (products && products.length > 0) return products;
    const set = new Set();
    reviews.forEach((r) => {
      if (r.product) set.add(r.product);
    });
    return Array.from(set).sort();
  }, [products, reviews]);

  // Filtered reviews using useMemo for high client-side performance
  const filteredReviews = useMemo(() => {
    const searchLower = search.trim().toLowerCase();

    return reviews.filter((r) => {
      // 1. Text search across text, product, summary, or ID
      if (searchLower) {
        const idMatch = (r.reviewId || String(r.id)).toLowerCase().includes(searchLower);
        const prodMatch = (r.product || '').toLowerCase().includes(searchLower);
        const textMatch = (r.cleanText || r.originalText || '').toLowerCase().includes(searchLower);
        const summaryMatch = (r.summary || '').toLowerCase().includes(searchLower);
        if (!idMatch && !prodMatch && !textMatch && !summaryMatch) {
          return false;
        }
      }

      // 2. Needs reply only filter (triggered from KPI card)
      if (needsReplyOnly && !r.needsReply) {
        return false;
      }

      // 3. Rating mismatch filter
      if (onlyMismatches && !r.ratingMismatch) {
        return false;
      }

      // 4. Product filter
      if (product !== 'ALL' && r.product !== product) {
        return false;
      }

      // 5. Sentiment filter
      if (sentiment !== 'ALL') {
        if (!r.sentiment || r.sentiment.toLowerCase() !== sentiment.toLowerCase()) {
          return false;
        }
      }

      // 6. Topic filter
      if (topic !== 'ALL') {
        if (!Array.isArray(r.topics) || !r.topics.includes(topic)) {
          return false;
        }
      }

      return true;
    });
  }, [reviews, search, needsReplyOnly, onlyMismatches, product, sentiment, topic]);

  // Ensure expanded row is only active if it exists in current filteredReviews
  const isRowVisible = filteredReviews.some((r) => r.id === expandedRowId);
  const activeExpandedRowId = isRowVisible ? expandedRowId : null;

  // Toggle row expansion (only one row expanded at a time)
  const toggleRowExpansion = (id) => {
    setExpandedRowId((prev) => (prev === id ? null : id));
  };

  // Toggle viewing original uncleaned text vs clean text for a row
  const toggleOriginalText = (e, rowId) => {
    e.stopPropagation();
    setShowOriginalTextMap((prev) => ({
      ...prev,
      [rowId]: !prev[rowId],
    }));
  };

  // Check if any filter is active
  const hasActiveFilters =
    product !== 'ALL' ||
    sentiment !== 'ALL' ||
    topic !== 'ALL' ||
    onlyMismatches ||
    needsReplyOnly ||
    Boolean(search.trim());

  // Clear all filters
  const handleClearAllFilters = () => {
    if (onFilterChange) {
      onFilterChange({
        product: 'ALL',
        sentiment: 'ALL',
        topic: 'ALL',
        onlyMismatches: false,
        needsReplyOnly: false,
        search: '',
      });
    }
  };

  // Helper to render human-readable status badge
  const renderStatus = (row) => {
    switch (row.status) {
      case 'analysed':
        return <span className="status-badge status-analysed">Analysed</span>;
      case 'skipped_empty':
        return <span className="status-badge status-skipped">Skipped (empty)</span>;
      case 'duplicate':
        return (
          <span className="status-badge status-duplicate">
            Duplicate {row.duplicateOf ? `of ${row.duplicateOf}` : ''}
          </span>
        );
      case 'analysis_failed':
        return <span className="status-badge status-failed">Analysis failed</span>;
      default:
        return <span className="status-badge">{row.status}</span>;
    }
  };

  // Helper to render sentiment badge
  const renderSentiment = (sentimentVal) => {
    if (!sentimentVal) return <span className="text-muted">—</span>;
    const lower = sentimentVal.toLowerCase();
    const badgeClass =
      lower === 'positive'
        ? 'badge-sentiment-positive'
        : lower === 'negative'
        ? 'badge-sentiment-negative'
        : 'badge-sentiment-neutral';

    return <span className={`sentiment-badge ${badgeClass}`}>{sentimentVal}</span>;
  };

  return (
    <div className="review-table-section">
      {/* Search & Filters Controls Header */}
      <div className="table-controls-header">
        <div className="table-header-title-group">
          <h2 className="section-title">Reviews Dataset</h2>
          <span className="match-counter">
            Showing <strong>{filteredReviews.length}</strong> of {reviews.length} reviews
          </span>
        </div>

        {/* Live Search Input */}
        <div className="table-search-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            value={search}
            onChange={(e) => onFilterChange && onFilterChange({ ...filters, search: e.target.value })}
            placeholder="Search reviews, products, summaries..."
            className="table-search-input"
          />
          {search && (
            <button
              type="button"
              className="btn-search-clear"
              onClick={() => onFilterChange && onFilterChange({ ...filters, search: '' })}
              aria-label="Clear search"
            >
              &times;
            </button>
          )}
        </div>

        {/* Toolbar Dropdowns */}
        <div className="filters-toolbar">
          {/* Rating Mismatch Filter Checkbox */}
          <div className="filter-group filter-checkbox-group">
            <label htmlFor="filter-mismatch" className="filter-checkbox-label">
              <input
                type="checkbox"
                id="filter-mismatch"
                checked={onlyMismatches}
                onChange={(e) =>
                  onFilterChange && onFilterChange({ ...filters, onlyMismatches: e.target.checked })
                }
                className="filter-checkbox"
              />
              <span>Mismatches only</span>
            </label>
          </div>

          {/* Product Filter */}
          <div className="filter-group">
            <label htmlFor="filter-product" className="filter-label">Product:</label>
            <select
              id="filter-product"
              value={product}
              onChange={(e) => onFilterChange && onFilterChange({ ...filters, product: e.target.value })}
              className="filter-select"
            >
              <option value="ALL">All Products</option>
              {productOptions.map((prod) => (
                <option key={prod} value={prod}>
                  {prod}
                </option>
              ))}
            </select>
          </div>

          {/* Sentiment Filter */}
          <div className="filter-group">
            <label htmlFor="filter-sentiment" className="filter-label">Sentiment:</label>
            <select
              id="filter-sentiment"
              value={sentiment}
              onChange={(e) => onFilterChange && onFilterChange({ ...filters, sentiment: e.target.value })}
              className="filter-select"
            >
              <option value="ALL">All Sentiments</option>
              <option value="positive">Positive</option>
              <option value="neutral">Neutral</option>
              <option value="negative">Negative</option>
            </select>
          </div>

          {/* Topic Filter */}
          <div className="filter-group">
            <label htmlFor="filter-topic" className="filter-label">Topic:</label>
            <select
              id="filter-topic"
              value={topic}
              onChange={(e) => onFilterChange && onFilterChange({ ...filters, topic: e.target.value })}
              className="filter-select"
            >
              <option value="ALL">All Topics</option>
              {availableTopics.map((top) => (
                <option key={top} value={top}>
                  {formatTopic(top)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {/* Active Filter Badges Bar */}
      {hasActiveFilters && (
        <div className="active-filters-bar">
          <span className="active-filters-label">Active filters:</span>
          {search && (
            <span className="filter-chip">
              Search: "{search}"
              <button
                type="button"
                onClick={() => onFilterChange && onFilterChange({ ...filters, search: '' })}
              >
                &times;
              </button>
            </span>
          )}
          {needsReplyOnly && (
            <span className="filter-chip">
              Needs Attention Only
              <button
                type="button"
                onClick={() => onFilterChange && onFilterChange({ ...filters, needsReplyOnly: false })}
              >
                &times;
              </button>
            </span>
          )}
          {onlyMismatches && (
            <span className="filter-chip">
              Rating Mismatches Only
              <button
                type="button"
                onClick={() => onFilterChange && onFilterChange({ ...filters, onlyMismatches: false })}
              >
                &times;
              </button>
            </span>
          )}
          {product !== 'ALL' && (
            <span className="filter-chip">
              Product: {product}
              <button
                type="button"
                onClick={() => onFilterChange && onFilterChange({ ...filters, product: 'ALL' })}
              >
                &times;
              </button>
            </span>
          )}
          {sentiment !== 'ALL' && (
            <span className="filter-chip">
              Sentiment: {sentiment}
              <button
                type="button"
                onClick={() => onFilterChange && onFilterChange({ ...filters, sentiment: 'ALL' })}
              >
                &times;
              </button>
            </span>
          )}
          {topic !== 'ALL' && (
            <span className="filter-chip">
              Topic: {formatTopic(topic)}
              <button
                type="button"
                onClick={() => onFilterChange && onFilterChange({ ...filters, topic: 'ALL' })}
              >
                &times;
              </button>
            </span>
          )}
          <button
            type="button"
            className="btn-clear-all-filters"
            onClick={handleClearAllFilters}
          >
            Clear all
          </button>
        </div>
      )}

      {/* Table Data Container */}
      <div className="table-scroll-container">
        <table className="review-table">
          <thead>
            <tr>
              <th className="th-expand"></th>
              <th className="th-id">ID</th>
              <th className="th-product">Product</th>
              <th className="th-rating">Rating</th>
              <th className="th-sentiment">Sentiment</th>
              <th className="th-topics">Topics</th>
              <th className="th-summary">Summary</th>
              <th className="th-reply">Needs Reply</th>
              <th className="th-status">Status</th>
            </tr>
          </thead>
          <tbody>
            {filteredReviews.length === 0 ? (
              <tr>
                <td colSpan="9" className="table-empty-row">
                  <div className="empty-results-box">
                    <p>No reviews match the selected filter criteria.</p>
                    {hasActiveFilters && (
                      <button
                        type="button"
                        className="btn btn-secondary btn-reset-filters"
                        onClick={handleClearAllFilters}
                      >
                        Reset All Filters
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ) : (
              filteredReviews.map((row) => {
                const isExpanded = activeExpandedRowId === row.id;
                const showOriginal = Boolean(showOriginalTextMap[row.id]);
                const mismatchTooltip =
                  row.ratingMismatch && row.rating != null
                    ? row.rating >= 4
                      ? `${row.rating} stars but text is negative`
                      : `${row.rating} star${row.rating > 1 ? 's' : ''} but text is positive`
                    : '';

                return (
                  <Fragment key={row.id}>
                    <tr
                      className={`table-row row-${row.status} ${isExpanded ? 'is-row-expanded' : ''}`}
                      onClick={() => toggleRowExpansion(row.id)}
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          toggleRowExpansion(row.id);
                        }
                      }}
                      role="button"
                      aria-expanded={isExpanded}
                    >
                      <td className="td-expand" title="Click to view details directly below">
                        <span className={`expand-chevron ${isExpanded ? 'is-open' : ''}`}>▶</span>
                      </td>
                      <td className="td-id">
                        <code>{row.reviewId || row.id}</code>
                      </td>
                      <td className="td-product" title={row.product}>
                        {row.product || '—'}
                      </td>
                      <td className="td-rating">
                        {row.rating != null ? (
                          <div className="rating-cell">
                            <span className="rating-pill">★ {row.rating}</span>
                            {row.ratingMismatch && (
                              <span className="mismatch-badge" title={mismatchTooltip}>
                                Mismatch
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="td-sentiment">{renderSentiment(row.sentiment)}</td>
                      <td className="td-topics">
                        {Array.isArray(row.topics) && row.topics.length > 0 ? (
                          <div className="topic-chips">
                            {row.topics.map((t) => (
                              <span
                                key={t}
                                className={`topic-chip ${topic === t ? 'is-active-chip' : ''}`}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onFilterChange &&
                                    onFilterChange({ ...filters, topic: topic === t ? 'ALL' : t });
                                }}
                                title={`Click to filter by ${formatTopic(t)}`}
                              >
                                {formatTopic(t)}
                              </span>
                            ))}
                          </div>
                        ) : (
                          <span className="text-muted">—</span>
                        )}
                      </td>
                      <td className="td-summary" title={row.cleanText}>
                        {row.summary || (row.cleanText ? (
                          <span className="raw-text-fallback">{row.cleanText}</span>
                        ) : (
                          <span className="text-muted">—</span>
                        ))}
                      </td>
                      <td className="td-reply" onClick={(e) => e.stopPropagation()}>
                        {row.needsReply ? (
                          <div className="reply-cell">
                            <span className="badge-reply-yes">Yes</span>
                            <button
                              type="button"
                              onClick={() => onSuggestReply && onSuggestReply(row)}
                              className={`btn-suggest-reply ${row.suggestedReply ? 'btn-has-reply' : ''}`}
                              title={row.suggestedReply ? 'View saved reply' : 'Generate suggested reply with Gemini'}
                            >
                              {row.suggestedReply ? 'View reply' : 'Suggest reply'}
                            </button>
                          </div>
                        ) : (
                          <span className="text-muted">No</span>
                        )}
                      </td>
                      <td className="td-status">{renderStatus(row)}</td>
                    </tr>

                    {/* Detail Panel Rendered Directly Under Its Own Row */}
                    {isExpanded && (
                      <tr className="detail-drawer-row">
                        <td colSpan="9" className="td-detail-drawer">
                          <div className="drawer-inner-card">
                            <div className="drawer-header">
                              <div className="drawer-title-group">
                                <span className="drawer-id-pill">{row.reviewId || `ID ${row.id}`}</span>
                                <h4 className="drawer-product-title">{row.product || 'Unknown Product'}</h4>
                                {row.rating != null && (
                                  <span className="drawer-rating">★ {row.rating} Stars</span>
                                )}
                                {row.date && <span className="drawer-date">📅 {row.date}</span>}
                              </div>
                              <button
                                type="button"
                                className="btn-drawer-close"
                                onClick={() => setExpandedRowId(null)}
                                aria-label="Close details"
                              >
                                &times;
                              </button>
                            </div>

                            <div className="drawer-body">
                              <div className="drawer-text-section">
                                <div className="drawer-text-header">
                                  <span className="drawer-label">
                                    {showOriginal ? 'Original Uncleaned Text:' : 'Sanitized Customer Text:'}
                                  </span>
                                  {row.originalText && row.originalText !== row.cleanText && (
                                    <button
                                      type="button"
                                      className="btn-text-toggle"
                                      onClick={(e) => toggleOriginalText(e, row.id)}
                                    >
                                      {showOriginal ? 'Show Cleaned Text' : 'Show Raw Original Text'}
                                    </button>
                                  )}
                                </div>
                                <blockquote className="drawer-quote">
                                  "{showOriginal ? (row.originalText || row.cleanText) : (row.cleanText || row.originalText || '—')}"
                                </blockquote>
                              </div>

                              {row.summary && (
                                <div className="drawer-summary-section">
                                  <span className="drawer-label">Gemini AI English Summary:</span>
                                  <p className="drawer-summary-content">{row.summary}</p>
                                </div>
                              )}

                              <div className="drawer-meta-grid">
                                <div className="meta-item">
                                  <span className="meta-key">Text Hash:</span>
                                  <code className="meta-val">{row.textHash ? `${row.textHash.slice(0, 16)}...` : '—'}</code>
                                </div>
                                <div className="meta-item">
                                  <span className="meta-key">Status:</span>
                                  <span className="meta-val">{renderStatus(row)}</span>
                                </div>
                                {row.duplicateOf && (
                                  <div className="meta-item">
                                    <span className="meta-key">Duplicate Of:</span>
                                    <code className="meta-val">{row.duplicateOf}</code>
                                  </div>
                                )}
                                {row.needsReply && (
                                  <div className="meta-item">
                                    <span className="meta-key">Support Action:</span>
                                    <button
                                      type="button"
                                      className="btn btn-secondary btn-drawer-reply"
                                      onClick={() => onSuggestReply && onSuggestReply(row)}
                                    >
                                      {row.suggestedReply ? 'View Saved Reply' : 'Generate Gemini Reply'}
                                    </button>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
