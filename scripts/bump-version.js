#!/usr/bin/env node
/**
 * Usage: npm run bump-version -- 1.0.1
 *
 * Updates:
 *   - package.json        → version
 *   - app.json            → expo.version
 *   - android/app/build.gradle → versionName + versionCode
 *
 * versionCode is derived from semver: major*10000 + minor*100 + patch
 * e.g. 1.2.3 → 10203
 */

const fs = require('fs')
const path = require('path')

// ── Parse argument ────────────────────────────────────────────────────────────

const version = process.argv[2]

if (!version) {
    console.error('Usage: npm run bump-version -- <version>')
    console.error('Example: npm run bump-version -- 1.0.1')
    process.exit(1)
}

const semver = version.match(/^(\d+)\.(\d+)\.(\d+)$/)
if (!semver) {
    console.error(`Invalid version format: "${version}". Expected x.y.z (e.g. 1.0.1)`)
    process.exit(1)
}

const [, major, minor, patch] = semver.map(Number)
const versionCode = major * 10000 + minor * 100 + patch

console.log(`\nBumping version → ${version} (versionCode: ${versionCode})\n`)

const root = path.resolve(__dirname, '..')

// ── package.json ──────────────────────────────────────────────────────────────

const pkgPath = path.join(root, 'package.json')
const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))
const prevPkg = pkg.version
pkg.version = version
fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
console.log(`  package.json       ${prevPkg} → ${version}`)

// ── app.json ──────────────────────────────────────────────────────────────────

const appJsonPath = path.join(root, 'app.json')
const appJson = JSON.parse(fs.readFileSync(appJsonPath, 'utf8'))
const prevAppJson = appJson.expo.version
appJson.expo.version = version
fs.writeFileSync(appJsonPath, JSON.stringify(appJson, null, 2) + '\n')
console.log(`  app.json           ${prevAppJson} → ${version}`)

// ── android/app/build.gradle ──────────────────────────────────────────────────

const gradlePath = path.join(root, 'android', 'app', 'build.gradle')
let gradle = fs.readFileSync(gradlePath, 'utf8')

const prevVersionCode = (gradle.match(/versionCode\s+(\d+)/) || [])[1]
const prevVersionName = (gradle.match(/versionName\s+"([^"]+)"/) || [])[1]

gradle = gradle.replace(/versionCode\s+\d+/, `versionCode ${versionCode}`)
gradle = gradle.replace(/versionName\s+"[^"]+"/, `versionName "${version}"`)

fs.writeFileSync(gradlePath, gradle)
console.log(`  build.gradle       versionCode ${prevVersionCode} → ${versionCode}`)
console.log(`  build.gradle       versionName "${prevVersionName}" → "${version}"`)

console.log('\nDone.\n')
