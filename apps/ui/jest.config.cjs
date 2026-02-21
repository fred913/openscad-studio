/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  // Default to jsdom for store/hook tests; formatter tests override via docblock
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/src'],
  // Match test files in __tests__ directories
  testMatch: ['**/__tests__/**/*.test.ts', '**/__tests__/**/*.test.tsx'],
  // Ignore fixture files and other non-test files
  testPathIgnorePatterns: [
    '/node_modules/',
    '/__tests__/fixtures/',
    '/__tests__/test-utils.ts',
    '\\.scad$',
  ],
  moduleNameMapper: {
    '^(\\.{1,2}/.*)\\.js$': '$1',
  },
  transform: {
    '^.+\\.(ts|tsx)$': [
      'ts-jest',
      {
        tsconfig: '<rootDir>/tsconfig.json',
        useESM: false,
      },
    ],
  },
  // Allow importing .wasm files
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'wasm'],
  // Set up global test timeout
  testTimeout: 30000,
  // Speed up test discovery and execution
  maxWorkers: 1,
  cache: true,
  cacheDirectory: '<rootDir>/.jest-cache',
  // Disable watchman to avoid 60s timeout
  watchman: false,
};
