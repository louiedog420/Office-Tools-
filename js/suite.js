/* Shared helpers for Office Tools: save, backup, CSV, and plain warnings.
   Data stays in this browser (localStorage). Nothing here uploads it.
*/
(function () {
  "use strict";

  var STORE_KEYS = [
    "payroll-helper-v1",
    "office-tools-payroll-snapshot",
    "office-tools-scheduler",
    "office-tools-timeoff",
    "office-tools-invoices",
    "office-tools-hiring",
    "office-tools-fleet"
  ];

  function uid() {
    return "id" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }

  function todayISO() {
    var d = new Date();
    return isoFromDate(d);
  }

  function isoFromDate(d) {
    var m = String(d.getMonth() + 1);
    var day = String(d.getDate());
    if (m.length < 2) m = "0" + m;
    if (day.length < 2) day = "0" + day;
    return d.getFullYear() + "-" + m + "-" + day;
  }

  function addDays(iso, n) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return "";
    var d = new Date(+m[1], +m[2] - 1, +m[3]);
    d.setDate(d.getDate() + n);
    return isoFromDate(d);
  }

  function prettyDate(iso) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(iso || "");
    if (!m) return iso || "";
    var months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return months[+m[2] - 1] + " " + (+m[3]) + ", " + m[1];
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function formatMoney(n) {
    var v = Math.round((Number(n) || 0) * 100) / 100;
    var neg = v < 0;
    var s = Math.abs(v).toFixed(2);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-$" : "$") + parts.join(".");
  }

  function sensitiveWarning(text, opts) {
    var s = String(text || "");
    opts = opts || {};
    if (!s.trim()) return "";
    if (/social\s*security|\bssn\b|\btax\s*id\b/i.test(s)) {
      return "Don't type Social Security numbers or tax IDs here. This page is not a safe place for those.";
    }
    if (/\b\d{3}-\d{2}-\d{4}\b/.test(s)) {
      return "That looks like a Social Security number. Don't type those here.";
    }
    if (/\b(?:routing|account|bank)\s*(?:number|#|no\.?)?\s*[:#]?\s*\d{4,}/i.test(s)) {
      return "Don't type bank account or routing numbers here. Give the paper form to your payroll company instead.";
    }
    if (opts.blockPlainSsn && /(^|[^\d])\d{9}([^\d]|$)/.test(s)) {
      return "That looks like a Social Security number. Don't type those here.";
    }
    return "";
  }

  function showNotice(msg) {
    if (typeof document === "undefined") return;
    var el = document.getElementById("suite-notice");
    if (!el) {
      el = document.createElement("div");
      el.id = "suite-notice";
      el.className = "notice";
      el.setAttribute("role", "alert");
      var main = document.getElementById("main") || document.body;
      main.insertBefore(el, main.firstChild);
    }
    el.textContent = msg || "";
    el.hidden = !msg;
  }

  function loadStore(key, fallback) {
    try {
      var raw = localStorage.getItem(key);
      if (!raw) return fallback;
      return JSON.parse(raw);
    } catch (err) {
      return fallback;
    }
  }

  function saveStore(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (err) {
      showNotice("Could not save on this computer. If this is a private window, use Backup instead.");
      return false;
    }
  }

  function parseCSV(text) {
    text = String(text || "").replace(/^\uFEFF/, "");
    var rows = [];
    var row = [];
    var cur = "";
    var inQ = false;
    for (var i = 0; i < text.length; i++) {
      var c = text[i];
      if (inQ) {
        if (c === '"') {
          if (text[i + 1] === '"') { cur += '"'; i++; }
          else inQ = false;
        } else cur += c;
      } else if (c === '"') inQ = true;
      else if (c === ",") { row.push(cur); cur = ""; }
      else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
      else if (c !== "\r") cur += c;
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows.filter(function (r) { return r.some(function (cell) { return String(cell).trim() !== ""; }); });
  }

  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/^[=+\-@]/.test(s)) s = "'" + s;
    if (/[",\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }

  function toCSV(rows) {
    return rows.map(function (r) { return r.map(csvEscape).join(","); }).join("\r\n");
  }

  function download(filename, text, mime) {
    var blob = new Blob([text], { type: mime || "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function backupObject() {
    var stores = {};
    STORE_KEYS.forEach(function (key) {
      var value = loadStore(key, null);
      if (value != null) stores[key] = value;
    });
    return {
      officeToolsBackup: 1,
      exportedAt: new Date().toISOString(),
      note: "Office Tools backup. This file is only a copy of what was saved in one browser. It was not uploaded.",
      stores: stores
    };
  }

  function downloadBackup() {
    var data = backupObject();
    var count = Object.keys(data.stores).length;
    download(
      "office-tools-backup-" + todayISO() + ".json",
      JSON.stringify(data, null, 2),
      "application/json"
    );
    showNotice(count ? "Backup downloaded. Keep that file somewhere safe." : "Backup downloaded. There was nothing saved yet, so the file is almost empty.");
  }

  function applyBackup(data) {
    if (!data || data.officeToolsBackup !== 1 || !data.stores || typeof data.stores !== "object") {
      showNotice("That file is not an Office Tools backup.");
      return false;
    }
    STORE_KEYS.forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(data.stores, key) && data.stores[key] != null) {
        localStorage.setItem(key, JSON.stringify(data.stores[key]));
      } else {
        localStorage.removeItem(key);
      }
    });
    return true;
  }

  var confirmResolver = null;
  function ensureModal() {
    var el = document.getElementById("suite-modal");
    if (el) return el;
    el = document.createElement("div");
    el.id = "suite-modal";
    el.className = "modal-backdrop";
    el.innerHTML = '<div class="modal" role="dialog" aria-modal="true"><p id="suite-modal-msg"></p><div class="modal-actions"><button type="button" class="btn secondary" id="suite-modal-cancel">Cancel</button><button type="button" class="btn" id="suite-modal-ok">Yes</button></div></div>';
    document.body.appendChild(el);
    document.getElementById("suite-modal-cancel").addEventListener("click", function () { finishConfirm(false); });
    document.getElementById("suite-modal-ok").addEventListener("click", function () { finishConfirm(true); });
    el.addEventListener("click", function (e) { if (e.target.id === "suite-modal") finishConfirm(false); });
    return el;
  }
  function finishConfirm(answer) {
    var el = document.getElementById("suite-modal");
    if (el) el.classList.remove("show");
    if (confirmResolver) confirmResolver(answer);
    confirmResolver = null;
  }
  function confirm(message, okLabel) {
    var el = ensureModal();
    document.getElementById("suite-modal-msg").textContent = message;
    document.getElementById("suite-modal-ok").textContent = okLabel || "Yes";
    el.classList.add("show");
    return new Promise(function (resolve) { confirmResolver = resolve; });
  }

  function mountDataTools(el) {
    if (!el || el.dataset.ready === "1") return;
    el.dataset.ready = "1";
    el.innerHTML = ''
      + '<h2>Backup / Restore all data</h2>'
      + '<p class="hint">This downloads every Office Tool saved in this browser: payroll, schedule, time off, invoices, hiring, and fleet. It is a file on your computer. Nothing is uploaded. Save a backup every week, or before someone else uses this computer.</p>'
      + '<div class="toolbar">'
      + '<button type="button" class="btn gold" id="suite-backup">Download backup (JSON)</button>'
      + '<button type="button" class="btn secondary" id="suite-restore">Restore from backup</button>'
      + '</div>'
      + '<input type="file" id="suite-restore-file" accept="application/json,.json" class="sr-only">'
      + '<p class="hint">Do not type Social Security numbers or bank account numbers in any box on this site.</p>';
    el.querySelector("#suite-backup").addEventListener("click", downloadBackup);
    el.querySelector("#suite-restore").addEventListener("click", function () {
      el.querySelector("#suite-restore-file").click();
    });
    el.querySelector("#suite-restore-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var data = null;
        try { data = JSON.parse(String(reader.result || "")); }
        catch (err) {
          showNotice("That file could not be read. Choose the JSON backup you downloaded.");
          return;
        }
        confirm("Replace everything saved in this browser with that backup file?", "Yes, restore").then(function (ok) {
          if (!ok) return;
          if (!applyBackup(data)) return;
          window.location.reload();
        });
      };
      reader.readAsText(file);
    });
  }

  function knownEmployeeNames() {
    var names = {};
    function add(n) {
      n = String(n || "").trim();
      if (n) names[n] = true;
    }
    var pay = loadStore("payroll-helper-v1", null);
    if (pay && Array.isArray(pay.employees)) pay.employees.forEach(function (e) { add(e.name); });
    var sch = loadStore("office-tools-scheduler", null);
    if (sch && Array.isArray(sch.employees)) sch.employees.forEach(function (e) { add(e.name); });
    var off = loadStore("office-tools-timeoff", null);
    if (off) {
      (off.requests || []).forEach(function (r) { add(r.employee); });
      (off.callouts || []).forEach(function (r) { add(r.employee); });
      (off.tardies || []).forEach(function (r) { add(r.employee); });
    }
    return Object.keys(names).sort(function (a, b) { return a.localeCompare(b); });
  }

  function fillNameList(listId) {
    var el = document.getElementById(listId);
    if (!el) return;
    el.innerHTML = knownEmployeeNames().map(function (n) {
      return "<option value=\"" + escapeHtml(n) + "\"></option>";
    }).join("");
  }

  var Suite = {
    STORE_KEYS: STORE_KEYS,
    uid: uid,
    todayISO: todayISO,
    isoFromDate: isoFromDate,
    addDays: addDays,
    prettyDate: prettyDate,
    escapeHtml: escapeHtml,
    formatMoney: formatMoney,
    sensitiveWarning: sensitiveWarning,
    showNotice: showNotice,
    loadStore: loadStore,
    saveStore: saveStore,
    parseCSV: parseCSV,
    csvEscape: csvEscape,
    toCSV: toCSV,
    download: download,
    confirm: confirm,
    mountDataTools: mountDataTools,
    knownEmployeeNames: knownEmployeeNames,
    fillNameList: fillNameList,
    backupObject: backupObject
  };

  if (typeof window !== "undefined") window.Suite = Suite;

  function boot() {
    var el = document.getElementById("data-tools");
    if (el) mountDataTools(el);
  }
  if (typeof document !== "undefined") {
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
    else boot();
  }
})();
