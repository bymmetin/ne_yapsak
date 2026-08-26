// Gün 37: ThemeContext.tsx her ekranda dolaylı olarak AsyncStorage'ı import
// ediyor - Jest'in native ortamı olmadığı için paketin kendi resmi mock'u
// (react-native-async-storage.github.io/async-storage/docs/advanced/jest)
// global olarak burada kuruluyor, her test dosyasında tekrarlamaya gerek
// kalmasın diye.
jest.mock('@react-native-async-storage/async-storage', () =>
  require('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);
