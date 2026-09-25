/**
 * Resolve as URLs de download do KUBO Local Agent a partir das GitHub
 * Releases do repositório, em runtime. Evita fixar uma tag ("nightly-4") no
 * código: cada novo build do workflow `kubo-agent-release.yml` aparece no
 * site automaticamente, e plataformas novas (macOS, Linux) passam de
 * "Em breve" para "Baixar" assim que o artefato existir de verdade.
 */

export type AgentPlatform = 'windows' | 'mac' | 'linux'

export const AGENT_REPO = 'kuboprotocol/kubovibe'
export const RELEASES_PAGE_URL = `https://github.com/${AGENT_REPO}/releases`

/** Nome do asset publicado pelo workflow para cada plataforma. */
export const AGENT_ASSET_NAMES: Record<AgentPlatform, string> = {
  windows: 'kubo-vibe-windows.exe',
  mac: 'kubo-vibe-macos.tar.gz',
  linux: 'kubo-vibe-linux-x64.tar.gz',
}

/**
 * Último build conhecido com Windows, usado se a API do GitHub estiver
 * indisponível (rate limit de 60 req/h por IP sem autenticação, rede, etc).
 */
export const FALLBACK_DOWNLOADS: Partial<Record<AgentPlatform, string>> = {
  windows: `https://github.com/${AGENT_REPO}/releases/download/nightly-4/kubo-vibe-windows.exe`,
}

interface GitHubAsset {
  name: string
  browser_download_url: string
}

export interface GitHubRelease {
  tag_name: string
  draft: boolean
  published_at: string | null
  assets: GitHubAsset[]
}

export interface ResolvedDownloads {
  urls: Partial<Record<AgentPlatform, string>>
  /** Tag da release mais nova que contribuiu com algum asset. */
  version: string | null
}

/**
 * Só consideramos releases do agent (tags `v*` e `nightly-*`) — o
 * repositório também tem releases de outros produtos. Para cada plataforma
 * pega o asset da release mais recente que o contém, então um build novo
 * sem macOS (ex.: job falhou) não "some" com o link de macOS anterior.
 */
export function resolveDownloads(releases: GitHubRelease[]): ResolvedDownloads {
  const agentReleases = releases
    .filter((r) => !r.draft && /^(v\d|nightly-\d)/.test(r.tag_name))
    .sort((a, b) => Date.parse(b.published_at ?? '0') - Date.parse(a.published_at ?? '0'))

  const urls: Partial<Record<AgentPlatform, string>> = {}
  let newestIndex = -1

  for (const platform of Object.keys(AGENT_ASSET_NAMES) as AgentPlatform[]) {
    const index = agentReleases.findIndex((r) =>
      r.assets.some((a) => a.name === AGENT_ASSET_NAMES[platform]),
    )
    if (index === -1) continue
    const asset = agentReleases[index].assets.find((a) => a.name === AGENT_ASSET_NAMES[platform])!
    urls[platform] = asset.browser_download_url
    if (newestIndex === -1 || index < newestIndex) newestIndex = index
  }

  return { urls, version: newestIndex === -1 ? null : agentReleases[newestIndex].tag_name }
}

export async function fetchAgentDownloads(signal?: AbortSignal): Promise<ResolvedDownloads> {
  try {
    const res = await fetch(`https://api.github.com/repos/${AGENT_REPO}/releases?per_page=20`, {
      headers: { Accept: 'application/vnd.github+json' },
      signal,
    })
    if (!res.ok) throw new Error(`GitHub API ${res.status}`)
    const resolved = resolveDownloads((await res.json()) as GitHubRelease[])
    return { urls: { ...FALLBACK_DOWNLOADS, ...resolved.urls }, version: resolved.version }
  } catch (err) {
    if ((err as Error).name === 'AbortError') throw err
    return { urls: { ...FALLBACK_DOWNLOADS }, version: null }
  }
}
