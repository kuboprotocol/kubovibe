//! Auto-update do daemon a partir das GitHub Releases públicas.
//!
//! Mesma regra de seleção da página /download do site
//! (`src/lib/agentReleases.ts`): só releases do agent (tags `v*` e
//! `nightly-*`), não-draft, a mais recente que tem o asset desta plataforma.
//! A tag do build atual é embutida em tempo de compilação pelo workflow
//! (`KUBO_RELEASE_TAG`); builds locais (`cargo build`) não têm tag e nunca
//! se auto-atualizam — evita sobrescrever um binário de desenvolvimento.

use anyhow::{anyhow, Context, Result};
use serde::{Deserialize, Serialize};
use std::path::{Path, PathBuf};

const RELEASES_API: &str = "https://api.github.com/repos/kuboprotocol/kubovibe/releases?per_page=20";

/// Tag da release que produziu este binário, ou `None` em builds locais.
pub fn current_tag() -> Option<&'static str> {
    option_env!("KUBO_RELEASE_TAG").filter(|t| !t.is_empty())
}

/// Asset "cru" (sem .tar.gz) publicado para esta plataforma — é o que dá
/// pra baixar e trocar no lugar sem precisar descompactar.
pub fn platform_asset() -> Option<&'static str> {
    if cfg!(target_os = "windows") {
        Some("kubo-vibe-windows.exe")
    } else if cfg!(target_os = "macos") {
        Some("kubo-agent-macos")
    } else if cfg!(all(target_os = "linux", target_arch = "x86_64")) {
        Some("kubo-agent-linux-x64")
    } else {
        None
    }
}

#[derive(Debug, Deserialize)]
struct GhAsset {
    name: String,
    browser_download_url: String,
}

#[derive(Debug, Deserialize)]
struct GhRelease {
    tag_name: String,
    draft: bool,
    published_at: Option<String>,
    assets: Vec<GhAsset>,
}

#[derive(Debug, Clone, Serialize)]
pub struct UpdateInfo {
    pub current: Option<String>,
    pub latest: Option<String>,
    pub available: bool,
    #[serde(skip)]
    pub download_url: Option<String>,
}

fn is_agent_tag(tag: &str) -> bool {
    let rest = tag.strip_prefix('v').or_else(|| tag.strip_prefix("nightly-"));
    rest.and_then(|r| r.chars().next()).map(|c| c.is_ascii_digit()).unwrap_or(false)
}

/// Escolhe a release mais nova com o asset desta plataforma. `published_at`
/// é RFC3339 em UTC, então comparação lexicográfica = cronológica.
fn pick_latest<'a>(releases: &'a [GhRelease], asset: &str) -> Option<(&'a GhRelease, &'a GhAsset)> {
    releases
        .iter()
        .filter(|r| !r.draft && is_agent_tag(&r.tag_name))
        .filter_map(|r| r.assets.iter().find(|a| a.name == asset).map(|a| (r, a)))
        .max_by(|(a, _), (b, _)| a.published_at.cmp(&b.published_at))
}

fn http() -> Result<reqwest::Client> {
    // A API do GitHub rejeita requisições sem User-Agent.
    Ok(reqwest::Client::builder()
        .user_agent(concat!("kubo-agent/", env!("CARGO_PKG_VERSION")))
        .build()?)
}

pub async fn check() -> Result<UpdateInfo> {
    let current = current_tag().map(str::to_string);
    let Some(asset) = platform_asset() else {
        return Ok(UpdateInfo { current, latest: None, available: false, download_url: None });
    };

    let releases: Vec<GhRelease> = http()?
        .get(RELEASES_API)
        .header("Accept", "application/vnd.github+json")
        .send()
        .await?
        .error_for_status()?
        .json()
        .await?;

    let latest = pick_latest(&releases, asset);
    let latest_tag = latest.map(|(r, _)| r.tag_name.clone());
    let available = match (&current, &latest_tag) {
        (Some(cur), Some(new)) => cur != new,
        _ => false,
    };

    Ok(UpdateInfo {
        current,
        latest: latest_tag,
        available,
        download_url: latest.map(|(_, a)| a.browser_download_url.clone()),
    })
}

