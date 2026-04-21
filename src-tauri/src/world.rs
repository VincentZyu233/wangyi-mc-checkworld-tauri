use chrono::{DateTime, Local};
use serde::{Deserialize, Serialize};
use std::fs;
use std::io::{Read, Write};
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
        std::process::Command::new("explorer")
            .arg(&path)
            .spawn()
            .map_err(|e| {
                tracing::error!("打开文件夹失败: {}", e);
                e.to_string()
            })?;
    }
    Ok(())
}

#[tauri::command]
pub fn backup_world(folder: String, backup_name: String) -> Result<String, String> {
    tracing::info!("备份存档: folder={}, name={}", folder, backup_name);
    let worlds_dir = get_worlds_dir();
    let source_path = worlds_dir.join(&folder);
    let backup_path = worlds_dir.join(format!("{}.zip", backup_name));

    if !source_path.exists() {
        tracing::error!("备份源目录不存在: {:?}", source_path);
        return Err("备份源目录不存在".to_string());
    }

    let file = fs::File::create(&backup_path).map_err(|e| e.to_string())?;
    let mut zip = zip::ZipWriter::new(file);
    let options =
        zip::write::FileOptions::default().compression_method(zip::CompressionMethod::Deflated);

    let mut file_count = 0;
    for entry in WalkDir::new(&source_path)
        .into_iter()
        .filter_map(|e| e.ok())
    {
        let entry_path = entry.path();
        let relative_path = entry_path.strip_prefix(&source_path).unwrap();

        if entry_path.is_file() {
            zip.start_file(relative_path.to_string_lossy(), options)
                .map_err(|e| e.to_string())?;
            let mut f = fs::File::open(entry_path).map_err(|e| e.to_string())?;
            let mut buffer = Vec::new();
            f.read_to_end(&mut buffer).map_err(|e| e.to_string())?;
            zip.write_all(&buffer).map_err(|e| e.to_string())?;
            file_count += 1;
        } else if !relative_path.as_os_str().is_empty() {
            zip.add_directory(relative_path.to_string_lossy(), options)
                .map_err(|e| e.to_string())?;
        }
    }

    zip.finish().map_err(|e| e.to_string())?;

    let size = format_size(get_folder_size(&source_path));
    tracing::info!(
        "备份完成: {} (原始大小 {}), 保存到 {:?}",
        folder,
        size,
        backup_path
    );
    Ok(backup_path.to_string_lossy().into())
}

#[tauri::command]
pub fn delete_world(folder: String) -> Result<(), String> {
    tracing::warn!("删除存档: {}", folder);
    let worlds_dir = get_worlds_dir();
    let target_path = worlds_dir.join(&folder);

    if !target_path.exists() {
        tracing::error!("删除目标不存在: {:?}", target_path);
        return Err("删除目标不存在".to_string());
    }

    fs::remove_dir_all(&target_path).map_err(|e| {
        tracing::error!("删除存档失败: {}", e);
        e.to_string()
    })?;
    tracing::info!("删除成功: {}", folder);
    Ok(())
}

#[tauri::command]
pub fn rename_world(folder: String, new_name: String) -> Result<(), String> {
    tracing::info!("重命名存档: folder={}, new_name={}", folder, new_name);
    let worlds_dir = get_worlds_dir();
    let target_path = worlds_dir.join(&folder);
    let levelname_path = target_path.join("levelname.txt");

    if !levelname_path.exists() {
        tracing::error!("levelname.txt 不存在: {:?}", levelname_path);
        return Err("levelname.txt not found".to_string());
    }

    fs::write(&levelname_path, &new_name).map_err(|e| {
        tracing::error!("写入新名称失败: {}", e);
        e.to_string()
    })?;
    tracing::info!("重命名成功: {} -> {}", folder, new_name);
    Ok(())
}
