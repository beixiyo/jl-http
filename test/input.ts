import { defineConfig } from '../src'


module.exports = defineConfig({
    /** 类名 */
    className: 'Test',
    /** 可以发送请求的对象 */
    requestFnName: 'iotHttp',
    /** 顶部导入的路径 */
    importPath: 'import { iotHttp } from \'@/http/iotHttp\'',
    /** 类里的函数 */
    fns: [
        {
            /** 
             * 生成 TS 类型的代码
             * 你可以像写 TS 一样写，也可以写字面量，字面量会被 typeof 转换
             */
            args: {
                age: 18,
                name: 'string',
                ids: 'number[]',
                salary: 'Bigint',
                money: BigInt(123),
                fn: 'function',
                isMan: true,
                isWoman: 'boolean',
            },
            /** 函数的名字 */
            name: 'getData',
            /** 请求的方法，如 get | post | ... */
            method: 'get',
            /** 请求地址 */
            url: '/addList',
            /** 添加异步关键字 */
            isAsync: false
        },
        {
            /** 函数的名字 */
            name: 'getData2',
            /** 请求的方法，如 get | post | ... */
            method: 'get',
            /** 请求地址 */
            url: '/addList',
            /** 添加异步关键字 */
            isAsync: true
        },
        {
            /** 函数的名字 */
            name: 'postData',
            /** 请求的方法，如 get | post | ... */
            method: 'post',
            /** 请求地址 */
            url: '/addList',
            /** 添加异步关键字 */
            isAsync: true
        },
        {
            /** 函数的名字 */
            name: 'postData2',
            /** 请求的方法，如 get | post | ... */
            method: 'post',
            /** 请求地址 */
            url: '/addList',
            /** 添加异步关键字 */
            isAsync: true,
            args: {
                age: 18,
                name: 'string',
                ids: 'number[]',
                salary: 'Bigint',
                money: BigInt(123),
                fn: 'function',
                isMan: true,
                isWoman: 'boolean',
            },
        },
    ],
})