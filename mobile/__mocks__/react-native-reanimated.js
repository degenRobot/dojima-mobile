// Mock React Native Reanimated for testing
const View = require('react-native').View;

const mockReanimated = {
  createAnimatedComponent: (component) => component,
  useSharedValue: jest.fn(() => ({ value: 0 })),
  useAnimatedStyle: jest.fn(() => ({})),
  useDerivedValue: jest.fn(),
  useAnimatedGestureHandler: jest.fn(),
  useAnimatedScrollHandler: jest.fn(),
  useWorkletCallback: jest.fn((callback) => callback),
  runOnJS: jest.fn((fn) => fn),
  runOnUI: jest.fn((fn) => fn),
  withTiming: jest.fn((toValue) => toValue),
  withSpring: jest.fn((toValue) => toValue),
  withDelay: jest.fn((delay, animation) => animation),
  withRepeat: jest.fn((animation) => animation),
  withSequence: jest.fn((...animations) => animations[0]),
  cancelAnimation: jest.fn(),
  measure: jest.fn(),
  scrollTo: jest.fn(),
  Extrapolate: {
    EXTEND: 'extend',
    CLAMP: 'clamp',
    IDENTITY: 'identity',
  },
  interpolate: jest.fn(),
  Easing: {
    linear: jest.fn(),
    ease: jest.fn(),
    quad: jest.fn(),
    cubic: jest.fn(),
    poly: jest.fn(),
    sin: jest.fn(),
    circle: jest.fn(),
    exp: jest.fn(),
    elastic: jest.fn(),
    back: jest.fn(),
    bounce: jest.fn(),
    bezier: jest.fn(),
    in: jest.fn(),
    out: jest.fn(),
    inOut: jest.fn(),
  },
};

// Create animated components
mockReanimated.default = {
  ...mockReanimated,
  View,
  Text: require('react-native').Text,
  ScrollView: require('react-native').ScrollView,
  Image: require('react-native').Image,
};

module.exports = mockReanimated;