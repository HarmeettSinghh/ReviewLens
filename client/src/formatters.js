/**
 * formatters.js
 * Human-readable formatters for topic tags and ratings.
 */

const TOPIC_LABELS = {
  size_fit: 'Size & Fit',
  quality: 'Quality',
  shipping: 'Shipping & Delivery',
  customer_service: 'Customer Service',
  price_value: 'Price & Value',
  packaging: 'Packaging',
  comfort: 'Comfort',
  design_style: 'Design & Style',
  durability: 'Durability',
  accuracy: 'Item Accuracy',
  other: 'Other',
};

export function formatTopic(topicKey) {
  if (!topicKey) return '';
  if (TOPIC_LABELS[topicKey]) return TOPIC_LABELS[topicKey];
  return topicKey
    .split('_')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join(' ');
}
