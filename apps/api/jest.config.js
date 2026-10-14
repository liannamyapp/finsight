/** @type {import('jest').Config} */
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/tests'],
  collectCoverageFrom: ['src/domain/**/*.ts', 'src/lib/**/*.ts'],
  coverageThreshold: {
    global: { lines: 80 },
  },
};
