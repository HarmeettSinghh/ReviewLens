import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js';
import { Doughnut } from 'react-chartjs-2';

// Register required Chart.js modules
ChartJS.register(ArcElement, Tooltip, Legend);

export default function SentimentChart({ sentiment }) {
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
    plugins: {
      legend: {
        position: 'bottom',
        labels: {
          boxWidth: 14,
          padding: 16,
          font: {
            family: 'system-ui, -apple-system, sans-serif',
            size: 13,
            weight: '500',
          },
          color: '#334155',
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
            return ` ${context.label}: ${count} (${pct}%)`;
          },
        },
      },
    },
    cutout: '68%',
  };

  return (
    <div className="chart-card">
      <div className="chart-header">
        <h3 className="card-heading">Sentiment Split</h3>
        <span className="chart-subtitle">{total} reviews analysed</span>
      </div>
      <div className="chart-container">
        <Doughnut data={data} options={options} />
      </div>
    </div>
  );
}
