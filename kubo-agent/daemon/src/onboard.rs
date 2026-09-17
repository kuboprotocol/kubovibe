//! Detecção e integração automática de IDEs — o que o instalador roda no
//! primeiro uso (e o que o endpoint /onboard expõe pra UI do instalador
//! mostrar "Integrar com um clique").
//!
//! Cobre VS Code e Cursor com confiança alta (ambos expõem `--install-extension`
//! na CLI, é o mecanismo oficial e documentado das duas). Trae também é
//! detectado, mas como o binário de linha de comando dele não é tão
//! padronizado quanto o dos outros dois, o resultado vem marcado como
//! `best_effort` — a extensão funciona lá se a instalação manual via .vsix
//! funcionar, mas não dependemos só da autodetecção pra prometer isso.

use serde::Serialize;
use std::path::{Path, PathBuf};
use std::process::Command;

#[derive(Debug, Clone, Copy, Serialize, PartialEq, Eq)]
pub enum EditorKind {
    VsCode,
    Cursor,
    Trae,
    Antigravity,
}

impl EditorKind {
    fn display_name(self) -> &'static str {
        match self {
            EditorKind::VsCode => "VS Code",
            EditorKind::Cursor => "Cursor",
            EditorKind::Trae => "Trae",
            EditorKind::Antigravity => "Antigravity",
        }
    }

    /// Trae e Antigravity têm CLI menos padronizada que VS Code/Cursor —
    /// auto-instalação é tentada, mas nunca prometida como garantia.
    fn best_effort(self) -> bool {
        matches!(self, EditorKind::Trae | EditorKind::Antigravity)
    }
}

#[derive(Debug, Clone, Serialize)]
pub struct DetectedEditor {
    pub kind: EditorKind,
    pub name: &'static str,
    pub exe_path: String,
    pub best_effort: bool,
}

#[derive(Debug, Clone, Serialize)]
pub struct InstallResult {
    pub editor: &'static str,
    pub ok: bool,
    pub detail: String,
}

/// Nomes de binário a procurar por editor, por plataforma. Cada um é
/// testado primeiro no PATH e depois nos diretórios de instalação padrão.
fn candidate_names(kind: EditorKind) -> &'static [&'static str] {
    match kind {
        EditorKind::VsCode => {
            if cfg!(target_os = "windows") {
                &["code.cmd", "code.exe"]
            } else {
                &["code"]
            }
        }
        EditorKind::Cursor => {
            if cfg!(target_os = "windows") {
                &["cursor.cmd", "cursor.exe"]
            } else {
                &["cursor"]
            }
        }
        EditorKind::Trae => {
            if cfg!(target_os = "windows") {
                &["trae.cmd", "trae.exe"]
            } else {
                &["trae"]
            }
        }
        EditorKind::Antigravity => {
            if cfg!(target_os = "windows") {
                &["antigravity.cmd", "antigravity.exe"]
            } else {
                &["antigravity"]
            }
        }
    }
}

/// Diretórios de instalação padrão conhecidos, por SO, onde o binário de
/// CLI costuma morar quando o instalador oficial de cada editor não
/// registra ele no PATH do sistema (comum no Windows).
fn known_install_dirs(kind: EditorKind) -> Vec<PathBuf> {
    let mut dirs = Vec::new();
    let home = directories::BaseDirs::new().map(|d| d.home_dir().to_path_buf());

    if cfg!(target_os = "windows") {
        if let Some(local) = std::env::var_os("LOCALAPPDATA") {
            let local = PathBuf::from(local);
            match kind {
                EditorKind::VsCode => dirs.push(local.join("Programs\\Microsoft VS Code\\bin")),
                EditorKind::Cursor => dirs.push(local.join("Programs\\cursor\\resources\\app\\bin")),
                EditorKind::Trae => dirs.push(local.join("Programs\\Trae\\bin")),
                EditorKind::Antigravity => dirs.push(local.join("Programs\\Antigravity\\bin")),
            }
        }
        if let Some(pf) = std::env::var_os("ProgramFiles") {
            let pf = PathBuf::from(pf);
            match kind {
                EditorKind::VsCode => dirs.push(pf.join("Microsoft VS Code\\bin")),
                EditorKind::Cursor => dirs.push(pf.join("cursor\\resources\\app\\bin")),
                EditorKind::Trae => dirs.push(pf.join("Trae\\bin")),
                EditorKind::Antigravity => dirs.push(pf.join("Antigravity\\bin")),
            }
        }
    } else if cfg!(target_os = "macos") {
        match kind {
            EditorKind::VsCode => dirs.push(PathBuf::from(
                "/Applications/Visual Studio Code.app/Contents/Resources/app/bin",
            )),
            EditorKind::Cursor => {
                dirs.push(PathBuf::from("/Applications/Cursor.app/Contents/Resources/app/bin"))
            }
            EditorKind::Trae => dirs.push(PathBuf::from("/Applications/Trae.app/Contents/Resources/app/bin")),
            EditorKind::Antigravity => {
                dirs.push(PathBuf::from("/Applications/Antigravity.app/Contents/Resources/app/bin"))
            }
        }
        if let Some(home) = &home {
            match kind {
                EditorKind::VsCode => dirs.push(
                    home.join("Applications/Visual Studio Code.app/Contents/Resources/app/bin"),
                ),
                EditorKind::Cursor => {
                    dirs.push(home.join("Applications/Cursor.app/Contents/Resources/app/bin"))
                }
                EditorKind::Trae => dirs.push(home.join("Applications/Trae.app/Contents/Resources/app/bin")),
                EditorKind::Antigravity => {
                    dirs.push(home.join("Applications/Antigravity.app/Contents/Resources/app/bin"))
                }
            }
        }
    } else {
        // Linux: instalações via pacote costumam já colocar o binário no
        // PATH; cobrimos só os locais mais comuns de instalação manual/AppImage.
        if let Some(home) = &home {
            dirs.push(home.join(".local/share/code/bin"));
            dirs.push(home.join(".local/share/cursor/bin"));
        }
        dirs.push(PathBuf::from("/usr/share/code/bin"));
        dirs.push(PathBuf::from("/opt/cursor/bin"));
    }

    dirs
}

