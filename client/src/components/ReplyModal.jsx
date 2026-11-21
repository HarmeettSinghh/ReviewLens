import { useState, useEffect } from 'react';
import { fetchReply } from '../api';

export default function ReplyModal({ review, onClose, onReplySaved }) {
  const [replyText, setReplyText] = useState(review?.suggestedReply || '');
  const [loading, setLoading] = useState(!review?.suggestedReply);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const reviewId = review?.id || review?.reviewId;

  // Word count helper
  const wordCount = replyText.trim() ? replyText.trim().split(/\s+/).length : 0;

  // Close on Escape key press
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  // Initial load: only call AI if review does not already have a saved reply
  useEffect(() => {
    if (review?.suggestedReply || !reviewId) {
      return;
    }

    let isMounted = true;
    async function generateInitialReply() {
      try {
        setLoading(true);
        setError(null);
        const data = await fetchReply(reviewId, false);
        if (!isMounted) return;
        setReplyText(data.reply || '');
        if (onReplySaved) {
          onReplySaved(reviewId, data.reply);
        }
      } catch (err) {
        if (!isMounted) return;
        setError(err.message || 'Failed to generate customer support reply.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    generateInitialReply();

    return () => {
      isMounted = false;
    };
  }, [reviewId, review?.suggestedReply, onReplySaved]);

  // Explicit user action to regenerate reply
  const handleRegenerate = async () => {
    if (!reviewId) return;
    try {
      setLoading(true);
      setError(null);
      const data = await fetchReply(reviewId, true);
      setReplyText(data.reply || '');
      if (onReplySaved) {
        onReplySaved(reviewId, data.reply);
      }
    } catch (err) {
      setError(err.message || 'Failed to regenerate reply.');
    } finally {
      setLoading(false);
    }
  };

  // Handle Copy to Clipboard
  const handleCopy = async () => {
    if (!replyText) return;
    try {
      await navigator.clipboard.writeText(replyText);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for restricted clipboard permissions
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
    <div className="modal-backdrop" onClick={onClose} role="dialog" aria-modal="true">
      <div className="modal-dialog" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-group">
            <span className="modal-badge">{review.reviewId || `ID ${review.id}`}</span>
            <h3 className="modal-title">Suggested Customer Support Reply</h3>
          </div>
          <button
            type="button"
            className="btn-modal-close"
            onClick={onClose}
            aria-label="Close modal (Esc)"
            title="Close (Esc)"
          >
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
                <p>Drafting courteous response with Google Gemini...</p>
                <span className="loading-subhint">Applying policy-safe guardrails and anti-injection sanitization</span>
              </div>
            ) : error ? (
              <div className="modal-error-box">
                <p className="error-title">Generation Error</p>
                <p className="error-msg">{error}</p>
                <button
                  type="button"
                  className="btn btn-secondary btn-retry"
                  onClick={handleRegenerate}
                >
                  Try Again
                </button>
              </div>
            ) : (
              <div className="reply-editor-wrapper">
                <div className="reply-editor-header">
                  <label htmlFor="reply-textarea" className="reply-textarea-label">
                    Suggested Response (editable):
                  </label>
                  <span className={`reply-word-count ${wordCount > 75 ? 'count-warning' : ''}`}>
                    {wordCount} words {wordCount > 70 ? '(target ~70 max)' : ''}
                  </span>
                </div>
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
            className="btn btn-secondary btn-regenerate"
            onClick={handleRegenerate}
            disabled={loading}
            title="Request an alternate response draft from Gemini"
          >
            {loading ? 'Drafting...' : '🔄 Regenerate Reply'}
          </button>

          <div className="footer-actions-right">
            <button
              type="button"
              className={`btn btn-copy ${copied ? 'btn-copied' : ''}`}
              onClick={handleCopy}
              disabled={loading || !replyText}
              title="Copy response to clipboard"
            >
              {copied ? '✓ Copied to Clipboard!' : 'Copy Response'}
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
