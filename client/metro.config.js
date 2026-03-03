<<<<<<< HEAD
const { getDefaultConfig } = require("expo/metro-config");

module.exports = getDefaultConfig(__dirname);
=======
const { getDefaultConfig } = require('expo/metro-config');
const path = require('path');
const config = getDefaultConfig(__dirname);
// Prevent Metro from resolving files in the server directory
config.resolver.blockList = [
    // Block any path containing /server/ (or platform specific)
    /.*\/server\/.*/,
];
module.exports = config;
>>>>>>> 92f4d8f1e561eb499056d6654fec148d8137ec02
