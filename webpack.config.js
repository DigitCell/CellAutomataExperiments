const webpack = require("webpack");
const path = require('path');
const CopyWebpackPlugin = require('copy-webpack-plugin');
const ZipPlugin = require('zip-webpack-plugin');
//const config = require("./webpack.config");
//const InjectHead = require("./plugins/InjectHead");
const HtmlWebpackPlugin = require("html-webpack-plugin")

module.exports = {
  mode: 'development',
  entry: './project/src/index.ts',
  devtool: 'source-map',
  
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname, 'dist'),
    clean: true,
    devtoolModuleFilenameTemplate: '[absolute-resource-path]'
  },


  module: {
    rules: [
        { test: /\.ts$/, loader: "ts-loader", exclude: /node_modules/ },
        {
          test: /\.wgsl$/,
          use: 'raw-loader',
        },
    ],
    
  },
  
  resolve: {
    extensions: [".js", ".ts"],
    modules: [path.resolve("./src"), path.resolve("./node_modules")],
    // Add the following line to include the @webgpu/types
    alias: {
      "@webgpu/types": path.resolve(__dirname, "path/to/@webgpu/types"),
    },
  },
  
  plugins: [
    new CopyWebpackPlugin({
      patterns: [
        //{ from: './project/public/index.html', to: '' },
        { from: './project/public/style.css', to: '' },
        { from: './project/static/favicon.ico', to: '' },
       // { from: './project/public/pg1112.txt', to: '' },
      ],
    }),
    new ZipPlugin({
      path: path.resolve(__dirname, 'dist'),
      filename: 'dist.zip'
    }),
    new HtmlWebpackPlugin({
      template: "./project/public/index.html",
      inject: "body",
      publicPath: "./",
      minify: false,
    })
  ],

};
