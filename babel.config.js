module.exports = function (api) {
  api.cache(true);
  return {
    presets: ['babel-preset-expo'],
    overrides: [
      {
        // Only transform private fields in plain JS files (NOT .ts/.tsx)
        // This avoids conflict with TypeScript's `declare` keyword
        test: /\.(js|jsx|mjs|cjs)$/,
        plugins: [
          ['@babel/plugin-transform-private-methods', { loose: true }],
          ['@babel/plugin-transform-private-property-in-object', { loose: true }],
        ],
      },
    ],
  };
};
