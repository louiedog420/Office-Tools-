/* Dates, expiration colors, and "what is due" checks.
   Expired = before today. Within 30 days and within 60 days are the warning bands.
   Today counts as due now (within 30 days), not expired.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.DueDates = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function parseISODate(value) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(String(value || "").trim());
    if (!m) return null;
    var y = +m[1], mo = +m[2], da = +m[3];
    if (mo < 1 || mo > 12 || da < 1 || da > 31) return null;
    var dt = new Date(Date.UTC(y, mo - 1, da));
    if (dt.getUTCFullYear() !== y || dt.getUTCMonth() !== mo - 1 || dt.getUTCDate() !== da) return null;
    return dt.getTime();
  }

  function daysUntil(dateStr, todayStr) {
    var a = parseISODate(dateStr);
    var b = parseISODate(todayStr);
    if (a == null || b == null) return null;
    return Math.round((a - b) / 86400000);
  }

  function normalizeDate(raw) {
    var s = String(raw || "").trim();
    if (!s) return "";
    if (parseISODate(s)) return s;
    var m = s.match(/^(\d{1,2})[\/\-](\d{1,2})[\/\-](\d{4})$/);
    if (!m) return "";
    var iso = m[3] + "-" + ("0" + m[1]).slice(-2) + "-" + ("0" + m[2]).slice(-2);
    return parseISODate(iso) ? iso : "";
  }

  function expirationStatus(dateStr, todayStr) {
    if (!String(dateStr || "").trim()) return { status: "none", days: null };
    var days = daysUntil(dateStr, todayStr);
    if (days == null) return { status: "none", days: null };
    if (days < 0) return { status: "expired", days: days };
    if (days <= 30) return { status: "soon30", days: days };
    if (days <= 60) return { status: "soon60", days: days };
    return { status: "ok", days: days };
  }

  function duePhrase(days) {
    if (days == null) return "No date";
    if (days < 0) {
      var n = Math.abs(days);
      return n === 1 ? "1 day ago" : n + " days ago";
    }
    if (days === 0) return "due today";
    if (days === 1) return "due tomorrow";
    return "in " + days + " days";
  }

  function statusLabel(status) {
    if (status === "expired") return "Expired";
    if (status === "soon30") return "Due within 30 days";
    if (status === "soon60") return "Due within 60 days";
    if (status === "ok") return "More than 60 days away";
    return "No date";
  }

  var DATE_FIELDS = [
    ["registrationExp", "Registration"],
    ["insuranceExp", "Insurance"],
    ["inspectionDue", "Inspection"]
  ];

  function nextDue(unit) {
    var dates = [];
    DATE_FIELDS.forEach(function (f) {
      if (parseISODate(unit && unit[f[0]])) dates.push(unit[f[0]]);
    });
    dates.sort();
    return dates[0] || "";
  }

  function unitSummary(unit, today) {
    var rank = { expired: 0, soon30: 1, soon60: 2, ok: 3, none: 4 };
    var parts = DATE_FIELDS.map(function (f) {
      var st = expirationStatus(unit[f[0]], today);
      return {
        field: f[0],
        label: f[1],
        status: st.status,
        days: st.days,
        date: unit[f[0]] || ""
      };
    });
    var worst = "none";
    parts.forEach(function (p) {
      if (rank[p.status] < rank[worst]) worst = p.status;
    });
    return { worst: worst, parts: parts, nextDue: nextDue(unit) };
  }

  function sortUnits(units) {
    return (units || []).slice().sort(function (a, b) {
      var da = nextDue(a);
      var db = nextDue(b);
      if (!da && !db) return String(a.unitNumber || "").localeCompare(String(b.unitNumber || ""), undefined, { numeric: true });
      if (!da) return 1;
      if (!db) return -1;
      if (da !== db) return da < db ? -1 : 1;
      return String(a.unitNumber || "").localeCompare(String(b.unitNumber || ""), undefined, { numeric: true });
    });
  }

  function billTiming(dateStr, today, within) {
    var days = daysUntil(dateStr, today);
    var windowDays = within == null ? 14 : within;
    if (days == null) return { timing: "none", days: null };
    if (days < 0) return { timing: "overdue", days: days };
    if (days <= windowDays) return { timing: "upcoming", days: days };
    return { timing: "later", days: days };
  }

  return {
    parseISODate: parseISODate,
    daysUntil: daysUntil,
    normalizeDate: normalizeDate,
    expirationStatus: expirationStatus,
    duePhrase: duePhrase,
    statusLabel: statusLabel,
    nextDue: nextDue,
    unitSummary: unitSummary,
    sortUnits: sortUnits,
    billTiming: billTiming
  };
});
