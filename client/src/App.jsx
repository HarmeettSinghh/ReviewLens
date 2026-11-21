import { useState, useEffect } from 'react';

function App() {
  const [status, setStatus] = useState('checking...');
  const [error, setError] = useState(null);

  useEffect(() => {
    // Fetch backend health status when the component mounts.
    // The Vite proxy redirects this request to http://localhost:4000/api/health.
    fetch('/api/health')
      .then((res) => {
        if (!res.ok) {
          throw new Error(`Server returned HTTP ${res.status}`);
        }
        return res.json();
      })
      .then((data) => {
        // Expected response format: { status: "ok" }
        setStatus(data.status);
      })
      .catch((err) => {
        // Display an error message if the server cannot be reached or returns an error.
        setError(err.message);
      });
  }, []);

  return (
    <main style={{ fontFamily: 'sans-serif', padding: '2rem' }}>
      <h1>ReviewLens</h1>
      {error ? (
        <p style={{ color: 'red' }}>Backend error: {error}</p>
      ) : (
        <p>Backend status: {status}</p>
      )}
    </main>
  );
}

export default App;
