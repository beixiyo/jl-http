#!/usr/bin/env node
const { writeFileSync } = require('node:fs')
const { resolve } = require('node:path')
const genType = require('./genType.cjs')


parseCommand()

function parseCommand() {
    const { input, output } = getSrc()
    const config = require(input)
    const content = genCode(config)

    writeFileSync(output, content, 'utf-8')
}

function getSrc() {
    const [_, __, input, output] = process.argv
    return {
        input: resolve(process.cwd(), input || ''),
        output: resolve(process.cwd(), output || ''),
    }
}

function genCode(config) {
    let code = ''
    const { importPath = '', requestFnName, className } = config

    code += importPath
    enter()
    enter()

    code += `export class ${className} {`
    enter()

    genServiceCode()
    enter()
    code += '}'

    return code


    function enter() {
        code += '\n'
    }
    function tab() {
        code += '    '
    }

    function genServiceCode() {
        config.fns.forEach((item) => {
            enter()
            tab()
            const type = genType(item.args)
            code += `static ${item.isAsync ? 'async ' : ''}${item.name}(data: ${type}) {`

            enter()
            tab()
            tab()
            code += `return ${requestFnName}.${item.method}(data)`
            enter()

            tab()
            code += '}'
            enter()
        })
    }
}
