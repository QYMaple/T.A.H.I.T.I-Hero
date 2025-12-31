// battle.js
(function () {
  "use strict";

  /***********************
   * 0) 工具
   ************************/
  function qsParam(name) {
    try {
      const u = new URL(window.location.href);
      return u.searchParams.get(name);
    } catch {
      return null;
    }
  }

  function clamp(v, a, b) {
    return Math.max(a, Math.min(b, v));
  }

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function decodeMaybe(v) {
    try { return decodeURIComponent(v); } catch { return v; }
  }

  function pick(arr) {
    if (!Array.isArray(arr) || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  // ✅ 强制写入 px（覆盖 CSS !important）
  function setPxImportant(el, prop, px) {
    if (!el) return;
    const n = Number(px);
    if (!Number.isFinite(n)) return;
    el.style.setProperty(prop, `${n}px`, "important");
  }

  /***********************
   * 1) 依赖（storage / skills / enemyPool / scenes）
   ************************/
  const storage =
    window.TAHITI?.storage ||
    window.storage ||
    null;

  // ✅ 兼容多种 skills.js 导出命名
  const SKILLS_DB =
    window.SKILLS_DB ||
    window.SKILLS ||
    window.skills ||
    window.TAHITI?.db?.skills ||
    [];

  function byId(id) {
    return SKILLS_DB.find((s) => s && s.id === id) || null;
  }

  function getEnemyPool() {
    return (
      window.TAHITI?.db?.enemyPool ||
      window.TAHITI?.enemyPool ||
      window.enemyPool ||
      null
    );
  }

  function getScenes() {
    return window.TAHITI?.scenes || {};
  }

  /***********************
   * 2) DOM
   ************************/
  const pageRoot = document.getElementById("pageRoot");
  const stageTitleEl = document.getElementById("stageTitle");

  const playerNameEl = document.getElementById("playerName");
  const hpTextEl = document.getElementById("hpText");
  const mpTextEl = document.getElementById("mpText");
  const hpBarEl = document.getElementById("hpBar");
  const mpBarEl = document.getElementById("mpBar");
  const passiveSlotsEl = document.getElementById("passiveSlots");

  const enemyPanelEl = document.getElementById("enemyPanel");
  const enemyNameEl = document.getElementById("enemyName");
  const enemySubEl = document.getElementById("enemySub");
  const ehpTextEl = document.getElementById("ehpText");
  const ehpBarEl = document.getElementById("ehpBar");

  // 注意：你 HTML 已经把 主动在上，增益在下
  const viewportActive = document.getElementById("viewportActive");
  const viewportBuff = document.getElementById("viewportBuff");
  const layerActive = document.getElementById("layerActive");
  const layerBuff = document.getElementById("layerBuff");

  const btnAction = document.getElementById("btnAction");

  const resultOverlay = document.getElementById("resultOverlay");
  const btnHome = document.getElementById("btnHome");
  const btnRetry = document.getElementById("btnRetry");
  const resultTitleEl = resultOverlay ? resultOverlay.querySelector(".result-title") : null;

  // 侧滑面板（我的神力内嵌）
  const btnSide = document.getElementById("btnSide");
  const sidePanel = document.getElementById("sidePanel");
  const sideDim = document.getElementById("sideDim");
  const btnSideClose = document.getElementById("btnSideClose");

  /***********************
   * 3) scene 读取（battle.html?scene=endless）
   ************************/
  const scenes = getScenes();

  const sceneIdRaw = (qsParam("scene") || "").trim();
  const sceneId = sceneIdRaw ? decodeMaybe(sceneIdRaw) : "";

  // 兼容你以前的写法：?stage=xxx
  const stageNameRaw = (qsParam("stage") || "").trim();

  const scene =
    (sceneId && scenes[sceneId]) ||
    scenes.default ||
    null;

  const finalTitle =
    (scene?.title && String(scene.title).trim()) ||
    (stageNameRaw && decodeMaybe(stageNameRaw)) ||
    "未知战场";

  if (stageTitleEl) stageTitleEl.textContent = finalTitle;
  document.title = finalTitle;

  /***********************
   * 4) 玩家：从存档读取 + 计算血蓝
   ************************/
  let player = storage?.loadPlayer
    ? storage.loadPlayer()
    : {
      name: "冒险者",
      str: 10, agi: 10, sta: 10, spi: 10,
      free: 0, gold: 0, diamond: 0,
      level: 1, exp: 0, expNext: 200, progress: "普通1"
    };

  if (playerNameEl) playerNameEl.textContent = player.name || "冒险者";

  const BASE_HP = 0;   // str=10, sta=10 => 3000
  const BASE_MP = 155; // spi=15 => 380

  function calcDerived(p) {
    const str = Number(p.str) || 0;
    const sta = Number(p.sta) || 0;
    const spi = Number(p.spi) || 0;

    const hpMax = BASE_HP + str * 100 + sta * 200;
    const mpMax = BASE_MP + spi * 15;
    return { hpMax, mpMax };
  }

  let { hpMax, mpMax } = calcDerived(player);
  let hp = hpMax;
  let mp = mpMax;

  function renderBars() {
    if (!hpTextEl || !mpTextEl || !hpBarEl || !mpBarEl) return;
    hpTextEl.textContent = `${Math.max(0, Math.round(hp))}/${hpMax}`;
    mpTextEl.textContent = `${Math.max(0, Math.round(mp))}/${mpMax}`;
    hpBarEl.style.width = `${clamp(hpMax ? hp / hpMax : 0, 0, 1) * 100}%`;
    mpBarEl.style.width = `${clamp(mpMax ? mp / mpMax : 0, 0, 1) * 100}%`;
  }
  renderBars();

  /***********************
   * 5) 敌人
   ************************/
  let enemyHpMax = 0;
  let enemyHp = 0;

  function renderEnemy() {
    if (!ehpTextEl || !ehpBarEl) return;
    ehpTextEl.textContent = `${Math.max(0, Math.round(enemyHp))}/${enemyHpMax}`;
    ehpBarEl.style.width =
      enemyHpMax <= 0 ? "0%" : `${clamp(enemyHp / enemyHpMax, 0, 1) * 100}%`;
  }

  function enemyPoolAllIds(pool) {
    if (!pool) return [];

    if (typeof pool.allIds === "function") return pool.allIds();
    if (typeof pool.getAllIds === "function") return pool.getAllIds();

    if (Array.isArray(pool)) return pool.map(x => x?.id).filter(Boolean);

    const candidates =
      pool.list ||
      pool.items ||
      pool.enemies ||
      pool.data ||
      pool.pool ||
      null;

    if (Array.isArray(candidates)) return candidates.map(x => x?.id).filter(Boolean);
    if (candidates && typeof candidates === "object") return Object.keys(candidates);

    return [];
  }

  function enemyPoolFindById(pool, id) {
    if (!pool || !id) return null;

    if (typeof pool.findById === "function") return pool.findById(id);
    if (typeof pool.getById === "function") return pool.getById(id);

    if (Array.isArray(pool)) return pool.find(x => x?.id === id) || null;

    const candidates =
      pool.map ||
      pool.byId ||
      pool.dict ||
      pool.data ||
      pool.pool ||
      null;

    if (candidates && typeof candidates === "object" && candidates[id]) return candidates[id];
    if (pool[id]) return pool[id];

    return null;
  }

  function chooseEnemyId() {
    const forced = (qsParam("enemy") || "").trim();
    if (forced) return decodeMaybe(forced);

    if (scene && scene.pickEnemy === "fixed" && scene.enemyId) {
      return String(scene.enemyId);
    }

    const pool = getEnemyPool();
    const ids = enemyPoolAllIds(pool);
    return pick(ids);
  }

  function applyEnemy(enemyId) {
    const pool = getEnemyPool();

    if (!enemyId) {
      if (enemyNameEl) enemyNameEl.textContent = "未知敌人";
      if (enemySubEl) enemySubEl.textContent = "（enemyPool 没有可用敌人）";
      enemyHpMax = 0;
      enemyHp = 0;
      renderEnemy();
      return;
    }

    const e = enemyPoolFindById(pool, enemyId);

    if (!e) {
      if (enemyNameEl) enemyNameEl.textContent = "未知敌人";
      if (enemySubEl) enemySubEl.textContent = `（敌人ID不存在：${enemyId}）`;
      enemyHpMax = 0;
      enemyHp = 0;
      renderEnemy();
      return;
    }

    if (enemyNameEl) enemyNameEl.textContent = e.name || e.id || "未知敌人";
    if (enemySubEl) enemySubEl.textContent = "";

    const estr = Number(e.str ?? 0) || 0;
    const esta = Number(e.sta ?? 0) || 0;
    
    // 兼容：如果你以后某些敌人仍然手写 hpMax，也能优先用手写的
    const eStr = Number(e.str ?? 0) || 0;
    const eSta = Number(e.sta ?? 0) || 0;
    
    enemyHpMax =
      Number(e.hpMax ?? e.maxHp ?? e.hp ?? 0) ||
      (eStr * 100 + eSta * 200) ||   // ✅ 四属性推血（和玩家同规则）
      1000;
    
    enemyHp = enemyHpMax;

    renderEnemy();
  }

  const initialEnemyId = chooseEnemyId();
  applyEnemy(initialEnemyId);

  /***********************
   * 5.5) 真实伤害（最小可用）
   ************************/
  function flashEnemyHit() {
    if (!enemyPanelEl) return;
    enemyPanelEl.style.outline = "2px solid rgba(239,68,68,0.45)";
    enemyPanelEl.style.boxShadow = "0 0 0 6px rgba(239,68,68,0.08)";
    setTimeout(() => {
      enemyPanelEl.style.outline = "";
      enemyPanelEl.style.boxShadow = "";
    }, 120);
  }

  function calcSkillDamage(skill) {
    const d = (skill && skill.backend && skill.backend.damage) ? skill.backend.damage : {};
  
    // 小工具：依次取第一个“能用的数字”
    function pickNum() {
      for (let i = 0; i < arguments.length; i++) {
        const v = Number(arguments[i]);
        if (Number.isFinite(v)) return v;
      }
      return NaN;
    }
  
    const element = (d.element || d.el || skill?.element || "physical");
  
    // ✅ 兼容更多“倍率字段名”
    let ratio = pickNum(
      d.ratio, d.mul, d.scale, d.coeff, d.k, d.multiplier, d.dmgMul, d.power,
      skill?.damageRatio, skill?.ratio
    );
    if (!Number.isFinite(ratio) || ratio <= 0) ratio = 1;
  
    // ✅ 支持“基础伤害字段名”（加法）
    const flat = pickNum(d.flat, d.base, d.amount, d.add, d.plus, 0) || 0;
  
    // ✅ 支持 stat 指定（默认物理=力量，法术=精神）
    let stat = d.stat || null;
    if (!stat) stat = (element === "physical") ? "str" : "spi";
  
    const statVal = Number(player?.[stat] ?? 0) || 0;
  
    const BASE = 20;
  
    // ✅ 默认按 releaseTurn 放大（超重击通常 releaseTurn 更大，就自然更痛）
    // 如果你哪天不想乘 releaseTurn，可以在 skills.js 里给该技能加：backend.damage.multiplyByReleaseTurn = false
    const dur = durOf(skill);
    const mulByDur = (d.multiplyByReleaseTurn === false) ? 1 : dur;
  
    let amount = Math.round((flat + statVal * BASE * ratio) * mulByDur);
  
    if (!Number.isFinite(amount) || amount <= 0) amount = 1;
    amount = Math.min(amount, 999999);
  
    return { amount, element, stat };
  }

  function applyDamage(amount) {
    if (!Number.isFinite(amount) || amount <= 0) return;
    enemyHp = Math.max(0, enemyHp - amount);
    renderEnemy();
    flashEnemyHit();

    if (enemyHp <= 0) showWin();
  }

  function onActiveSkillTriggered(skill) {
    const { amount } = calcSkillDamage(skill);
    applyDamage(amount);
  }

  /***********************
   * 6) 被动槽位（预留5个）
   ************************/
  function renderPassiveSlots(passiveIds) {
    if (!passiveSlotsEl) return;
    passiveSlotsEl.innerHTML = "";
    for (let i = 0; i < 5; i++) {
      const id = passiveIds[i] || null;
      const s = id ? byId(id) : null;
      const div = document.createElement("div");
      div.className = "p-slot";
      div.textContent = s?.icon ? s.icon : "";
      passiveSlotsEl.appendChild(div);
    }
  }

  /***********************
   * 7) 读取“我的神力”已装备
   ************************/
  const LOADOUT_KEY = "tahiti_loadout_v1";

  function loadLoadout() {
    try {
      const raw = localStorage.getItem(LOADOUT_KEY);
      if (!raw) return { buff: [], active: [], passive: [] };
      const parsed = JSON.parse(raw) || {};
      const pickArr = (k) =>
        (Array.isArray(parsed[k]) ? parsed[k] : [])
          .filter((x) => typeof x === "string" && x.trim())
          .slice(0, 5);

      return {
        buff: pickArr("buff"),
        active: pickArr("active"),
        passive: pickArr("passive")
      };
    } catch {
      return { buff: [], active: [], passive: [] };
    }
  }

  function fallbackIds(type, n) {
    return SKILLS_DB.filter((s) => s && s.type === type).slice(0, n).map((s) => s.id);
  }

  let loadout = loadLoadout();

  // 主动：保留 fallback（否则新号没技能无法打）
  let activeIds = loadout.active.length ? loadout.active : fallbackIds("active", 2);
  let buffIds = loadout.buff.length ? loadout.buff : [];
  let passiveIds = loadout.passive.length ? loadout.passive : [];

  renderPassiveSlots(passiveIds);

  /***********************
   * 7.5) ✅ 冷却系统（按“槽位”独立 + 轮询顺序 + 永不断流）
   *
   * 规则：
   * - 按装备槽顺序轮询（1→2→3→4→5）
   * - 槽位在冷却就跳过（不耗时）
   * - 全部冷却：直接把“战斗时间”快进到最早冷却结束（轴不真空）
   * - 冷却从“技能结束后”开始计：cdUntil = start + releaseTurn + cooldown
   ************************/
  let simTime = 0;          // 战斗时间（秒），不是 performance.now
  let activePtr = 0;        // 轮询指针（槽位索引）
  let slotCdUntil = [];     // 每个槽位独立冷却结束时间（simTime）
  
  function cooldownSecOf(skill) {
    const v = Number(skill?.backend?.cooldownSec ?? 0);
    return Number.isFinite(v) && v > 0 ? v : 0;
  }
  
  function durOf(skill) {
    const d = Number(skill?.releaseTurn ?? 1);
    return Number.isFinite(d) && d > 0 ? d : 1;
  }
  
  function ensureCdArray() {
    const n = activeIds.length;
    if (!Array.isArray(slotCdUntil) || slotCdUntil.length !== n) {
      slotCdUntil = new Array(n).fill(0);
    }
    if (!Number.isFinite(activePtr) || activePtr < 0) activePtr = 0;
    if (n > 0) activePtr = activePtr % n;
  }
  
  function resetAllCooldown() {
    simTime = 0;
    activePtr = 0;
    slotCdUntil = new Array(activeIds.length).fill(0);
  }
  
  // 返回：{ skill, slotIndex }，一定能返回（除非没装备技能）
  function pickNextBySlots() {
    const n = activeIds.length;
    if (n <= 0) return null;
    ensureCdArray();
  
    // 1) 从指针开始找可用槽
    for (let step = 0; step < n; step++) {
      const idx = (activePtr + step) % n;
      if (simTime >= (slotCdUntil[idx] || 0)) {
        const id = activeIds[idx];
        const skill = byId(id) || { id, name: id, icon: "✨", type: "active", releaseTurn: 1, backend: {} };
        activePtr = (idx + 1) % n;
        return { skill, slotIndex: idx };
      }
    }
  
    // 2) 全冷却：快进到最早冷却结束（不真空）
    let earliest = Infinity;
    for (let i = 0; i < n; i++) earliest = Math.min(earliest, Number(slotCdUntil[i] || 0));
    if (Number.isFinite(earliest) && earliest > simTime) simTime = earliest;
  
    // 3) 快进后再找（保证同一时刻多个可用仍按顺序）
    for (let step = 0; step < n; step++) {
      const idx = (activePtr + step) % n;
      if (simTime >= (slotCdUntil[idx] || 0)) {
        const id = activeIds[idx];
        const skill = byId(id) || { id, name: id, icon: "✨", type: "active", releaseTurn: 1, backend: {} };
        activePtr = (idx + 1) % n;
        return { skill, slotIndex: idx };
      }
    }
  
    return null;
  }
  
  function startCooldownForSlot(slotIndex, skill) {
    const cd = cooldownSecOf(skill);
    if (cd <= 0) return;
    ensureCdArray();
    const dur = durOf(skill);
    // ✅ 冷却从技能结束后开始
    slotCdUntil[slotIndex] = simTime + dur + cd;
  }
  
  // ✅ 主动轴“发卡机”：按槽位轮询 + 冷却跳过 + 全冷却快进
  function nextSpawnPlan() {
    const picked = pickNextBySlots();
    if (!picked) return null;
    const { skill, slotIndex } = picked;
    return { skill, slotIndex };
  }

  /***********************
   * 8) 轴 / 卡组（拖拽 + 无缝）
   ************************/
  const AXIS_RATIO = 0.12;

  // 你要“每秒=1格”的话，把速度设成：1格=unit 像素 / 秒
  // （unit 会随轨道高度变化，所以速度要动态计算）
  const MODE = { IDLE: "idle", RUNNING: "running", STOPPING: "stopping", STOPPED: "stopped" };
  let mode = MODE.IDLE;

  let stopStartAt = 0;
  const STOP_DURATION = 700;

  function makeLane(viewportEl, layerEl, type) {
    return {
      viewportEl,
      layerEl,
      type,
      cards: [],
      unit: 10,
      axisX: 10,   // 轴线在 layer 坐标系里的 x
      drag: null   // { pointerId, key, grabDx }
    };
  }

  const laneActive = makeLane(viewportActive, layerActive, "active");
  const laneBuff = makeLane(viewportBuff, layerBuff, "buff");

  function recalcLane(lane) {
    if (!lane?.viewportEl || !lane?.layerEl) return;

    const viewRect = lane.viewportEl.getBoundingClientRect();
    const layerRect = lane.layerEl.getBoundingClientRect();

    const w = viewRect.width || 1;
    const h = viewRect.height || 1;

    lane.unit = h;

    const axisInViewport = w * AXIS_RATIO;

    const axisEl = lane.viewportEl.querySelector(".axis");
    if (axisEl) setPxImportant(axisEl, "left", axisInViewport);

    const axisScreenX = viewRect.left + axisInViewport;
    lane.axisX = axisScreenX - layerRect.left;
  }

  function skillUnits(skill) {
    const v = Number(skill?.releaseTurn);
    if (!Number.isFinite(v) || v <= 0) return 1;
    return v;
  }

  let uid = 0;

  function beginDrag(lane, key, e) {
    const card = lane.cards.find((c) => c.key === key);
    if (!card) return;

    recalcLane(lane);

    const layerRect = lane.layerEl.getBoundingClientRect();
    const px = e.clientX - layerRect.left;

    lane.drag = {
      pointerId: e.pointerId,
      key,
      grabDx: px - card.x
    };

    card.el.style.zIndex = "20";
    try { card.el.setPointerCapture(e.pointerId); } catch { }
    e.preventDefault();
  }

  function setCardSkillVisual(card, newSkill) {
    if (!card || !newSkill || !card.el) return;

    card.skillId = newSkill.id;
    card.skill = newSkill;
    card.el.dataset.skillId = newSkill.id;
    card.el.title = newSkill.name || "技能";

    const ic = card.el.querySelector(".ic");
    if (!ic) return;

    ic.innerHTML = "";
    const icon = newSkill.icon;

    const looksLikeImg =
      typeof icon === "string" &&
      (icon.includes("/") || icon.includes(".")) &&
      /\.(png|jpg|jpeg|webp|svg|gif)$/i.test(icon.trim());

    if (looksLikeImg) {
      const img = document.createElement("img");
      img.src = icon;
      img.alt = newSkill.name || "icon";
    
      // ✅ 关键：禁用浏览器原生“拖拽图片”，否则会抢走你的拖动手势
      img.draggable = false;
      img.setAttribute("draggable", "false");
      img.style.pointerEvents = "none";   // ✅ 让点击/拖动落到 card 上
      img.style.userSelect = "none";
      img.style.webkitUserDrag = "none"; // ✅ 兼容 Chrome/Safari
    
      img.style.width = "100%";
      img.style.height = "100%";
      img.style.objectFit = "contain";
      img.style.display = "block";
      ic.appendChild(img);
    } else {
      ic.textContent = icon || "✨";
      ic.style.fontSize = "18px";
      ic.style.fontWeight = "900";
    }
  }

  function createCardEl(skill, lane) {
    const el = document.createElement("div");
    el.className = `card-skill ${lane.type}`;
    el.dataset.key = `k_${++uid}`;
    el.dataset.skillId = skill.id;

    el.style.top = "0";
    el.style.height = "100%";
    el.style.padding = "0";
    el.style.justifyContent = "center";
    el.style.gap = "0";
    
    // ✅ 关键：禁止浏览器把拖动当成滚动/手势（否则会 pointercancel 然后自动归位）
    el.style.touchAction = "none";
    el.style.userSelect = "none";
    el.style.webkitUserSelect = "none";
    el.style.webkitUserDrag = "none";
    
    const ic = document.createElement("div");
    ic.className = "ic";
    ic.style.height = "74%";
    ic.style.aspectRatio = "1 / 1";
    ic.style.width = "auto";
    ic.style.borderRadius = "12px";
    ic.style.background = "rgba(0,0,0,0.06)";
    ic.style.display = "grid";
    ic.style.placeItems = "center";
    ic.style.overflow = "hidden";
    ic.style.flex = "0 0 auto";

    el.appendChild(ic);

    const tmpCard = { el, skill, skillId: skill.id };
    setCardSkillVisual(tmpCard, skill);

    el.addEventListener("pointerdown", (e) => {
      if (mode === MODE.STOPPING || mode === MODE.STOPPED) return;
      beginDrag(lane, el.dataset.key, e);
    });

    return el;
  }

  function normalizeLane(lane) {
    lane.cards.sort((a, b) => (a.x + a.w / 2) - (b.x + b.w / 2));
    let startX = lane.cards.length ? lane.cards[0].x : 0;

    for (let i = 0; i < lane.cards.length; i++) {
      const c = lane.cards[i];
      c.x = startX;
      setPxImportant(c.el, "left", c.x);
      c.el.style.borderLeft = i === 0 ? "1px solid rgba(0,0,0,0.10)" : "0";
      startX += c.w;
    }
  }

  function alignLaneStartToAxis(lane) {
    if (!lane || !lane.cards || lane.cards.length === 0) return;

    recalcLane(lane);

    lane.cards.sort((a, b) => a.x - b.x);
    const first = lane.cards[0];
    if (!first) return;

    const shift = lane.axisX - first.x;
    // ✅ 增大阈值，避免初始化时微小的调整导致抽动
    if (!Number.isFinite(shift) || Math.abs(shift) < 2) return;

    for (const c of lane.cards) {
      c.x += shift;
      setPxImportant(c.el, "left", c.x);
    }

    lane.cards.sort((a, b) => a.x - b.x);
    for (let i = 0; i < lane.cards.length; i++) {
      lane.cards[i].el.style.borderLeft = (i === 0)
        ? "1px solid rgba(0,0,0,0.10)"
        : "0";
    }
  }

  function alignAllLanesToAxis() {
    alignLaneStartToAxis(laneActive);
    alignLaneStartToAxis(laneBuff);
  }

  function initLane(lane, ids) {
    recalcLane(lane);
    lane.layerEl.innerHTML = "";
    lane.cards = [];

    if (!Array.isArray(ids) || ids.length === 0) return;

    const viewW = lane.viewportEl.getBoundingClientRect().width || 1;
    const targetCover = viewW * 2.2;

    let x = 0;
    let idx = 0;

    while (x < targetCover) {
      const slotIndex = idx % ids.length;
      const baseSkillId = ids[slotIndex];
      const baseSkill =
        byId(baseSkillId) ||
        { id: baseSkillId, name: baseSkillId, icon: "✨", type: lane.type, releaseTurn: 1 };

      const w = skillUnits(baseSkill) * lane.unit;

      const el = createCardEl(baseSkill, lane);
      const key = el.dataset.key;

      setPxImportant(el, "left", x);
      setPxImportant(el, "width", w);

      if (lane.cards.length > 0) el.style.borderLeft = "0";
      lane.layerEl.appendChild(el);

      lane.cards.push({
        key,
        // ✅ 这个卡片代表“哪个装备槽位”
        slotIndex,
        baseSkillId,
        baseSkill,
        skillId: baseSkill.id,
        skill: baseSkill,
        x,
        w,
        el,
        triggered: false
      });

      x += w;
      idx += 1;
    }

    normalizeLane(lane);
  }

  function rebuildAllLanes() {
    loadout = loadLoadout();

    activeIds = loadout.active.length ? loadout.active : fallbackIds("active", 2);
    buffIds = loadout.buff.length ? loadout.buff : [];
    passiveIds = loadout.passive.length ? loadout.passive : [];

    renderPassiveSlots(passiveIds);

    initLane(laneActive, activeIds);
    initLane(laneBuff, buffIds);
  }

  // ✅ 初始化标志：确保初始化完成后再启动主循环
  let lanesInitialized = false;

  // ✅ 延迟初始化，确保 DOM 已渲染，避免刷新时抽动
  function doInitialize() {
    // 等待多个 RAF 确保布局稳定（CSS aspect-ratio 等需要时间计算）
    // 使用 setTimeout 额外延迟，确保所有样式都已应用
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        setTimeout(() => {
          rebuildAllLanes();
          alignAllLanesToAxis();
          lanesInitialized = true;
        }, 0);
      });
    });
  }

  if (document.readyState === 'loading') {
    window.addEventListener('DOMContentLoaded', doInitialize);
  } else {
    doInitialize();
  }

  function moveDrag(lane, e) {
    const drag = lane.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;

    const card = lane.cards.find((c) => c.key === drag.key);
    if (!card) return;

    const layerRect = lane.layerEl.getBoundingClientRect();
    const px = e.clientX - layerRect.left;

    card.x = px - drag.grabDx;
    setPxImportant(card.el, "left", card.x);
  }

    function castOne(card) {
      if (!card) return;
    
      // ✅ 优先释放“这张卡计划好的技能”
      const plan = card.plan;
      if (plan && plan.skill) {
        onActiveSkillTriggered(plan.skill);
        startCooldownForSlot(plan.slotIndex, plan.skill);
    
        // 释放后清掉计划，避免重复（下一次回收会重新写 plan）
        card.plan = null;
        return;
      }
    
      // 兜底：如果还没有 plan，就按当前卡面技能释放（不至于崩）
      const skill = card.skill || byId(card.skillId);
      if (skill) onActiveSkillTriggered(skill);
    }
  
    function triggerCardNowIfOverlapAxis(lane, card) {
      if (!lane || !card) return;
      recalcLane(lane);
  
      const overlapsAxis = card.x < lane.axisX && card.x + card.w > lane.axisX;
      if (!overlapsAxis) return;
  
      card.triggered = true;
      card.el.classList.add("trigger");
      setTimeout(() => card.el.classList.remove("trigger"), 220);
  
      if (mode !== MODE.RUNNING) return;
      if (lane.type !== "active") return;
  
      castOne(card);
    }

  function endDrag(lane, e) {
    const drag = lane.drag;
    if (!drag || drag.pointerId !== e.pointerId) return;

    lane.drag = null;

    const card = lane.cards.find((c) => c.key === drag.key);
    if (!card) return;

    card.el.style.zIndex = "1";

    // ✅ 关键：拖到轴上松手 = 立刻释放（而不是 skip）
    triggerCardNowIfOverlapAxis(lane, card);

    normalizeLane(lane);
  }

  window.addEventListener("pointermove", (e) => {
    moveDrag(laneActive, e);
    moveDrag(laneBuff, e);
  }, { passive: false });

  window.addEventListener("pointerup", (e) => {
    endDrag(laneActive, e);
    endDrag(laneBuff, e);
  }, { passive: false });

  window.addEventListener("pointercancel", (e) => {
    endDrag(laneActive, e);
    endDrag(laneBuff, e);
  }, { passive: false });

  /***********************
   * 9) 滚动与触发（右边缘 <= axisX）
   ************************/
        function tickLane(lane, dtSec, speedFactor) {
          if (!lane.cards || lane.cards.length === 0) return;
        
          recalcLane(lane);
        
          // 每秒滚动 1 格（1格 = unit 像素）
          const dx = lane.unit * speedFactor * dtSec;
        
          // ✅ simTime：只在战斗中推进
          if (lane.type === "active" && mode === MODE.RUNNING) {
            simTime += dx / lane.unit;
          }
        
          // ✅ 贴合函数：无论 dx 是否为 0，只要改过宽度，就必须贴合，不然就会“空洞/重叠/像丢图标”
          function packNoGap() {
            if (lane.drag) return;
            lane.cards.sort((a, b) => a.x - b.x);
            for (let i = 1; i < lane.cards.length; i++) {
              const prev = lane.cards[i - 1];
              const cur = lane.cards[i];
              const desiredX = prev.x + prev.w;
              if (Math.abs(cur.x - desiredX) > 0.6) {
                cur.x = desiredX;
                setPxImportant(cur.el, "left", cur.x);
              }
              cur.el.style.borderLeft = "0";
            }
            if (lane.cards[0]) lane.cards[0].el.style.borderLeft = "1px solid rgba(0,0,0,0.10)";
          }
        
          // ✅ 主动轴：不管是否在战斗，都允许“预览规划”（但战斗前 simTime 不走）
          if (lane.type === "active") {
            const upcoming = lane.cards
              .filter(c => !c.triggered)
              // 右边缘还没过轴的，才算“未来会触发”
              .filter(c => (c.x + c.w) > lane.axisX)
              // 谁的“右边缘”更接近轴，谁更早触发
              .sort((a, b) => (a.x + a.w) - (b.x + b.w));
        
            const n = activeIds.length;
            const cd = Array.isArray(slotCdUntil) ? slotCdUntil.slice() : [];
            let ptr = Number.isFinite(activePtr) ? activePtr : 0;
            let tShadow = Number.isFinite(simTime) ? simTime : 0;
        
            function getSkillBySlot(idx) {
              const id = activeIds[idx];
              return byId(id) || { id, name: id, icon: "✨", type: "active", releaseTurn: 1, backend: {} };
            }
        
            // ✅ 这里的 now 表示“这张卡右边缘过轴的时刻（=技能结束时刻）”
            function pickNextShadow(now) {
              if (n <= 0) return null;
        
              if (cd.length !== n) {
                while (cd.length < n) cd.push(0);
                cd.length = n;
              }
              if (!Number.isFinite(ptr) || ptr < 0) ptr = 0;
              ptr = ptr % n;
        
              tShadow = Math.max(tShadow, now);
        
              // 1) 按轮询找可用：要求【开始时刻 >= 冷却结束】
              // 开始时刻 = 结束时刻 - dur
              for (let step = 0; step < n; step++) {
                const idx = (ptr + step) % n;
                const skill = getSkillBySlot(idx);
                const dur = durOf(skill);
                const cdUntil = Number(cd[idx] || 0);
        
                if ((tShadow - dur) >= cdUntil) {
                  ptr = (idx + 1) % n;
                  return { skill, slotIndex: idx, at: tShadow };
                }
              }
        
              // 2) 全冷却：快进到“最早可能结束”的那个时刻
              let earliestEnd = Infinity;
              for (let i = 0; i < n; i++) {
                const s = getSkillBySlot(i);
                const dur = durOf(s);
                earliestEnd = Math.min(earliestEnd, Number(cd[i] || 0) + dur);
              }
              if (Number.isFinite(earliestEnd) && earliestEnd > tShadow) tShadow = earliestEnd;
        
              // 3) 再找一次
              for (let step = 0; step < n; step++) {
                const idx = (ptr + step) % n;
                const skill = getSkillBySlot(idx);
                const dur = durOf(skill);
                const cdUntil = Number(cd[idx] || 0);
        
                if ((tShadow - dur) >= cdUntil) {
                  ptr = (idx + 1) % n;
                  return { skill, slotIndex: idx, at: tShadow };
                }
              }
        
              return null;
            }
        
            function startCdShadow(slotIndex, skill) {
              const cdSec = cooldownSecOf(skill);
              if (cdSec <= 0) return;
              // ✅ 右边缘触发=结束时刻，冷却从结束后开始
              cd[slotIndex] = tShadow + cdSec;
            }
        
            for (const c of upcoming) {
              const timeToAxis = Math.max(0, (c.x + c.w - lane.axisX) / lane.unit);
              const eventTime = simTime + timeToAxis; // ✅ 结束时刻
        
              const plan = pickNextShadow(eventTime);
              if (!plan || !plan.skill) break;
        
              if (lane.drag && lane.drag.key === c.key) continue;
        
              c.plan = plan;
        
              const w = skillUnits(plan.skill) * lane.unit;
              if (Math.abs(c.w - w) > 0.6) {
                c.w = w;
                setPxImportant(c.el, "width", w);
              }
        
              if (c.skillId !== plan.skill.id) {
                setCardSkillVisual(c, plan.skill);
                c.skill = plan.skill;
                c.skillId = plan.skill.id;
              }
        
              startCdShadow(plan.slotIndex, plan.skill);
            }
        
            // ✅ 关键：即便 dx=0（战斗前），也要把宽度变化贴合掉
            packNoGap();
          }
        
          // 战斗前 dx=0：不滚动，但预览 + 贴合已经做完
          if (dx === 0) return;
        
          // 位移
          for (const c of lane.cards) {
            if (lane.drag && lane.drag.key === c.key) continue;
            c.x -= dx;
            setPxImportant(c.el, "left", c.x);
          }
        
          // ✅ 触发：右边缘过轴才触发
          for (const c of lane.cards) {
            if (c.triggered) continue;
        
            if ((c.x + c.w) <= lane.axisX) {
              c.triggered = true;
              c.el.classList.add("trigger");
              setTimeout(() => c.el.classList.remove("trigger"), 220);
        
              if (mode === MODE.RUNNING && lane.type === "active") {
                const plan = c.plan;
        
                if (plan && plan.skill && Number.isFinite(plan.slotIndex)) {
                  // ✅ 如果玩家拖拽/顺序导致“结束时刻不够”，就把 simTime 快进到合法结束时刻
                  const dur = durOf(plan.skill);
                  const cdUntil = Number(slotCdUntil[plan.slotIndex] || 0);
                  const requiredEnd = cdUntil + dur;
                  if (simTime < requiredEnd) simTime = requiredEnd;
        
                  const n = activeIds.length;
                  if (n > 0) activePtr = (plan.slotIndex + 1) % n;
        
                  onActiveSkillTriggered(plan.skill);
                  startCooldownForSlot(plan.slotIndex, plan.skill);
                } else {
                  const skill = c.skill || byId(c.skillId);
                  if (skill) onActiveSkillTriggered(skill);
                }
              }
            }
          }
        
          // 循环回收（无缝）
          const vw = lane.viewportEl.getBoundingClientRect().width || 1;
          const leftLimit = -vw * 0.35;
        
          let maxRight = -Infinity;
          for (const c of lane.cards) maxRight = Math.max(maxRight, c.x + c.w);
        
          for (const c of lane.cards) {
            if (c.x + c.w < leftLimit) {
              c.x = maxRight;
              setPxImportant(c.el, "left", c.x);
        
              c.triggered = false;
              c.plan = null;
              maxRight = c.x + c.w;
            }
          }
        
          // 贴合，避免缝
          packNoGap();
        }

  /***********************
   * 10) 60fps 主循环
   ************************/
  let lastT = 0;

  function loop(t) {
    if (!lastT) lastT = t;
    const dt = Math.min(0.05, (t - lastT) / 1000);
    lastT = t;

    let speedFactor = 0;

    if (mode === MODE.RUNNING) {
      speedFactor = 1;
    } else if (mode === MODE.STOPPING) {
      const p = clamp((t - stopStartAt) / STOP_DURATION, 0, 1);
      speedFactor = 1 - easeOutCubic(p);
      if (p >= 1) {
        mode = MODE.STOPPED;
        speedFactor = 0;
        showFail();
      }
    } else {
      speedFactor = 0;
    }

    tickLane(laneActive, dt, speedFactor);
    tickLane(laneBuff, dt, speedFactor);

    requestAnimationFrame(loop);
  }
  requestAnimationFrame(loop);

  /***********************
   * 11) 开始 / 撤退
   ************************/
  function setActionButton() {
    if (!btnAction) return;
    if (mode === MODE.IDLE) {
      btnAction.textContent = "开始战斗";
      btnAction.disabled = false;
    } else if (mode === MODE.RUNNING) {
      btnAction.textContent = "撤退";
      btnAction.disabled = false;
    } else {
      btnAction.disabled = true;
    }
  }
  setActionButton();
  
  function startBattle() {
    if (mode !== MODE.IDLE) return;
  
    enemyHp = enemyHpMax;
    renderEnemy();
  
    // 先把轨道对齐
    alignAllLanesToAxis();
  
    // ✅ 重置冷却与轮询指针（计时从 0 开始）
    resetAllCooldown();
  
    // ✅ 不要在开局用 nextSpawnPlan() 预发卡（会把逻辑“写死”，并且会触发 simTime 快进）
    //    开局只清空 plan，让 tickLane 在 RUNNING 时按“到点刷新”逻辑自动规划与刷新卡面
    if (laneActive && Array.isArray(laneActive.cards)) {
      for (const c of laneActive.cards) {
        c.plan = null;
        c.triggered = false;
      }
    }
  
    mode = MODE.RUNNING;
    setActionButton();
  }
  
  function retreatBattle() {
    if (mode !== MODE.RUNNING) return;
    mode = MODE.STOPPING;
    stopStartAt = performance.now();
    if (pageRoot) pageRoot.classList.add("freeze");
    setActionButton();
  }
  
  if (btnAction) {
    btnAction.addEventListener("click", () => {
      if (mode === MODE.IDLE) startBattle();
      else if (mode === MODE.RUNNING) retreatBattle();
    });
  }

  /***********************
   * 12) 结果覆盖层
   ************************/
  function showFail() {
    if (resultTitleEl) resultTitleEl.textContent = "战斗失败";
    if (btnRetry) btnRetry.textContent = "重新战斗";
    if (resultOverlay) {
      resultOverlay.classList.add("show");
      resultOverlay.setAttribute("aria-hidden", "false");
    }
  }

  function showWin() {
    mode = MODE.STOPPED;
    setActionButton();

    if (resultTitleEl) resultTitleEl.textContent = "战斗胜利";
    if (btnRetry) btnRetry.textContent = "再战一次";
    if (resultOverlay) {
      resultOverlay.classList.add("show");
      resultOverlay.setAttribute("aria-hidden", "false");
    }
  }

  if (btnHome) {
    btnHome.addEventListener("click", () => {
      window.location.href = "./index.html";
    });
  }

  if (btnRetry) {
    btnRetry.addEventListener("click", () => {
      window.location.reload();
    });
  }

  /***********************
   * 13) 侧滑“技能调整”
   ************************/
  function openSide() {
    if (mode !== MODE.IDLE) return;
    if (!sidePanel || !sideDim || !btnSide) return;

    sidePanel.classList.add("open");
    sideDim.classList.add("show");
    btnSide.classList.add("hide");
    sidePanel.setAttribute("aria-hidden", "false");
  }

  function closeSide() {
    if (!sidePanel || !sideDim || !btnSide) return;

    sidePanel.classList.remove("open");
    sideDim.classList.remove("show");
    btnSide.classList.remove("hide");
    sidePanel.setAttribute("aria-hidden", "true");

    if (storage?.loadPlayer) player = storage.loadPlayer();
    if (playerNameEl) playerNameEl.textContent = player.name || "冒险者";

    ({ hpMax, mpMax } = calcDerived(player));
    hp = hpMax;
    mp = mpMax;
    renderBars();

    rebuildAllLanes();
    alignAllLanesToAxis();

    const eid = chooseEnemyId();
    applyEnemy(eid);

    if (pageRoot) pageRoot.classList.remove("freeze");
    mode = MODE.IDLE;
    setActionButton();
  }

  if (btnSide) btnSide.addEventListener("click", openSide);
  if (btnSideClose) btnSideClose.addEventListener("click", closeSide);
  if (sideDim) sideDim.addEventListener("click", closeSide);

  /***********************
   * 14) resize / load：重铺轴
   ************************/
  let resizeTimer = null;
  window.addEventListener("resize", () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      rebuildAllLanes();
      alignAllLanesToAxis();
    }, 140);
  });

  // ✅ 移除 load 事件中的重复调用，避免刷新时抽动
  // （初始化时已经调用过了，不需要重复）

  /***********************
   * 15) 调试入口 + 装备变更刷新
   ************************/
  window.TAHITI = window.TAHITI || {};
  window.TAHITI.battle = window.TAHITI.battle || {};
  window.TAHITI.battle.debug = window.TAHITI.battle.debug || {};

  window.TAHITI.battle.debug.pickRandomEnemy = function () {
    const eid = chooseEnemyId();
    applyEnemy(eid);
    return eid;
  };

  window.addEventListener("message", (e) => {
    if (!e || !e.data) return;
    if (e.data.type === "TAHITI_LOADOUT_CHANGED") {
      rebuildAllLanes();
      alignAllLanesToAxis();
    }
  });

})();