fn search_path_env(binary_name: &str) -> Option<PathBuf> {
    let path_var = std::env::var_os("PATH")?;
    for dir in std::env::split_paths(&path_var) {
        let candidate = dir.join(binary_name);
        if candidate.is_file() {
            return Some(candidate);
        }
    }
    None
}

fn detect_one(kind: EditorKind) -> Option<DetectedEditor> {
    for name in candidate_names(kind) {
        if let Some(found) = search_path_env(name) {
            return Some(DetectedEditor {
                kind,
                name: kind.display_name(),
                exe_path: found.display().to_string(),
                best_effort: kind.best_effort(),
            });
        }
    }
    for dir in known_install_dirs(kind) {
        for name in candidate_names(kind) {
            let candidate = dir.join(name);
            if candidate.is_file() {
                return Some(DetectedEditor {
                    kind,
                    name: kind.display_name(),
                    exe_path: candidate.display().to_string(),
                    best_effort: kind.best_effort(),
                });
            }
        }
    }
    None
}

/// Roda a detecção para os três editores suportados. Ordem: VS Code, Cursor,
/// Trae — mas todos que forem encontrados são retornados, não só o primeiro
/// (o dev pode ter mais de um instalado e usar os dois).
pub fn detect_editors() -> Vec<DetectedEditor> {
    [EditorKind::VsCode, EditorKind::Cursor, EditorKind::Trae, EditorKind::Antigravity]
        .into_iter()
        .filter_map(detect_one)
        .collect()
}

/// Instala o .vsix da extensão KUBO no editor detectado, via
/// `<exe> --install-extension <vsix>` — o mecanismo oficial de instalação
/// silenciosa suportado tanto pelo VS Code quanto pelo Cursor.
pub fn install_extension(editor: &DetectedEditor, vsix_path: &Path) -> InstallResult {
    if !vsix_path.is_file() {
        return InstallResult {
            editor: editor.name,
            ok: false,
            detail: format!("arquivo .vsix não encontrado em {}", vsix_path.display()),
        };
    }

    let output = Command::new(&editor.exe_path)
        .arg("--install-extension")
        .arg(vsix_path)
        .output();

    match output {
        Ok(out) if out.status.success() => InstallResult {
            editor: editor.name,
            ok: true,
            detail: "extensão instalada com sucesso".to_string(),
        },
        Ok(out) => InstallResult {
            editor: editor.name,
            ok: false,
            detail: format!(
                "{}{}",
                String::from_utf8_lossy(&out.stdout),
                String::from_utf8_lossy(&out.stderr)
            ),
        },
        Err(err) => InstallResult { editor: editor.name, ok: false, detail: err.to_string() },
    }
}

/// Detecta e instala em todos os editores encontrados de uma vez — é o que
/// o instalador chama no primeiro run ("Integrar com um clique").
pub fn onboard_all(vsix_path: &Path) -> (Vec<DetectedEditor>, Vec<InstallResult>) {
    let editors = detect_editors();
    let results = editors.iter().map(|e| install_extension(e, vsix_path)).collect();
    (editors, results)
}
