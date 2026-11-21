import { useState, useEffect, useCallback } from 'react';
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

  // Load initial data on mount (so refresh shows existing analyses)
  const loadData = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const [statsData, reviewsData] = await Promise.all([
        fetchStats(),
        fetchReviews(),
      ]);

      setStats(statsData);
      setReviews(reviewsData || []);

      // If stats returned a previous upload run, populate uploadSummary
      if (statsData.lastRun && !uploadSummary) {
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
      setError(err.message || 'Failed to connect to ReviewLens backend.');
    } finally {
      setLoading(false);
    }
  }, [uploadSummary]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Callback triggered after successful CSV upload in UploadBox
  const handleUploadSuccess = async (summary) => {
    setUploadSummary(summary);
    // Re-fetch both stats and reviews to display new results
    await loadData();
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
              <span className="header-meta-label">Last Ingested File</span>
              <span className="header-meta-file">{stats.lastRun.fileName}</span>
            </div>
          )}
        </div>
      </header>

      {/* Main Container */}
      <main className="main-content">
        {/* Upload Box Section */}
        <section className="section-upload">
          <UploadBox onUploadSuccess={handleUploadSuccess} />
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
            <div className="empty-icon">📊</div>
            <h3>Upload a CSV to get started</h3>
            <p>Select your reviews CSV dataset above to extract sentiment analysis, key topics, and triage actionable customer feedback.</p>
          </div>
        )}

        {/* Dashboard Content */}
        {hasData && (
          <>
            {/* Top Stat Cards */}
            <section className="section-stats">
              <SummaryCards stats={stats} />
            </section>

            {/* Visual Insights: Sentiment Chart & Top Lists */}
            <section className="section-insights-grid">
              <SentimentChart sentiment={stats?.sentiment} />
              <TopLists
                topComplaints={stats?.topComplaints}
                topPraises={stats?.topPraises}
              />
            </section>

            {/* Filterable Reviews Table */}
            <section className="section-table">
              <ReviewTable
                reviews={reviews}
                products={stats?.products || []}
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
