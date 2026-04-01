module.exports = {
  testEnvironment: 'node',
  testMatch: ['**/tests/**/*.test.js'],
  collectCoverageFrom: ['src/**/*.js'],
  setupFiles: ['dotenv/config'],
  transform: {
    '\\.js$': 'babel-jest',
    '\\.ts$': 'babel-jest',
  },
  transformIgnorePatterns: [
    'node_modules/(?!(@scure|otplib|@otplib|uuid|@noble)/)',
  ],
};
