const { computeStats, getExpectedSentiment, isRatingMismatch } = require('../services/stats');

describe('computeStats service tests (pure function)', () => {
  // Test 1: Empty dataset handling
  it('handles an empty dataset without crashing and returns zeros and empty arrays', () => {
    const stats = computeStats([]);

    expect(stats.counts).toEqual({
      totalRows: 0,
      analysed: 0,
      duplicates: 0,
      skipped: 0,
      failed: 0,
    });

    expect(stats.sentiment).toEqual({
      positive: { count: 0, percent: 0 },
      neutral: { count: 0, percent: 0 },
      negative: { count: 0, percent: 0 },
    });

    expect(stats.needsReplyCount).toBe(0);
    expect(stats.agreementPercent).toBe(100);
    expect(stats.mismatchCount).toBe(0);
    expect(stats.topComplaints).toEqual([]);
    expect(stats.topPraises).toEqual([]);
    expect(stats.products).toEqual([]);
  });

  // Test 2: Percentages and exclusion of duplicate/skipped/failed rows
  it('calculates sentiment percentages solely from analysed reviews and excludes duplicates/skipped/failed rows', () => {
    const mockReviews = [
      // 3 positive analysed reviews
      { status: 'analysed', sentiment: 'positive', rating: 5, product: 'Product A', topics: ['quality'] },
      { status: 'analysed', sentiment: 'positive', rating: 4, product: 'Product A', topics: ['quality'] },
      { status: 'analysed', sentiment: 'positive', rating: 5, product: 'Product B', topics: ['support'] },
      // 2 neutral analysed reviews
      { status: 'analysed', sentiment: 'neutral', rating: 3, product: 'Product A', topics: ['price'] },
      { status: 'analysed', sentiment: 'neutral', rating: 3, product: 'Product B', topics: ['price'] },
      // 1 negative analysed review
      { status: 'analysed', sentiment: 'negative', rating: 1, product: 'Product B', topics: ['delivery'] },
      // Non-analysed rows that must be excluded from percentages
      { status: 'duplicate', duplicateOf: 'R001', product: 'Product A', sentiment: 'positive' },
      { status: 'duplicate', duplicateOf: 'R002', product: 'Product A', sentiment: 'positive' },
      { status: 'skipped_empty', product: 'Product B' },
      { status: 'analysis_failed', product: 'Product C' },
    ];

    const stats = computeStats(mockReviews);

    // Total rows = 10, analysed = 6, duplicates = 2, skipped = 1, failed = 1
    expect(stats.counts).toEqual({
      totalRows: 10,
      analysed: 6,
      duplicates: 2,
      skipped: 1,
      failed: 1,
    });

    // Percentages are based on 6 analysed reviews:
    // positive: 3 / 6 = 50.0%
    // neutral: 2 / 6 = 33.3%
    // negative: 1 / 6 = 16.7%
    expect(stats.sentiment.positive).toEqual({ count: 3, percent: 50.0 });
    expect(stats.sentiment.neutral).toEqual({ count: 2, percent: 33.3 });
    expect(stats.sentiment.negative).toEqual({ count: 1, percent: 16.7 });

    const totalPercent =
      stats.sentiment.positive.percent +
      stats.sentiment.neutral.percent +
      stats.sentiment.negative.percent;
    expect(Math.round(totalPercent)).toBe(100);

    // Products list should be sorted distinct names from all reviews
    expect(stats.products).toEqual(['Product A', 'Product B', 'Product C']);

    // 100% agreement since all 6 ratings match their expected sentiments
    expect(stats.agreementPercent).toBe(100);
    expect(stats.mismatchCount).toBe(0);
  });

  // Test 3: Top complaints ordering (count descending, then topic name, includes needsReply)
  it('correctly ranks top complaints by count descending and alphabetical tie-breaker, including needsReply reviews', () => {
    const mockReviews = [
      // 3 quality complaints (negative sentiment)
      { status: 'analysed', sentiment: 'negative', needsReply: true, topics: ['quality'], summary: 'Broken on arrival' },
      { status: 'analysed', sentiment: 'negative', needsReply: true, topics: ['quality'], summary: 'Defective screen' },
      { status: 'analysed', sentiment: 'negative', needsReply: false, topics: ['quality'], summary: 'Poor materials' },

      // 2 delivery complaints (one negative, one neutral with needsReply true)
      { status: 'analysed', sentiment: 'negative', needsReply: false, topics: ['delivery'], summary: 'Late shipment' },
      { status: 'analysed', sentiment: 'neutral', needsReply: true, topics: ['delivery'], summary: 'Lost in transit' },

      // 1 support complaint
      { status: 'analysed', sentiment: 'negative', needsReply: true, topics: ['support'], summary: 'No agent answered' },

      // 1 price complaint (tied with support in count=1, but "price" comes before "support" alphabetically)
      { status: 'analysed', sentiment: 'negative', needsReply: true, topics: ['price'], summary: 'Overpriced' },
    ];

    const stats = computeStats(mockReviews);

    expect(stats.needsReplyCount).toBe(5);
    expect(stats.topComplaints).toHaveLength(3);

    // 1st: quality (count: 3)
    expect(stats.topComplaints[0].topic).toBe('quality');
    expect(stats.topComplaints[0].count).toBe(3);
    expect(stats.topComplaints[0].examples).toHaveLength(2); // Max 2 examples

    // 2nd: delivery (count: 2)
    expect(stats.topComplaints[1].topic).toBe('delivery');
    expect(stats.topComplaints[1].count).toBe(2);

    // 3rd: price (count: 1) - alphabetical tie-breaker over support
    expect(stats.topComplaints[2].topic).toBe('price');
    expect(stats.topComplaints[2].count).toBe(1);
  });

  // Test 4: The "other" exclusion rule
  describe('"other" topic exclusion rule', () => {
    it('excludes "other" from the top 3 list when 3 or more non-other topics exist, even if "other" has higher count', () => {
      const mockReviews = [
        { status: 'analysed', sentiment: 'positive', topics: ['other'], summary: 'Other praise 1' },
        { status: 'analysed', sentiment: 'positive', topics: ['other'], summary: 'Other praise 2' },
        { status: 'analysed', sentiment: 'positive', topics: ['other'], summary: 'Other praise 3' },
        { status: 'analysed', sentiment: 'positive', topics: ['other'], summary: 'Other praise 4' },
        { status: 'analysed', sentiment: 'positive', topics: ['quality'], summary: 'Quality praise' },
        { status: 'analysed', sentiment: 'positive', topics: ['delivery'], summary: 'Delivery praise' },
        { status: 'analysed', sentiment: 'positive', topics: ['packaging'], summary: 'Packaging praise' },
      ];

      const stats = computeStats(mockReviews);

      // "other" has count 4, but since 3 non-other topics exist (quality, delivery, packaging),
      // "other" must be excluded from the top 3!
      const topTopics = stats.topPraises.map((p) => p.topic);
      expect(topTopics).not.toContain('other');
      expect(topTopics).toEqual(['delivery', 'packaging', 'quality']); // alphabetically tied with count 1
    });

    it('includes "other" in the top list when fewer than 3 non-other topics exist', () => {
      const mockReviews = [
        { status: 'analysed', sentiment: 'positive', topics: ['other'], summary: 'Other praise' },
        { status: 'analysed', sentiment: 'positive', topics: ['quality'], summary: 'Quality praise' },
      ];

      const stats = computeStats(mockReviews);

      // Only 1 non-other topic exists ("quality"), which is < 3, so "other" is allowed
      const topTopics = stats.topPraises.map((p) => p.topic);
      expect(topTopics).toContain('other');
      expect(topTopics).toContain('quality');
    });
  });

  // Test 5: Rating mismatch logic & agreement percent (Phase 11 bonus)
  describe('Rating mismatch & agreement calculation', () => {
    it('maps star ratings to expected sentiments correctly', () => {
      expect(getExpectedSentiment(5)).toBe('positive');
      expect(getExpectedSentiment(4)).toBe('positive');
      expect(getExpectedSentiment(3)).toBe('neutral');
      expect(getExpectedSentiment(2)).toBe('negative');
      expect(getExpectedSentiment(1)).toBe('negative');
      expect(getExpectedSentiment(null)).toBeNull();
      expect(getExpectedSentiment(undefined)).toBeNull();
      expect(getExpectedSentiment('invalid')).toBeNull();
    });

    it('flags strong opposite-polarity rating mismatches (e.g. R008: 5 stars with negative text)', () => {
      // 5 stars with negative text (e.g. R008 sarcastic review) -> FLAGGED
      expect(isRatingMismatch({ status: 'analysed', rating: 5, sentiment: 'negative' })).toBe(true);
      // 4 stars with negative text -> FLAGGED
      expect(isRatingMismatch({ status: 'analysed', rating: 4, sentiment: 'negative' })).toBe(true);
      // 1 star with positive text (accidental 1-star) -> FLAGGED
      expect(isRatingMismatch({ status: 'analysed', rating: 1, sentiment: 'positive' })).toBe(true);
      // 2 stars with positive text -> FLAGGED
      expect(isRatingMismatch({ status: 'analysed', rating: 2, sentiment: 'positive' })).toBe(true);

      // Normal aligned reviews -> NOT flagged
      expect(isRatingMismatch({ status: 'analysed', rating: 5, sentiment: 'positive' })).toBe(false);
      expect(isRatingMismatch({ status: 'analysed', rating: 1, sentiment: 'negative' })).toBe(false);
      expect(isRatingMismatch({ status: 'analysed', rating: 3, sentiment: 'neutral' })).toBe(false);

      // Neutral ratings or neutral sentiments are NOT opposite polarity -> NOT flagged
      expect(isRatingMismatch({ status: 'analysed', rating: 5, sentiment: 'neutral' })).toBe(false);
      expect(isRatingMismatch({ status: 'analysed', rating: 1, sentiment: 'neutral' })).toBe(false);
      expect(isRatingMismatch({ status: 'analysed', rating: 3, sentiment: 'negative' })).toBe(false);
      expect(isRatingMismatch({ status: 'analysed', rating: 3, sentiment: 'positive' })).toBe(false);

      // Non-analysed or unrated reviews -> NOT flagged
      expect(isRatingMismatch({ status: 'duplicate', rating: 5, sentiment: 'negative' })).toBe(false);
      expect(isRatingMismatch({ status: 'analysed', rating: null, sentiment: 'negative' })).toBe(false);
    });

    it('computes agreementPercent accurately across rated analysed reviews', () => {
      const mockReviews = [
        // Aligned: 5 stars & positive
        { status: 'analysed', rating: 5, sentiment: 'positive' },
        // Aligned: 1 star & negative
        { status: 'analysed', rating: 1, sentiment: 'negative' },
        // Aligned: 3 stars & neutral
        { status: 'analysed', rating: 3, sentiment: 'neutral' },
        // Mismatch: 5 stars & negative (R008 style)
        { status: 'analysed', rating: 5, sentiment: 'negative' },
        // Unrated analysed review: ignored in rating agreement
        { status: 'analysed', rating: null, sentiment: 'positive' },
        // Duplicate row: ignored
        { status: 'duplicate', rating: 5, sentiment: 'negative' },
      ];

      const stats = computeStats(mockReviews);

      // 4 rated analysed reviews, 3 agree (75.0%)
      expect(stats.agreementPercent).toBe(75.0);
      expect(stats.mismatchCount).toBe(1);
    });
  });
});
