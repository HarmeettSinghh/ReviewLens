const express = require('express');
const cors = require('cors');
const healthRoutes = require('./routes/health');

const app = express();

// Enable Cross-Origin Resource Sharing so the frontend client can communicate with this API.
app.use(cors());

// Parse incoming JSON request bodies into req.body for handlers to use.
app.use(express.json());

// Mount routes under the /api path prefix.
app.use('/api', healthRoutes);

// Export the app instance without calling listen()
// so test suites (e.g., Supertest) can test HTTP endpoints without binding a real network port.
module.exports = app;
