// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require('eslint-config-expo/flat');
const prettierConfig = require('eslint-config-prettier');
const globals = require('globals');

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ['dist/*'],
  },
  // Gün 37: Jest testleri (__tests__/) ve jest.setup.js describe/it/expect/
  // jest gibi global'leri kullanıyor - bunlar için ayrı bir eslint-plugin-jest
  // kurmak yerine (henüz sadece birkaç test dosyası var) 'globals' paketinin
  // hazır jest seti kullanıldı, eslint-config-expo zaten transitive olarak
  // içeriyor.
  {
    files: ['__tests__/**/*.ts', 'jest.setup.js'],
    languageOptions: {
      globals: globals.jest,
    },
  },
]);
