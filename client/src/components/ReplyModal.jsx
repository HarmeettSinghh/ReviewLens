import { useState, useEffect, useCallback } from 'react';
import { fetchReply } from '../api';

export default function ReplyModal({ review, onClose, onReplySaved }) {
  const [replyText, setReplyText] = useState(review?.suggestedReply || '');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const reviewId = review?.id || review?.reviewId;

  // Load or generate reply
  const loadReply = useCallback(
    async (regenerate = false) => {
      if (!reviewId) return;

      // If we already have a saved reply and user is NOT explicitly regenerating, don't hit the network
      if (review?.suggestedReply && !regenerate) {
        setReplyText(review.suggestedReply);
        return;
      }

      try {
        setLoading(true);
        setError(null);
        const data = await fetchReply(reviewId, regenerate);
        setReplyText(data.reply || '');
        if (onReplySaved) {
          onReplySaved(reviewId, data.reply);
        }
      } catch (err) {
        setError(err.message || 'Failed to generate customer support reply.');
      } finally {
        setLoading(false);
      }
    },
    [reviewId, review?.suggestedReply, onReplySaved]
  );

  useEffect(() => {
    // Only fetch if no reply is currently stored
    if (!review?.suggestedReply) {
      loadReply(false);
    } else {
      setReplyText(review.suggestedReply);
    }
  }, [loadReply, review?.suggestedReply]);

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    if (!replyText) return;
    try {
      await navigator.clipboard.writeText(replyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback if clipboard API is blocked in sandbox
      const el = document.createElement('textarea');
      el.value = replyText;
      document.body.appendChild(el);
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  if (!review) return null;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">{review.reviewId || `ID ${review.id}`}</span>
            <h3 className="modal-title">Suggested Customer Support Reply</h3>
          </div>
          <button type="button" className="btn-modal-close" onClick={onClose} aria-label="Close modal">
            &times;
          </button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Review Details Card */}
          <div className="modal-review-context">
            <div className="context-row">
              <span className="context-label">Product:</span>
              <span className="context-product">{review.product || '—'}</span>
              {review.rating != null && (
                <span className="context-rating">★ {review.rating}</span>
              )}
            </div>
            <div className="context-text-block">
              <span className="context-label">Customer Review:</span>
              <p className="context-review-text">
                "{review.cleanText || review.originalText || '—'}"
              </p>
            </div>
            {review.summary && (
              <div className="context-summary-block">
                <span className="context-label">Gemini Summary:</span>
                <span className="context-summary-text">{review.summary}</span>
              </div>
            )}
          </div>

          {/* Generated Reply Area */}
          <div className="modal-reply-area">
            {loading ? (
              <div className="modal-loading-box">
                <div className="spinner" />
                <p>Generating polite customer response with Gemini...</p>
              </div>
            ) : error ? (
              <div className="modal-error-box">
                <p className="error-title">Generation Error</p>
                <p className="error-msg">{error}</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-retry"
                  onClick={() => loadReply(false)}
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="reply-editor-wrapper">
                <label htmlFor="reply-textarea" className="reply-textarea-label">
                  Suggested Response (editable):
                </label>
                <textarea
                  id="reply-textarea"
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  className="reply-textarea"
                  rows={4}
                  placeholder="Support reply will appear here..."
                />
              </div>
            )}
          </div>
        </div>

        {/* Modal Footer */}
        <div className="modal-footer">
          <button
            type="button"
            className="btn btn-secondary"
            onClick={() => loadReply(true)}
            disabled={loading}
          >
            {loading ? 'Generating...' : '🔄 Regenerate'}
          </button>

          <div className="footer-actions-right">
            <button
              type="button"
              className={`btn btn-copy ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopy}
              disabled={loading || !replyText}
            >
              {copied ? '✓ Copied!' : 'Copy to Clipboard'}
            </button>
            <button type="button" className="btn btn-primary" onClick={onClose}>
              Done
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
