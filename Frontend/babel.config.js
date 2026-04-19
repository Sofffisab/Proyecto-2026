module.exports = function(api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      ['module-resolver', {
        alias: {
          '@': './src',
          '@components': './src/components',
          '@screens': './src/screens',
          '@services': './src/services',
          '@hooks': './src/hooks',
          '@utils': './src/utils',
          '@constants': './src/constants',
          '@assets': './src/assets',
          '@context': './src/context',
          '@navigation': './src/navigation',
        },
      }],
      'react-native-reanimated/plugin',
    ],
  };
};