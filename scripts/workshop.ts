// Starts the workshop's server (`tools/workshop/workshop.server.ts`) and opens one of its pages in
// the browser:
//
//   yarn workshop <game>               the asset workshop, /?game=<game>
//   yarn workshop ui <game>            the UI workshop, /ui?game=<game>
//   yarn workshop particles <game>     the particle workshop, /particles?game=<game>
//   yarn workshop poses                the pose lab, /poses
//   yarn workshop                      the asset workshop with no game picked
//
// `WORKSHOP_PORT` serves it on another port than 5180. The page is opened at 127.0.0.1, not
// localhost, so another program listening on the port's localhost is never the one reached.
// Ctrl-C stops the server.
import { spawn } from 'node:child_process'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { start } from '../tools/workshop/workshop.server.ts'

const pages = ['ui', 'particles', 'poses'] as const
type Page = typeof pages[number]
const isPage = (word: string | undefined): word is Page => pages.includes(word as Page)

export function address(port: number, args: string[]) {
  const [first, second] = args
  const page = isPage(first) ? first : ''
  const game = isPage(first) ? second : first
  if (page === 'poses' && game) throw new Error('the pose lab takes no game: yarn workshop poses')
  if ((page === 'ui' || page === 'particles') && !game) throw new Error(`the ${page} workshop needs a game: yarn workshop ${page} <game>`)
  return `http://127.0.0.1:${port}/${page}${game ? `?game=${encodeURIComponent(game)}` : ''}`
}

function open(url: string) {
  const [command, args] = process.platform === 'darwin' ? ['open', [url]]
    : process.platform === 'win32' ? ['cmd', ['/c', 'start', '', url]]
    : ['xdg-open', [url]]
  spawn(command, args, { stdio: 'ignore', detached: true }).unref()
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const port = Number(process.env.WORKSHOP_PORT ?? 5180)
  const url = address(port, process.argv.slice(2))
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
  await start({ port, root })
  console.log(`workshop at ${url}`)
  open(url)
}
