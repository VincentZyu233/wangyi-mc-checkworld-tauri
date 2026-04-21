// Prevents additional console window on Windows in release, DO NOT REMOVE!!
#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

mod logger;
mod world;

use logger::get_log_path_command;
use world::{
    backup_world, delete_world, get_worlds_path, list_worlds, open_folder, rename_world,
};
use logger::read_log;

fn main() {
    logger::init();

    tracing::info!("WangyiMCCheckworld 启动");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .invoke_handler(tauri::generate_handler![
            get_worlds_path,
            list_worlds,
            open_folder,
            backup_world,
            delete_world,
            rename_world,
            get_log_path_command,
            read_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
