const { invoke } = window.__TAURI__.core;

let allWorlds = [];
let filteredWorlds = [];
let currentTheme = 'system';
let currentLocale = 'zh-CN';
let logInterval = null;
let lastLogLen = 0;

const translations = {
  'zh-CN': {
    appTitle: '🎮 MC 网易世界管理器',
    loading: 'Loading...',
    searchPlaceholder: '🔍 搜索存档...',
    refreshBtn: '🔄 刷新',
    sortLatest: '⏰ 最新优先',
    sortOldest: '⏰ 最旧优先',
    sortNameAsc: '📝 名称 A-Z',
    sortNameDesc: '📝 名称 Z-A',
    sortSizeDesc: '💾 最大优先',
    sortSizeAsc: '💾 最小优先',
    totalCount: '共 {count} 个存档',
    totalSize: '总大小: {size}',
    colIndex: '#',
    colName: '存档名称',
    colFolder: '文件夹',
    colTime: '最后保存',
    colSize: '大小',
    colActions: '操作',
    noWorlds: '未找到存档',
    loadingWorlds: '⏳ 加载存档中...',
    errorLoading: '❌ 加载错误',
    btnOpen: '📁 打开',
    btnBackup: '💾 备份',
    btnRename: '✏️ 重命名',
    btnDelete: '🗑️ 删除',
    modalBackupTitle: '💾 备份存档',
    modalBackupMessage: '创建 "{name}" 的备份？',
    modalBackupConfirm: '备份',
    modalRenameTitle: '✏️ 重命名存档',
    modalRenameMessage: '输入新名称:',
    modalRenameConfirm: '重命名',
    modalDeleteTitle: '🗑️ 删除存档',
    modalDeleteMessage: '确定要删除 "{name}" 吗？此操作无法撤销！',
    modalDeleteConfirm: '删除',
    modalCancel: '取消',
    toastBackupSuccess: '备份已创建: {path}',
    toastBackupFailed: '备份失败: {error}',
    toastRenameSuccess: '存档重命名成功',
    toastRenameFailed: '重命名失败: {error}',
    toastDeleteSuccess: '存档已删除',
    toastDeleteFailed: '删除失败: {error}',
    toastOpenFailed: '打开文件夹失败: {error}',
    toastLoadFailed: '加载存档失败',
    nameEmptyError: '名称不能为空',
    logWindowTitle: '📋 日志',
    logPollingStarted: '开始实时日志轮询',
    logPollingStopped: '日志窗口已关闭',
  },
  'en-US': {
    appTitle: '🎮 MC NetEase World Manager',
    loading: 'Loading...',
    searchPlaceholder: '🔍 Search worlds...',
    refreshBtn: '🔄 Refresh',
    sortLatest: '⏰ Latest First',
    sortOldest: '⏰ Oldest First',
    sortNameAsc: '📝 Name A-Z',
    sortNameDesc: '📝 Name Z-A',
    sortSizeDesc: '💾 Largest First',
    sortSizeAsc: '💾 Smallest First',
    totalCount: 'Total: {count} worlds',
    totalSize: 'Total size: {size}',
    colIndex: '#',
    colName: 'World Name',
    colFolder: 'Folder',
    colTime: 'Last Saved',
    colSize: 'Size',
    colActions: 'Actions',
    noWorlds: 'No worlds found',
    loadingWorlds: '⏳ Loading worlds...',
    errorLoading: '❌ Error loading',
    btnOpen: '📁 Open',
    btnBackup: '💾 Backup',
    btnRename: '✏️ Rename',
    btnDelete: '🗑️ Delete',
    modalBackupTitle: '💾 Backup World',
    modalBackupMessage: 'Create a backup of "{name}"?',
    modalBackupConfirm: 'Backup',
    modalRenameTitle: '✏️ Rename World',
    modalRenameMessage: 'Enter new name:',
    modalRenameConfirm: 'Rename',
    modalDeleteTitle: '🗑️ Delete World',
    modalDeleteMessage: 'Are you sure you want to delete "{name}"?\n\nThis action cannot be undone!',
    modalDeleteConfirm: 'Delete',
    modalCancel: 'Cancel',
    toastBackupSuccess: 'Backup created: {path}',
    toastBackupFailed: 'Backup failed: {error}',
    toastRenameSuccess: 'World renamed successfully',
    toastRenameFailed: 'Rename failed: {error}',
    toastDeleteSuccess: 'World deleted',
    toastDeleteFailed: 'Delete failed: {error}',
    toastOpenFailed: 'Failed to open folder: {error}',
    toastLoadFailed: 'Failed to load worlds',
    nameEmptyError: 'Name cannot be empty',
    logWindowTitle: '📋 Log',
  }
};

