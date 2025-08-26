// Add TextEncoder/TextDecoder polyfills
global.TextEncoder = require('util').TextEncoder;
global.TextDecoder = require('util').TextDecoder;

// Mock crypto for testing
global.crypto = {
  getRandomValues: (arr) => {
    for (let i = 0; i < arr.length; i++) {
      arr[i] = Math.floor(Math.random() * 256);
    }
    return arr;
  },
  randomUUID: () => {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }
};

// Mock fetch for tests
global.fetch = jest.fn();

// Mock React Native modules that might not be available in test
jest.mock('react-native', () => ({
  ...jest.requireActual('react-native'),
  NativeModules: {},
  Platform: {
    OS: 'ios',
    select: jest.fn((obj) => obj.ios),
  },
}));