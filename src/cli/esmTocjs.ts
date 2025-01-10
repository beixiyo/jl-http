import { writeFileSync, existsSync, readFileSync, mkdirSync } from 'node:fs'
import { resolve } from 'node:path'


export function esmTocjs(path: string) {
  const content = readFileSync(path, 'utf-8')
  const reg = /import\s*\{\s*(.*?)\s*\}\s*from\s*['"](.*?)['"]/g

  return content
    .replace(reg, (_match: string, fn: string, path: string) => {
      return `const { ${fn} } = require('${path}')`
    })
    .replace(/export default/g, 'module.exports =')
}

export function writeTempFile(cjsCode: string, tempPath: string, tempFile: string) {
  createDir(tempPath)
  writeFileSync(resolve(process.cwd(), `${tempPath}/${tempFile}`), cjsCode, 'utf-8')
}

function createDir(dir: string) {
  if (!existsSync(dir)) {
    mkdirSync(dir, { recursive: true })
  }
}
