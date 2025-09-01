module.exports = {
    // Run tests in Node (no DOM APIs needed for gestures/functions)
    testEnvironment: 'node',
  
    // Where to start resolving modules
    rootDir: '..',
  
    // Look for any .test.js files under tests/
    testMatch: ['<rootDir>/tests/**/*.test.js'],
  
    // Run setup script before tests
    setupFilesAfterEnv: ['<rootDir>/tests/setupTests.js'],
  
    // Allow cleaner imports with @aliases
    moduleNameMapper: {
      '^@core/(.*)$': '<rootDir>/src/core/$1',
      '^@gestures/(.*)$': '<rootDir>/src/gestures/$1',
      '^@functions/(.*)$': '<rootDir>/src/functions/$1',
      '^@input/(.*)$': '<rootDir>/src/input/$1',
      '^@osx/(.*)$': '<rootDir>/src/osx/$1',
      '^@adapters/(.*)$': '<rootDir>/src/adapters/$1',
      '^@hud/(.*)$': '<rootDir>/src/hud/$1',
      '^@settings/(.*)$': '<rootDir>/src/settings/$1'
    }
  };
  