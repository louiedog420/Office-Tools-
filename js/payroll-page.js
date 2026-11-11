(function () {
  "use strict";

  var PC = window.PayrollCalc;
  var STORAGE_KEY = "payroll-helper-v1";
  var SNAPSHOT_KEY = "office-tools-payroll-snapshot";
  var DAYS = PC.DAYS;
  var DAY_LABEL = PC.DAY_LABEL;
  var uid = PC.uid;
  var roundTo = PC.roundTo;
  var roundHours = PC.roundHours;
  var roundMoney = PC.roundMoney;
  var emptyWeek = PC.emptyWeek;
  var cloneWeek = PC.cloneWeek;
  var dayOrder = PC.dayOrder;
  var newEmployee = PC.newEmployee;
  var parseTimeToken = PC.parseTimeToken;
  var parseDayInput = PC.parseDayInput;
  var splitWeekHours = PC.splitWeekHours;
  var windowMinutes = PC.windowMinutes;
  var overlapHours = PC.overlapHours;
  var autoSnowHours = PC.autoSnowHours;
  var resolveDaySnow = PC.resolveDaySnow;
  var resolveWeekSnow = PC.resolveWeekSnow;
  var calcWeekPay = PC.calcWeekPay;
  var weekHours = PC.weekHours;
  var calcEmployee = PC.calcEmployee;
  var formatMoney = PC.formatMoney;
  var formatHours = PC.formatHours;
  var parseCSV = PC.parseCSV;
  var importEmployeesCSV = PC.importEmployeesCSV;
  var sampleEmployees = PC.sampleEmployees;

  function defaultState() {
    return {
      businessName: "",
      periodStart: "",
      periodEnd: "",
      preparedBy: "",
      period: "weekly",
      weekStarts: "monday",
      lunchMinutes: 30,
      snowPremium: 5,
      snowStart: "4:00 PM",
      snowEnd: "7:00 PM",
      activeWeek: 1,
      employees: [],
      explainId: null
    };
  }

  var state = defaultState();


  function publishSnapshot() {
    try {
      var rows = calcAll();
      var g = grandTotals(rows);
      var worked = g.regularHours + g.otHours + g.dtHours + g.snowHours;
      if (!(worked > 0 || g.gross > 0)) return;
      var people = [];
      rows.forEach(function (row) {
        if (!row.emp.name && !row.calc.gross) return;
        people.push({
          name: row.emp.name || "(no name yet)",
          regularHours: row.calc.regularHours,
          otHours: row.calc.otHours,
          snowHours: row.calc.snowHours,
          gross: row.calc.gross
        });
      });
      localStorage.setItem(SNAPSHOT_KEY, JSON.stringify({
        savedAt: new Date().toISOString(),
        businessName: state.businessName,
        period: state.period,
        periodStart: state.periodStart,
        periodEnd: state.periodEnd,
        preparedBy: state.preparedBy,
        peopleCount: g.people,
        regularHours: g.regularHours,
        otHours: g.otHours,
        snowHours: g.snowHours,
        regularPay: g.regularPay,
        snowPay: g.snowPay,
        otPay: g.otPay,
        dtPay: g.dtPay,
        bonus: g.bonus,
        tips: g.tips,
        gross: g.gross,
        employees: people
      }));
    } catch (err) { /* the report can still read the live payroll list */ }
  }
  function save() {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
      publishSnapshot();
      var el = document.getElementById("save-note");
      if (el) el.textContent = "Saved on this computer as you type.";
    } catch (err) {
      var n = document.getElementById("save-note");
      if (n) n.textContent = "Could not save on this computer (private window?). Copy a CSV download if you need a backup.";
    }
  }
  function blockedValue(input) {
    if (!input || !window.Suite || !Suite.sensitiveWarning) return false;
    var msg = Suite.sensitiveWarning(input.value);
    if (!msg) return false;
    input.value = "";
    Suite.showNotice(msg);
    return true;
  }
  function load() {
    try {
      var raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return;
      var saved = JSON.parse(raw);
      var base = defaultState();
      Object.keys(base).forEach(function (k) {
        if (saved[k] != null) base[k] = saved[k];
      });
      if (!Array.isArray(base.employees)) base.employees = [];
      base.employees = base.employees.map(function (e) {
        var emp = newEmployee();
        Object.keys(emp).forEach(function (k) {
          if (e[k] != null) emp[k] = e[k];
        });
        emp.id = e.id || emp.id;
        emp.week1 = cloneWeek(e.week1);
        emp.week2 = cloneWeek(e.week2);
        emp.snow1 = cloneWeek(e.snow1);
        emp.snow2 = cloneWeek(e.snow2);
        return emp;
      });
      state = base;
    } catch (err) { /* keep defaults */ }
  }

  function opts() {
    return {
      period: state.period,
      lunchMinutes: Number(state.lunchMinutes) || 0,
      snowPremium: state.snowPremium,
      snowStart: state.snowStart,
      snowEnd: state.snowEnd
    };
  }
  function findEmp(id) {
    for (var i = 0; i < state.employees.length; i++) {
      if (state.employees[i].id === id) return state.employees[i];
    }
    return null;
  }
  function calcAll() {
    return state.employees.map(function (e) {
      return { emp: e, calc: calcEmployee(e, opts()) };
    });
  }
  function grandTotals(rows) {
    var g = { people: 0, regularHours: 0, otHours: 0, dtHours: 0, snowHours: 0, regularPay: 0, snowPay: 0, otPay: 0, dtPay: 0, bonus: 0, tips: 0, gross: 0 };
    rows.forEach(function (row) {
      if (!row.emp.name && !row.calc.w1.total && !row.calc.w2.total && !row.calc.gross) return;
      g.people += 1;
      g.regularHours = roundHours(g.regularHours + row.calc.regularHours);
      g.otHours = roundHours(g.otHours + row.calc.otHours);
      g.dtHours = roundHours(g.dtHours + row.calc.dtHours);
      g.snowHours = roundHours(g.snowHours + row.calc.snowHours);
      g.regularPay = roundMoney(g.regularPay + row.calc.regularPay);
      g.snowPay = roundMoney(g.snowPay + row.calc.snowPay);
      g.otPay = roundMoney(g.otPay + row.calc.otPay);
      g.dtPay = roundMoney(g.dtPay + row.calc.dtPay);
      g.bonus = roundMoney(g.bonus + row.calc.bonus);
      g.tips = roundMoney(g.tips + row.calc.tips);
      g.gross = roundMoney(g.gross + row.calc.gross);
    });
    return g;
  }

  function escapeHtml(s) {
    return String(s == null ? "" : s)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function dayTitle(parsed, raw) {
    if (!parsed || parsed.kind === "empty") return "";
    if (parsed.kind === "error") return parsed.error;
    if (parsed.kind === "clock") {
      return formatHours(parsed.hours) + " hours (" + raw + ", minus " + parsed.lunch + " min lunch)";
    }
    if (parsed.kind === "duration") return formatHours(parsed.hours) + " hours (read as hours:minutes)";
    return formatHours(parsed.hours) + " hours";
  }

  function renderSheet() {
    var wrap = document.getElementById("sheet-wrap");
    var tabs = document.getElementById("week-tabs");
    var bi = state.period === "biweekly";
    tabs.hidden = !bi;
    document.getElementById("tab-w1").className = "btn " + (state.activeWeek === 1 ? "" : "secondary");
    document.getElementById("tab-w2").className = "btn " + (state.activeWeek === 2 ? "" : "secondary");
    if (!state.employees.length) {
      wrap.innerHTML = '<div class="empty-state"><p>No one is on the list yet.</p><p>Add a person, import a name-and-rate spreadsheet, or try the sample numbers to see how the math works.</p></div>';
      return;
    }
    var weekKey = (!bi || state.activeWeek === 1) ? "week1" : "week2";
    var dtKey = weekKey === "week1" ? "dt1" : "dt2";
    var order = dayOrder(state.weekStarts);
    var lunch = Number(state.lunchMinutes) || 0;
    var html = '<table class="sheet" id="timesheet"><thead><tr>';
    html += '<th class="sticky">Name</th><th class="rate">Hourly rate</th><th class="otm">OT ×</th>';
    order.forEach(function (d) { html += '<th class="day">' + DAY_LABEL[d] + "</th>"; });
    html += '<th class="extra">DT hours</th><th class="extra">Bonus</th><th class="extra">Tips</th><th>Hours</th><th>Regular</th><th>OT</th><th>Snow</th><th>Week pay</th><th></th>';
    html += "</tr></thead><tbody>";
    state.employees.forEach(function (emp) {
      var calc = calcEmployee(emp, opts());
      var w = weekKey === "week1" ? calc.w1 : calc.w2;
      var info = weekKey === "week1" ? calc.w1info : calc.w2info;
      html += '<tr class="' + (w.ot > 0 ? "has-ot" : "") + '" data-id="' + emp.id + '">';
      html += '<td class="sticky"><input class="name-in" data-k="name" type="text" size="14" value="' + escapeHtml(emp.name) + '" placeholder="First and last name"></td>';
      html += '<td class="rate"><input data-k="rate" type="number" min="0" step="0.01" value="' + escapeHtml(emp.rate) + '" inputmode="decimal"></td>';
      html += '<td class="otm"><input data-k="otMult" type="number" min="0" step="0.1" value="' + escapeHtml(emp.otMult) + '" inputmode="decimal" title="Usually 1.5 for time-and-a-half"></td>';
      order.forEach(function (d) {
        var parsed = info.days[d];
        var raw = emp[weekKey][d] || "";
        var snowKey = weekKey === "week1" ? "snow1" : "snow2";
        if (!emp[snowKey]) emp[snowKey] = emptyWeek();
        var snowRes = resolveDaySnow(emp[snowKey][d], parsed, opts());
        html += '<td class="day">';
        html += '<input data-day="' + d + '" class="day-in' + (parsed.kind === "error" ? " err" : "") + '" type="text" size="10" value="' + escapeHtml(raw) + '" title="' + escapeHtml(dayTitle(parsed, raw)) + '" placeholder="">';
        html += '<span class="snow-lab">Snow</span>';
        html += '<input data-snow-day="' + d + '" class="snow-in" type="text" size="5" inputmode="decimal" value="' + escapeHtml(emp[snowKey][d] || "") + '" placeholder="" title="Hours between the snow-time window. Leave blank to use the clock-in amount' + (snowRes.auto ? " (" + formatHours(snowRes.auto) + ")" : "") + '.">';
        if (snowRes.source === "auto" && snowRes.hours > 0) html += '<span class="snow-auto">auto ' + formatHours(snowRes.hours) + '</span>';
        html += '</td>';
      });
      html += '<td><input data-k="' + dtKey + '" type="number" min="0" step="0.01" value="' + escapeHtml(emp[dtKey]) + '" inputmode="decimal"></td>';
      html += '<td><input data-k="bonus" type="number" min="0" step="0.01" value="' + escapeHtml(emp.bonus) + '" inputmode="decimal"></td>';
      html += '<td><input data-k="tips" type="number" min="0" step="0.01" value="' + escapeHtml(emp.tips) + '" inputmode="decimal"></td>';
      html += '<td class="num">' + formatHours(w.total) + '</td>';
      html += '<td class="num">' + formatHours(w.regular) + '</td>';
      html += '<td class="num ot-num">' + formatHours(w.ot) + '</td>';
      html += '<td class="num">' + formatHours(w.snow) + '</td>';
      html += '<td class="num money">' + formatMoney(w.weekGross) + '</td>';
      html += '<td class="actions"><button type="button" class="btn tiny secondary btn-explain">Explain</button><button type="button" class="btn tiny danger btn-del">Remove</button></td>';
      html += "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  function renderSummary() {
    var rows = calcAll();
    var g = grandTotals(rows);
    document.getElementById("tot-people").textContent = g.people;
    document.getElementById("tot-reg-hrs").textContent = formatHours(g.regularHours);
    document.getElementById("tot-ot-hrs").textContent = formatHours(g.otHours);
    document.getElementById("tot-snow-hrs").textContent = formatHours(g.snowHours);
    document.getElementById("tot-reg-pay").textContent = formatMoney(g.regularPay);
    document.getElementById("tot-snow-pay").textContent = formatMoney(g.snowPay);
    document.getElementById("tot-ot-pay").textContent = formatMoney(g.otPay);
    document.getElementById("tot-gross").textContent = formatMoney(g.gross);

    var bi = state.period === "biweekly";
    var thead = document.querySelector("#summary-table thead");
    var tbody = document.querySelector("#summary-table tbody");
    var tfoot = document.querySelector("#summary-table tfoot");
    var head = "<tr><th>Name</th><th>Rate</th>";
    if (bi) head += "<th>Week 1 hours</th><th>Week 1 OT</th><th>Week 1 snow</th><th>Week 1 pay</th><th>Week 2 hours</th><th>Week 2 OT</th><th>Week 2 snow</th><th>Week 2 pay</th>";
    else head += "<th>Hours</th><th>Regular hours</th><th>OT hours</th><th>Snow hours</th><th>Regular pay</th><th>Snow pay</th><th>OT pay</th>";
    head += "<th>Double-time extra</th><th>Bonus</th><th>Tips</th><th>Gross pay</th></tr>";
    thead.innerHTML = head;

    var body = "";
    rows.forEach(function (row) {
      var e = row.emp, c = row.calc;
      var label = e.name || "(no name yet)";
      body += "<tr><td>" + escapeHtml(label) + "</td><td>" + formatMoney(Number(e.rate) || 0) + "</td>";
      if (bi) {
        body += "<td>" + formatHours(c.w1.total) + "</td><td>" + formatHours(c.w1.ot) + "</td><td>" + formatHours(c.w1.snow) + "</td><td>" + formatMoney(c.w1.weekGross) + "</td>";
        body += "<td>" + formatHours(c.w2.total) + "</td><td>" + formatHours(c.w2.ot) + "</td><td>" + formatHours(c.w2.snow) + "</td><td>" + formatMoney(c.w2.weekGross) + "</td>";
      } else {
        body += "<td>" + formatHours(c.w1.total) + "</td><td>" + formatHours(c.w1.regular) + "</td><td>" + formatHours(c.w1.ot) + "</td><td>" + formatHours(c.w1.snow) + "</td>";
        body += "<td>" + formatMoney(c.w1.regularPay) + "</td><td>" + formatMoney(c.w1.snowPay) + "</td><td>" + formatMoney(c.w1.otPay) + "</td>";
      }
      body += "<td>" + formatMoney(c.dtPay) + "</td><td>" + formatMoney(c.bonus) + "</td><td>" + formatMoney(c.tips) + "</td><td><strong>" + formatMoney(c.gross) + "</strong></td></tr>";
    });
    if (!rows.length) body = '<tr><td colspan="16">No people yet.</td></tr>';
    tbody.innerHTML = body;

    var foot = "<tr><td>Team totals</td><td></td>";
    if (bi) {
      var w1h = 0, w1o = 0, w1s = 0, w1p = 0, w2h = 0, w2o = 0, w2s = 0, w2p = 0;
      rows.forEach(function (row) {
        w1h += row.calc.w1.total; w1o += row.calc.w1.ot; w1s += row.calc.w1.snow; w1p += row.calc.w1.weekGross;
        w2h += row.calc.w2.total; w2o += row.calc.w2.ot; w2s += row.calc.w2.snow; w2p += row.calc.w2.weekGross;
      });
      foot += "<td>" + formatHours(w1h) + "</td><td>" + formatHours(w1o) + "</td><td>" + formatHours(w1s) + "</td><td>" + formatMoney(w1p) + "</td>";
      foot += "<td>" + formatHours(w2h) + "</td><td>" + formatHours(w2o) + "</td><td>" + formatHours(w2s) + "</td><td>" + formatMoney(w2p) + "</td>";
    } else {
      foot += "<td>" + formatHours(rows.reduce(function (s, r) { return s + r.calc.w1.total; }, 0)) + "</td>";
      foot += "<td>" + formatHours(g.regularHours) + "</td><td>" + formatHours(g.otHours) + "</td><td>" + formatHours(g.snowHours) + "</td>";
      foot += "<td>" + formatMoney(g.regularPay) + "</td><td>" + formatMoney(g.snowPay) + "</td><td>" + formatMoney(g.otPay) + "</td>";
    }
    foot += "<td>" + formatMoney(g.dtPay) + "</td><td>" + formatMoney(g.bonus) + "</td><td>" + formatMoney(g.tips) + "</td><td>" + formatMoney(g.gross) + "</td></tr>";
    tfoot.innerHTML = foot;

    var bits = [];
    if (state.businessName) bits.push("<strong>" + escapeHtml(state.businessName) + "</strong>");
    bits.push("Pay summary — " + (bi ? "biweekly" : "weekly"));
    if (state.periodStart || state.periodEnd) {
      bits.push("Period: " + escapeHtml(state.periodStart || "…") + " to " + escapeHtml(state.periodEnd || "…"));
    }
    if (state.preparedBy) bits.push("Prepared by " + escapeHtml(state.preparedBy));
    document.getElementById("print-header").innerHTML = "<p>" + bits.join("<br>") + "</p>";
  }

  function renderExplain() {
    var card = document.getElementById("explain-card");
    var body = document.getElementById("explain-body");
    var emp = findEmp(state.explainId);
    if (!emp) {
      card.classList.remove("open");
      body.innerHTML = "";
      return;
    }
    var c = calcEmployee(emp, opts());
    var name = emp.name || "This person";
    var rate = Number(emp.rate) || 0;
    var html = "";
    var winLabel = (state.snowStart || "4:00 PM") + " and " + (state.snowEnd || "7:00 PM");
    html += "<p><strong>" + escapeHtml(name) + "</strong> is paid " + formatMoney(rate) + " an hour.</p>";

    function weekBlock(label, w) {
      var s = "<p><strong>" + label + ":</strong> " + formatHours(w.total) + " hours worked.</p><ul>";
      s += "<li>Straight-time pay (every hour at the regular rate): " + formatHours(w.total) + " × " + formatMoney(rate) + " = " + formatMoney(w.regularPay) + "</li>";
      if (w.snow > 0) {
        s += "<li>Snow time: " + formatHours(w.snow) + " hour" + (w.snow === 1 ? "" : "s") + " between " + escapeHtml(winLabel) + ", at an extra " + formatMoney(w.snowPremium) + " an hour = " + formatMoney(w.snowPay) + ". These hours are part of the " + formatHours(w.total) + " hours already counted — they still count toward overtime.</li>";
      } else {
        s += "<li>No snow hours this week (no extra " + formatMoney(Number(state.snowPremium) || 5) + " pay).</li>";
      }
      if (w.dt > 0) {
        s += "<li>Double-time extra: " + formatHours(w.dt) + " hour" + (w.dt === 1 ? "" : "s") + " already got straight-time pay, plus an extra " + formatMoney(rate) + " each to make them double-time = " + formatMoney(w.dtPay) + "</li>";
      }
      if (w.ot > 0) {
        var rrShow = w.regularRate;
        s += "<li>Overtime: " + formatHours(w.ot) + " hour" + (w.ot === 1 ? "" : "s") + " over 40.</li>";
        if (w.snowPay > 0) {
          s += "<li>Because there is overtime, the snow extra has to be folded into the overtime rate (that is the federal rule). Blended hourly rate: (" + formatMoney(w.regularPay) + " + " + formatMoney(w.snowPay) + ") ÷ " + formatHours(w.total) + " = " + formatMoney(rrShow) + " (more precisely $" + (Math.round(rrShow * 10000) / 10000).toFixed(4) + ").</li>";
          s += "<li>Overtime extra (half of that blended rate, since overtime is time-and-a-half): " + formatHours(w.ot) + " × ½ × $" + (Math.round(rrShow * 10000) / 10000).toFixed(4) + " = " + formatMoney(w.otPay) + "</li>";
        } else {
          s += "<li>Overtime extra (half of the regular rate): " + formatHours(w.ot) + " × ½ × " + formatMoney(rate) + " = " + formatMoney(w.otPay) + "</li>";
        }
      } else {
        s += "<li>No overtime this week, because hours were not over 40 (after any double-time hours).</li>";
      }
      s += "<li>" + label + " total: " + formatMoney(w.regularPay) + " regular pay + " + formatMoney(w.snowPay) + " snow + " + formatMoney(w.otPay) + " overtime" + (w.dtPay ? " + " + formatMoney(w.dtPay) + " double-time extra" : "") + " = " + formatMoney(w.weekGross) + "</li></ul>";
      return s;
    }

    if (state.period === "biweekly") {
      html += weekBlock("Week 1", c.w1);
      html += weekBlock("Week 2", c.w2);
      if (c.w1.ot + c.w2.ot > 0 && (c.w1.total + c.w2.total) <= 80) {
        html += '<div class="callout">Overtime is counted <strong>each week by itself</strong>, not as hours over 80 for the whole paycheck. ';
        html += escapeHtml(name) + " worked " + formatHours(c.w1.total) + " + " + formatHours(c.w2.total) + " = " + formatHours(c.w1.total + c.w2.total) + " hours across two weeks, ";
        html += "with <strong>" + formatHours(c.otHours) + " overtime hours</strong> — not zero.</div>";
      }
    } else {
      html += weekBlock("This week", c.w1);
    }
    if (c.bonus) html += "<p>Bonus: " + formatMoney(c.bonus) + "</p>";
    if (c.tips) html += "<p>Tips: " + formatMoney(c.tips) + "</p>";
    html += "<p><strong>Gross pay (before taxes): " + formatMoney(c.gross) + "</strong></p>";
    html += "<p>This tool does not take out taxes. The payroll company or accountant still does that part.</p>";
    body.innerHTML = html;
    card.classList.add("open");
  }

  function render() {
    syncSettingsToForm();
    renderSheet();
    renderSummary();
    renderExplain();
  }

  function syncSettingsToForm() {
    document.getElementById("businessName").value = state.businessName;
    document.getElementById("periodStart").value = state.periodStart;
    document.getElementById("periodEnd").value = state.periodEnd;
    document.getElementById("preparedBy").value = state.preparedBy;
    document.getElementById("lunchMinutes").value = state.lunchMinutes;
    document.getElementById("snowPremium").value = state.snowPremium;
    document.getElementById("snowStart").value = state.snowStart;
    document.getElementById("snowEnd").value = state.snowEnd;
    document.querySelectorAll('input[name="period"]').forEach(function (el) {
      el.checked = el.value === state.period;
    });
    document.querySelectorAll('input[name="weekStarts"]').forEach(function (el) {
      el.checked = el.value === state.weekStarts;
    });
  }

  var confirmResolver = null;
  function askConfirm(message, okLabel) {
    return new Promise(function (resolve) {
      document.getElementById("modal-msg").textContent = message;
      document.getElementById("modal-ok").textContent = okLabel || "Yes";
      document.getElementById("modal").classList.add("show");
      confirmResolver = resolve;
    });
  }
  function finishConfirm(answer) {
    document.getElementById("modal").classList.remove("show");
    if (confirmResolver) confirmResolver(answer);
    confirmResolver = null;
  }

  function bindSettings() {
    ["businessName", "periodStart", "periodEnd", "preparedBy"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function (e) {
        if (blockedValue(e.target)) {
          state[id] = "";
          save();
          renderSummary();
          return;
        }
        state[id] = e.target.value;
        save();
        renderSummary();
      });
    });
    document.getElementById("lunchMinutes").addEventListener("input", function (e) {
      state.lunchMinutes = e.target.value === "" ? 0 : Number(e.target.value);
      save();
      render();
    });
    document.getElementById("snowPremium").addEventListener("input", function (e) {
      state.snowPremium = e.target.value === "" ? 0 : Number(e.target.value);
      save();
      render();
    });
    ["snowStart", "snowEnd"].forEach(function (id) {
      document.getElementById(id).addEventListener("input", function (e) {
        if (blockedValue(e.target)) {
          state[id] = id === "snowStart" ? "4:00 PM" : "7:00 PM";
          e.target.value = state[id];
          save();
          render();
          return;
        }
        state[id] = e.target.value;
        save();
        render();
      });
    });
    document.querySelectorAll('input[name="period"]').forEach(function (el) {
      el.addEventListener("change", function () {
        if (!el.checked) return;
        state.period = el.value;
        if (state.period === "weekly") state.activeWeek = 1;
        save();
        render();
      });
    });
    document.querySelectorAll('input[name="weekStarts"]').forEach(function (el) {
      el.addEventListener("change", function () {
        if (!el.checked) return;
        state.weekStarts = el.value;
        save();
        render();
      });
    });
  }

  function applyRowInput(input) {
    var tr = input.closest("tr");
    if (!tr) return;
    var emp = findEmp(tr.getAttribute("data-id"));
    if (!emp) return;
    if (blockedValue(input)) {
      var dayClear = input.getAttribute("data-day");
      var snowClear = input.getAttribute("data-snow-day");
      var keyClear = input.getAttribute("data-k");
      var weekClear = (state.period === "biweekly" && state.activeWeek === 2) ? "week2" : "week1";
      if (dayClear) emp[weekClear][dayClear] = "";
      else if (snowClear) {
        var snowKeyClear = weekClear === "week1" ? "snow1" : "snow2";
        if (!emp[snowKeyClear]) emp[snowKeyClear] = emptyWeek();
        emp[snowKeyClear][snowClear] = "";
      } else if (keyClear === "name") emp.name = "";
      else if (keyClear) emp[keyClear] = "";
      save();
      render();
      return;
    }
    var day = input.getAttribute("data-day");
    var snowDay = input.getAttribute("data-snow-day");
    var k = input.getAttribute("data-k");
    var weekKey = (state.period === "biweekly" && state.activeWeek === 2) ? "week2" : "week1";
    if (day) {
      emp[weekKey][day] = input.value;
      var parsed = parseDayInput(input.value, Number(state.lunchMinutes) || 0);
      if (parsed.kind === "error") input.classList.add("err");
      else input.classList.remove("err");
      input.title = dayTitle(parsed, input.value);
    } else if (snowDay) {
      var snowKey = weekKey === "week1" ? "snow1" : "snow2";
      if (!emp[snowKey]) emp[snowKey] = emptyWeek();
      emp[snowKey][snowDay] = input.value;
    } else if (k) {
      if (k === "name") emp.name = input.value;
      else if (k === "rate" || k === "otMult" || k === "dt1" || k === "dt2" || k === "bonus" || k === "tips") {
        emp[k] = input.value;
      }
    }
    save();
    var calc = calcEmployee(emp, opts());
    var weekKey = (state.period === "biweekly" && state.activeWeek === 2) ? "week2" : "week1";
    var w = weekKey === "week1" ? calc.w1 : calc.w2;
    var tds = tr.querySelectorAll("td");
    var resultStart = tds.length - 6;
    tds[resultStart].textContent = formatHours(w.total);
    tds[resultStart + 1].textContent = formatHours(w.regular);
    tds[resultStart + 2].textContent = formatHours(w.ot);
    tds[resultStart + 3].textContent = formatHours(w.snow);
    tds[resultStart + 4].textContent = formatMoney(w.weekGross);
    tr.classList.toggle("has-ot", w.ot > 0);
    renderSummary();
    if (state.explainId === emp.id) renderExplain();
  }

  function bindSheet() {
    var wrap = document.getElementById("sheet-wrap");
    wrap.addEventListener("input", function (e) {
      if (e.target && e.target.matches("input")) applyRowInput(e.target);
    });
    wrap.addEventListener("change", function (e) {
      if (e.target && e.target.matches("input")) applyRowInput(e.target);
    });
    wrap.addEventListener("click", function (e) {
      var explainBtn = e.target.closest(".btn-explain");
      var delBtn = e.target.closest(".btn-del");
      var tr = e.target.closest("tr");
      if (!tr) return;
      var id = tr.getAttribute("data-id");
      if (explainBtn) {
        state.explainId = id;
        save();
        renderExplain();
        document.getElementById("explain-card").scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
      if (delBtn) {
        var emp = findEmp(id);
        var label = emp && emp.name ? emp.name : "this person";
        askConfirm("Remove " + label + " from the list?", "Yes, remove").then(function (ok) {
          if (!ok) return;
          state.employees = state.employees.filter(function (x) { return x.id !== id; });
          if (state.explainId === id) state.explainId = null;
          save();
          render();
        });
      }
    });
  }

  function csvEscape(v) {
    var s = String(v == null ? "" : v);
    if (/[",\n]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
    return s;
  }
  function downloadText(filename, text) {
    var blob = new Blob([text], { type: "text/csv;charset=utf-8" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 500);
  }

  function exportPayReport() {
    var bi = state.period === "biweekly";
    var order = dayOrder(state.weekStarts);
    var headers = ["Name", "Hourly Rate", "OT Multiplier"];
    function weekHeaders(prefix) {
      order.forEach(function (d) { headers.push(prefix + " " + DAY_LABEL[d]); });
      headers.push(prefix + " Total Hours", prefix + " Regular Hours", prefix + " OT Hours", prefix + " Snow Hours", prefix + " Double-Time Hours", prefix + " Regular Pay", prefix + " Snow Pay", prefix + " OT Pay", prefix + " Double-Time Extra", prefix + " Week Pay");
    }
    weekHeaders("W1");
    if (bi) weekHeaders("W2");
    headers.push("Bonus", "Tips", "Gross Pay");
    var lines = [headers.map(csvEscape).join(",")];
    calcAll().forEach(function (row) {
      var e = row.emp, c = row.calc;
      var rec = [e.name, Number(e.rate) || 0, Number(e.otMult) || 1.5];
      function pushWeek(weekObj, w) {
        order.forEach(function (d) { rec.push(weekObj[d] || ""); });
        rec.push(formatHours(w.total), formatHours(w.regular), formatHours(w.ot), formatHours(w.snow), formatHours(w.dt),
          w.regularPay.toFixed(2), w.snowPay.toFixed(2), w.otPay.toFixed(2), w.dtPay.toFixed(2), w.weekGross.toFixed(2));
      }
      pushWeek(e.week1, c.w1);
      if (bi) pushWeek(e.week2, c.w2);
      rec.push(c.bonus.toFixed(2), c.tips.toFixed(2), c.gross.toFixed(2));
      lines.push(rec.map(csvEscape).join(","));
    });
    var g = grandTotals(calcAll());
    lines.push("");
    lines.push(["TEAM TOTALS", "", "", g.regularHours.toFixed(2) + " regular hours", g.otHours.toFixed(2) + " OT hours", g.snowHours.toFixed(2) + " snow hours", g.snowPay.toFixed(2) + " snow pay", g.gross.toFixed(2) + " gross"].map(csvEscape).join(","));
    downloadText("payroll-report.csv", lines.join("\r\n"));
  }

  function exportPeople() {
    var lines = [["Name", "Hourly Rate", "OT Multiplier"].map(csvEscape).join(",")];
    state.employees.forEach(function (e) {
      if (!e.name && e.rate === "") return;
      lines.push([e.name, e.rate, e.otMult].map(csvEscape).join(","));
    });
    downloadText("employee-list.csv", lines.join("\r\n"));
  }

  function clearHoursKeepPeople() {
    state.employees.forEach(function (e) {
      e.week1 = emptyWeek();
      e.week2 = emptyWeek();
      e.dt1 = "";
      e.dt2 = "";
      e.snow1 = emptyWeek();
      e.snow2 = emptyWeek();
      e.bonus = "";
      e.tips = "";
    });
    state.explainId = null;
  }

  function bindButtons() {
    document.getElementById("btn-add").addEventListener("click", function () {
      state.employees.push(newEmployee());
      save();
      render();
      var names = document.querySelectorAll(".name-in");
      if (names.length) names[names.length - 1].focus();
    });
    document.getElementById("btn-import").addEventListener("click", function () {
      document.getElementById("import-file").click();
    });
    document.getElementById("import-file").addEventListener("change", function (e) {
      var file = e.target.files && e.target.files[0];
      e.target.value = "";
      if (!file) return;
      var reader = new FileReader();
      reader.onload = function () {
        var imported = importEmployeesCSV(String(reader.result || ""));
        if (!imported.length) {
          askConfirm("No names were found in that file. Use columns like Name, Rate.", "OK").then(function () {});
          document.getElementById("modal-cancel").style.display = "none";
          setTimeout(function () { document.getElementById("modal-cancel").style.display = ""; }, 400);
          return;
        }
        imported.forEach(function (emp) { state.employees.push(emp); });
        save();
        render();
      };
      reader.readAsText(file);
    });
    document.getElementById("btn-sample").addEventListener("click", function () {
      var go = function () {
        state.employees = sampleEmployees();
        state.explainId = null;
        save();
        render();
      };
      if (state.employees.length) {
        askConfirm("Replace your current list with sample people? The names are made up. This is only for trying the calculator.", "Yes, load samples").then(function (ok) {
          if (ok) go();
        });
      } else go();
    });
    document.getElementById("btn-new-period").addEventListener("click", function () {
      askConfirm("Start a new pay period? This clears hours, snow hours, double-time, bonus, and tips, but keeps every name and pay rate.", "Yes, start new period").then(function (ok) {
        if (!ok) return;
        clearHoursKeepPeople();
        save();
        render();
      });
    });
    document.getElementById("btn-clear").addEventListener("click", function () {
      askConfirm("Clear the payroll page? This erases the list, hours, and settings saved on this computer. The other tools stay. Reports will no longer show this payroll.", "Yes, clear payroll").then(function (ok) {
        if (!ok) return;
        try {
          localStorage.removeItem(STORAGE_KEY);
          localStorage.removeItem(SNAPSHOT_KEY);
        } catch (err) {}
        state = defaultState();
        save();
        render();
      });
    });
    document.getElementById("btn-export").addEventListener("click", exportPayReport);
    document.getElementById("btn-export-people").addEventListener("click", exportPeople);
    document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
    document.getElementById("btn-close-explain").addEventListener("click", function () {
      state.explainId = null;
      save();
      renderExplain();
    });
    document.getElementById("tab-w1").addEventListener("click", function () { state.activeWeek = 1; save(); render(); });
    document.getElementById("tab-w2").addEventListener("click", function () { state.activeWeek = 2; save(); render(); });
    document.getElementById("modal-cancel").addEventListener("click", function () { finishConfirm(false); });
    document.getElementById("modal-ok").addEventListener("click", function () { finishConfirm(true); });
    document.getElementById("modal").addEventListener("click", function (e) {
      if (e.target.id === "modal") finishConfirm(false);
    });
  }

  function maybeLoadDemo() {
    var q = "";
    try { q = String(location.search || ""); } catch (err) {}
    if (q.indexOf("demo=1") >= 0 && !state.employees.length) {
      state.employees = sampleEmployees();
      state.period = q.indexOf("biweekly=1") >= 0 ? "biweekly" : state.period;
    }
  }

  load();
  maybeLoadDemo();
  bindSettings();
  bindSheet();
  bindButtons();
  render();

  window.PayrollHelper = {
    parseTimeToken: parseTimeToken,
    parseDayInput: parseDayInput,
    splitWeekHours: splitWeekHours,
    calcWeekPay: calcWeekPay,
    calcEmployee: calcEmployee,
    weekHours: weekHours,
    overlapHours: overlapHours,
    autoSnowHours: autoSnowHours,
    resolveDaySnow: resolveDaySnow,
    resolveWeekSnow: resolveWeekSnow,
    windowMinutes: windowMinutes,
    roundHours: roundHours,
    roundMoney: roundMoney,
    formatMoney: formatMoney,
    importEmployeesCSV: importEmployeesCSV,
    parseCSV: parseCSV,
    sampleEmployees: sampleEmployees,
    newEmployee: newEmployee,
    getState: function () { return state; },
    setState: function (s) { state = s; save(); render(); },
    loadSample: function () { state.employees = sampleEmployees(); save(); render(); },
    render: render,
    exportPayReport: exportPayReport,
    exportPeople: exportPeople,
    calcAll: calcAll,
    grandTotals: grandTotals,
    dayOrder: dayOrder
  };
})();
