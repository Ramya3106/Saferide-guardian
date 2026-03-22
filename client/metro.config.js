const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);

// Prevent Metro from resolving files in the server directory
config.resolver.blockList = [
    /.*\/server\/.*/,
    /.*\\server\\.*/,
];

module.exports = config;
