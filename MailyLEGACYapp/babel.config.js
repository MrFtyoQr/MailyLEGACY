module.exports = function (api) {
  api.cache(true)
  return {
    presets: [
      ['babel-preset-expo', { jsxImportSource: 'nativewind' }],
      'nativewind/babel',
    ],
    plugins: [
      [
        'module-resolver',
        {
          root: ['./'],
          alias: {
            '@': './src',
            '@constants': './src/constants',
            '@lib': './src/lib',
            '@store': './src/store',
            '@hooks': './src/hooks',
            '@schemas': './src/schemas',
            '@components': './src/components',
          },
        },
      ],
      'react-native-reanimated/plugin', // must be last
    ],
  }
}
