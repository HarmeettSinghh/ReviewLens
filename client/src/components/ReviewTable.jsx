import { useState, useMemo } from 'react';
import { formatTopic } from './TopLists';

export default function ReviewTable({ reviews = [], products = [], onSuggestReply }) {
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedSentiment, setSelectedSentiment] = useState('ALL');
  const [selectedTopic, setSelectedTopic] = useState('ALL');

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
    return reviews.filter((r) => {
      // Product filter
      if (selectedProduct !== 'ALL' && r.product !== selectedProduct) {
        return false;
      }

      // Sentiment filter
      if (selectedSentiment !== 'ALL') {
        if (!r.sentiment || r.sentiment.toLowerCase() !== selectedSentiment.toLowerCase()) {
          return false;
        }
      }

      // Topic filter
      if (selectedTopic !== 'ALL') {
        if (!Array.isArray(r.topics) || !r.topics.includes(selectedTopic)) {
          return false;
        }
      }

      return true;
    });
  }, [reviews, selectedProduct, selectedSentiment, selectedTopic]);

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
  const renderSentiment = (sentiment) => {
    if (!sentiment) return <span className="text-muted">—</span>;
    const lower = sentiment.toLowerCase();
    const badgeClass =
      lower === 'positive'
        ? 'badge-sentiment-positive'
        : lower === 'negative'
        ? 'badge-sentiment-negative'
        : 'badge-sentiment-neutral';

    return <span className={`sentiment-badge ${badgeClass}`}>{sentiment}</span>;
  };

  return (
    <div className="review-table-section">
      <div className="table-controls-header">
        <div>
          <h2 className="section-title">Reviews Dataset</h2>
          <span className="match-counter">
            Showing <strong>{filteredReviews.length}</strong> of {reviews.length} reviews
          </span>
        </div>

        <div className="filters-toolbar">
          {/* Product Filter */}
          <div className="filter-group">
            <label htmlFor="filter-product" className="filter-label">Product:</label>
            <select
              id="filter-product"
              value={selectedProduct}
              onChange={(e) => setSelectedProduct(e.target.value)}
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
              value={selectedSentiment}
              onChange={(e) => setSelectedSentiment(e.target.value)}
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
              value={selectedTopic}
              onChange={(e) => setSelectedTopic(e.target.value)}
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

      <div className="table-scroll-container">
        <table className="review-table">
          <thead>
            <tr>
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
                <td colSpan="8" className="table-empty-row">
                  No reviews match the selected filters.
                </td>
              </tr>
            ) : (
              filteredReviews.map((row) => (
                <tr key={row.id} className={`table-row row-${row.status}`}>
                  <td className="td-id">
                    <code>{row.reviewId || row.id}</code>
                  </td>
                  <td className="td-product" title={row.product}>
                    {row.product || '—'}
                  </td>
                  <td className="td-rating">
                    {row.rating != null ? (
                      <span className="rating-pill">★ {row.rating}</span>
                    ) : (
                      <span className="text-muted">—</span>
                    )}
                  </td>
                  <td className="td-sentiment">{renderSentiment(row.sentiment)}</td>
                  <td className="td-topics">
                    {Array.isArray(row.topics) && row.topics.length > 0 ? (
                      <div className="topic-chips">
                        {row.topics.map((t) => (
                          <span key={t} className="topic-chip">
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
                  <td className="td-reply">
                    {row.needsReply ? (
                      <div className="reply-cell">
                        <span className="badge-reply-yes">Yes</span>
                        <button
                          type="button"
                          onClick={() => onSuggestReply && onSuggestReply(row)}
                          className={`btn-suggest-reply ${row.suggestedReply ? 'btn-has-reply' : ''}`}
                          title={row.suggestedReply ? 'View saved reply' : 'Generate suggested reply'}
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
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
