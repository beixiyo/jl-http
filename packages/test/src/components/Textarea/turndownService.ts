import type TurndownService from 'turndown'

let turndownService: TurndownService | null = null

export async function getTurndownService() {
  if (turndownService) {
    return turndownService
  }

  const { default: TurndownService } = await import('turndown')

  turndownService = new TurndownService({
    headingStyle: 'atx',
    codeBlockStyle: 'fenced',
    emDelimiter: '*',
    bulletListMarker: '-',
  })

  return turndownService
}
