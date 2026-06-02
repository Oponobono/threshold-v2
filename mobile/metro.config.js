const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// Disable strict package exports to prevent warnings for older packages like whisper.rn
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
