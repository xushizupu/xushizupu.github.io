

(function () {
  "use strict";

  // ---------- 配置 ----------
  const DATA_URL = 'data.json';   // 由 build.py 生成
  const PAGE_SIZE = 100;          // 名录每批渲染条数（大数据量时分页，避免一次渲染数万节点）

  // ---------- 工具函数 ----------
  function isMobileDevice() {
    return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
      || window.innerWidth < 768;
  }

  // HTML 转义：所有拼入 innerHTML 的字段都必须经过它
  function esc(v) {
    return String(v == null ? '' : v).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function debounce(fn, ms) {
    let timer = null;
    return function () {
      const args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(null, args); }, ms);
    };
  }

  // ---------- 状态 ----------
  let familyData = [];
  let personMap = new Map();     // id -> 人员
  let childrenMap = new Map();   // fatherId -> [子女]
  let generationSet = new Set();
  let currentPerson = null;
  let currentGenFilter = '全部';
  let searchTerm = '';
  let listShown = PAGE_SIZE;
  const treeCache = new Map();   // person.id -> {ancestors, descendants}

  // ---------- DOM ----------
  const memberContainer = document.getElementById('memberListContainer');
  const listCountSpan = document.getElementById('listCount');
  const statsDisplay = document.getElementById('statsDisplay');
  const searchInput = document.getElementById('searchInput');
  const genFilterContainer = document.getElementById('genFilterContainer');
  const detailName = document.getElementById('detailName');
  const detailGenLifespan = document.getElementById('detailGenLifespan');
  const profileDetails = document.getElementById('profileDetails');
  const treeContainer = document.getElementById('treeContainer');
  const detailPanel = document.getElementById('detailPanel');
  const previewBanner = document.getElementById('previewBanner');
  const fileInput = document.getElementById('file-input');
  const uploadBtn = document.getElementById('uploadBtn');

  // ---------- 数据归一化与索引 ----------
  // 自动补 id / fatherId，并预建小写搜索索引
  function normalizeRecords(records) {
    const nameToId = new Map();
    const out = [];
    records.forEach(function (p, i) {
      if (!p || !p.name) return;
      const rec = {
        id: i + 1,
        name: String(p.name).trim(),
        gender: String(p.gender || '').trim(),
        birth: (p.birth === '' || p.birth == null) ? '' : p.birth,
        death: (p.death === '' || p.death == null) ? '' : p.death,
        spouse: String(p.spouse || '').trim(),
        father: String(p.father || '').trim(),
        generation: String(p.generation || '').trim(),
        occupation: String(p.occupation || '').trim(),
        burial: String(p.burial || '').trim(),
        remark: String(p.remark || '').trim()
      };
      if (!nameToId.has(rec.name)) nameToId.set(rec.name, rec.id);
      out.push(rec);
    });
    out.forEach(function (p) {
      p.fatherId = p.father ? (nameToId.get(p.father) || 0) : 0;
      p._search = [p.name, p.gender, p.occupation, p.father, p.spouse, p.generation, p.remark, p.burial]
        .join(' ').toLowerCase();
    });
    return out;
  }

  function buildIndex() {
    personMap.clear();
    childrenMap.clear();
    generationSet.clear();
    treeCache.clear();
    familyData.forEach(function (p) {
      personMap.set(p.id, p);
      if (p.generation) generationSet.add(p.generation);
      if (p.fatherId) {
        if (!childrenMap.has(p.fatherId)) childrenMap.set(p.fatherId, []);
        childrenMap.get(p.fatherId).push(p);
      }
    });
  }

  function setData(records) {
    familyData = normalizeRecords(records);
    buildIndex();
    if (!currentPerson || !personMap.has(currentPerson.id)) {
      currentPerson = familyData[0] || null;
    }
    renderGenButtons();
    filterAndRenderList();
    renderProfileAndTree(currentPerson);
    statsDisplay.textContent = `📌 ${familyData.length} 位族人 · ${generationSet.size} 字辈`;
  }

  // ---------- 数据加载（data.json） ----------
  async function loadData() {
    statsDisplay.textContent = '数据加载中…';
    memberContainer.innerHTML = '<div style="padding:24px; color:#9a8a7a; text-align:center;">数据加载中…</div>';
    try {
      const res = await fetch(DATA_URL, { cache: 'no-cache' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const data = await res.json();
      const records = Array.isArray(data) ? data : (data.records || []);
      setData(records);
      clearAutofilledSearch();
      applyHash();
    } catch (err) {
      statsDisplay.textContent = '⚠️ 数据加载失败';
      memberContainer.innerHTML = '<div style="padding:24px; color:#9a8a7a; text-align:center; line-height:1.8;">'
        + '无法加载 <b>data.json</b>。<br>请先在项目目录运行 <b>build.py</b> 生成数据文件并提交到 GitHub。<br><br>'
        + '也可以点击上方“📥 本地数据预览”按钮，加载自己的 Excel / CSV 文件预览效果。'
        + '<div style="margin-top:14px; font-size:0.75rem; color:#b0a08f;">' + esc(String(err && err.message ? err.message : err)) + '</div></div>';
      detailName.textContent = '数据未加载';
      detailGenLifespan.textContent = '';
    }
  }

  // ---------- 字辈筛选（事件委托，只挂一次） ----------
  function renderGenButtons() {
    const gens = Array.from(generationSet).sort();
    let html = '<button class="gen-btn ' + (currentGenFilter === '全部' ? 'active' : '') + '" data-gen="全部">全部</button>';
    gens.forEach(function (gen) {
      html += '<button class="gen-btn ' + (gen === currentGenFilter ? 'active' : '') + '" data-gen="' + esc(gen) + '">' + esc(gen) + '字辈</button>';
    });
    genFilterContainer.innerHTML = html;
  }

  genFilterContainer.addEventListener('click', function (e) {
    const btn = e.target.closest('.gen-btn');
    if (!btn) return;
    currentGenFilter = btn.dataset.gen;
    renderGenButtons();
    filterAndRenderList();
  });

  // ---------- 筛选与名录（分页渲染） ----------
  function getFilteredData() {
    let filtered = familyData;
    if (currentGenFilter !== '全部') {
      filtered = filtered.filter(function (p) { return p.generation === currentGenFilter; });
    }
    const term = searchTerm.trim().toLowerCase();
    if (term) {
      filtered = filtered.filter(function (p) { return p._search.indexOf(term) !== -1; });
    }
    return filtered;
  }

  function filterAndRenderList() {
    listShown = PAGE_SIZE;
    const filtered = getFilteredData();
    renderMemberList(filtered);
    listCountSpan.textContent = String(filtered.length);
  }

  function renderMemberList(list) {
    if (!list.length) {
      memberContainer.innerHTML = '<div style="padding:24px; color:#9a8a7a; text-align:center;">暂无族人</div>';
      return;
    }
    const slice = list.slice(0, listShown);
    let html = '';
    slice.forEach(function (p) {
      const activeClass = (currentPerson && currentPerson.id === p.id) ? 'active' : '';
      const lifespan = (p.birth !== '' && p.birth != null)
        ? p.birth + '–' + ((p.death === '' || p.death == null) ? '?' : p.death)
        : '';
      html += '<div class="member-item ' + activeClass + '" data-id="' + p.id + '">'
        + '<span class="member-name">' + esc(p.name) + ' <span class="gender-badge">' + esc(p.gender) + '</span></span>'
        + '<span class="member-meta">' + esc(lifespan) + '</span>'
        + '</div>';
    });
    if (list.length > listShown) {
      html += '<div class="load-more" data-action="more">加载更多（已显示 ' + listShown + ' / ' + list.length + '）</div>';
    }
    memberContainer.innerHTML = html;
  }

  // 名录事件委托（整个容器只挂一次监听）
  memberContainer.addEventListener('click', function (e) {
    const more = e.target.closest('.load-more');
    if (more) {
      listShown += PAGE_SIZE;
      renderMemberList(getFilteredData());
      return;
    }
    const item = e.target.closest('.member-item');
    if (item) {
      const p = personMap.get(Number(item.dataset.id));
      if (p) selectPerson(p, true);
    }
  });

  // 搜索防抖（停顿 250ms 才搜索，避免每个按键全表扫描+重渲染）
  searchInput.addEventListener('input', debounce(function (e) {
    searchInput.dataset.touched = '1';
    searchTerm = e.target.value;
    filterAndRenderList();
  }, 250));

  // 防止浏览器自动填充搜索框（Chrome 有时忽略 autocomplete=off）：
  // 初始 readonly，点击/聚焦时才变为可输入；加载时若发现非用户输入的残留值则清空。
  searchInput.addEventListener('focus', function () {
    searchInput.removeAttribute('readonly');
  });
  function clearAutofilledSearch() {
    if (!searchInput.dataset.touched && searchInput.value) {
      searchInput.value = '';
      searchTerm = '';
      filterAndRenderList();
    }
  }
  window.addEventListener('pageshow', clearAutofilledSearch);

  // ---------- 选中与详情 ----------
  function selectPerson(p, scroll) {
    currentPerson = p;
    try { history.replaceState(null, '', '#p-' + p.id); } catch (err) { /* 忽略 */ }
    renderMemberList(getFilteredData());
    renderProfileAndTree(p);
    if (scroll) scrollToDetailIfMobile();
  }

  function applyHash() {
    const h = location.hash;
    if (h === '#update') { showView('update'); return; }
    if (h === '#admin') { showView('admin'); return; }
    showView('browse');
    const m = /^#p-(\d+)/.exec(h);
    if (m) {
      const p = personMap.get(Number(m[1]));
      if (p) selectPerson(p, false);
    }
  }
  window.addEventListener('hashchange', applyHash);

  function scrollToDetailIfMobile() {
    if (isMobileDevice()) {
      setTimeout(function () {
        detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start', inline: 'nearest' });
      }, 100);
    }
  }

  function renderProfileAndTree(person) {
    if (!person) {
      detailName.textContent = '—';
      detailGenLifespan.textContent = '';
      profileDetails.innerHTML = '';
      treeContainer.innerHTML = '';
      return;
    }
    detailName.textContent = person.name;
    const birthDeath = (person.birth || '?') + ' – ' + (person.death || '?');
    detailGenLifespan.textContent = (person.generation || '') + '字辈 · ' + birthDeath;

    const details = [
      { label: '性别', value: person.gender || '—' },
      { label: '配偶', value: (person.spouse && person.spouse !== '无') ? person.spouse : '无' },
      { label: '父亲', value: person.father || '—' },
      { label: '职业', value: person.occupation || '—' },
      { label: '葬于', value: person.burial || '—' },
      { label: '备注', value: person.remark || '—' }
    ];
    profileDetails.innerHTML = details.map(function (d) {
      return '<div class="detail-item"><span class="detail-label">' + esc(d.label) + '</span><span class="detail-value">' + esc(d.value) + '</span></div>';
    }).join('');
    drawFamilyTree(person);
  }

  // ---------- 世系图 ----------
  function getAncestorsChain(person) {
    const chain = [];
    let cur = person;
    for (let i = 0; i < 3; i++) {
      const fid = cur.fatherId;
      if (!fid) break;
      const father = personMap.get(fid);
      if (!father) break;
      chain.unshift(father);
      cur = father;
    }
    return chain;
  }

  function getDescendantsByGen(person, maxGen) {
    const byGen = { 1: [], 2: [], 3: [] };
    const queue = [{ p: person, gen: 0 }];
    const visited = new Set([person.id]);
    let head = 0;
    while (head < queue.length) {
      const cur = queue[head++];
      if (cur.gen > 0 && cur.gen <= maxGen) byGen[cur.gen].push(cur.p);
      if (cur.gen < maxGen) {
        const kids = childrenMap.get(cur.p.id) || [];
        kids.forEach(function (child) {
          if (!visited.has(child.id)) {
            visited.add(child.id);
            queue.push({ p: child, gen: cur.gen + 1 });
          }
        });
      }
    }
    return byGen;
  }

  function drawFamilyTree(person) {
    let cached = treeCache.get(person.id);
    if (!cached) {
      cached = { ancestors: getAncestorsChain(person), descendants: getDescendantsByGen(person, 3) };
      treeCache.set(person.id, cached);
    }
    const ancestors = cached.ancestors;
    const descendants = cached.descendants;

    const levels = [
      { label: '曾祖', nodes: [] },
      { label: '祖父', nodes: [] },
      { label: '父亲', nodes: [] },
      { label: '本人', nodes: [person] },
      { label: '子女', nodes: descendants[1] || [] },
      { label: '孙辈', nodes: descendants[2] || [] },
      { label: '曾孙', nodes: descendants[3] || [] }
    ];
    if (ancestors.length >= 3) levels[0].nodes = [ancestors[0]];
    if (ancestors.length >= 2) levels[1].nodes = [ancestors[ancestors.length - 2]];
    if (ancestors.length >= 1) levels[2].nodes = [ancestors[ancestors.length - 1]];

    let treeHtml = '<div class="family-tree-vis">';
    levels.forEach(function (level, idx) {
      const nodes = level.nodes;
      treeHtml += '<div class="tree-level">';
      if (nodes.length === 0) {
        treeHtml += '<div class="tree-node empty-node">——</div>';
      } else {
        nodes.forEach(function (node) {
          const isSelf = node.id === person.id;
          const selfClass = isSelf ? 'self-node' : '';
          treeHtml += '<div class="tree-node ' + selfClass + '" data-id="' + node.id + '">' + esc(node.name) + '</div>';
        });
      }
      treeHtml += '</div>';
      if (idx < levels.length - 1) {
        treeHtml += '<div class="connector-line">│</div>';
      }
    });
    treeHtml += '</div>';
    treeContainer.innerHTML = treeHtml;

    // 滚动条居中
    setTimeout(function () {
      if (treeContainer.scrollWidth > treeContainer.clientWidth) {
        treeContainer.scrollLeft = (treeContainer.scrollWidth - treeContainer.clientWidth) / 2;
      }
    }, 50);
  }

  // 图谱事件委托（整个容器只挂一次监听）
  treeContainer.addEventListener('click', function (e) {
    const node = e.target.closest('.tree-node[data-id]');
    if (!node) return;
    const p = personMap.get(Number(node.dataset.id));
    if (p) selectPerson(p, true);
  });

  // ---------- 本地文件预览（仅预览，不持久化） ----------
  function loadScript(src) {
    return new Promise(function (resolve, reject) {
      if (window.XLSX) return resolve();
      const script = document.createElement('script');
      script.src = src;
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // 健壮 CSV 解析：支持引号包裹的逗号/换行、BOM、\r\n
  function parseCsv(text) {
    if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
    const rows = [];
    let row = [], cell = '', inQ = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (inQ) {
        if (ch === '"') {
          if (text[i + 1] === '"') { cell += '"'; i++; }
          else inQ = false;
        } else cell += ch;
      } else if (ch === '"') {
        inQ = true;
      } else if (ch === ',') {
        row.push(cell.trim()); cell = '';
      } else if (ch === '\n' || ch === '\r') {
        if (ch === '\r' && text[i + 1] === '\n') i++;
        row.push(cell.trim()); cell = '';
        if (row.some(function (c) { return c !== ''; })) rows.push(row);
        row = [];
      } else {
        cell += ch;
      }
    }
    if (cell !== '' || row.length) {
      row.push(cell.trim());
      if (row.some(function (c) { return c !== ''; })) rows.push(row);
    }
    return rows;
  }

  function fromItem(item) {
    return {
      name: item['姓名'] || item.name || '',
      gender: item['性别'] || item.gender || '',
      birth: (item['生'] !== undefined) ? item['生'] : ((item.birth !== undefined) ? item.birth : ''),
      death: (item['卒'] !== undefined) ? item['卒'] : ((item.death !== undefined) ? item.death : ''),
      spouse: item['配偶'] || item.spouse || '',
      father: item['父亲'] || item.father || '',
      generation: item['字辈'] || item.generation || '',
      occupation: item['职业'] || item.occupation || '',
      burial: item['葬于'] || item.burial || '',
      remark: item['备注'] || item.remark || ''
    };
  }

  function parseMatrix(matrix) {
    const headers = matrix[0].map(function (h) { return String(h).trim(); });
    return matrix.slice(1).map(function (row) {
      const obj = {};
      headers.forEach(function (h, i) { obj[h] = row[i] !== undefined ? row[i] : ''; });
      return fromItem(obj);
    }).filter(function (p) { return p.name; });
  }

  async function handleFileUpload(file) {
    const fileName = file.name.toLowerCase();
    let records = null;
    if (fileName.endsWith('.json')) {
      const text = await file.text();
      const json = JSON.parse(text);
      if (Array.isArray(json)) {
        records = (json.length && Array.isArray(json[0])) ? parseMatrix(json) : json.map(fromItem).filter(function (p) { return p.name; });
      } else if (json && Array.isArray(json.records)) {
        records = json.records;
      }
    } else if (fileName.endsWith('.csv')) {
      const rows = parseCsv(await file.text());
      if (rows.length) records = parseMatrix(rows);
    } else {
      await loadScript('https://cdn.sheetjs.com/xlsx-0.20.1/package/dist/xlsx.full.min.js');
      const data = await file.arrayBuffer();
      const wb = XLSX.read(data);
      const sheet = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
      if (rows.length) records = parseMatrix(rows);
    }
    if (!records || !records.length) throw new Error('文件中没有可用数据（需包含表头：姓名、性别、生、卒、配偶、父亲、字辈、职业、葬于、备注）');
    setData(records);
    previewBanner.classList.add('show');
    alert('成功导入 ' + familyData.length + ' 条记录（仅本地预览，刷新后恢复线上数据）');
  }

  uploadBtn.addEventListener('click', function () { fileInput.click(); });
  fileInput.addEventListener('change', function (e) {
    const file = e.target.files[0];
    if (!file) return;
    handleFileUpload(file).catch(function (err) { alert('处理出错: ' + err); });
    fileInput.value = '';
  });

  // =====================================================================
  // 在线编辑管理后台（GitHub API 直写，保留 Excel 批量维护）
  // =====================================================================

  // ---------- 配置 ----------
  const COLUMNS = ['姓名', '性别', '生', '卒', '配偶', '父亲', '字辈', '职业', '葬于', '备注'];
  const GH_API = 'https://api.github.com';

  // 提交服务配置：公开部署，请按 SETUP.md 填写后提交。
  // 安全说明：该 token 会随网页公开，请务必只给它“提交箱仓库”的最小权限（见 SETUP.md）。

  const SITE_DEFAULTS = { siteOwner: 'xushizupu', siteRepo: 'xushizupu.github.io' };

  function getSiteConfig() {
    try {
      const s = JSON.parse(localStorage.getItem('xszp_site') || 'null');
      if (s && s.siteOwner && s.siteRepo) return s;
    } catch (e) { /* ignore */ }
    return SITE_DEFAULTS;
  }

  function isMock() {
    return new URLSearchParams(location.search).get('mock') === '1' || localStorage.getItem('xszp_mock') === '1';
  }

  // ---------- Base64 / 下载工具 ----------
  function toBase64(str) {
    const bytes = new TextEncoder().encode(str);
    let bin = '';
    for (let i = 0; i < bytes.length; i++) bin += String.fromCharCode(bytes[i]);
    return btoa(bin);
  }
  function fromBase64Bytes(b64) {
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    return bytes;
  }
  // Excel 在中文系统上可能把 CSV 存成 GBK，这里先按 UTF-8 解，出现乱码再按 GBK 解
  function decodeText(bytes) {
    const utf8 = new TextDecoder('utf-8');
    try {
      const s = utf8.decode(bytes);
      if (s.indexOf('\uFFFD') === -1) return s;
    } catch (e) { /* fallthrough */ }
    try { return new TextDecoder('gbk').decode(bytes); } catch (e) { return utf8.decode(bytes); }
  }
  function toCsv(rows) {
    return rows.map(function (row) {
      return row.map(function (cell) {
        const s = String(cell == null ? '' : cell);
        return /[",\n\r]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
      }).join(',');
    }).join('\r\n');
  }
  function downloadText(filename, text) {
    const blob = new Blob([text], { type: 'text/csv;charset=utf-8' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    setTimeout(function () { URL.revokeObjectURL(a.href); a.remove(); }, 500);
  }

  // ---------- GitHub API 封装（支持演示模式） ----------
  function ghKey(owner, repo, path) { return 'xszp_mock:' + owner + '/' + repo + '/' + path; }
  function ghPathUrl(owner, repo, path) {
    return GH_API + '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo)
      + '/contents/' + path.split('/').map(encodeURIComponent).join('/');
  }

  async function ghGetFile(owner, repo, path, token) {
    if (isMock()) {
      const raw = localStorage.getItem(ghKey(owner, repo, path));
      if (!raw) return null;
      const o = JSON.parse(raw);
      return { sha: o.sha, bytes: new TextEncoder().encode(o.content) };
    }
    const res = await fetch(ghPathUrl(owner, repo, path), {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token }
    });
    if (res.status === 404) return null;
    if (!res.ok) {
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); msg = j.message || msg; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    const j = await res.json();
    return { sha: j.sha, bytes: fromBase64Bytes(j.content) };
  }

  async function ghWriteFile(owner, repo, path, content, message, token) {
    if (isMock()) {
      localStorage.setItem(ghKey(owner, repo, path), JSON.stringify({ sha: 'mock-sha-' + Date.now(), content: content }));
      return { ok: true };
    }
    let lastErr = null;
    for (let attempt = 0; attempt < 3; attempt++) {
      const cur = await ghGetFile(owner, repo, path, token);
      const body = { message: message, content: toBase64(content) };
      if (cur) body.sha = cur.sha;
      const res = await fetch(ghPathUrl(owner, repo, path), {
        method: 'PUT',
        headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });
      if (res.ok) return await res.json();
      if (res.status === 409) { lastErr = new Error('文件刚被他人修改，已自动重试…'); continue; }
      let msg = 'HTTP ' + res.status;
      try { const j = await res.json(); msg = j.message || msg; } catch (e) { /* ignore */ }
      throw new Error(msg);
    }
    throw lastErr || new Error('写入失败');
  }

  // ---------- 视图切换（#submit / #admin / 浏览） ----------
  function showView(view) {
    const updateView = document.getElementById('updateView');
    const adminView = document.getElementById('adminView');
    const mainGrid = document.getElementById('mainGrid');
    const searchBar = document.getElementById('searchBar');
    updateView.style.display = (view === 'update') ? 'block' : 'none';
    adminView.style.display = (view === 'admin') ? 'block' : 'none';
    mainGrid.style.display = (view === 'browse') ? '' : 'none';
    searchBar.style.display = (view === 'browse') ? '' : 'none';
    if (view === 'admin') loadAdminView();
  }

  function navigateTo(h, viewName) {
    if (location.hash === h) showView(viewName);
    else location.hash = h;
  }
  function goHome() {
    try { history.replaceState(null, '', location.pathname + location.search); } catch (e) { /* ignore */ }
    showView('browse');
  }

  document.getElementById('updateNavBtn').addEventListener('click', function () { navigateTo('#update', 'update'); });
  document.getElementById('adminFooterLink').addEventListener('click', function (e) {
    e.preventDefault();
    navigateTo('#admin', 'admin');
  });
  document.getElementById('updateBack').addEventListener('click', goHome);
  document.getElementById('adminBack').addEventListener('click', goHome);


  // ---------- 管理后台 ----------
  let adminLogged = false;
  let adminToken = '';
  let adminHeader = COLUMNS.slice();
  let adminRows = [];
  let adminSearch = '';
  let adminPage = 1;
  const ADMIN_PAGE = 100;

  function adminConf() {
    return {
      owner: document.getElementById('ad_owner').value.trim(),
      repo: document.getElementById('ad_repo').value.trim(),
      token: document.getElementById('ad_token').value.trim()
    };
  }

  function showAdminPanel() {
    document.getElementById('adminLogin').style.display = 'none';
    document.getElementById('adminPanel').style.display = '';
  }

  // 登录前先用 GitHub API 验证 token：有效且有仓库读权限才允许进入后台
  async function verifyToken(owner, repo, token) {
    const res = await fetch(GH_API + '/repos/' + encodeURIComponent(owner) + '/' + encodeURIComponent(repo), {
      headers: { Accept: 'application/vnd.github+json', Authorization: 'Bearer ' + token }
    });
    if (res.status === 401) throw new Error('Token 无效或已过期（Bad credentials）');
    if (res.status === 403) throw new Error('Token 没有该仓库的访问权限（请检查 Repository access）');
    if (res.status === 404) throw new Error('仓库不存在或无访问权限，请检查 Owner / 仓库名');
    if (!res.ok) throw new Error('验证失败：HTTP ' + res.status);
    return true;
  }

  async function loadAdminView() {
    document.getElementById('adExitMockBtn').style.display = isMock() ? '' : 'none';
    const sc = getSiteConfig();
    document.getElementById('ad_owner').value = sc.siteOwner;
    document.getElementById('ad_repo').value = sc.siteRepo;
    const saved = localStorage.getItem('xszp_admintoken');
    if (saved) document.getElementById('ad_token').value = saved;
    const msg = document.getElementById('adLoginMsg');
    if (isMock()) {
      adminLogged = true;
      adminToken = 'mock';
      showAdminPanel();
      try { await refreshAdminData(); } catch (e) { /* ignore */ }
      return;
    }
    if (saved) {
      // 用保存的 token 自动验证，失效则清除并停留在登录页
      msg.style.display = 'block';
      try {
        const c = adminConf();
        await verifyToken(c.owner || sc.siteOwner, c.repo || sc.siteRepo, saved);
        adminLogged = true;
        adminToken = saved;
        showAdminPanel();
        await refreshAdminData();
      } catch (err) {
        localStorage.removeItem('xszp_admintoken');
        document.getElementById('ad_token').value = '';
        msg.className = 'msg error';
        msg.textContent = '保存的 Token 已失效，请重新登录：' + err.message;
      }
    }
  }

  async function refreshAdminData() {
    const c = adminConf();
    const owner = c.owner || getSiteConfig().siteOwner;
    const repo = c.repo || getSiteConfig().siteRepo;
    document.getElementById('adRepoLabel').textContent = owner + '/' + repo + (isMock() ? '（演示模式）' : '');
    await loadCsv(owner, repo, c.token);
  }

  document.getElementById('adLoginBtn').addEventListener('click', async function () {
    const c = adminConf();
    const msg = document.getElementById('adLoginMsg');
    msg.style.display = 'block';
    if (isMock()) {
      adminToken = 'mock';
      adminLogged = true;
      showAdminPanel();
      try { await refreshAdminData(); } catch (e) { /* ignore */ }
      return;
    }
    if (!c.token) { msg.className = 'msg error'; msg.textContent = '请输入管理员 Token'; return; }
    const owner = c.owner || getSiteConfig().siteOwner;
    const repo = c.repo || getSiteConfig().siteRepo;
    msg.className = 'msg';
    msg.textContent = '正在验证 Token…';
    try {
      await verifyToken(owner, repo, c.token);
      adminToken = c.token;
      localStorage.setItem('xszp_admintoken', adminToken);
      localStorage.setItem('xszp_site', JSON.stringify({ siteOwner: owner, siteRepo: repo }));
      adminLogged = true;
      showAdminPanel();
      await refreshAdminData();
      msg.className = 'msg ok';
      msg.textContent = '✅ 已连接仓库';
    } catch (err) {
      // 验证失败：停留在登录页，不进入后台
      msg.className = 'msg error';
      msg.textContent = '无法进入后台：' + err.message;
    }
  });

  document.getElementById('adMockBtn').addEventListener('click', async function () {
    localStorage.setItem('xszp_mock', '1');
    adminToken = 'mock';
    adminLogged = true;
    showAdminPanel();
    try { await refreshAdminData(); } catch (e) { /* ignore */ }
  });

  document.getElementById('adExitMockBtn').addEventListener('click', function () {
    localStorage.removeItem('xszp_mock');
    location.reload();
  });

  document.getElementById('adLogoutBtn').addEventListener('click', function () {
    adminLogged = false;
    adminToken = '';
    localStorage.removeItem('xszp_admintoken');
    document.getElementById('ad_token').value = '';
    document.getElementById('adminPanel').style.display = 'none';
    document.getElementById('adminLogin').style.display = '';
  });

  document.getElementById('adRefreshBtn').addEventListener('click', async function () {
    try { await refreshAdminData(); } catch (e) { alert('刷新失败：' + e.message); }
  });


  function fieldIndex(h) {
    const map = { '姓名': 'name', '性别': 'gender', '生': 'birth', '卒': 'death', '配偶': 'spouse', '父亲': 'father', '字辈': 'generation', '职业': 'occupation', '葬于': 'burial', '备注': 'remark' };
    return map[h] || '';
  }

  // ---- 在线编辑 source.csv ----
  async function loadCsv(owner, repo, token) {
    let csvText = null;
    if (isMock()) {
      const f = await ghGetFile(owner, repo, 'source.csv', token);
      if (f) {
        csvText = decodeText(f.bytes);
      } else {
        csvText = '\uFEFF' + toCsv([COLUMNS].concat(familyData.map(function (p) {
          return COLUMNS.map(function (h) {
            const k = fieldIndex(h);
            return (k && p[k] != null) ? String(p[k]) : '';
          });
        })));
      }
    } else {
      const f = await ghGetFile(owner, repo, 'source.csv', token);
      if (!f) throw new Error('仓库中没有 source.csv，请先推送一次数据');
      csvText = decodeText(f.bytes);
    }
    if (csvText.charCodeAt(0) === 0xFEFF) csvText = csvText.slice(1);
    const rows = parseCsv(csvText);
    adminHeader = (rows.length && rows[0].length) ? rows[0] : COLUMNS.slice();
    adminRows = rows.slice(1).map(function (r) {
      while (r.length < adminHeader.length) r.push('');
      return r.slice(0, adminHeader.length);
    });
    adminSearch = '';
    document.getElementById('adSearch').value = '';
    adminPage = 1;
    renderAdminTable();
  }

  function filteredAdminRows() {
    const term = adminSearch.trim().toLowerCase();
    if (!term) return adminRows;
    const nameIdx = adminHeader.indexOf('姓名');
    return adminRows.filter(function (r) {
      const name = nameIdx >= 0 ? String(r[nameIdx] || '') : '';
      return name.toLowerCase().indexOf(term) !== -1;
    });
  }

  function renderAdminTable() {
    const rows = filteredAdminRows();
    const total = rows.length;
    const pages = Math.max(1, Math.ceil(total / ADMIN_PAGE));
    if (adminPage > pages) adminPage = pages;
    const start = (adminPage - 1) * ADMIN_PAGE;
    const slice = rows.slice(start, start + ADMIN_PAGE);
    let html = '<thead><tr>';
    adminHeader.forEach(function (h) { html += '<th>' + esc(h) + '</th>'; });
    html += '<th></th></tr></thead><tbody>';
    slice.forEach(function (row, j) {
      const realIdx = start + j;
      html += '<tr>';
      row.forEach(function (cell, ci) {
        html += '<td><input class="cell-input" data-r="' + realIdx + '" data-c="' + ci + '" value="' + esc(cell) + '"></td>';
      });
      html += '<td><button type="button" class="btn btn-mini" data-del="' + realIdx + '">删除</button></td></tr>';
    });
    html += '</tbody>';
    document.getElementById('adminTable').innerHTML = html;
    let ph = '共 ' + total + ' 行，第 ' + adminPage + '/' + pages + ' 页　';
    ph += '<button type="button" class="btn btn-mini" data-page="prev"' + (adminPage <= 1 ? ' disabled' : '') + '>上一页</button> ';
    ph += '<button type="button" class="btn btn-mini" data-page="next"' + (adminPage >= pages ? ' disabled' : '') + '>下一页</button>';
    document.getElementById('adminPager').innerHTML = ph;
  }

  document.getElementById('adminTable').addEventListener('input', function (e) {
    const t = e.target;
    if (!t.classList.contains('cell-input')) return;
    const r = Number(t.dataset.r), c = Number(t.dataset.c);
    if (!isNaN(r) && !isNaN(c) && adminRows[r]) adminRows[r][c] = t.value;
  });

  document.getElementById('adminTable').addEventListener('click', function (e) {
    const del = e.target.closest('[data-del]');
    if (del) {
      const r = Number(del.dataset.del);
      if (!isNaN(r) && adminRows[r]) {
        const nameIdx = adminHeader.indexOf('姓名');
        const nm = nameIdx >= 0 ? (adminRows[r][nameIdx] || '') : '';
        if (window.confirm('确认删除第 ' + (r + 1) + ' 行（' + nm + '）？')) {
          adminRows.splice(r, 1);
          renderAdminTable();
        }
      }
      return;
    }
    const pg = e.target.closest('[data-page]');
    if (pg) {
      const pages = Math.max(1, Math.ceil(filteredAdminRows().length / ADMIN_PAGE));
      if (pg.dataset.page === 'prev' && adminPage > 1) adminPage--;
      if (pg.dataset.page === 'next' && adminPage < pages) adminPage++;
      renderAdminTable();
    }
  });

  document.getElementById('adAddRowBtn').addEventListener('click', function () {
    adminRows.push(adminHeader.map(function () { return ''; }));
    adminSearch = '';
    document.getElementById('adSearch').value = '';
    adminPage = Math.ceil(adminRows.length / ADMIN_PAGE);
    renderAdminTable();
  });

  document.getElementById('adSearch').addEventListener('input', debounce(function (e) {
    adminSearch = e.target.value;
    adminPage = 1;
    renderAdminTable();
  }, 250));

  async function saveCsv(owner, repo, token, message) {
    const csvText = '\uFEFF' + toCsv([adminHeader].concat(adminRows));
    await ghWriteFile(owner, repo, 'source.csv', csvText, message || '更新族谱数据', token);
  }

  document.getElementById('adSaveBtn').addEventListener('click', async function () {
    const c = adminConf();
    const owner = c.owner || getSiteConfig().siteOwner;
    const repo = c.repo || getSiteConfig().siteRepo;
    const btn = this;
    const msgEl = document.getElementById('adSaveMsg');
    msgEl.style.display = 'block';
    btn.disabled = true;
    msgEl.className = 'msg';
    msgEl.textContent = '正在保存到 GitHub…';
    try {
      await saveCsv(owner, repo, c.token || 'mock', '管理后台在线编辑族谱');
      msgEl.className = 'msg ok';
      msgEl.textContent = '✅ 已保存到 source.csv。GitHub Actions 将自动重新生成 data.json，约 1 分钟后网站更新。';
    } catch (err) {
      msgEl.className = 'msg error';
      msgEl.textContent = '保存失败：' + err.message;
    } finally {
      btn.disabled = false;
    }
  });

  document.getElementById('adExportBtn').addEventListener('click', function () {
    downloadText('族谱数据.csv', '\uFEFF' + toCsv([adminHeader].concat(adminRows)));
  });
  // ---------- 启动 ----------
  renderGenButtons();
  loadData();
})();


