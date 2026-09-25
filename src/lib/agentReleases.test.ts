import { describe, it, expect } from 'vitest'
import { resolveDownloads, type GitHubRelease } from './agentReleases'

const asset = (name: string, tag: string) => ({
  name,
  browser_download_url: `https://example.test/${tag}/${name}`,
})

const release = (tag: string, date: string, names: string[], draft = false): GitHubRelease => ({
  tag_name: tag,
  draft,
  published_at: date,
  assets: names.map((n) => asset(n, tag)),
})

describe('resolveDownloads', () => {
  it('usa a release mais nova que contém cada asset', () => {
    const { urls, version } = resolveDownloads([
      release('nightly-4', '2026-09-17T00:00:00Z', ['kubo-vibe-windows.exe']),
      release('nightly-5', '2026-09-25T00:00:00Z', [
        'kubo-vibe-windows.exe',
        'kubo-vibe-macos.tar.gz',
        'kubo-vibe-linux-x64.tar.gz',
      ]),
    ])
    expect(urls.windows).toContain('nightly-5')
    expect(urls.mac).toContain('nightly-5')
    expect(urls.linux).toContain('nightly-5')
    expect(version).toBe('nightly-5')
  })

  it('mantém o link anterior quando o build novo não tem a plataforma', () => {
    const { urls } = resolveDownloads([
      release('nightly-6', '2026-09-26T00:00:00Z', ['kubo-vibe-windows.exe']),
      release('nightly-5', '2026-09-25T00:00:00Z', ['kubo-vibe-windows.exe', 'kubo-vibe-macos.tar.gz']),
    ])
    expect(urls.windows).toContain('nightly-6')
    expect(urls.mac).toContain('nightly-5')
    expect(urls.linux).toBeUndefined()
  })

  it('ignora drafts e releases de outros produtos', () => {
    const { urls, version } = resolveDownloads([
      release('Vertal', '2026-09-30T00:00:00Z', ['kubo-vibe-windows.exe']),
      release('v1.0.0', '2026-09-29T00:00:00Z', ['kubo-vibe-windows.exe'], true),
    ])
    expect(urls).toEqual({})
    expect(version).toBeNull()
  })
})
