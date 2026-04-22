use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs;
use std::path::PathBuf;
use walkdir::WalkDir;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct WorldInfo {
    pub folder: String,
    pub name: String,
    pub last_saved: Option<String>,
    pub last_saved_timestamp: Option<i64>,
    pub size: u64,
    pub size_formatted: String,
    pub path: String,
}

fn get_worlds_dir() -> PathBuf {
    std::env::var("APPDATA")
        .map(PathBuf::from)
        .unwrap_or_else(|_| PathBuf::from("."))
        .join("MinecraftPC_Netease_PB")
        .join("minecraftWorlds")
}

pub fn worlds_dir() -> PathBuf {
    get_worlds_dir()
}

pub fn format_size(bytes: u64) -> String {
    const KB: u64 = 1024;
    const MB: u64 = KB * 1024;
    const GB: u64 = MB * 1024;

    if bytes < KB {
        format!("{:.2} B", bytes as f64)
    } else if bytes < MB {
        format!("{:.2} KB", bytes as f64 / KB as f64)
    } else if bytes < GB {
        format!("{:.2} MB", bytes as f64 / MB as f64)
    } else {
        format!("{:.2} GB", bytes as f64 / GB as f64)
    }
}

fn get_folder_size(path: &PathBuf) -> u64 {
    WalkDir::new(path)
        .into_iter()
        .filter_map(|e| e.ok())
        .filter(|e| e.file_type().is_file())
        .filter_map(|e| e.metadata().ok())
        .map(|m| m.len())
        .sum()
}

#[tauri::command]
pub fn get_worlds_path() -> String {
    get_worlds_dir().to_string_lossy().into()
}

#[tauri::command]
pub fn list_worlds() -> Result<Vec<WorldInfo>, String> {
    tracing::info!("开始列出存档");
    let worlds_dir = get_worlds_dir();

    if !worlds_dir.exists() {
        tracing::error!("存档目录不存在: {:?}", worlds_dir);
        return Err(format!("存档目录不存在: {}", worlds_dir.display()));
    }

    let mut worlds = Vec::new();
    let entries = fs::read_dir(&worlds_dir).map_err(|e| e.to_string())?;

    for entry in entries.filter_map(|e| e.ok()) {
        let path = entry.path();
        if !path.is_dir() {
            continue;
        }

        let folder_name = path.file_name().unwrap().to_string_lossy().to_string();
        if folder_name.starts_with("+++") {
            continue;
        }

        let levelname_path = path.join("levelname.txt");
        if !levelname_path.exists() {
            continue;
        }

        let world_name = fs::read_to_string(&levelname_path)
            .unwrap_or_else(|_| "Unknown".to_string())
            .trim()
            .to_string();

        let leveldat_path = path.join("level.dat");
        let (last_saved, last_saved_timestamp) = if leveldat_path.exists() {
            if let Ok(metadata) = fs::metadata(&leveldat_path) {
                if let Ok(modified) = metadata.modified() {
                    let datetime: DateTime<Local> = modified.into();
                    (
                        Some(datetime.format("%Y-%m-%d %H:%M:%S").to_string()),
                        Some(datetime.timestamp()),
                    )
                } else {
                    (None, None)
                }
            } else {
                (None, None)
            }
        } else {
            (None, None)
        };

        let size = get_folder_size(&path);

        worlds.push(WorldInfo {
            folder: folder_name.clone(),
            name: world_name.clone(),
            last_saved,
            last_saved_timestamp,
            size,
            size_formatted: format_size(size),
            path: path.to_string_lossy().to_string(),
        });

        tracing::debug!(
            "发现存档: name={}, folder={}, size={}",
            world_name,
            folder_name,
            format_size(size)
        );
    }

    worlds.sort_by(|a, b| {
        b.last_saved_timestamp
            .unwrap_or(0)
            .cmp(&a.last_saved_timestamp.unwrap_or(0))
    });

    tracing::info!("共找到 {} 个存档", worlds.len());
    Ok(worlds)
}

#[tauri::command]
pub fn open_folder(path: String) -> Result<(), String> {
    tracing::info!("打开文件夹: {}", path);
    #[cfg(target_os = "windows")]
    {
        // Windows explorer 接受两种路径格式：
        // 1. 带反斜杠: C:\Users\...\folder
        // 2. 带正斜杠: C:/Users/.../folder  (推荐，避免被当作通配符)
        // 注意：explorer 对反斜杠路径有时会误判为文件搜索而打开"此电脑"
        // 所以统一用正斜杠
        let explorer_path = path.replace('\\', "/");

        // 用 cmd /c start 包装，确保路径被正确解释
        std::process::Command::new("cmd")
            .args(["/C", "start", "", &explorer_path])
            .spawn()
            .map_err(|e| {
                tracing::error!("打开文件夹失败: {}", e);
                e.to_string()
            })?;
    }
    Ok(())
}
