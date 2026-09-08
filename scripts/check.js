const fs = require('fs')
const path = require('path')
const cp = require('child_process')
const { createHarness } = require('../tests/page-harness')
const root = path.resolve(__dirname, '..')
const files = []
function walk(dir) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (['node_modules', '.git', 'artifacts', 'docs', 'tests', 'scripts'].includes(entry.name)) continue
    const full = path.join(dir, entry.name)
    if (entry.isDirectory()) walk(full); else files.push(path.relative(root, full).replace(/\\/g, '/'))
  }
}
walk(root)
const failures = []; let handlers = 0
for (const file of files) {
  const source = fs.readFileSync(path.join(root, file), 'utf8')
  if (file.endsWith('.js')) {
    const result = cp.spawnSync(process.execPath, ['--check', file], { cwd: root, encoding: 'utf8' })
    if (result.status) failures.push(result.stderr)
  }
  if (file.endsWith('.json')) { try { JSON.parse(source) } catch (err) { failures.push(file + ': ' + err.message) } }
  if (file.endsWith('.wxml')) {
    // Tags may span lines; quoted attribute values may not.
    for (const match of source.matchAll(/(?:^|\s)[\w:-]+\s*=\s*(["'])([\s\S]*?)\1/g)) if (/\r|\n/.test(match[2])) failures.push(file + ': multiline attribute ' + match[0])
    const js = file.replace('.wxml', '.js')
    const h = createHarness()
    const definition = h.page(js)
    const methods = definition.methods || definition
    for (const match of source.matchAll(/(?:bind|catch)(?::)?[\w-]+="([A-Za-z]\w*)"/g)) {
      handlers++
      if (typeof methods[match[1]] !== 'function') failures.push(file + ': missing handler ' + match[1])
    }
  }
}
const app = JSON.parse(fs.readFileSync(path.join(root, 'app.json'), 'utf8'))
for (const page of app.pages) for (const ext of ['js', 'json', 'wxml', 'wxss']) if (!fs.existsSync(path.join(root, page + '.' + ext))) failures.push('Missing page file: ' + page + '.' + ext)
const compilerRoot = process.env.WECHAT_COMPILER_DIR || 'D:/微信web开发者工具/code/package.nw/node_modules/wcc-exec'
const compilation = {}
for (const [ext, executable] of [['wxml', 'wcc.exe'], ['wxss', 'wcsc.exe']]) {
  const exe = path.join(compilerRoot, executable)
  if (!fs.existsSync(exe)) { compilation[ext] = 'NOT VERIFIED: compiler not found'; continue }
  const result = cp.spawnSync(exe, files.filter(f => f.endsWith('.' + ext)), { cwd: root, encoding: 'utf8', maxBuffer: 30 * 1024 * 1024 })
  compilation[ext] = { status: result.status, diagnostics: result.stderr }
  if (result.status !== 0) failures.push(ext + ': ' + result.stderr)
}
const report = { pages: app.pages.length, js: files.filter(f => f.endsWith('.js')).length, handlers, compilation, failures }
fs.mkdirSync(path.join(root, 'artifacts'), { recursive: true })
fs.writeFileSync(path.join(root, 'artifacts/static-check.json'), JSON.stringify(report, null, 2))
console.log(JSON.stringify(report, null, 2))
process.exitCode = failures.length ? 1 : 0
