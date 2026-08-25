module.exports = {
  testEnvironment: 'node',
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react-jsx',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
      }
    }],
    '^.+\\.jsx?$': 'babel-jest'
  },
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  testMatch: ['**/?(*.)+(spec|test).ts?(x)'],
  transformIgnorePatterns: [
    'node_modules/(?!(expo-sqlite|@expo|uuid|react-native-get-random-values|react-native)/)'
  ],
  globals: {
    __DEV__: true
  }
};
