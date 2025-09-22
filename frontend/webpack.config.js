const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');

const isDev = process.env.NODE_ENV !== 'production';

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: path.resolve(__dirname, 'src/index.jsx'),
  output: {
    filename: isDev ? 'js/bundle.js' : 'js/[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/' // root so devServer can serve HMR correctly
  },
  devtool: isDev ? 'eval-source-map' : 'source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.json']
  },
  module: {
    rules: [
      {
        test: /\.jsx?$/,
        exclude: /node_modules/,
        use: {
          loader: 'babel-loader',
          options: {
            cacheDirectory: true,
            plugins: [isDev && require.resolve('react-refresh/babel')].filter(Boolean),
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }]
            ]
          }
        }
      },
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      },
      {
        test: /\.(png|jpg|jpeg|gif|svg|ico)$/i,
        type: 'asset',
        parser: { dataUrlCondition: { maxSize: 10 * 1024 } }
      },
      {
        test: /\.(wasm)$/,
        type: 'asset/resource'
      }
    ]
  },
  experiments: {
    asyncWebAssembly: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
      inject: 'body'
    }),
    isDev && new ReactRefreshWebpackPlugin()
  ].filter(Boolean),
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'public'),
      watch: true
    },
    host: '0.0.0.0',
    hot: true,
    port: 3000,
    https: true,
    historyApiFallback: true,
    client: {
      overlay: true,
      logging: 'info',
      progress: true
    },
    allowedHosts: 'all'
  }
};
