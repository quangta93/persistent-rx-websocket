// jest.config.js
module.exports = {
  verbose: true,
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  testPathIgnorePatterns: [
    "node_modules",
    "mock-server*"
  ]
};
