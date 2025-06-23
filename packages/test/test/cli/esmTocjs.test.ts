import { esmTocjs, writeTempFile } from '@jl-org/http'
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

// Mock fs functions
vi.mock('node:fs', () => ({
  readFileSync: vi.fn(),
  writeFileSync: vi.fn(),
  existsSync: vi.fn(),
  mkdirSync: vi.fn(),
  rmSync: vi.fn(),
}))

vi.mock('node:path', () => ({
  resolve: vi.fn(),
}))

const mockReadFileSync = vi.mocked(readFileSync)
const mockWriteFileSync = vi.mocked(writeFileSync)
const mockExistsSync = vi.mocked(existsSync)
const mockMkdirSync = vi.mocked(mkdirSync)
const mockResolve = vi.mocked(resolve)

describe('esmTocjs', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('esmTocjs 函数', () => {
    it('应该将 ES6 import 转换为 CommonJS require', () => {
      const esmCode = `import { defineConfig } from '@jl-org/http'
import { Http } from '@jl-org/http'

export default defineConfig({
  importPath: 'import { Http } from "@jl-org/http"',
  className: 'UserApi',
  requestFnName: 'http',
  fns: []
})`

      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toContain('const { defineConfig } = require(\'@jl-org/http\')')
      expect(result).toContain('const { Http } = require(\'@jl-org/http\')')
      expect(result).toContain('module.exports =')
      expect(result).not.toContain('import {')
      expect(result).not.toContain('export default')
    })

    it('应该处理单个导入', () => {
      const esmCode = `import { defineConfig } from '@jl-org/http'`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toBe('const { defineConfig } = require(\'@jl-org/http\')')
    })

    it('应该处理多个导入', () => {
      const esmCode = `import { defineConfig, Http, BaseReq } from '@jl-org/http'`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toBe('const { defineConfig, Http, BaseReq } = require(\'@jl-org/http\')')
    })

    it('应该处理带空格的导入', () => {
      const esmCode = `import {  defineConfig  ,  Http  } from  '@jl-org/http'`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toBe('const {  defineConfig  ,  Http  } = require(\'@jl-org/http\')')
    })

    it('应该处理双引号的导入', () => {
      const esmCode = `import { defineConfig } from "@jl-org/http"`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toBe('const { defineConfig } = require("@jl-org/http")')
    })

    it('应该处理多行导入', () => {
      const esmCode = `import { defineConfig } from '@jl-org/http'
import { Http } from '@jl-org/http'
import { BaseReq } from '@jl-org/http'`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      const lines = result.split('\n')
      expect(lines[0]).toBe('const { defineConfig } = require(\'@jl-org/http\')')
      expect(lines[1]).toBe('const { Http } = require(\'@jl-org/http\')')
      expect(lines[2]).toBe('const { BaseReq } = require(\'@jl-org/http\')')
    })

    it('应该处理 export default', () => {
      const esmCode = `export default defineConfig({
  className: 'TestApi'
})`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toBe(`module.exports = defineConfig({
  className: 'TestApi'
})`)
    })

    it('应该同时处理 import 和 export default', () => {
      const esmCode = `import { defineConfig } from '@jl-org/http'

export default defineConfig({
  className: 'TestApi'
})`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toBe(`const { defineConfig } = require('@jl-org/http')

module.exports = defineConfig({
  className: 'TestApi'
})`)
    })

    it('应该处理复杂的配置文件', () => {
      const esmCode = `import { defineConfig } from '@jl-org/http'
import type { Config } from '@jl-org/http'

const config: Config = {
  importPath: 'import { Http } from "@jl-org/http"',
  className: 'UserApi',
  requestFnName: 'http',
  fns: [
    {
      name: 'getUser',
      url: '/user/:id',
      method: 'get',
      comment: '获取用户信息'
    }
  ]
}

export default defineConfig(config)`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toContain('const { defineConfig } = require(\'@jl-org/http\')')
      expect(result).toContain('module.exports = defineConfig(config)')
      expect(result).not.toContain('import {')
      expect(result).not.toContain('export default')
    })

    it('应该保留非 import/export 的代码', () => {
      const esmCode = `import { defineConfig } from '@jl-org/http'

const apiUrl = 'https://api.example.com'
const timeout = 5000

export default defineConfig({
  className: 'TestApi',
  requestFnName: 'http'
})`
      mockReadFileSync.mockReturnValue(esmCode)

      const result = esmTocjs('test.ts')

      expect(result).toContain('const apiUrl = \'https://api.example.com\'')
      expect(result).toContain('const timeout = 5000')
    })
  })

  describe('writeTempFile 函数', () => {
    it('应该创建目录并写入文件', () => {
      const cjsCode = 'const { defineConfig } = require("@jl-org/http")'
      const tempPath = 'node_modules/@jl-org/.http'
      const tempFile = 'temp.cjs'
      const expectedPath = '/resolved/path/node_modules/@jl-org/.http/temp.cjs'

      mockExistsSync.mockReturnValue(false)
      mockResolve.mockReturnValue(expectedPath)

      writeTempFile(cjsCode, tempPath, tempFile)

      expect(mockMkdirSync).toHaveBeenCalledWith(tempPath, { recursive: true })
      expect(mockWriteFileSync).toHaveBeenCalledWith(expectedPath, cjsCode, 'utf-8')
    })

    it('应该在目录已存在时跳过创建', () => {
      const cjsCode = 'const { defineConfig } = require("@jl-org/http")'
      const tempPath = 'node_modules/@jl-org/.http'
      const tempFile = 'temp.cjs'

      mockExistsSync.mockReturnValue(true)
      mockResolve.mockReturnValue('/resolved/path')

      writeTempFile(cjsCode, tempPath, tempFile)

      expect(mockMkdirSync).not.toHaveBeenCalled()
      expect(mockWriteFileSync).toHaveBeenCalled()
    })

    it('应该处理嵌套目录路径', () => {
      const cjsCode = 'test code'
      const tempPath = 'deep/nested/path'
      const tempFile = 'file.js'

      mockExistsSync.mockReturnValue(false)
      mockResolve.mockReturnValue('/resolved/deep/nested/path/file.js')

      writeTempFile(cjsCode, tempPath, tempFile)

      expect(mockMkdirSync).toHaveBeenCalledWith(tempPath, { recursive: true })
    })
  })

  describe('边界情况', () => {
    it('应该处理空文件', () => {
      mockReadFileSync.mockReturnValue('')

      const result = esmTocjs('empty.ts')

      expect(result).toBe('')
    })

    it('应该处理没有 import/export 的文件', () => {
      const code = `const test = 'hello'
console.log(test)`
      mockReadFileSync.mockReturnValue(code)

      const result = esmTocjs('plain.ts')

      expect(result).toBe(code)
    })

    it('应该处理注释中的 import/export', () => {
      const code = `// import { test } from 'module'
/* export default something */
const real = 'code'`
      mockReadFileSync.mockReturnValue(code)

      const result = esmTocjs('commented.ts')

      expect(result).toBe(code) // 注释不应该被转换
    })

    it('应该处理字符串中的 import/export', () => {
      const code = `const str = "import { test } from 'module'"
const str2 = 'export default value'`
      mockReadFileSync.mockReturnValue(code)

      const result = esmTocjs('strings.ts')

      expect(result).toBe(code) // 字符串中的不应该被转换
    })
  })
})