const themeIcons = {
  'light': '☀️',
  'dark': '🌙',
  'system': '🖥️'
};

function t(key, params = {}) {
  const trans = translations[currentLocale] || translations['zh-CN'];
  let text = trans[key] || key;
  for (const [k, v] of Object.entries(params)) {
    text = text.replace(`{${k}}`, v);
  }
  return text;
}

function initLocale() {
  const saved = localStorage.getItem('locale');
  if (saved && translations[saved]) {
    currentLocale = saved;
  } else {
    const browserLang = navigator.language || navigator.userLanguage;
    currentLocale = browserLang.startsWith('en') ? 'en-US' : 'zh-CN';
  }
  updateLocaleUI();
}

function updateLocaleUI() {
  const select = document.getElementById('locale-select');
  if (select) select.value = currentLocale;
}

function setLocale(locale) {
  if (translations[locale]) {
    currentLocale = locale;
    localStorage.setItem('locale', locale);
    updateLocaleUI();
    updateUITexts();
  }
}

function initTheme() {
  const saved = localStorage.getItem('theme');
  if (saved) {
    currentTheme = saved;
  }
  applyTheme();
  
  document.getElementById('theme-btn').addEventListener('click', cycleTheme);
}

function applyTheme() {
  const themeIcon = document.getElementById('theme-icon');
  themeIcon.textContent = themeIcons[currentTheme];
  
  if (currentTheme === 'system') {
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    document.documentElement.setAttribute('data-theme', prefersDark ? 'dark' : 'light');
  } else {
    document.documentElement.setAttribute('data-theme', currentTheme);
  }
}

function cycleTheme() {
  const themes = ['system', 'light', 'dark'];
  const currentIndex = themes.indexOf(currentTheme);
  currentTheme = themes[(currentIndex + 1) % themes.length];
  localStorage.setItem('theme', currentTheme);
  applyTheme();
}

window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', () => {
  if (currentTheme === 'system') {
    applyTheme();
  }
});

async function loadWorldsPath() {
  try {
    const path = await invoke('get_worlds_path');
    document.getElementById('worlds-path').textContent = `📂 ${path}`;
  } catch (e) {
    console.error('Failed to get worlds path:', e);
  }
}

async function loadWorlds() {
  const tbody = document.getElementById('worlds-tbody');
  tbody.innerHTML = `<tr><td colspan="6" class="loading">${t('loadingWorlds')}</td></tr>`;

  try {
    allWorlds = await invoke('list_worlds');
    filteredWorlds = [...allWorlds];
    applySort();
    renderWorlds();
    updateStats();
  } catch (e) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">${t('errorLoading')}: ${escapeHtml(e)}</td></tr>`;
    showToast(t('toastLoadFailed', { error: e }), true);
  }
}

