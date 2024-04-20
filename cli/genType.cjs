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
    BigInt: 'BigInt',
}

function genType(args) {
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
function normalizeType(value) {
    const type = typeMap[value] ?? value
    if (Object.keys(typeMap).includes(type)) return type

    if (typeof type === 'string') {
        let match = type.match(/.+?\[\]/g)
        if (match?.[0]) {
            return match[0]
        }
    }

    return typeof type
}

module.exports = genType

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