// Mock Expo Secure Store for testing
const storage = {};

export const setItemAsync = jest.fn(async (key, value) => {
  storage[key] = value;
});

export const getItemAsync = jest.fn(async (key) => {
  return storage[key] || null;
});

export const deleteItemAsync = jest.fn(async (key) => {
  delete storage[key];
});

export const isAvailableAsync = jest.fn(() => Promise.resolve(true));