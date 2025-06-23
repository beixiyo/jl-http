#!/usr/bin/env node

/**
 * 运行所有测试的脚本
 * 用于验证整个测试套件的完整性
 */

import { spawn } from 'node:child_process'
import { resolve } from 'node:path'

const testCategories = [
  {
    name: '工具函数测试',
    command: 'pnpm vitest run test/tools --no-coverage',
    description: '测试基础工具函数、重试机制、并发任务、SSE 流处理等',
  },
  {
    name: '核心功能测试',
    command: 'pnpm vitest run test/core --no-coverage',
    description: '测试 BaseReq 和 Http 类的核心功能',
  },
  {
    name: 'CLI 工具测试',
    command: 'pnpm vitest run test/cli --no-coverage',
    description: '测试命令行工具功能',
  },
  {
    name: '集成测试',
    command: 'pnpm vitest run test/integration --no-coverage',
    description: '测试各模块的协同工作',
  },
]

async function runCommand(command, cwd = process.cwd()) {
  return new Promise((resolve, reject) => {
    console.log(`\n🚀 执行命令: ${command}`)
    console.log(`📁 工作目录: ${cwd}`)
    
    const [cmd, ...args] = command.split(' ')
    const child = spawn(cmd, args, {
      cwd,
      stdio: 'inherit',
      shell: true,
    })

    child.on('close', (code) => {
      if (code === 0) {
        console.log(`✅ 命令执行成功`)
        resolve(code)
      } else {
        console.log(`❌ 命令执行失败，退出码: ${code}`)
        reject(new Error(`Command failed with exit code ${code}`))
      }
    })

    child.on('error', (error) => {
      console.error(`❌ 命令执行出错:`, error)
      reject(error)
    })
  })
}

async function runAllTests() {
  console.log('🧪 开始运行 jl-http 测试套件')
  console.log('=' .repeat(60))

  const results = []
  let totalPassed = 0
  let totalFailed = 0

  for (const category of testCategories) {
    console.log(`\n📋 ${category.name}`)
    console.log(`📝 ${category.description}`)
    console.log('-'.repeat(40))

    try {
      const startTime = Date.now()
      await runCommand(category.command)
      const duration = Date.now() - startTime
      
      results.push({
        name: category.name,
        status: 'success',
        duration,
      })
      totalPassed++
      
      console.log(`✅ ${category.name} 完成 (${duration}ms)`)
    } catch (error) {
      results.push({
        name: category.name,
        status: 'failed',
        error: error.message,
      })
      totalFailed++
      
      console.log(`❌ ${category.name} 失败: ${error.message}`)
    }
  }

  // 生成最终报告
  console.log('\n' + '='.repeat(60))
  console.log('📊 测试套件执行总结')
  console.log('='.repeat(60))

  results.forEach((result, index) => {
    const status = result.status === 'success' ? '✅' : '❌'
    const duration = result.duration ? ` (${result.duration}ms)` : ''
    console.log(`${index + 1}. ${status} ${result.name}${duration}`)
    if (result.error) {
      console.log(`   错误: ${result.error}`)
    }
  })

  console.log('\n📈 统计信息:')
  console.log(`✅ 成功: ${totalPassed}`)
  console.log(`❌ 失败: ${totalFailed}`)
  console.log(`📊 总计: ${totalPassed + totalFailed}`)

  if (totalFailed === 0) {
    console.log('\n🎉 所有测试类别都执行成功！')
    console.log('💡 建议运行 "pnpm test:coverage" 查看详细的覆盖率报告')
  } else {
    console.log('\n⚠️  有测试类别执行失败，请检查上述错误信息')
    process.exit(1)
  }
}

// 运行完整测试套件
async function runFullTestSuite() {
  console.log('\n🔄 运行完整测试套件（包含覆盖率）')
  console.log('-'.repeat(40))
  
  try {
    await runCommand('pnpm test:coverage')
    console.log('\n✅ 完整测试套件执行成功！')
    console.log('📄 查看 coverage/index.html 获取详细覆盖率报告')
  } catch (error) {
    console.log('\n❌ 完整测试套件执行失败')
    console.log('💡 可以尝试运行单独的测试类别来定位问题')
  }
}

// 主函数
async function main() {
  const args = process.argv.slice(2)
  
  if (args.includes('--help') || args.includes('-h')) {
    console.log(`
jl-http 测试套件运行器

用法:
  node run-all-tests.js [选项]

选项:
  --categories, -c    只运行分类测试（不包含覆盖率）
  --full, -f         运行完整测试套件（包含覆盖率）
  --help, -h         显示帮助信息

示例:
  node run-all-tests.js --categories  # 运行所有测试类别
  node run-all-tests.js --full        # 运行完整测试套件
  node run-all-tests.js               # 默认运行分类测试
`)
    return
  }

  try {
    if (args.includes('--full') || args.includes('-f')) {
      await runFullTestSuite()
    } else {
      await runAllTests()
      
      // 询问是否运行完整测试套件
      if (!args.includes('--categories') && !args.includes('-c')) {
        console.log('\n❓ 是否运行完整测试套件（包含覆盖率）？')
        console.log('💡 运行 "node run-all-tests.js --full" 或 "pnpm test:coverage"')
      }
    }
  } catch (error) {
    console.error('\n💥 执行过程中发生未预期的错误:', error)
    process.exit(1)
  }
}

main().catch(console.error)
