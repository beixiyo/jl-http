/**
 * Header 合并工具
 *
 * 统一处理 Fetch 支持的 Header 输入，并保证大小写不同的同名字段由后值覆盖
 */

/** 按传入顺序合并 Header，后面的同名字段覆盖前面的字段 */
export function mergeHeaders(...sources: Array<HeadersInit | undefined>): Record<string, string> {
  const entriesByName = new Map<string, HeaderEntry>()

  for (const source of sources) {
    for (const [name, value] of toHeaderEntries(source)) {
      const normalizedName = name.toLowerCase()
      entriesByName.delete(normalizedName)
      entriesByName.set(normalizedName, { name, value })
    }
  }

  return Object.fromEntries(
    Array.from(entriesByName.values(), ({ name, value }) => [name, value]),
  )
}

function toHeaderEntries(headers?: HeadersInit): Array<[string, string]> {
  if (!headers)
    return []

  if (headers instanceof Headers) {
    const entries: Array<[string, string]> = []
    headers.forEach((value, name) => entries.push([name, value]))
    return entries
  }

  if (Array.isArray(headers))
    return headers.map(([name, value]) => [name, value])

  return Object.entries(headers)
}

type HeaderEntry = {
  name: string
  value: string
}
