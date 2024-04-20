export function defineConfig(config: Config) {
    return config
}

export type Config = {
    importPath?: string
    className: string
    fns: Fn[]
}

export type Fn = {
    name: string
    isAsync?: boolean
    args: Record<string, any>
}