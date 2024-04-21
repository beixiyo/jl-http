import { iotHttp } from '@/http/iotHttp'

export class Test {

    static getData(data: {
		age: number
		name: string
		ids: number[]
		salary: string
		money: bigint
		fn: string
		isMan: true
		isWoman: boolean
	}) {
        return iotHttp.get('/addList', { query: data })
    }

    static async getData2() {
        return iotHttp.get('/addList')
    }

    static async postData() {
        return iotHttp.post('/addList')
    }

    static async postData2(data: {
		age: number
		name: string
		ids: number[]
		salary: string
		money: bigint
		fn: string
		isMan: true
		isWoman: boolean
	}) {
        return iotHttp.post('/addList', data)
    }

}