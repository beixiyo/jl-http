import { getType } from '@/tools'

const typeMap = {
  string: 'string',
  number: 'number',
  boolean: 'boolean',
  true: 'true',
  false: 'false',
  array: 'any[]',
  object: 'object',
  any: 'any',
  null: 'null',
  undefined: 'undefined',
  function: 'Function',
  Function: 'Function',
  bigInt: 'bigInt',
}

export function genType(args?: Record<string, any>) {
  if (!args) return ''

  let ts = '{'
  for (const k in args) {
    if (!Object.hasOwnProperty.call(args, k)) continue

    const value = args[k]
    const type = normalizeType(value)
    ts += `\n\t\t${k}: ${type}`
  }

  ts += '\n\t}'
  return ts
}

function normalizeType(value: string) {
  // @ts-ignore
  const type = typeMap[value]
  if (type) return type

  if (typeof value === 'string') {
    let match = value.match(/.+?\[\]/g)
    if (match?.[0]) {
      return match[0]
    }
  }

  const finaltype = getType(value)
  return finaltype === 'array'
    ? 'any[]'
    : finaltype
}


// console.log(genType({
//     a: 'string',
//     b: 'number',
//     c: 'boolean',
//     d: 'array',
//     e: 'object',
//     f: 'asdf',
//     g: 'string[]',
//     h: 123,
//     i: true,
//     j: false,
//     k: null,
//     l: undefined,
//     m: function () { },
//     n: BigInt(123),
//     o: {},
// }))