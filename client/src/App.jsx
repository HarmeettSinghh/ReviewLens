import { useState, useEffect, useRef } from 'react';
import { fetchStats, fetchReviews } from './api';
import UploadBox from './components/UploadBox';
import UploadSummary from './components/UploadSummary';
import SummaryCards from './components/SummaryCards';
import SentimentChart from './components/SentimentChart';
import TopLists from './components/TopLists';
import ReviewTable from './components/ReviewTable';
import ReplyModal from './components/ReplyModal';

export default function App() {
  const [stats, setStats] = useState(null);
  const [reviews, setReviews] = useState([]);
  const [uploadSummary, setUploadSummary] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active review selected for customer support reply modal
  const [activeReplyReview, setActiveReplyReview] = useState(null);

  // Unified filter state synchronized across KPI cards, chart, top lists, and table
  const [filters, setFilters] = useState({
    product: 'ALL',
    sentiment: 'ALL',
    topic: 'ALL',
    onlyMismatches: false,
    needsReplyOnly: false,
    search: '',
  });

  const tableRef = useRef(null);

  // Load initial data on mount (so refresh shows existing analyses)
  useEffect(() => {
    let isMounted = true;

    async function loadInitialData() {
      try {
        const [statsData, reviewsData] = await Promise.all([
          fetchStats(),
          fetchReviews(),
        ]);

        if (!isMounted) return;

        setStats(statsData);
        setReviews(reviewsData || []);

        if (statsData.lastRun) {
          setUploadSummary({
            totalRows: statsData.lastRun.totalRows,
            analysedCount: statsData.lastRun.analysedCount,
            duplicateCount: statsData.lastRun.duplicateCount,
            skippedCount: statsData.lastRun.skippedCount,
            failedCount: statsData.lastRun.failedCount,
            aiCalls: statsData.lastRun.aiCalls,
            cacheHits: statsData.lastRun.cacheHits,
            durationMs: statsData.lastRun.durationMs,
          });
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to connect to ReviewLens backend.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitialData();

    return () => {
      isMounted = false;
    };
  }, []);

  // Reload data after a fresh CSV upload
  const reloadData = async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, reviewsData] = await Promise.all([
        fetchStats(),
        fetchReviews(),
      ]);
      setStats(statsData);
      setReviews(reviewsData || []);
    } catch (err) {
      setError(err.message || 'Failed to refresh dashboard data.');
    } finally {
      setLoading(false);
    }
  };

  // Callback triggered after successful CSV upload in UploadBox
  const handleUploadSuccess = async (summary) => {
    setUploadSummary(summary);
    await reloadData();
  };

  // Handler for KPI card clicks
  const handleSelectKpiFilter = (filterObj) => {
    if (!filterObj) {
      // Reset all filters
      setFilters({
        product: 'ALL',
        sentiment: 'ALL',
        topic: 'ALL',
        onlyMismatches: false,
        needsReplyOnly: false,
        search: '',
      });
      return;
    }

    if (filterObj.type === 'sentiment') {
      setFilters((prev) => ({
        ...prev,
        sentiment: prev.sentiment === filterObj.value ? 'ALL' : filterObj.value,
        needsReplyOnly: false,
        onlyMismatches: false,
      }));
    } else if (filterObj.type === 'needsReply') {
      setFilters((prev) => ({
        ...prev,
        needsReplyOnly: !prev.needsReplyOnly,
        sentiment: 'ALL',
        onlyMismatches: false,
      }));
    } else if (filterObj.type === 'onlyMismatches') {
      setFilters((prev) => ({
        ...prev,
        onlyMismatches: !prev.onlyMismatches,
        sentiment: 'ALL',
        needsReplyOnly: false,
      }));
    }

    // Scroll smoothly to table view
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handler for topic list clicks
  const handleSelectTopic = (topicName) => {
    setFilters((prev) => ({
      ...prev,
      topic: topicName,
    }));
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Handler for doughnut chart segment clicks
  const handleSelectSentiment = (sentimentName) => {
    setFilters((prev) => ({
      ...prev,
      sentiment: sentimentName,
    }));
    if (tableRef.current) {
      tableRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // Callback when a reply is generated or saved in ReplyModal
  const handleReplySaved = (reviewId, newReply) => {
    setReviews((prev) =>
      prev.map((r) =>
        r.id === reviewId || r.reviewId === reviewId
          ? { ...r, suggestedReply: newReply }
          : r
      )
    );
    if (activeReplyReview && (activeReplyReview.id === reviewId || activeReplyReview.reviewId === reviewId)) {
      setActiveReplyReview((prev) => ({ ...prev, suggestedReply: newReply }));
    }
  };

  const hasData = reviews && reviews.length > 0;

  // Active filter state to pass to SummaryCards
  const activeCardFilter = filters.onlyMismatches
    ? { type: 'onlyMismatches', value: true }
    : filters.needsReplyOnly
    ? { type: 'needsReply', value: true }
    : filters.sentiment !== 'ALL'
    ? { type: 'sentiment', value: filters.sentiment }
    : null;

  return (
    <div className="app-shell">
      {/* Brand Header */}
      <header className="app-header">
        <div className="header-container">
          <div className="brand-group">
            <span className="brand-badge">Gemini Powered</span>
            <h1 className="brand-title">ReviewLens</h1>
            <p className="brand-subtitle">
              Intelligent customer review intelligence, sentiment tracking, and triage.
            </p>
          </div>
          {stats?.lastRun && (
            <div className="header-meta">
              <span className="header-meta-label">Active Dataset</span>
              <span className="header-meta-file">{stats.lastRun.fileName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Upload Box Section */}
        <section className="section-upload">
          <UploadBox onUploadSuccess={handleUploadSuccess} isCompact={hasData} />
        </section>

        {/* Upload Summary Line */}
        {uploadSummary && (
          <section className="section-upload-summary">
            <UploadSummary summary={uploadSummary} />
          </section>
        )}

        {/* Global Loading / Error Indicators */}
        {loading && !hasData && (
          <div className="state-panel panel-loading">
            <div className="spinner" />
            <p>Loading dashboard metrics...</p>
          </div>
        )}

        {error && (
          <div className="state-panel panel-error">
            <strong>System Error:</strong> {error}
          </div>
        )}

        {/* Empty State when no data has been uploaded yet */}
        {!loading && !hasData && !error && (
          <div className="state-panel panel-empty">
            <h3>Upload a CSV to get started</h3>
            <p>Select your reviews CSV dataset above to extract sentiment analysis, key topics, and triage actionable customer feedback.</p>
          </div>
        )}

        {/* Dashboard Content */}
        {hasData && (
          <>
            {/* Top Interactive Stat Cards */}
            <section className="section-stats">
              <SummaryCards
                stats={stats}
                activeFilter={activeCardFilter}
                onSelectFilter={handleSelectKpiFilter}
              />
            </section>

            {/* Visual Insights: Interactive Sentiment Chart & Top Lists */}
            <section className="section-insights-grid">
              <SentimentChart
                sentiment={stats?.sentiment}
                activeSentiment={filters.sentiment}
                onSelectSentiment={handleSelectSentiment}
              />
              <TopLists
                topComplaints={stats?.topComplaints}
                topPraises={stats?.topPraises}
                activeTopic={filters.topic}
                onSelectTopic={handleSelectTopic}
              />
            </section>

            {/* Filterable Reviews Table with Search & Accordion Details */}
            <section className="section-table" ref={tableRef}>
              <ReviewTable
                reviews={reviews}
                products={stats?.products || []}
                filters={filters}
                onFilterChange={setFilters}
                onSuggestReply={(review) => setActiveReplyReview(review)}
              />
            </section>
          </>
        )}
      </main>

      {/* Suggested Reply Modal */}
      {activeReplyReview && (
        <ReplyModal
          review={activeReplyReview}
          onClose={() => setActiveReplyReview(null)}
          onReplySaved={handleReplySaved}
        />
      )}

      {/* Clean Footer */}
      <footer className="app-footer">
        <p>ReviewLens • Assessment Pipeline with Semantic Gemini Batching & Caching</p>
      </footer>
    </div>
  );
}
