const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require('nativewind/metro');
const config = getDefaultConfig(__dirname);

// Prevent Metro from resolving files in the server directory
config.resolver.blockList = [
    /.*\/server\/.*/,
    /.*\\server\\.*/,
];

module.exports = withNativeWind(config, { input: './global.css' });
