// Décor animé (react-native-svg + reanimated) : sans intérêt dans les tests d'écrans.
jest.mock('@/components/brand/ThreadBackground', () => ({ ThreadBackground: () => null }));
