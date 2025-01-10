import type { RespData } from '@/types'

/** 获取类型 */
export const getType = (data: any) => (Object.prototype.toString.call(data) as string).slice(8, -1).toLowerCase()

/**
 * 深度比较对象 `Map | Set`无法使用
 * 支持循环引用比较
 */
export function deepCompare(o1: any, o2: any, seen = new WeakMap()) {
  if (Object.is(o1, o2)) {
    return true
  }

  if (JSON.stringify(o1) === JSON.stringify(o2)) {
    return true
  }

  /**
   * !isObj，说明是基本类型，上面直接比较过了
   * 主要是 WeakMap 的键不能是基本类型，为了避免报错
   */
  if (!isObj(o1) || !isObj(o2) || getType(o1) !== getType(o2)) {
    return false
  }

  /** 循环引用 */
  if (seen.has(o1) || seen.has(o2)) {
    return false
  }

  seen.set(o1, true)
  seen.set(o2, true)

  const keys1 = Object.keys(o1).concat(Object.getOwnPropertySymbols(o1) as any)
  const keys2 = Object.keys(o2).concat(Object.getOwnPropertySymbols(o2) as any)

  if (keys1.length !== keys2.length) {
    return false
  }

  for (const key of keys1) {
    /**
     * 键不同或者值不同
     */
    if (!keys2.includes(key) || !deepCompare((o1 as any)[key], (o2 as any)[key], seen)) {
      return false
    }
  }

  return true
}

export const isObj = (data: any): data is object =>
  typeof data === 'object' && data !== null

/**
 * 失败后自动重试请求
 * @param task 任务数组
 * @param maxCount 重试次数，默认 3
 */
export function retryReq<T>(
  task: () => Promise<T>,
  maxCount = 3
): Promise<T> {
  return task()
    .then(res => res)
    .catch(() => {
      return maxCount <= 0
        ? Promise.reject({ msg: '重试次数耗尽', code: 500 } as RespData)
        : retryReq(task, maxCount - 1)
    })
}

/**
 * 并发任务数组 完成最大并发数后才会继续
 * @param tasks 任务数组
 * @param maxCount 最大并发数，默认 4
 */
export function concurrentTask<T>(
  tasks: (() => Promise<T>)[],
  maxCount = 4
): Promise<T[]> {
  let len = tasks.length,
    finalCount = 0,
    nextIndex = 0,
    resp: T,
    resArr: T[] = []

  return new Promise((resolve) => {
    if (len === 0) return resolve([])
    for (let i = 0; i < maxCount && i < len; i++) {
      _run()
    }

    /** 完成一个任务时，递归执行下一个任务。直到所有任务完成 */
    function _run() {
      const task = tasks[nextIndex++]

      task()
        .then((res: T) => { resp = res })
        .catch((err: any) => { resp = err })
        .finally(() => {
          resArr[finalCount] = resp
          nextIndex < len && _run()
          ++finalCount === len && resolve(resArr)
        })
    }
  })
}
