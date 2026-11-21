/**
 * Helper: computes top topics ranking for a subset of reviews.
 * - Counts frequency of each topic.
 * - Collects up to 2 distinct summary examples per topic.
 * - Excludes the topic "other" from the top lists unless fewer than 3 other topics exist.
 * - Sorts by count descending, then alphabetically by topic name for stable ordering.
 */
function getTopTopics(reviewsSubset, limit = 3) {
  const topicMap = new Map();

  for (const review of reviewsSubset) {
    const topics = Array.isArray(review.topics) ? review.topics : [];
    const summary = review.summary ? String(review.summary).trim() : null;

    for (const topic of topics) {
      if (!topic) continue;

      if (!topicMap.has(topic)) {
        topicMap.set(topic, { topic, count: 0, examples: [] });
      }

      const entry = topicMap.get(topic);
      entry.count += 1;

      if (summary && entry.examples.length < 2 && !entry.examples.includes(summary)) {
        entry.examples.push(summary);
      }
    }
  }

  const allTopics = Array.from(topicMap.values());

  // Exclude "other" unless fewer than 3 non-other topics exist
  const nonOtherTopics = allTopics.filter((t) => t.topic !== 'other');
  let eligibleTopics;

  if (nonOtherTopics.length >= limit) {
    eligibleTopics = nonOtherTopics;
  } else {
    // Fewer than 3 other topics exist; allow "other" to be included
    eligibleTopics = allTopics;
  }

  // Sort: count descending, then topic name ascending
  eligibleTopics.sort((a, b) => {
    if (b.count !== a.count) {
      return b.count - a.count;
    }
    return a.topic.localeCompare(b.topic);
  });

  return eligibleTopics.slice(0, limit);
}

/**
 * Maps a numeric star rating (1-5) to its expected sentiment category:
 * - 4 to 5 stars -> positive
 * - 3 stars -> neutral
 * - 1 to 2 stars -> negative
 * Returns null if rating is null, undefined, or outside 1-5.
 */
function getExpectedSentiment(rating) {
  if (rating === null || rating === undefined || rating === '') {
    return null;
  }
  const num = Number(rating);
  if (Number.isNaN(num)) {
    return null;
  }
  if (num >= 4 && num <= 5) return 'positive';
  if (num === 3) return 'neutral';
  if (num >= 1 && num <= 2) return 'negative';
  return null;
}

/**
 * Checks whether a review exhibits a strong polarity mismatch between star rating and text sentiment:
 * - Only flagged for OPPOSITE polarity:
 *   - Rating 4-5 with negative text sentiment (e.g. sarcastic 5-star review "Terrible quality!")
 *   - Rating 1-2 with positive text sentiment (e.g. "Loved everything!" but gave 1 star by accident)
 * - Only analysed reviews with a non-null rating can be flagged.
 *
 * @param {Object} review The Review record
 * @returns {boolean} True if strong opposite-polarity mismatch exists
 */
function isRatingMismatch(review) {
  if (!review || review.status !== 'analysed') {
    return false;
  }
  if (review.rating === null || review.rating === undefined) {
    return false;
  }
  if (!review.sentiment) {
    return false;
  }

  const num = Number(review.rating);
  if (Number.isNaN(num)) {
    return false;
  }

  const actualSentiment = String(review.sentiment).toLowerCase();

  // Strong opposite polarity:
  // 4-5 stars with negative sentiment
  if (num >= 4 && actualSentiment === 'negative') {
    return true;
  }
  // 1-2 stars with positive sentiment
  if (num <= 2 && num >= 1 && actualSentiment === 'positive') {
    return true;
  }

  return false;
}

/**
 * computeStats(reviews)
 * Pure calculation function that computes dashboard metrics for a list of reviews.
 * - Statistics use only reviews with status "analysed".
 * - Duplicates, skipped rows, and failed rows are counted separately and excluded from percentages.
 * - Handles empty datasets gracefully without crashing.
 *
 * @param {Array} reviews Array of Review records (topics already parsed as arrays)
 * @returns {Object} Dashboard metrics object
 */
function computeStats(reviews = []) {
  const safeReviews = Array.isArray(reviews) ? reviews : [];

  // 1. Overall counts breakdown
  const totalRows = safeReviews.length;
  const analysed = safeReviews.filter((r) => r.status === 'analysed').length;
  const duplicates = safeReviews.filter((r) => r.status === 'duplicate').length;
  const skipped = safeReviews.filter((r) => r.status === 'skipped_empty').length;
  const failed = safeReviews.filter((r) => r.status === 'analysis_failed').length;

  const counts = {
    totalRows,
    analysed,
    duplicates,
    skipped,
    failed,
  };

  // 2. Filter for analysed reviews only (duplicates and invalid reviews excluded from statistics)
  const analysedReviews = safeReviews.filter((r) => r.status === 'analysed');
  const totalAnalysed = analysedReviews.length;

  // 3. Sentiment counts & percentages
  const positiveCount = analysedReviews.filter((r) => r.sentiment === 'positive').length;
  const neutralCount = analysedReviews.filter((r) => r.sentiment === 'neutral').length;
  const negativeCount = analysedReviews.filter((r) => r.sentiment === 'negative').length;

  const calcPercent = (count) => {
    if (totalAnalysed === 0) return 0;
    return Math.round((count / totalAnalysed) * 100 * 10) / 10;
  };

  const sentiment = {
    positive: {
      count: positiveCount,
      percent: calcPercent(positiveCount),
    },
    neutral: {
      count: neutralCount,
      percent: calcPercent(neutralCount),
    },
    negative: {
      count: negativeCount,
      percent: calcPercent(negativeCount),
    },
  };

  // 4. Needs reply count across analysed reviews
  const needsReplyCount = analysedReviews.filter((r) => Boolean(r.needsReply)).length;

  // 5. Rating vs text agreement calculation
  // Only considers analysed reviews with a non-null rating
  const ratedAnalysed = analysedReviews.filter(
    (r) => r.rating !== null && r.rating !== undefined && !Number.isNaN(Number(r.rating))
  );

  let agreementCount = 0;
  let mismatchCount = 0;

  for (const r of ratedAnalysed) {
    const expected = getExpectedSentiment(r.rating);
    const actual = r.sentiment ? String(r.sentiment).toLowerCase() : null;
    if (expected && actual && expected === actual) {
      agreementCount++;
    }
    if (isRatingMismatch(r)) {
      mismatchCount++;
    }
  }

  const agreementPercent =
    ratedAnalysed.length > 0
      ? Math.round((agreementCount / ratedAnalysed.length) * 100 * 10) / 10
      : 100;

  // 6. Top complaints (reviews with sentiment negative OR needsReply true)
  const complaintReviews = analysedReviews.filter((r) => r.sentiment === 'negative' || Boolean(r.needsReply));
  const topComplaints = getTopTopics(complaintReviews, 3);

  // 7. Top praises (reviews with sentiment positive)
  const praiseReviews = analysedReviews.filter((r) => r.sentiment === 'positive');
  const topPraises = getTopTopics(praiseReviews, 3);

  // 8. Sorted distinct list of product names
  const products = Array.from(
    new Set(
      safeReviews
        .map((r) => (r.product ? String(r.product).trim() : ''))
        .filter((name) => name.length > 0)
    )
  ).sort((a, b) => a.localeCompare(b));

  return {
    counts,
    sentiment,
    needsReplyCount,
    agreementPercent,
    mismatchCount,
    topComplaints,
    topPraises,
    products,
  };
}

module.exports = {
  computeStats,
  getExpectedSentiment,
  isRatingMismatch,
};
