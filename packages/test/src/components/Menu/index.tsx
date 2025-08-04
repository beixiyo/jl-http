import { useBindWinEvent } from '@/hooks'
import { cn } from '@/utils'
import { ThemeToggle } from '../ThemeToggle'

const SEP = { path: '/', name: '' }

const pathArr = [
  { path: '/http-basic', name: 'HTTP 基础' },
  { path: '/http-cache', name: '请求缓存' },
  { path: '/http-progress', name: '请求进度' },
  { path: '/http-retry', name: '请求重试' },
  { path: '/http-abort', name: '请求中断' },
  { path: '/http-concurrent', name: '并发请求' },
  { path: '/http-sse', name: 'SSE 流式' },
  { path: '/http-interceptors', name: '拦截器' },
  { path: '/http-comprehensive', name: '综合演示' },
]

export function Menu(
  {
    className,
    style,
  }: MenuProps,
) {
  const [isOpen, setIsOpen] = useState(false)
  const location = useLocation()

  useBindWinEvent('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter' && e.altKey) {
      setIsOpen(true)
    }
  })

  return (
    <div
      className={ cn(
        `flex min-h-screen flex-col gap-4
      bg-black text-white p-3 overflow-y-auto overflow-x-hidden`,
        className,
      ) }
      style={ style }
    >
      <ThemeToggle className="my-0" />

      { pathArr.map((item, index) => {
        if (item.name === '') {
          return <div key={ index } className="my-2 border-t border-gray-600" />
        }

        return (
          <NavLink
            key={ item.path }
            to={ item.path }
            className="block py-1 text-sm transition-all duration-300 !hover:text-fuchsia-300"
            style={ {
              color: location.pathname === item.path
                ? '#f0abfc'
                : 'white',
            } }
          >
            { item.name }
          </NavLink>
        )
      }) }

    </div>
  )
}
Menu.displayName = 'Index'

export interface MenuProps {
  className?: string
  style?: React.CSSProperties
  children?: React.ReactNode
}
