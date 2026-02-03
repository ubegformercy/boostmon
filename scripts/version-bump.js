#!/usr/bin/env node

/**
 * Version Bump Utility
 * Automatically increments version numbers in version.json
 * 
 * Usage:
 *   npm run bump-patch    # 2.1.4 -> 2.1.5
 *   npm run bump-minor    # 2.1.4 -> 2.2.0
 *   npm run bump-major    # 2.1.4 -> 3.0.0
 *   node scripts/version-bump.js patch "Commit message"
 */

const fs = require('fs');
const path = require('path');

const versionFile = path.join(__dirname, '../version.json');

function readVersion() {
  try {
    const data = fs.readFileSync(versionFile, 'utf8');
    return JSON.parse(data);
  } catch (err) {
    console.error('Error reading version.json:', err.message);
    process.exit(1);
  }
}

function writeVersion(versionObj) {
  try {
    fs.writeFileSync(versionFile, JSON.stringify(versionObj, null, 2) + '\n');
    console.log(`✓ Version updated to ${versionObj.version}`);
  } catch (err) {
    console.error('Error writing version.json:', err.message);
    process.exit(1);
  }
}

function getVersionString(major, minor, patch) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(type = 'patch', description = '') {
  const version = readVersion();
  let { major, minor, patch } = version;

  switch (type.toLowerCase()) {
    case 'major':
      major++;
      minor = 0;
      patch = 0;
      break;
    case 'minor':
      minor++;
      patch = 0;
      break;
    case 'patch':
    default:
      patch++;
      break;
  }

  const newVersion = getVersionString(major, minor, patch);
  const updated = {
    major,
    minor,
    patch,
    version: newVersion,
    lastUpdated: new Date().toISOString(),
    description: description || `Bumped ${type} version`
  };

  writeVersion(updated);
  return newVersion;
}

// Get arguments
const args = process.argv.slice(2);
const bumpType = args[0] || 'patch';
const message = args.slice(1).join(' ');

console.log(`Bumping ${bumpType} version...`);
const newVersion = bumpVersion(bumpType, message);
console.log(`New version: ${newVersion}`);
