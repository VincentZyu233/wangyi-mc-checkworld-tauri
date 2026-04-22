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
    toastPathCopied: '路径已复制',
    modalCancel: '取消',
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
    toastPathCopied: 'Path copied',
    modalCancel: 'Cancel',
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
    document.getElementById('path-bar-text').textContent = path;
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

  document.getElementById('log-btn').addEventListener('click', toggleLogWindow);
  document.getElementById('log-close').addEventListener('click', toggleLogWindow);

  const copyPath = () => {
    const path = document.getElementById('path-bar-text').textContent;
    if (path && path !== '—') {
      navigator.clipboard.writeText(path).then(() => {
        const toast = document.getElementById('toast');
        toast.textContent = t('toastPathCopied');
        toast.className = 'toast';
        toast.classList.remove('hidden');
        setTimeout(() => toast.classList.add('hidden'), 2000);
      }).catch(() => {});
    }
  };
  document.getElementById('copy-path-btn').addEventListener('click', copyPath);
  document.getElementById('copy-path-btn2').addEventListener('click', copyPath);
}

function toggleLogWindow() {
  const logWindow = document.getElementById('log-window');
  const isHidden = logWindow.classList.contains('hidden');

  if (isHidden) {
    logWindow.classList.remove('hidden');
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

async function openFolder(path) {
  try {
    await invoke('open_folder', { path });
  } catch (e) {
    // silently fail - opening folder is non-critical
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