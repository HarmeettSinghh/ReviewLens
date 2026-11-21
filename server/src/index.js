const path = require('path');
// Load environment variables from server/.env regardless of current working directory
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

const app = require('./app');

// Fallback to port 4000 if PORT is not defined in the environment.
const PORT = process.env.PORT || 4000;

// Config check: warn early if GEMINI_API_KEY is missing so developers know
// AI analysis won't function, but do NOT crash the server (health checks and other APIs still work).
// Never print the key in logs to prevent secret leakage.
if (!process.env.GEMINI_API_KEY) {
  console.warn('[WARNING] GEMINI_API_KEY is missing from environment variables. Gemini features will not work.');
}

// Start the HTTP server.
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});
