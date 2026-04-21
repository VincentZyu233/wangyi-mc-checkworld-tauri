#!/usr/bin/env python3
import argparse
import re
import json
import sys

if sys.platform == "win32":
    import io

    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding="utf-8", errors="replace")

GREEN = "\033[92m"
YELLOW = "\033[93m"
RED = "\033[91m"
CYAN = "\033[96m"
BOLD = "\033[1m"
RESET = "\033[0m"


def print_header(text):
    print(f"\n{BOLD}{CYAN}{'═' * 50}{RESET}")
    print(f"{BOLD}{CYAN}  {text}{RESET}")
    print(f"{BOLD}{CYAN}{'═' * 50}{RESET}\n")


def print_success(text):
    print(f"{GREEN}✅ {text}{RESET}")


def print_warning(text):
    print(f"{YELLOW}⚠️  {text}{RESET}")


def print_error(text):
    print(f"{RED}❌ {text}{RESET}")


def print_info(text):
    print(f"{CYAN}ℹ️  {text}{RESET}")


def validate_version(version):
    parts = version.split(".")
    if len(parts) != 3:
        raise ValueError(f"版本号必须是 x.y.z 格式，当前: {version}")
    for part in parts:
        if not part.isdigit():
            raise ValueError(f"版本号每个部分必须是数字，当前: {version}")
    return True


def update_cargo_toml(version):
    print_info(f"正在更新 src-tauri/Cargo.toml ...")
    cargo_path = "src-tauri/Cargo.toml"
    with open(cargo_path, "r", encoding="utf-8") as f:
        content = f.read()

    pattern = r'^version = "[^"]+"$'
    replacement = f'version = "{version}"'
    new_content = re.sub(pattern, replacement, content, count=1, flags=re.MULTILINE)

    if new_content == content:
        raise RuntimeError(f"未能在 {cargo_path} 中找到版本号")

    with open(cargo_path, "w", encoding="utf-8") as f:
        f.write(new_content)

    print_success(f"🎉 {cargo_path} -> v{version}")


def update_tauri_conf(version):
    print_info(f"正在更新 src-tauri/tauri.conf.json ...")
    conf_path = "src-tauri/tauri.conf.json"
    with open(conf_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    old_version = data.get("version", "unknown")
    data["version"] = version

    with open(conf_path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

    print_success(f"🎉 {conf_path}: {old_version} -> v{version}")


def main():
    print_header("🚀 版本号更新工具")

    parser = argparse.ArgumentParser(
        description=f"{BOLD}MC 存档管理器 - 版本号批量更新工具{RESET}",
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog=f"""
示例:
  {GREEN}python bump.py --version 0.3.2{RESET}
  {GREEN}python bump.py -v 1.0.0{RESET}
        """,
    )
    parser.add_argument(
        "--version", "-v", default="0.0.0", help="新版本号 (x.y.z 格式，默认: 0.0.0)"
    )
    args = parser.parse_args()

    version = args.version

    print_info(f"目标版本: {BOLD}v{version}{RESET}")

    try:
        validate_version(version)
        print()

        update_cargo_toml(version)
        print()

        update_tauri_conf(version)
        print()

        print_header(f"✨ 更新完成! 当前版本: v{version}")

    except ValueError as e:
        print_error(f"版本号格式错误: {e}")
        exit(1)
    except Exception as e:
        print_error(f"发生错误: {e}")
        exit(1)


if __name__ == "__main__":
    main()
