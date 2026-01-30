const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
// Prevent Metro from resolving files in the server directory
config.resolver.blockList = [
    // Block any path containing /server/ (or platform specific)
    /.*\/server\/.*/,
];
module.exports = config;