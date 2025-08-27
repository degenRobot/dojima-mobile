module.exports = {
  preset: 'jest-expo',
  setupFilesAfterEnv: ['<rootDir>/jest.setup.js'],
  transformIgnorePatterns: [
    'node_modules/(?!((jest-)?react-native|@react-native(-community)?)|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@sentry/react-native|native-base|react-native-svg|react-native-reanimated|viem|@wagmi/.*|ethers)'
  ],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^expo-secure-store$': '<rootDir>/__mocks__/expo-secure-store.js',
    '^expo-haptics$': '<rootDir>/__mocks__/expo-haptics.js',
    'react-native-reanimated': '<rootDir>/__mocks__/react-native-reanimated.js',
  },
  testEnvironment: 'node',
  testMatch: [
    '**/src/**/__tests__/simple*.test.{js,ts,tsx}',
  ],
  collectCoverageFrom: [
    'src/**/*.{ts,tsx}',
    '!src/**/*.d.ts',
    '!src/**/*.test.{ts,tsx}',
  ],
  globals: {
    __DEV__: true,
  },
  testTimeout: 30000, // 30 seconds for network calls
};