import { formatTopic } from '../formatters';

function TopicListColumn({ title, items, badgeClass, emptyMessage, activeTopic, onSelectTopic }) {
  const handleTopicClick = (topic) => {
    if (!onSelectTopic) return;
    if (activeTopic === topic) {
      onSelectTopic('ALL'); // Reset
    } else {
      onSelectTopic(topic);
    }
  };

  const handleKeyDown = (e, topic) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleTopicClick(topic);
    }
  };

  return (
    <div className="top-list-column">
      <div className="column-header-row">
        <h3 className="column-title">{title}</h3>
        <span className="column-interactive-hint">Click topic to filter</span>
      </div>

      {!items || items.length === 0 ? (
        <p className="empty-subtext">{emptyMessage}</p>
      ) : (
        <div className="topic-items-list">
          {items.map((item, idx) => {
            const isSelected = activeTopic === item.topic;

            return (
              <div
                key={item.topic || idx}
                className={`topic-item-card topic-item-interactive ${isSelected ? 'is-selected-topic' : ''}`}
                onClick={() => handleTopicClick(item.topic)}
                onKeyDown={(e) => handleKeyDown(e, item.topic)}
                role="button"
                tabIndex={0}
                title={`Click to filter reviews by "${formatTopic(item.topic)}"`}
              >
                <div className="topic-item-header">
                  <div className="topic-title-group">
                    <span className="topic-title">{formatTopic(item.topic)}</span>
                    {isSelected && <span className="topic-selected-pill">Active</span>}
                  </div>
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
            );
          })}
        </div>
      )}
    </div>
  );
}

export default function TopLists({
  topComplaints = [],
  topPraises = [],
  activeTopic,
  onSelectTopic,
}) {
  return (
    <div className="top-lists-container">
      <TopicListColumn
        title="Top 3 Complaints"
        items={topComplaints}
        badgeClass="badge-complaint"
        emptyMessage="No complaints recorded yet."
        activeTopic={activeTopic}
        onSelectTopic={onSelectTopic}
      />
      <TopicListColumn
        title="Top 3 Praises"
        items={topPraises}
        badgeClass="badge-praise"
        emptyMessage="No praises recorded yet."
        activeTopic={activeTopic}
        onSelectTopic={onSelectTopic}
      />
    </div>
  );
}
