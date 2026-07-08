/**
 * Suite rápida de insignias de nivel — sin simulador ni registro de vitales.
 * Ejecutar: npm run test:levels
 */

import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import {
  MAX_LEVEL,
  LEVEL_META_TEXT,
  LEVEL_THRESHOLDS,
  clampLevel,
  getLevelProgress,
} from '../src/constants/levelBadgeData'
import { formatEarnedDate } from '../src/lib/gamification/formatEarnedDate'
import { decideLevelCelebration } from '../src/lib/gamification/levelCelebrationLogic'

const ASSETS_DIR = path.join(__dirname, '../assets/images/levels')

function testMetaCompleteness() {
  assert.equal(MAX_LEVEL, 10)
  assert.ok(LEVEL_THRESHOLDS.length >= MAX_LEVEL, 'faltan umbrales de nivel')

  for (let level = 1; level <= MAX_LEVEL; level++) {
    const meta = LEVEL_META_TEXT[level]
    assert.ok(meta, `falta LEVEL_META_TEXT[${level}]`)
    assert.equal(meta.level, level)
    assert.ok(meta.name.length > 0, `nombre vacío nivel ${level}`)
    assert.ok(meta.phrase.length > 0, `frase vacía nivel ${level}`)
    assert.ok(meta.accent.startsWith('#'), `accent inválido nivel ${level}`)

    const imagePath = path.join(ASSETS_DIR, `nivel-${level}.png`)
    assert.ok(fs.existsSync(imagePath), `falta imagen ${imagePath}`)
  }
}

function testThresholdsAscending() {
  for (let i = 1; i < LEVEL_THRESHOLDS.length; i++) {
    assert.ok(
      LEVEL_THRESHOLDS[i] > LEVEL_THRESHOLDS[i - 1],
      `umbral no ascendente en índice ${i}`,
    )
  }
}

function testClampLevel() {
  assert.equal(clampLevel(0), 1)
  assert.equal(clampLevel(99), MAX_LEVEL)
  assert.equal(clampLevel(3.7), 4)
}

function testGetLevelProgress() {
  const mid = getLevelProgress(350, 2)
  assert.ok(mid.pct > 0 && mid.pct < 1)
  assert.ok(mid.needed > 0)

  const max = getLevelProgress(999_999, MAX_LEVEL)
  assert.equal(max.pct, 1)
  assert.equal(max.needed, 0)
}

function testFormatEarnedDate() {
  const formatted = formatEarnedDate('2026-07-07T12:00:00.000Z')
  assert.match(formatted, /2026/)
  assert.match(formatted, /julio/i)
}

function testCelebrationLogic() {
  assert.deepEqual(decideLevelCelebration(3, null), { action: 'init', level: 3 })
  assert.deepEqual(decideLevelCelebration(3, 'abc'), { action: 'init', level: 3 })
  assert.deepEqual(decideLevelCelebration(5, '4'), { action: 'celebrate', level: 5 })
  assert.deepEqual(decideLevelCelebration(3, '5'), { action: 'noop' })
  assert.deepEqual(decideLevelCelebration(3, '3'), { action: 'noop' })
}

const tests = [
  ['metadatos completos', testMetaCompleteness],
  ['umbrales ascendentes', testThresholdsAscending],
  ['clampLevel', testClampLevel],
  ['progreso de nivel', testGetLevelProgress],
  ['formatEarnedDate', testFormatEarnedDate],
  ['lógica de celebración', testCelebrationLogic],
] as const

let passed = 0
for (const [name, fn] of tests) {
  fn()
  passed++
  console.log(`  ✓ ${name}`)
}

console.log(`\n${passed}/${tests.length} pruebas de insignias OK`)
