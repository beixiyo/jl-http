#!/usr/bin/env node

/**
 * 测试报告生成脚本
 * 用于生成详细的测试报告和覆盖率分析
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const __filename = fileURLToPath(import.meta.url)
const __dirname = dirname(__filename)

const REPORT_DIR = resolve(__dirname, '../test-results')
const COVERAGE_DIR = resolve(__dirname, '../coverage')

// 确保报告目录存在
if (!existsSync(REPORT_DIR)) {
  mkdirSync(REPORT_DIR, { recursive: true })
}

/**
 * 生成测试摘要报告
 */
function generateTestSummary() {
  const resultsPath = resolve(REPORT_DIR, 'results.json')
  
  if (!existsSync(resultsPath)) {
    console.warn('测试结果文件不存在，请先运行测试')
    return
  }

  try {
    const results = JSON.parse(readFileSync(resultsPath, 'utf-8'))
    
    const summary = {
      timestamp: new Date().toISOString(),
      testRun: {
        total: results.numTotalTests || 0,
        passed: results.numPassedTests || 0,
        failed: results.numFailedTests || 0,
        skipped: results.numPendingTests || 0,
        duration: results.testResults?.reduce((acc, test) => acc + (test.perfStats?.runtime || 0), 0) || 0,
      },
      testSuites: {
        total: results.numTotalTestSuites || 0,
        passed: results.numPassedTestSuites || 0,
        failed: results.numFailedTestSuites || 0,
      },
      coverage: getCoverageSummary(),
      details: {
        failedTests: getFailedTests(results),
        slowTests: getSlowTests(results),
        testsByCategory: getTestsByCategory(results),
      }
    }

    // 生成 JSON 报告
    writeFileSync(
      resolve(REPORT_DIR, 'summary.json'),
      JSON.stringify(summary, null, 2),
      'utf-8'
    )

    // 生成 Markdown 报告
    generateMarkdownReport(summary)

    console.log('✅ 测试报告生成完成')
    console.log(`📊 总测试数: ${summary.testRun.total}`)
    console.log(`✅ 通过: ${summary.testRun.passed}`)
    console.log(`❌ 失败: ${summary.testRun.failed}`)
    console.log(`⏭️  跳过: ${summary.testRun.skipped}`)
    console.log(`⏱️  耗时: ${(summary.testRun.duration / 1000).toFixed(2)}s`)

    if (summary.coverage) {
      console.log(`📈 代码覆盖率: ${summary.coverage.statements}%`)
    }

  } catch (error) {
    console.error('生成测试报告时出错:', error)
  }
}

/**
 * 获取覆盖率摘要
 */
function getCoverageSummary() {
  const coveragePath = resolve(COVERAGE_DIR, 'coverage-summary.json')
  
  if (!existsSync(coveragePath)) {
    return null
  }

  try {
    const coverage = JSON.parse(readFileSync(coveragePath, 'utf-8'))
    const total = coverage.total

    return {
      statements: total.statements.pct,
      branches: total.branches.pct,
      functions: total.functions.pct,
      lines: total.lines.pct,
      details: {
        statements: `${total.statements.covered}/${total.statements.total}`,
        branches: `${total.branches.covered}/${total.branches.total}`,
        functions: `${total.functions.covered}/${total.functions.total}`,
        lines: `${total.lines.covered}/${total.lines.total}`,
      }
    }
  } catch (error) {
    console.warn('读取覆盖率报告失败:', error.message)
    return null
  }
}

/**
 * 获取失败的测试
 */
function getFailedTests(results) {
  const failedTests = []
  
  if (results.testResults) {
    results.testResults.forEach(suite => {
      if (suite.assertionResults) {
        suite.assertionResults.forEach(test => {
          if (test.status === 'failed') {
            failedTests.push({
              suite: suite.name,
              test: test.title,
              error: test.failureMessages?.[0] || 'Unknown error',
              duration: test.duration || 0,
            })
          }
        })
      }
    })
  }
  
  return failedTests
}

/**
 * 获取慢测试
 */
function getSlowTests(results) {
  const slowTests = []
  
  if (results.testResults) {
    results.testResults.forEach(suite => {
      if (suite.assertionResults) {
        suite.assertionResults.forEach(test => {
          if (test.duration && test.duration > 1000) { // 超过1秒的测试
            slowTests.push({
              suite: suite.name,
              test: test.title,
              duration: test.duration,
            })
          }
        })
      }
    })
  }
  
  return slowTests.sort((a, b) => b.duration - a.duration).slice(0, 10) // 前10个最慢的测试
}

/**
 * 按类别分组测试
 */
