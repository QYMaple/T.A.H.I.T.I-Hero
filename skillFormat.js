// skillFormat.js
// 作用：把技能“显示用信息”渲染成带颜色的 HTML（不影响你技能的后台字段）

(function () {
  "use strict";

  window.TAHITI = window.TAHITI || {};
  window.TAHITI.ui = window.TAHITI.ui || {};

  // 你说的颜色规则（以后想加“血”等，直接加在这里）
  const ELEMENT_STYLE = {
    physical: { label: "物理", className: "dmg-physical" },
    fire:     { label: "火",   className: "dmg-fire" },
    ice:      { label: "冰",   className: "dmg-ice" },
    lightning:{ label: "电",   className: "dmg-lightning" },
    poison:   { label: "毒",   className: "dmg-poison" },
    wind:     { label: "风",   className: "dmg-wind" },
    true:     { label: "真伤", className: "dmg-true" },
    blood:    { label: "血",   className: "dmg-blood" },
  };

  function esc(s) {
    return String(s ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#39;");
  }

  // 统一：技能“显示三行”
  // display = { kindText, freq, effectParts }
  // effectParts: [{t:"text",v:"..."},{t:"pct",v:100},{t:"dmg",element:"physical",v:"物理伤害"}]
  function renderEffect(effectParts) {
    if (!Array.isArray(effectParts)) return esc(effectParts || "");

    return effectParts.map(part => {
      if (!part) return "";
      if (part.t === "text") return esc(part.v);

      if (part.t === "pct") {
        // 100 => "100%"
        return `<b>${esc(part.v)}%</b>`;
      }

      if (part.t === "dmg") {
        const key = part.element || "physical";
        const info = ELEMENT_STYLE[key] || { className: "dmg-physical" };
        return `<span class="${info.className}">${esc(part.v || "")}</span>`;
      }

      // 兜底：当普通 text
      return esc(part.v || "");
    }).join("");
  }

  function renderSkillDisplay(skill) {
    const d = skill?.display || {};
    const kindText = d.kindText || "未知";
    const freq = d.freq ?? skill?.releaseTurn ?? 1;

    const effectHTML = renderEffect(d.effectParts);

    return {
      kindText,
      freq,
      effectHTML
    };
  }

  // 导出给页面用
  window.TAHITI.ui.renderSkillDisplay = renderSkillDisplay;

  // 同时导出一个“快速生成 effectParts 的工具”
  // 用法：E.text("对敌方...").pct(100).dmg("physical","物理伤害").done()
  const E = {
    text(v){ this._p.push({t:"text", v}); return this; },
    pct(v){ this._p.push({t:"pct", v}); return this; },
    dmg(element, v){ this._p.push({t:"dmg", element, v}); return this; },
    done(){ const out = this._p; this._p = []; return out; },
    _p: []
  };
  window.TAHITI.ui.E = E;
})();