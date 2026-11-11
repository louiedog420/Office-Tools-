/* Payroll math for Office Tools.
   Same rules as the original Payroll Helper:
   - Overtime is hours over 40 in one workweek, at 1.5x unless you set another multiplier.
   - A biweekly paycheck is two separate weeks. Hours are not averaged over 80.
   - Snow time (default 4:00 PM to 7:00 PM) earns an extra amount per hour (default $5).
     Those hours still count toward the 40. The extra is blended into the FLSA regular rate
     when that week also has overtime.
   - Gross pay only. This does not take out taxes.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.PayrollCalc = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DAYS = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];
  var DAY_LABEL = { sun: "Sun", mon: "Mon", tue: "Tue", wed: "Wed", thu: "Thu", fri: "Fri", sat: "Sat" };

  function uid() {
    return "e" + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  }
  function roundTo(n, places) {
    n = Number(n);
    if (!isFinite(n)) return 0;
    var sign = n < 0 ? -1 : 1;
    var f = Math.pow(10, places);
    return sign * Math.round(Math.abs(n) * f + 1e-8) / f;
  }
  function roundHours(n) { return roundTo(n, 2); }
  function roundMoney(n) { return roundTo(n, 2); }
  function emptyWeek() {
    return { sun: "", mon: "", tue: "", wed: "", thu: "", fri: "", sat: "" };
  }
  function cloneWeek(w) {
    var o = emptyWeek();
    DAYS.forEach(function (d) { o[d] = w && w[d] != null ? String(w[d]) : ""; });
    return o;
  }
  function dayOrder(weekStarts) {
    return weekStarts === "sunday"
      ? ["sun", "mon", "tue", "wed", "thu", "fri", "sat"]
      : ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  }
  function newEmployee() {
    return {
      id: uid(),
      name: "",
      rate: "",
      otMult: 1.5,
      week1: emptyWeek(),
      week2: emptyWeek(),
      dt1: "",
      dt2: "",
      snow1: emptyWeek(),
      snow2: emptyWeek(),
      bonus: "",
      tips: ""
    };
  }

  function parseTimeToken(raw) {
    if (raw == null) return null;
    var s = String(raw).trim().toLowerCase().replace(/\s+/g, "");
    if (!s) return null;
    var ampm = null;
    if (/a\.?m\.?$/.test(s) || /a$/.test(s)) {
      ampm = "am";
      s = s.replace(/a\.?m\.?$/, "").replace(/a$/, "");
    } else if (/p\.?m\.?$/.test(s) || /p$/.test(s)) {
      ampm = "pm";
      s = s.replace(/p\.?m\.?$/, "").replace(/p$/, "");
    }
    var h, m = 0;
    if (s.indexOf(":") >= 0) {
      var parts = s.split(":");
      h = parseInt(parts[0], 10);
      m = parseInt(parts[1], 10);
    } else {
      h = parseInt(s, 10);
      m = 0;
    }
    if (!isFinite(h) || !isFinite(m) || h < 0 || h > 23 || m < 0 || m > 59) return null;
    if (ampm === "am") {
      if (h === 12) h = 0;
      else if (h > 12) return null;
    } else if (ampm === "pm") {
      if (h === 12) h = 12;
      else if (h < 12) h += 12;
      else return null;
    }
    return { minutes: h * 60 + m, ampm: ampm, hour24: ampm ? (ampm === "am" ? (parseInt(String(raw).replace(/\D.*$/, ""), 10) === 12 ? 0 : h) : h) : h, rawHour: h, explicit24: ampm == null && h >= 13 };
  }

  function parseTimeTokenMinutes(raw, role, other) {
    var t = parseTimeToken(raw);
    if (!t) return null;
    if (t.ampm || t.explicit24) return t.minutes;
    var h = parseInt(String(raw).trim().toLowerCase().replace(/[^0-9:].*$/, "").split(":")[0], 10);
    var mMatch = String(raw).match(/:(\d{1,2})/);
    var m = mMatch ? parseInt(mMatch[1], 10) : 0;
    if (!isFinite(h) || !isFinite(m)) return null;
    if (role === "start") {
      if (h === 12) return 12 * 60 + m;
      return h * 60 + m;
    }
    if (h === 12) return 12 * 60 + m;
    if (h < 12) return (h + 12) * 60 + m;
    return h * 60 + m;
  }

  function normalizeRangeText(text) {
    return String(text)
      .replace(/\s+/g, " ")
      .trim()
      .replace(/(\d)\s*:\s*(\d)/g, "$1:$2")
      .replace(/(\d)\s*(a\.?m\.?|p\.?m\.?|[ap])\b/gi, "$1$2");
  }

  function splitRange(text) {
    var t = normalizeRangeText(text);
    var parts = t.split(/\s*(?:\s+to\s+|[\/\u2013\u2014-]|\sto\s)\s*/i);
    if (parts.length === 2 && parts[0] && parts[1]) return parts;
    var ws = t.split(/\s+/);
    if (ws.length === 2 && /[ap]/i.test(ws[0] + ws[1])) return ws;
    return null;
  }

  function parseDayInput(raw, lunchMinutes) {
    var text = raw == null ? "" : String(raw).trim();
    if (!text) return { hours: 0, kind: "empty" };
    if (/^\d+(\.\d+)?$/.test(text)) {
      var n = parseFloat(text);
      if (n < 0) return { hours: 0, kind: "error", error: "Hours cannot be negative" };
      return { hours: roundHours(n), kind: "number" };
    }
    if (/^\d{1,2}:\d{2}$/.test(text)) {
      var hm = text.split(":").map(Number);
      if (hm[1] > 59) return { hours: 0, kind: "error", error: "Minutes should be 00–59" };
      return { hours: roundHours(hm[0] + hm[1] / 60), kind: "duration" };
    }
    var range = splitRange(text);
    if (!range) return { hours: 0, kind: "error", error: "Try 8 or 8:30a-5p" };
    var startInfo = parseTimeToken(range[0]);
    var endInfo = parseTimeToken(range[1]);
    if (!startInfo || !endInfo) return { hours: 0, kind: "error", error: "Could not read that time" };
    var start = startInfo.minutes;
    if (!startInfo.ampm && !startInfo.explicit24) {
      start = parseTimeTokenMinutes(range[0], "start");
    }
    if (start == null) return { hours: 0, kind: "error", error: "Could not read that time" };
    function rangeDur(st, en) {
      if (en <= st) en += 24 * 60;
      return en - st;
    }
    function betterDur(d, cur) {
      if (cur == null) return true;
      var dOk = d > 0 && d <= 16 * 60;
      var cOk = cur > 0 && cur <= 16 * 60;
      if (dOk !== cOk) return dOk;
      return d < cur;
    }
    var endChoices = [endInfo.minutes];
    if (!endInfo.ampm && !endInfo.explicit24) {
      var endPm = parseTimeTokenMinutes(range[1], "end");
      if (endPm != null && endChoices.indexOf(endPm) < 0) endChoices.push(endPm);
    }
    var mins = null;
    endChoices.forEach(function (en) {
      var d = rangeDur(start, en);
      if (betterDur(d, mins)) mins = d;
    });
    if (mins == null) return { hours: 0, kind: "error", error: "Could not read that time" };
    var lunch = Math.max(0, Number(lunchMinutes) || 0);
    var worked = Math.max(0, mins - lunch);
    return {
      hours: roundHours(worked / 60),
      kind: "clock",
      rawMinutes: mins,
      lunch: lunch,
      startMinutes: start,
      endMinutes: start + mins
    };
  }

  function splitWeekHours(totalHours, dtHours) {
    var total = roundHours(Math.max(0, Number(totalHours) || 0));
    var dtIn = roundHours(Math.max(0, Number(dtHours) || 0));
    var dt = roundHours(Math.min(total, dtIn));
    var remaining = roundHours(Math.max(0, total - dt));
    var regular = roundHours(Math.min(40, remaining));
    var ot = roundHours(Math.max(0, remaining - 40));
    return { total: total, dt: dt, regular: regular, ot: ot };
  }

  function windowMinutes(raw, fallback) {
    var t = parseTimeToken(raw);
    if (t && isFinite(t.minutes)) return t.minutes;
    return fallback;
  }

  function overlapHours(shiftStart, shiftEnd, winStart, winEnd) {
    if (shiftStart == null || shiftEnd == null || shiftEnd <= shiftStart) return 0;
    if (winStart == null || winEnd == null) return 0;
    var segs;
    if (winEnd > winStart) {
      segs = [[winStart, winEnd], [winStart + 1440, winEnd + 1440], [winStart + 2880, winEnd + 2880]];
    } else {
      segs = [[winStart, winEnd + 1440], [winStart + 1440, winEnd + 2880]];
    }
    var mins = 0;
    segs.forEach(function (seg) {
      mins += Math.max(0, Math.min(shiftEnd, seg[1]) - Math.max(shiftStart, seg[0]));
    });
    return roundHours(mins / 60);
  }

  function autoSnowHours(parsed, opts) {
    opts = opts || {};
    if (!parsed || parsed.kind !== "clock") return 0;
    var winStart = windowMinutes(opts.snowStart, 16 * 60);
    var winEnd = windowMinutes(opts.snowEnd, 19 * 60);
    var snow = overlapHours(parsed.startMinutes, parsed.endMinutes, winStart, winEnd);
    return roundHours(Math.min(snow, parsed.hours));
  }

  function resolveDaySnow(typedRaw, parsed, opts) {
    var typed = typedRaw == null ? "" : String(typedRaw).trim();
    if (typed !== "") {
      var n = parseFloat(typed);
      if (!isFinite(n) || n < 0) return { hours: 0, source: "error", auto: autoSnowHours(parsed, opts) };
      var capped = roundHours(Math.min(n, parsed && parsed.hours ? parsed.hours : n));
      return { hours: capped, source: "manual", auto: autoSnowHours(parsed, opts) };
    }
    var auto = autoSnowHours(parsed, opts);
    if (auto > 0) return { hours: auto, source: "auto", auto: auto };
    return { hours: 0, source: "none", auto: 0 };
  }

  function resolveWeekSnow(snowObj, parsedDays, opts) {
    var total = 0;
    var days = {};
    DAYS.forEach(function (d) {
      var res = resolveDaySnow(snowObj && snowObj[d], parsedDays && parsedDays[d], opts);
      days[d] = res;
      total = roundHours(total + res.hours);
    });
    return { total: total, days: days };
  }

  function calcWeekPay(totalHours, dtHours, rate, otMult, dtMult, snowHours, snowPremium) {
    if (dtMult == null) dtMult = 2;
    if (snowPremium == null || snowPremium === "") snowPremium = 5;
    var split = splitWeekHours(totalHours, dtHours);
    var r = Number(rate) || 0;
    var om = Number(otMult);
    if (!isFinite(om) || om <= 0) om = 1.5;
    var prem = Number(snowPremium);
    if (!isFinite(prem) || prem < 0) prem = 0;
    var snow = roundHours(Math.min(split.total, Math.max(0, Number(snowHours) || 0)));
    var regularPay = roundMoney(split.total * r);
    var snowPay = roundMoney(snow * prem);
    var regularRate = split.total > 0 ? (regularPay + snowPay) / split.total : r;
    var otFactor = Math.max(0, om - 1);
    var otPay = roundMoney(otFactor * regularRate * split.ot);
    var dtPay = roundMoney(split.dt * r * Math.max(0, dtMult - 1));
    return {
      total: split.total,
      dt: split.dt,
      regular: split.regular,
      ot: split.ot,
      snow: snow,
      regularPay: regularPay,
      snowPay: snowPay,
      otPay: otPay,
      dtPay: dtPay,
      weekGross: roundMoney(regularPay + snowPay + otPay + dtPay),
      rate: r,
      otMult: om,
      dtMult: dtMult,
      snowPremium: prem,
      regularRate: regularRate,
      otRate: roundMoney(r + otFactor * regularRate)
    };
  }

  function weekHours(weekObj, lunchMinutes) {
    var total = 0;
    var days = {};
    var errors = [];
    DAYS.forEach(function (d) {
      var parsed = parseDayInput(weekObj && weekObj[d], lunchMinutes);
      days[d] = parsed;
      total = roundHours(total + parsed.hours);
      if (parsed.kind === "error") errors.push(d);
    });
    return { total: total, days: days, errors: errors };
  }

  function calcEmployee(emp, opts) {
    opts = opts || {};
    var lunch = opts.lunchMinutes;
    if (lunch == null) lunch = 30;
    var period = opts.period || "weekly";
    var premium = opts.snowPremium;
    if (premium == null || premium === "") premium = 5;
    var w1info = weekHours(emp.week1, lunch);
    var w2info = weekHours(emp.week2, lunch);
    var s1 = resolveWeekSnow(emp.snow1, w1info.days, opts);
    var s2 = resolveWeekSnow(emp.snow2, w2info.days, opts);
    w1info.snow = s1;
    w2info.snow = s2;
    var w1 = calcWeekPay(w1info.total, emp.dt1, emp.rate, emp.otMult, 2, s1.total, premium);
    var w2;
    if (period === "biweekly") {
      w2 = calcWeekPay(w2info.total, emp.dt2, emp.rate, emp.otMult, 2, s2.total, premium);
    } else {
      w2 = calcWeekPay(0, 0, emp.rate, emp.otMult, 2, 0, premium);
    }
    var bonus = roundMoney(Math.max(0, Number(emp.bonus) || 0));
    var tips = roundMoney(Math.max(0, Number(emp.tips) || 0));
    var gross = roundMoney(w1.weekGross + w2.weekGross + bonus + tips);
    return {
      w1: w1,
      w2: w2,
      w1info: w1info,
      w2info: w2info,
      bonus: bonus,
      tips: tips,
      gross: gross,
      regularHours: roundHours(w1.regular + w2.regular),
      otHours: roundHours(w1.ot + w2.ot),
      dtHours: roundHours(w1.dt + w2.dt),
      snowHours: roundHours(w1.snow + (period === "biweekly" ? w2.snow : 0)),
      regularPay: roundMoney(w1.regularPay + w2.regularPay),
      snowPay: roundMoney(w1.snowPay + (period === "biweekly" ? w2.snowPay : 0)),
      otPay: roundMoney(w1.otPay + w2.otPay),
      dtPay: roundMoney(w1.dtPay + w2.dtPay)
    };
  }

  function formatMoney(n) {
    var v = roundMoney(n);
    var neg = v < 0;
    v = Math.abs(v);
    var s = v.toFixed(2);
    var parts = s.split(".");
    parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    return (neg ? "-$" : "$") + parts.join(".");
  }
  function formatHours(n) { return roundHours(n).toFixed(2); }

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
      } else {
        if (c === '"') inQ = true;
        else if (c === ",") { row.push(cur); cur = ""; }
        else if (c === "\n") { row.push(cur); rows.push(row); row = []; cur = ""; }
        else if (c !== "\r") cur += c;
      }
    }
    if (cur.length || row.length) { row.push(cur); rows.push(row); }
    return rows;
  }

  function looksLikeHeader(cells) {
    var a = (cells[0] || "").toString().trim().toLowerCase();
    return a === "name" || a === "employee" || a === "employee name" || a === "worker";
  }

  function importEmployeesCSV(text) {
    var rows = parseCSV(text);
    var out = [];
    var start = 0;
    var nameI = 0, rateI = 1, otI = 2;
    if (rows.length && looksLikeHeader(rows[0])) {
      var header = rows[0].map(function (h) { return String(h).trim().toLowerCase(); });
      header.forEach(function (h, idx) {
        if (h === "name" || h === "employee" || h === "employee name" || h === "worker") nameI = idx;
        if (h === "rate" || h === "hourly rate" || h === "pay rate" || h === "hourly" || h === "wage") rateI = idx;
        if (h === "ot" || h === "ot multiplier" || h === "overtime" || h === "ot rate" || h === "ot mult") otI = idx;
      });
      start = 1;
    }
    for (var r = start; r < rows.length; r++) {
      var cells = rows[r];
      if (!cells) continue;
      var name = (cells[nameI] || "").toString().trim();
      if (!name) continue;
      var rateRaw = (cells[rateI] || "").toString().replace(/[$,]/g, "").trim();
      var otRaw = (cells[otI] || "").toString().trim();
      var emp = newEmployee();
      emp.name = name;
      emp.rate = rateRaw === "" ? "" : roundMoney(parseFloat(rateRaw));
      if (otRaw !== "" && isFinite(parseFloat(otRaw))) emp.otMult = parseFloat(otRaw);
      out.push(emp);
    }
    return out;
  }

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

  function sampleEmployees() {
    function days(map) {
      var w = emptyWeek();
      Object.keys(map).forEach(function (k) { w[k] = map[k]; });
      return w;
    }
    var maria = newEmployee();
    maria.name = "Maria Garcia";
    maria.rate = 20;
    maria.week1 = days({ mon: "8", tue: "8", wed: "9", thu: "8", fri: "8", sat: "4" });
    maria.snow1 = days({ mon: "1", tue: "1", wed: "1", thu: "1", fri: "1" });
    var james = newEmployee();
    james.name = "James Lee";
    james.rate = 18;
    james.week1 = days({ mon: "8", tue: "8", wed: "8", thu: "8", fri: "8" });
    james.snow1 = days({ mon: "1", tue: "1", wed: "1", thu: "1", fri: "1" });
    var keisha = newEmployee();
    keisha.name = "Keisha Brooks";
    keisha.rate = 22;
    keisha.week1 = days({ mon: "10", tue: "10", wed: "10", thu: "10", fri: "10" });
    keisha.week2 = days({ mon: "6", tue: "6", wed: "6", thu: "6", fri: "6" });
    keisha.snow1 = days({ mon: "1", tue: "1", wed: "1", thu: "1", fri: "1" });
    var luis = newEmployee();
    luis.name = "Luis Ortega";
    luis.rate = 16.5;
    luis.week1 = days({
      mon: "8:30a / 5p",
      tue: "8:30a / 5p",
      wed: "8:30a-5p",
      thu: "8:30a-5p",
      fri: "8:30a-5p"
    });
    var anna = newEmployee();
    anna.name = "Anna Patel";
    anna.rate = 25;
    anna.week1 = days({ mon: "8", tue: "8", wed: "8", thu: "8", fri: "8" });
    anna.bonus = 50;
    return [maria, james, keisha, luis, anna];
  }


  return {
    DAYS: DAYS,
    DAY_LABEL: DAY_LABEL,
    uid: uid,
    roundTo: roundTo,
    roundHours: roundHours,
    roundMoney: roundMoney,
    emptyWeek: emptyWeek,
    cloneWeek: cloneWeek,
    dayOrder: dayOrder,
    newEmployee: newEmployee,
    parseTimeToken: parseTimeToken,
    parseDayInput: parseDayInput,
    splitWeekHours: splitWeekHours,
    windowMinutes: windowMinutes,
    overlapHours: overlapHours,
    autoSnowHours: autoSnowHours,
    resolveDaySnow: resolveDaySnow,
    resolveWeekSnow: resolveWeekSnow,
    calcWeekPay: calcWeekPay,
    weekHours: weekHours,
    calcEmployee: calcEmployee,
    formatMoney: formatMoney,
    formatHours: formatHours,
    parseCSV: parseCSV,
    importEmployeesCSV: importEmployeesCSV,
    sampleEmployees: sampleEmployees
  };
});