function getTestsByCategory(results) {
  const categories = {
    unit: { total: 0, passed: 0, failed: 0 },
    integration: { total: 0, passed: 0, failed: 0 },
    cli: { total: 0, passed: 0, failed: 0 },
    tools: { total: 0, passed: 0, failed: 0 },
    core: { total: 0, passed: 0, failed: 0 },
  }
  
  if (results.testResults) {
    results.testResults.forEach(suite => {
      let category = 'unit' // 默认分类
      
      if (suite.name.includes('integration')) {
        category = 'integration'
      } else if (suite.name.includes('cli')) {
        category = 'cli'
      } else if (suite.name.includes('tools')) {
        category = 'tools'
      } else if (suite.name.includes('core')) {
        category = 'core'
      }
      
      if (suite.assertionResults) {
        suite.assertionResults.forEach(test => {
          categories[category].total++
          if (test.status === 'passed') {
            categories[category].passed++
          } else if (test.status === 'failed') {
            categories[category].failed++
          }
        })
      }
    })
  }
  
  return categories
}

/**
 * 生成 Markdown 报告
 */
function generateMarkdownReport(summary) {
  const markdown = `# jl-http 测试报告

## 📊 测试概览

- **生成时间**: ${new Date(summary.timestamp).toLocaleString('zh-CN')}
- **总测试数**: ${summary.testRun.total}
- **通过**: ${summary.testRun.passed} ✅
- **失败**: ${summary.testRun.failed} ❌
- **跳过**: ${summary.testRun.skipped} ⏭️
- **总耗时**: ${(summary.testRun.duration / 1000).toFixed(2)}s

## 📈 代码覆盖率

${summary.coverage ? `
| 类型 | 覆盖率 | 详情 |
|------|--------|------|
| 语句 | ${summary.coverage.statements}% | ${summary.coverage.details.statements} |
| 分支 | ${summary.coverage.branches}% | ${summary.coverage.details.branches} |
| 函数 | ${summary.coverage.functions}% | ${summary.coverage.details.functions} |
| 行数 | ${summary.coverage.lines}% | ${summary.coverage.details.lines} |
` : '覆盖率数据不可用'}

## 🏷️ 测试分类

| 分类 | 总数 | 通过 | 失败 | 通过率 |
|------|------|------|------|--------|
| 核心功能 | ${summary.details.testsByCategory.core.total} | ${summary.details.testsByCategory.core.passed} | ${summary.details.testsByCategory.core.failed} | ${summary.details.testsByCategory.core.total > 0 ? ((summary.details.testsByCategory.core.passed / summary.details.testsByCategory.core.total) * 100).toFixed(1) : 0}% |
| 工具函数 | ${summary.details.testsByCategory.tools.total} | ${summary.details.testsByCategory.tools.passed} | ${summary.details.testsByCategory.tools.failed} | ${summary.details.testsByCategory.tools.total > 0 ? ((summary.details.testsByCategory.tools.passed / summary.details.testsByCategory.tools.total) * 100).toFixed(1) : 0}% |
| 集成测试 | ${summary.details.testsByCategory.integration.total} | ${summary.details.testsByCategory.integration.passed} | ${summary.details.testsByCategory.integration.failed} | ${summary.details.testsByCategory.integration.total > 0 ? ((summary.details.testsByCategory.integration.passed / summary.details.testsByCategory.integration.total) * 100).toFixed(1) : 0}% |
| CLI 工具 | ${summary.details.testsByCategory.cli.total} | ${summary.details.testsByCategory.cli.passed} | ${summary.details.testsByCategory.cli.failed} | ${summary.details.testsByCategory.cli.total > 0 ? ((summary.details.testsByCategory.cli.passed / summary.details.testsByCategory.cli.total) * 100).toFixed(1) : 0}% |
| 单元测试 | ${summary.details.testsByCategory.unit.total} | ${summary.details.testsByCategory.unit.passed} | ${summary.details.testsByCategory.unit.failed} | ${summary.details.testsByCategory.unit.total > 0 ? ((summary.details.testsByCategory.unit.passed / summary.details.testsByCategory.unit.total) * 100).toFixed(1) : 0}% |

${summary.details.failedTests.length > 0 ? `
## ❌ 失败的测试

${summary.details.failedTests.map(test => `
### ${test.suite} - ${test.test}

\`\`\`
${test.error}
\`\`\`

**耗时**: ${test.duration}ms
`).join('\n')}
` : ''}

${summary.details.slowTests.length > 0 ? `
## 🐌 慢测试 (>1s)

| 测试套件 | 测试名称 | 耗时 |
|----------|----------|------|
${summary.details.slowTests.map(test => `| ${test.suite} | ${test.test} | ${test.duration}ms |`).join('\n')}
` : ''}

## 📝 建议

${summary.testRun.failed > 0 ? '- ❗ 请修复失败的测试用例\n' : ''}
${summary.coverage && summary.coverage.statements < 85 ? '- 📈 建议提高代码覆盖率到85%以上\n' : ''}
${summary.details.slowTests.length > 0 ? '- ⚡ 优化慢测试的性能\n' : ''}
${summary.testRun.failed === 0 && (!summary.coverage || summary.coverage.statements >= 85) ? '- ✨ 测试质量良好，继续保持！\n' : ''}

---

*报告由 jl-http 测试工具自动生成*
`

  writeFileSync(
    resolve(REPORT_DIR, 'README.md'),
    markdown,
    'utf-8'
  )
}

// 运行报告生成
generateTestSummary()
