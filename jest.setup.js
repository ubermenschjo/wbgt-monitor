const mockSetWidgetData = jest.fn();

jest.mock('expo-modules-core', () => {
  const actual = jest.requireActual('expo-modules-core');
  return {
    ...actual,
    requireOptionalNativeModule: jest.fn((name) => {
      if (name === 'ExpoWidgets') {
        return { setWidgetData: mockSetWidgetData };
      }
      return null;
    }),
  };
});

jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

jest.mock('@bittingz/expo-widgets', () => ({
  setWidgetData: mockSetWidgetData,
}));

jest.mock('expo-sqlite', () => ({
  openDatabaseAsync: jest.fn(),
}));
