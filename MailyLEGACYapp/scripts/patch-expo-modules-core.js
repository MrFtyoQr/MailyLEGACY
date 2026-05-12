/**
 * patch-expo-modules-core.js
 * --------------------------
 * expo-modules-core 2.x tenía "main": "src/index.ts" que rompía
 * el arranque en Node 20. En 3.x (SDK 54+) ya no es necesario,
 * pero el script es inofensivo y aplica el fix si volvemos a 2.x.
 */

const fs   = require('fs')
const path = require('path')

const pkgPath = path.join(
  __dirname, '..', 'node_modules', 'expo-modules-core', 'package.json',
)

if (!fs.existsSync(pkgPath)) {
  process.exit(0)
}

const pkg = JSON.parse(fs.readFileSync(pkgPath, 'utf8'))

// Solo parchear si está apuntando a .ts Y existe el stub index.js
const stubPath = path.join(path.dirname(pkgPath), 'index.js')
if (pkg.main === 'src/index.ts' && fs.existsSync(stubPath)) {
  pkg.main = 'index.js'
  fs.writeFileSync(pkgPath, JSON.stringify(pkg, null, 2) + '\n')
  console.log('[patch] expo-modules-core: main corregido src/index.ts → index.js')
}
