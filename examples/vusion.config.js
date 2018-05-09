const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');

module.exports = {
    version: '>=0.6.0',
    type: 'app',
    extractCSS: true,
    libraryPath: './src/components',
    webpack: {
        entry: {
            vendor: 'babel-polyfill',
            bundle: './src/views/index.js',
        },
        resolve: {
            alias: {
                '@': path.resolve(__dirname, './src'),
                'vue-schema': path.resolve(__dirname, '../'),
            },
        },
        plugins: [
            new HtmlWebpackPlugin({ filename: 'index.html', hash: true, template: './src/views/index.html', chunks: ['vendor', 'bundle'] }),
        ],
    },
};
