/**
 * 并发执行异步任务数组，并保持结果顺序。
 * 当一个任务完成后，会自动从队列中取下一个任务执行，直到所有任务完成。
 * @param tasks 要执行的异步任务函数数组。每个函数应返回一个 Promise。
 * @param maxConcurrency 最大并发数。默认为 4。
 * @returns 返回一个 Promise，该 Promise resolve 为一个结果对象数组，
 *          每个结果对象表示对应任务的完成状态（成功或失败）。
 *          结果数组的顺序与输入 tasks 数组的顺序一致。
 */
export function concurrentTask<T>(
  tasks: (() => Promise<T>)[],
  maxConcurrency = 4,
): Promise<TaskResult<T>[]> {
  const numTasks = tasks.length
  if (numTasks === 0) {
    return Promise.resolve([])
  }

  const results: TaskResult<T>[] = new Array(numTasks)
  /** 当前正在运行的任务数 */
  let running = 0
  /** 已完成的任务数 */
  let completed = 0
  /** 下一个要执行的任务的索引 */
  let index = 0

  return new Promise((resolve) => {
    function runNextTask() {
      while (running < maxConcurrency && index < numTasks) {
        const taskIndex = index++ // 捕获当前任务的索引
        running++

        tasks[taskIndex]()
          .then((value) => {
            results[taskIndex] = { status: 'fulfilled', value }
          })
          .catch((reason) => {
            results[taskIndex] = {
              status: 'rejected',
              reason: reason instanceof Error
                ? reason
                : new Error(String(reason)),
            }
          })
          .finally(() => {
            running--
            completed++
            if (completed === numTasks) {
              resolve(results)
            }
            else {
              runNextTask() // 一个任务完成，尝试补充新的任务
            }
          })
      }
    }

    runNextTask()
  })
}

export type TaskResult<T> =
  | { status: 'fulfilled', value: T }
  | { status: 'rejected', reason: Error }
