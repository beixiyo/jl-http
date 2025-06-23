#!/usr/bin/env node
/* eslint-disable ts/no-require-imports */
import type { Config } from '@/tools/defineConfig'
import { rm, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { esmTocjs, genType, writeTempFile } from './tools'

const tempPath = 'node_modules/@jl-org/.http'
const tempFile = 'temp.cjs'
const filename = resolve(process.cwd(), `${tempPath}/${tempFile}`)

parseCommand()

function parseCommand() {
  const { input, output } = getSrc()
  const cjsCode = esmTocjs(input)
  writeTempFile(cjsCode, tempPath, tempFile)

  const config = require(filename)
  const content = genCode(config)

  writeFileSync(output, content, 'utf-8')
  rm(filename, () => { })
}

function getSrc() {
  const [_, __, input, output] = process.argv
  return {
    input: resolve(process.cwd(), input || ''),
    output: resolve(process.cwd(), output || ''),
  }
}

function genCode(config: Config) {
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
    config.fns?.forEach((item) => {
      if (Object.keys(item).length <= 0)
        return
      enter()
      tab()
      const type = genType(item.args)
      code += item.comment
        ? `/** ${item.comment} */\n\t`
        : ''
      code += `static ${item.isAsync
        ? 'async '
        : ''}${item.name}(${type
        ? `data: ${type}`
        : ''}) {`

      enter()
      tab()
      tab()
      if (['get', 'head'].includes(item.method)) {
        code += `return ${requestFnName}.${item.method}('${item.url}'${type
          ? `, { query: data }`
          : ''})`
      }
      else {
        code += `return ${requestFnName}.${item.method}('${item.url}'${type
          ? `, data`
          : ''})`
      }
      enter()

      tab()
      code += '}'
      enter()
    })
  }
}
