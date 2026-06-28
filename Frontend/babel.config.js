module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@components': './src/components',
            '@styles': './src/styles',
            '@services': './src/services',
            '@utils': './src/utils',
            '@assets': './assets',
          },
        },
      ],
    ],
  };
};