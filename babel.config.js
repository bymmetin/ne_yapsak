// Gün 37: Jest (jest-expo preset) projede babel.config.js olmadan JSX/TS'i
// dönüştüremiyor - Metro şimdiye kadar bunsuz çalışıyordu çünkü kendi
// varsayılan babel-preset-expo fallback'ini kullanıyordu, ama babel-jest bu
// fallback'e sahip değil, projenin kök dizininde açık bir babel config
// arıyor.
module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
  };
};
