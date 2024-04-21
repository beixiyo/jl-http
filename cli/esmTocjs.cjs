const { writeFileSync, existsSync, readFileSync, mkdirSync } = require('node:fs')
const { resolve } = require('node:path')


function esmTocjs(path) {
    const content = readFileSync(path, 'utf-8')
    const reg = /import\s*\{\s*(.*?)\s*\}\s*from\s*['"](.*?)['"]/g

    return content
        .replace(reg, (_match, fn, path) => {
            return `const { ${fn} } = require('${path}')`
        })
        .replace(/export default/g, 'module.exports =')
}

function writeTempFile(cjsCode, tempPath, tempFile) {
    createDir(tempPath)
    writeFileSync(resolve(process.cwd(), `${tempPath}/${tempFile}`), cjsCode, 'utf-8')
}

function createDir(dir) {
    if (!existsSync(dir)) {
        mkdirSync(dir, { recursive: true })
    }
}

module.exports = {
    esmTocjs,
    writeTempFile,
}