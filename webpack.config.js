const path = require('path');

module.exports = {
    entry: {
        app: './index.ts',
    },
    output: {
        path: path.resolve(__dirname, './dist/'),
        filename: '[name].js',
        library: 'VueSchema',
        libraryTarget: 'umd',
    },
    resolve: {
        extensions: ['.js', '.ts', '.vue', '.json'],
        alias: {
            vue$: 'vue/dist/vue.common.js',
            src: path.resolve(__dirname, './src'),
        },
    },
    module: {
        rules: [
            {
                test: /\.tsx?$/,
                loader: 'ts-loader',
                exclude: /node_modules/,
            },
        ],
    },
};