/// Baixa a versão nova e troca o executável em uso. Não reinicia sozinho —
/// quem chama decide (ver `main.rs`, que re-executa o binário novo).
pub async fn apply(info: &UpdateInfo) -> Result<PathBuf> {
    let url = info.download_url.as_deref().ok_or_else(|| anyhow!("nenhuma atualização disponível"))?;
    let exe = std::env::current_exe().context("não consegui localizar o executável atual")?;

    let bytes = http()?.get(url).send().await?.error_for_status()?.bytes().await?;
    // Sanidade mínima: um binário real do agent tem vários MB. Protege contra
    // gravar uma página de erro HTML por cima do executável.
    if bytes.len() < 512 * 1024 {
        return Err(anyhow!("download inesperadamente pequeno ({} bytes)", bytes.len()));
    }

    let staged = exe.with_extension("new");
    std::fs::write(&staged, &bytes)?;
    #[cfg(unix)]
    {
        use std::os::unix::fs::PermissionsExt;
        std::fs::set_permissions(&staged, std::fs::Permissions::from_mode(0o755))?;
    }

    swap_in(&exe, &staged)?;
    Ok(exe)
}

/// No Windows não dá pra sobrescrever um .exe em execução, mas dá pra
/// renomeá-lo — então: atual → `.old`, novo → nome original. No Unix o
/// `rename` por cima é atômico e o processo atual segue com o inode antigo.
fn swap_in(exe: &Path, staged: &Path) -> Result<()> {
    if cfg!(target_os = "windows") {
        let old = old_path(exe);
        let _ = std::fs::remove_file(&old);
        std::fs::rename(exe, &old)?;
        if let Err(err) = std::fs::rename(staged, exe) {
            // Desfaz para não deixar o usuário sem executável nenhum.
            let _ = std::fs::rename(&old, exe);
            return Err(err.into());
        }
    } else {
        std::fs::rename(staged, exe)?;
    }
    Ok(())
}

fn old_path(exe: &Path) -> PathBuf {
    exe.with_extension("old")
}

/// Remove sobras de uma atualização anterior (`.old` no Windows, `.new` de
/// um download interrompido). Chamado no boot.
pub fn cleanup_leftovers() {
    if let Ok(exe) = std::env::current_exe() {
        let _ = std::fs::remove_file(old_path(&exe));
        let _ = std::fs::remove_file(exe.with_extension("new"));
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn rel(tag: &str, date: &str, assets: &[&str]) -> GhRelease {
        GhRelease {
            tag_name: tag.into(),
            draft: false,
            published_at: Some(date.into()),
            assets: assets
                .iter()
                .map(|n| GhAsset { name: (*n).into(), browser_download_url: format!("https://x/{tag}/{n}") })
                .collect(),
        }
    }

    #[test]
    fn agent_tags_only() {
        assert!(is_agent_tag("v1.2.0"));
        assert!(is_agent_tag("nightly-12"));
        assert!(!is_agent_tag("Vertal"));
        assert!(!is_agent_tag("vertal"));
        assert!(!is_agent_tag("nightly-"));
    }

    #[test]
    fn picks_newest_release_with_asset() {
        let releases = vec![
            rel("nightly-5", "2026-09-25T10:00:00Z", &["kubo-agent-linux-x64"]),
            rel("nightly-6", "2026-09-26T10:00:00Z", &["kubo-vibe-windows.exe"]),
            rel("Vertal", "2026-09-30T10:00:00Z", &["kubo-agent-linux-x64"]),
        ];
        let (r, _) = pick_latest(&releases, "kubo-agent-linux-x64").unwrap();
        assert_eq!(r.tag_name, "nightly-5");
        let (r, _) = pick_latest(&releases, "kubo-vibe-windows.exe").unwrap();
        assert_eq!(r.tag_name, "nightly-6");
    }
}
