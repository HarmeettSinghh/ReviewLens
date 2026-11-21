module.exports = {
  // Use Node.js testing environment because this backend server runs without a browser DOM.
  testEnvironment: 'node',
  // Discover and run test files located inside server/src/tests.
  testMatch: ['<rootDir>/src/tests/**/*.test.js'],
  // Clear mock states automatically between tests to avoid cross-test contamination.
  clearMocks: true,
};
