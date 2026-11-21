import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register required Chart.js modules
ChartJS.register(ArcElement, Tooltip, Legend);

export default function SentimentChart({ sentiment, activeSentiment, onSelectSentiment }) {
  if (!sentiment) return null;

  const positiveCount = sentiment.positive?.count ?? 0;
  const neutralCount = sentiment.neutral?.count ?? 0;
  const negativeCount = sentiment.negative?.count ?? 0;
  const total = positiveCount + neutralCount + negativeCount;

  if (total === 0) {
    return (
      <div className="chart-card empty-chart">
        <h3 className="card-heading">Sentiment Split</h3>
        <p className="empty-hint">No analysed reviews to display sentiment chart.</p>
      </div>
    );
  }

  const sentiments = ['positive', 'neutral', 'negative'];

  const data = {
    labels: ['Positive', 'Neutral', 'Negative'],
    datasets: [
      {
        data: [positiveCount, neutralCount, negativeCount],
        backgroundColor: [
          '#059669', // Emerald green
          '#64748b', // Slate gray
          '#dc2626', // Crimson red
        ],
        hoverBackgroundColor: [
          '#047857',
          '#475569',
          '#b91c1c',
        ],
        borderColor: '#ffffff',
        borderWidth: 2,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    onClick: (_event, elements) => {
      if (elements && elements.length > 0 && onSelectSentiment) {
        const index = elements[0].index;
        const clickedSentiment = sentiments[index];
        if (activeSentiment === clickedSentiment) {
          onSelectSentiment('ALL'); // Reset
        } else {
          onSelectSentiment(clickedSentiment);
        }
      }
    },
    plugins: {
      legend: {
        position: 'bottom',
        onClick: (_e, legendItem) => {
          if (onSelectSentiment) {
            const clickedSentiment = sentiments[legendItem.index];
            if (activeSentiment === clickedSentiment) {
              onSelectSentiment('ALL');
            } else {
              onSelectSentiment(clickedSentiment);
            }
          }
        },
        labels: {
          boxWidth: 14,
          padding: 16,
          font: {
            family: 'system-ui, -apple-system, sans-serif',
            size: 13,
            weight: '600',
          },
          color: '#334155',
          cursor: 'pointer',
        },
      },
      tooltip: {
        backgroundColor: '#0f172a',
        padding: 10,
        titleFont: { size: 13, weight: '600' },
        bodyFont: { size: 12 },
        callbacks: {
          label: (context) => {
            const count = context.parsed;
            const pct = total > 0 ? ((count / total) * 100).toFixed(1) : 0;
            return ` ${context.label}: ${count} (${pct}%) — click to filter`;
          },
        },
      },
    },
    cutout: '68%',
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <div>
          <h3 className="card-heading">Sentiment Split</h3>
          <span className="chart-subtitle">
            {total} reviews analysed {activeSentiment && activeSentiment !== 'ALL' ? `(Filtered: ${activeSentiment})` : ''}
          </span>
        </div>
        {activeSentiment && activeSentiment !== 'ALL' && (
          <button
            type="button"
            className="btn-filter-reset-pill"
            onClick={() => onSelectSentiment && onSelectSentiment('ALL')}
            title="Reset sentiment filter"
          >
            Clear filter ×
          </button>
        )}
      </div>
      <div className="chart-container">
        <Doughnut data={data} options={options} />
      </div>
      <div className="chart-footer-hint">
        <span>Click any slice or label to filter the reviews list</span>
      </div>
    </div>
  );
}
