/**
 * api.js
 * Centralized API client for ReviewLens frontend.
 * All HTTP requests flow through the Vite development proxy (/api/*)
 * so the client never exposes backend hostnames or Gemini API keys.
 */

/**
 * Uploads a CSV file to the backend processing pipeline.
 * @param {File} file 
 * @returns {Promise<Object>} Upload summary metrics
 */
export async function uploadCsv(file) {
  if (!file) {
    throw new Error('Please select a CSV file to upload.');
  }

  const formData = new FormData();
  formData.append('file', file);

  const res = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Upload failed with HTTP ${res.status}`);
  }

  return data;
}

/**
 * Fetches dashboard statistics and latest upload run metadata.
 * @returns {Promise<Object>} Stats object including lastRun
 */
export async function fetchStats() {
  const res = await fetch('/api/stats');
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Failed to fetch statistics (HTTP ${res.status})`);
  }

  return data;
}

/**
 * Fetches all reviews from the currently active dataset.
 * @returns {Promise<Array>} Array of review records
 */
export async function fetchReviews() {
  const res = await fetch('/api/reviews');
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Failed to fetch reviews (HTTP ${res.status})`);
  }

  return data;
}

/**
 * Generates or retrieves a suggested customer support reply for a review.
 * @param {string|number} reviewId 
 * @param {boolean} regenerate 
 * @returns {Promise<{ reply: string }>}
 */
export async function fetchReply(reviewId, regenerate = false) {
  const res = await fetch(`/api/reviews/${reviewId}/reply`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ regenerate }),
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || `Failed to generate reply (HTTP ${res.status})`);
  }

  return data;
}
