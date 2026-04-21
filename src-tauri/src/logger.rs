use chrono::Local;
use std::fs::{self, OpenOptions};
use std::io::Write;
use std::path::PathBuf;
use std::sync::Mutex;
use tracing::Level;
use tracing_appender::non_blocking::WorkerGuard;
use tracing_subscriber::{fmt, layer::SubscriberExt, util::SubscriberInitExt, EnvFilter};

static _LOG_GUARD: Mutex<Option<WorkerGuard>> = Mutex::new(None);

/// 获取日志文件路径（exe 同级目录/latest.log）
fn get_log_path() -> PathBuf {
    if let Ok(exe) = std::env::current_exe() {
        if let Some(exe_dir) = exe.parent() {
            return exe_dir.join("latest.log");
        }
    }
    PathBuf::from("latest.log")
}

/// 初始化日志系统，仅写入 latest.log（每次启动覆盖）
pub fn init() {
    let log_path = get_log_path();

    if let Some(parent) = log_path.parent() {
        let _ = fs::create_dir_all(parent);
    }

    // 每次启动清空旧日志
    let _ = fs::write(&log_path, "");

    let file_appender = tracing_appender::rolling::never(
        log_path.parent().unwrap_or(&PathBuf::from(".")),
        log_path.file_name().unwrap_or_default().to_string_lossy().as_ref(),
    );
    let (non_blocking, guard) = tracing_appender::non_blocking(file_appender);

    {
        let mut g = _LOG_GUARD.lock().unwrap();
        *g = Some(guard);
    }

    let env_filter = EnvFilter::try_from_default_env()
        .unwrap_or_else(|_| EnvFilter::new("info"));

    tracing_subscriber::registry()
        .with(env_filter)
        .with(
            fmt::layer()
                .with_writer(non_blocking)
                .with_ansi(false)
                .with_target(true)
                .with_level(true)
                .with_file(true)
                .with_line_number(true),
        )
        .init();

    tracing::info!("日志系统初始化完成: {:?}", get_log_path());
}

/// 返回 latest.log 路径，暴露给前端
#[tauri::command]
pub fn get_log_path_command() -> String {
    get_log_path().to_string_lossy().to_string()
}
/// 读取 latest.log 当前内容（供前端轮询）
#[tauri::command]
pub fn read_log() -> Result<String, String> {
    fs::read_to_string(get_log_path()).map_err(|e| e.to_string())
}
/// 追加一行原始日志（不走 tracing 格式，直接写文件）
pub fn append_raw(line: &str) {
    let path = get_log_path();
    if let Ok(mut file) = OpenOptions::new().create(true).append(true).open(&path) {
        let ts = Local::now().format("%Y-%m-%d %H:%M:%S%.3f");
        let _ = writeln!(file, "[{}] {}", ts, line);
    }
}
