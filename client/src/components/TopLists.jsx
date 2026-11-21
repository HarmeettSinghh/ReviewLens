/**
 * TopLists.jsx
 * Displays two columns: "Top 3 complaints" and "Top 3 praises".
 * Shows readable topic labels, count badges, and up to 2 example summaries.
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

function TopicListColumn({ title, items, badgeClass, emptyMessage }) {
  return (
    <div className="top-list-column">
      <h3 className="column-title">{title}</h3>

      {(!items || items.length === 0) ? (
        <p className="empty-subtext">{emptyMessage}</p>
      ) : (
        <div className="topic-items-list">
          {items.map((item, idx) => (
            <div key={item.topic || idx} className="topic-item-card">
              <div className="topic-item-header">
                <span className="topic-title">{formatTopic(item.topic)}</span>
                <span className={`topic-badge ${badgeClass}`}>
                  {item.count} {item.count === 1 ? 'review' : 'reviews'}
                </span>
              </div>

              {item.examples && item.examples.length > 0 && (
                <ul className="topic-examples-list">
                  {item.examples.map((example, exIdx) => (
                    <li key={exIdx} className="topic-example-text">
                      "{example}"
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default function TopLists({ topComplaints = [], topPraises = [] }) {
  return (
    <div className="top-lists-container">
      <TopicListColumn
        title="Top 3 Complaints"
        items={topComplaints}
        badgeClass="badge-complaint"
        emptyMessage="No complaints recorded yet."
      />
      <TopicListColumn
        title="Top 3 Praises"
        items={topPraises}
        badgeClass="badge-praise"
        emptyMessage="No praises recorded yet."
      />
    </div>
  );
}