function renderWorlds() {
  const tbody = document.getElementById('worlds-tbody');

  if (filteredWorlds.length === 0) {
    tbody.innerHTML = `<tr><td colspan="6" class="loading">${t('noWorlds')}</td></tr>`;
    return;
  }

  tbody.innerHTML = filteredWorlds.map((world, index) => `
    <tr data-folder="${escapeHtml(world.folder)}">
      <td class="col-index">${index + 1}</td>
      <td class="col-name">${escapeHtml(world.name)}</td>
      <td class="col-folder">${escapeHtml(world.folder)}</td>
      <td class="col-time">${world.last_saved || 'Unknown'}</td>
      <td class="col-size">${world.size_formatted}</td>
      <td class="col-actions">
        <div class="action-buttons">
          <button class="btn btn-secondary btn-small" onclick="openFolder('${escapeJs(world.path)}')">${t('btnOpen')}</button>
          <button class="btn btn-secondary btn-small" onclick="backupWorld('${escapeJs(world.folder)}', '${escapeJs(world.name)}')">${t('btnBackup')}</button>
          <button class="btn btn-secondary btn-small" onclick="renameWorld('${escapeJs(world.folder)}', '${escapeJs(world.name)}')">${t('btnRename')}</button>
          <button class="btn btn-danger btn-small" onclick="deleteWorld('${escapeJs(world.folder)}', '${escapeJs(world.name)}')">${t('btnDelete')}</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function updateStats() {
  const totalCount = filteredWorlds.length;
  const totalSize = filteredWorlds.reduce((sum, w) => sum + w.size, 0);

  document.getElementById('total-count').textContent = t('totalCount', { count: totalCount });
  document.getElementById('total-size').textContent = t('totalSize', { size: formatSize(totalSize) });
}

function formatSize(bytes) {
  const KB = 1024;
  const MB = KB * 1024;
  const GB = MB * 1024;

  if (bytes < KB) return `${bytes.toFixed(2)} B`;
  if (bytes < MB) return `${(bytes / KB).toFixed(2)} KB`;
  if (bytes < GB) return `${(bytes / MB).toFixed(2)} MB`;
  return `${(bytes / GB).toFixed(2)} GB`;
}

function applySort() {
  const sortValue = document.getElementById('sort-select').value;

  filteredWorlds.sort((a, b) => {
    switch (sortValue) {
      case 'time-desc':
        return (b.last_saved_timestamp || 0) - (a.last_saved_timestamp || 0);
      case 'time-asc':
        return (a.last_saved_timestamp || 0) - (b.last_saved_timestamp || 0);
      case 'name-asc':
        return a.name.localeCompare(b.name);
      case 'name-desc':
        return b.name.localeCompare(a.name);
      case 'size-desc':
        return b.size - a.size;
      case 'size-asc':
        return a.size - b.size;
      default:
        return 0;
    }
  });
}

function applySearch() {
  const query = document.getElementById('search-input').value.toLowerCase().trim();

  if (!query) {
    filteredWorlds = [...allWorlds];
  } else {
    filteredWorlds = allWorlds.filter(w =>
      w.name.toLowerCase().includes(query) ||
      w.folder.toLowerCase().includes(query)
    );
  }

  applySort();
  renderWorlds();
  updateStats();
}

function updateUITexts() {
  document.getElementById('app-title').textContent = t('appTitle');
  document.getElementById('search-input').placeholder = t('searchPlaceholder');
  document.getElementById('refresh-btn').textContent = t('refreshBtn');
  
  const sortSelect = document.getElementById('sort-select');
  sortSelect.options[0].text = t('sortLatest');
  sortSelect.options[1].text = t('sortOldest');
  sortSelect.options[2].text = t('sortNameAsc');
  sortSelect.options[3].text = t('sortNameDesc');
  sortSelect.options[4].text = t('sortSizeDesc');
  sortSelect.options[5].text = t('sortSizeAsc');
  
  document.getElementById('total-count').textContent = t('totalCount', { count: filteredWorlds.length });
  document.getElementById('total-size').textContent = t('totalSize', { size: formatSize(filteredWorlds.reduce((sum, w) => sum + w.size, 0)) });
  
  document.getElementById('th-index').textContent = t('colIndex');
  document.getElementById('th-name').textContent = t('colName');
  document.getElementById('th-folder').textContent = t('colFolder');
  document.getElementById('th-time').textContent = t('colTime');
  document.getElementById('th-size').textContent = t('colSize');
  document.getElementById('th-actions').textContent = t('colActions');
  
  renderWorlds();
}

function setupEventListeners() {
  document.getElementById('refresh-btn').addEventListener('click', loadWorlds);
  document.getElementById('sort-select').addEventListener('change', () => {
    applySort();
    renderWorlds();
  });
  document.getElementById('search-input').addEventListener('input', applySearch);

  document.getElementById('locale-select').addEventListener('change', (e) => {
    setLocale(e.target.value);
  });

  document.getElementById('modal-cancel').addEventListener('click', hideModal);
  document.getElementById('modal').addEventListener('click', (e) => {
    if (e.target.id === 'modal') hideModal();
  });
  document.getElementById('log-btn').addEventListener('click', toggleLogWindow);
  document.getElementById('log-close').addEventListener('click', toggleLogWindow);
}

async function openFolder(path) {
  try {
    await invoke('open_folder', { path });
  } catch (e) {
    showToast(t('toastOpenFailed', { error: e }), true);
  }
}

function toggleLogWindow() {
  const logWindow = document.getElementById('log-window');
  const isHidden = logWindow.classList.contains('hidden');

  if (isHidden) {
    logWindow.classList.remove('hidden');
    // 显示日志文件路径
    invoke('get_log_path_command').then((path) => {
      document.getElementById('log-path').textContent = path;
    }).catch(() => {});
    lastLogLen = 0;
    fetchLog();
    logInterval = setInterval(fetchLog, 1000);
  } else {
    logWindow.classList.add('hidden');
    if (logInterval !== null) {
      clearInterval(logInterval);
      logInterval = null;
    }
  }
}

async function fetchLog() {
  try {
    const content = await invoke('read_log');
    if (content.length !== lastLogLen) {
      const logEl = document.getElementById('log-content');
      logEl.textContent = content;
      logEl.scrollTop = logEl.scrollHeight;
      lastLogLen = content.length;
    }
  } catch (e) {
    // ignore read errors while polling
  }
}

function appendLog(message) {
  const logContent = document.getElementById('log-content');
  const timestamp = new Date().toLocaleTimeString();
  logContent.textContent += `[${timestamp}] ${message}\n`;
  logContent.scrollTop = logContent.scrollHeight;
}

async function backupWorld(folder, name) {
  const timestamp = new Date().toISOString().slice(0, 10).replace(/-/g, '');
  const defaultName = `${name}_backup_${timestamp}`;

  showModal(
    t('modalBackupTitle'),
    t('modalBackupMessage', { name }),
    defaultName,
    async (backupName) => {
      if (!backupName.trim()) {
        showToast('备份名称不能为空', true);
        return;
      }
      try {
        const path = await invoke('backup_world', { folder, backupName });
        showToast(t('toastBackupSuccess', { path }));
      } catch (e) {
        showToast(t('toastBackupFailed', { error: e }), true);
      }
    },
    t('modalBackupConfirm'),
    false
  );
}

async function renameWorld(folder, currentName) {
  showModal(
    t('modalRenameTitle'),
    t('modalRenameMessage'),
    currentName,
    async (newName) => {
      if (!newName.trim()) {
        showToast(t('nameEmptyError'), true);
        return;
      }
      try {
        await invoke('rename_world', { folder, newName: newName.trim() });
        showToast(t('toastRenameSuccess'));
        await loadWorlds();
      } catch (e) {
        showToast(t('toastRenameFailed', { error: e }), true);
      }
    },
    t('modalRenameConfirm'),
    false
  );
}

async function deleteWorld(folder, name) {
  showModal(
    t('modalDeleteTitle'),
    t('modalDeleteMessage', { name }),
    '',
    async (inputValue) => {
      if (inputValue !== name) {
        showToast(`名称不匹配：需输入 "${name}" 才能确认删除`, true);
        return;
      }
      try {
        await invoke('delete_world', { folder });
        showToast(t('toastDeleteSuccess'));
        await loadWorlds();
      } catch (e) {
        showToast(t('toastDeleteFailed', { error: e }), true);
      }
    },
    t('modalDeleteConfirm'),
    true,
    name
  );
}

let modalCallback = null;

function showModal(title, message, inputValue, callback, confirmText, isDanger = false, requiredInput = null) {
  modalCallback = callback;

  document.getElementById('modal-title').textContent = title;
  document.getElementById('modal-message').textContent = message;

  const inputContainer = document.getElementById('modal-input-container');
  const inputElement = document.getElementById('modal-input');
  const inputHint = document.getElementById('modal-input-hint');

  if (requiredInput !== null) {
    inputContainer.classList.remove('hidden');
    inputElement.value = '';
    inputElement.placeholder = `请输入 "${requiredInput}" 确认`;
    inputHint.textContent = `请输入 "${requiredInput}" 才能点击确认`;
    inputHint.classList.remove('hidden');
    setTimeout(() => inputElement.focus(), 100);
  } else if (inputValue !== null) {
    inputContainer.classList.remove('hidden');
    inputElement.value = inputValue;
    inputElement.placeholder = '';
    inputHint.classList.add('hidden');
    setTimeout(() => inputElement.focus(), 100);
  } else {
    inputContainer.classList.add('hidden');
    inputHint.classList.add('hidden');
  }

  const confirmBtn = document.getElementById('modal-confirm');
  confirmBtn.textContent = confirmText;
  confirmBtn.className = isDanger ? 'btn btn-danger' : 'btn btn-primary';
  confirmBtn.onclick = () => {
    const value = (requiredInput !== null || inputValue !== null) ? inputElement.value : null;
    hideModal();
    if (modalCallback) modalCallback(value);
  };

  document.getElementById('modal').classList.remove('hidden');
}

function hideModal() {
  document.getElementById('modal').classList.add('hidden');
  modalCallback = null;
}

function showToast(message, isError = false) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.className = isError ? 'toast error' : 'toast';

  setTimeout(() => {
    toast.classList.add('hidden');
  }, 3000);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function escapeJs(str) {
  return str.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

document.addEventListener('DOMContentLoaded', async () => {
  initLocale();
  initTheme();
  updateUITexts();
  await loadWorldsPath();
  await loadWorlds();
  setupEventListeners();
});