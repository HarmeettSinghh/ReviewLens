const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { PrismaClient } = require('@prisma/client');

// Fallback to local SQLite database file if DATABASE_URL was not set in .env
if (!process.env.DATABASE_URL) {
  process.env.DATABASE_URL = 'file:./dev.db';
}

// Export one shared PrismaClient instance across the server.
// Sharing this single instance avoids exhausting database connections
// and prevents SQLite file-locking conflicts.
const prisma = new PrismaClient();

module.exports = prisma;
