/** 获取类型 */
export const getType = (data: any) => (Object.prototype.toString.call(data) as string).slice(8, -1).toLowerCase()

/**
 * 等待指定时间后返回 Promise
 *
 * @example
 * ```ts
 * await wait(2000)
 * ```
 *
 * @param durationMS 等待时间，默认 1000 毫秒
 */
export function wait(durationMS = 1000) {
  return new Promise((resolve) => {
    setTimeout(resolve, durationMS)
  })
}

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

export function isObj(data: any): data is object {
  return typeof data === 'object' && data !== null
}
