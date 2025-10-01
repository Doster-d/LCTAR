const path = require('path');
const HtmlWebpackPlugin = require('html-webpack-plugin');
const ReactRefreshWebpackPlugin = require('@pmmmwh/react-refresh-webpack-plugin');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const webpack = require('webpack');
const dotenv = require('dotenv');

const isDev = process.env.NODE_ENV === 'development';

const envResult = dotenv.config({ path: path.resolve(__dirname, '.env') });
const envVars = { ...envResult.parsed };
const defineEnv = {
  'process.env.API_URL': JSON.stringify(process.env.API_URL ?? envVars?.API_URL ?? ''),
};

module.exports = {
  mode: isDev ? 'development' : 'production',
  entry: path.resolve(__dirname, 'src/index.jsx'),
  output: {
    filename: isDev ? 'js/[name].js' : 'js/[contenthash].js',
    chunkFilename: isDev ? 'js/[name].js' : 'js/[contenthash].js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    publicPath: '/' // root so devServer can serve HMR correctly
  },
  devtool: isDev ? 'eval-source-map' : 'source-map',
  resolve: {
    extensions: ['.js', '.jsx', '.json'],
    fallback: {
      vm: require.resolve("vm-browserify"),
      crypto: require.resolve('crypto-browserify'),
      path: require.resolve('path-browserify'),
      fs: false,
      buffer: require.resolve('buffer/'),
      stream: require.resolve('stream-browserify')
    }
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
            presets: [
              ['@babel/preset-env', { targets: 'defaults' }],
              ['@babel/preset-react', { runtime: 'automatic' }]
            ],
            plugins: isDev ? (function() {
              return ['react-refresh/babel'];
            })() : (function() {
              return [];
            })()
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
  optimization: {
    splitChunks: {
      chunks: 'all',
      cacheGroups: {
        vendor: {
          test: /[\\/]node_modules[\\/]/,
          name: 'vendors',
          chunks: 'all',
          priority: 10
        },
        opencv: {
          test: /[\\/]node_modules[\\/]@techstark[\\/]opencv-js[\\/]/,
          name: 'opencv',
          chunks: 'all',
          priority: 20
        },
        three: {
          test: /[\\/]node_modules[\\/]three[\\/]/,
          name: 'three',
          chunks: 'all',
          priority: 20
        },
        reactThree: {
          test: /[\\/]node_modules[\\/]@react-three[\\/]/,
          name: 'react-three',
          chunks: 'all',
          priority: 20
        }
      }
    }
  },
  experiments: {
    asyncWebAssembly: true
  },
  plugins: [
    new HtmlWebpackPlugin({
      template: path.resolve(__dirname, 'public/index.html'),
      inject: 'body'
    }),
    new webpack.DefinePlugin(defineEnv),
    new CopyWebpackPlugin({
      patterns: [
        // Критически важные файлы
        { from: 'public/favicon.ico', to: 'favicon.ico' },
        { from: 'public/alva/alva_ar.js', to: 'alva/alva_ar.js' },
        { from: 'public/apriltag-config.json', to: 'apriltag-config.json' },
        { from: 'public/manifest.json', to: 'manifest.json' },
        { from: 'public/robots.txt', to: 'robots.txt' },

        // SVG маркеры AprilTag
        { from: 'public/tag36h11-0.svg', to: 'tag36h11-0.svg' },
        { from: 'public/tag36h11-1.svg', to: 'tag36h11-1.svg' },
        { from: 'public/tag36h11-2.svg', to: 'tag36h11-2.svg' },

        // Изображения с сохранением структуры папок
        { from: path.resolve(__dirname, 'public/img'), to: 'img', noErrorOnMissing: true },

        // Дополнительные модели
        { from: path.resolve(__dirname, 'public/models'), to: 'models', noErrorOnMissing: true },

        // Разработческие инструменты (опционально)
        { from: path.resolve(__dirname, 'public/dev-tools'), to: 'dev-tools', noErrorOnMissing: true },

        // Существующие файлы (сохранить)
        { from: 'public/apriltag_wasm.js', to: 'apriltag_wasm.js' },
        { from: 'public/apriltag_wasm.wasm', to: 'apriltag_wasm.wasm' }
      ]
    }),
    isDev && (function() {
      try {
        const plugin = new ReactRefreshWebpackPlugin({
          overlay: false, // Отключаем overlay чтобы избежать конфликтов
          disableRefreshCheck: true // Отключаем проверку для React 19
        });
        return plugin;
      } catch (error) {
        try {
          const fallbackPlugin = new ReactRefreshWebpackPlugin();
          return fallbackPlugin;
        } catch (fallbackError) {
          return null;
        }
      }
    })()
  ].filter(Boolean),
  devServer: {
    static: {
      directory: path.resolve(__dirname, 'public'),
      watch: true
    },
    host: '0.0.0.0',
    hot: true,
    port: 3000,
    server: { type: 'https' },
    historyApiFallback: true,
    client: {
      overlay: true,
      logging: 'info',
      progress: true
    },
    allowedHosts: 'all'
  }
};
