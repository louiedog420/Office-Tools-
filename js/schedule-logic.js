/* Weekly schedule checks.
   Hours are start time to end time. A shift that ends at or before it starts
   is treated as ending the next morning, except when the times are equal
   (that counts as no hours).
   Optional unpaid lunch is taken off a shift only when that shift is 5 hours
   or longer. Over-40 means the week's scheduled hours are more than 40.
*/
(function (root, factory) {
  var api = factory();
  if (typeof module === "object" && module.exports) module.exports = api;
  if (root) root.ScheduleLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  var DAYS = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];
  var DAY_LABEL = {
    mon: "Monday", tue: "Tuesday", wed: "Wednesday", thu: "Thursday",
    fri: "Friday", sat: "Saturday", sun: "Sunday"
  };

  function parseMinutes(raw) {
    if (raw == null) return null;
    var s = String(raw).trim().toLowerCase();
    if (!s) return null;
    var m = s.match(/^(\d{1,2})(?::(\d{2}))?\s*(a\.?m\.?|p\.?m\.?|a|p)?$/);
    if (!m) return null;
    var h = parseInt(m[1], 10);
    var min = m[2] ? parseInt(m[2], 10) : 0;
    var ap = m[3] || "";
    if (min > 59 || h < 0) return null;
    if (ap) {
      if (h > 12) return null;
      if (ap.charAt(0) === "a") {
        if (h === 12) h = 0;
      } else if (h < 12) h += 12;
    } else if (h > 23) return null;
    return h * 60 + min;
  }

  function shiftMinutes(start, end) {
    var a = parseMinutes(start);
    var b = parseMinutes(end);
    if (a == null || b == null) return 0;
    var diff = b - a;
    if (diff === 0) return 0;
    if (diff < 0) diff += 1440;
    return diff;
  }

  function shiftHours(start, end, lunchMinutes) {
    var mins = shiftMinutes(start, end);
    if (!mins) return 0;
    var lunch = Math.max(0, Number(lunchMinutes) || 0);
    if (lunch && mins >= 5 * 60 && mins > lunch) mins -= lunch;
    return Math.round((mins / 60) * 100) / 100;
  }

  function weeklyHours(shifts, lunchMinutes) {
    var hours = 0;
    (shifts || []).forEach(function (s) {
      hours += shiftHours(s.start, s.end, lunchMinutes);
    });
    return Math.round(hours * 100) / 100;
  }

  function overFortyWarnings(employees, shifts, lunchMinutes) {
    var out = [];
    (employees || []).forEach(function (emp) {
      if (!emp) return;
      var mine = (shifts || []).filter(function (s) { return s.employeeId === emp.id; });
      var hours = weeklyHours(mine, lunchMinutes);
      if (hours > 40) out.push({ employeeId: emp.id, name: emp.name || "", hours: hours });
    });
    return out;
  }

  function intervalsOverlap(a, b) {
    return a[0] < b[1] && b[0] < a[1];
  }

  function shiftInterval(start, end) {
    var a = parseMinutes(start);
    var b = parseMinutes(end);
    if (a == null || b == null) return null;
    if (b === a) return null;
    if (b < a) b += 1440;
    return [a, b];
  }

  function conflictWarnings(shifts) {
    var groups = {};
    (shifts || []).forEach(function (s) {
      var key = (s.employeeId || "") + "|" + (s.day || "");
      if (!groups[key]) groups[key] = [];
      groups[key].push(s);
    });
    var out = [];
    Object.keys(groups).forEach(function (key) {
      var list = groups[key];
      for (var i = 0; i < list.length; i++) {
        var left = shiftInterval(list[i].start, list[i].end);
        if (!left) continue;
        for (var j = i + 1; j < list.length; j++) {
          var right = shiftInterval(list[j].start, list[j].end);
          if (!right) continue;
          if (intervalsOverlap(left, right)) {
            out.push({
              employeeId: list[i].employeeId,
              day: list[i].day,
              shiftA: list[i].id || "",
              shiftB: list[j].id || ""
            });
          }
        }
      }
    });
    return out;
  }

  function coverageGaps(shifts, coverage) {
    var out = [];
    DAYS.forEach(function (day) {
      var neededRaw = coverage && coverage[day];
      if (neededRaw === "" || neededRaw == null) return;
      var needed = parseInt(neededRaw, 10);
      if (!isFinite(needed) || needed <= 0) return;
      var who = {};
      (shifts || []).forEach(function (s) {
        if (s.day !== day) return;
        if (shiftMinutes(s.start, s.end) <= 0) return;
        who[s.employeeId] = true;
      });
      var have = Object.keys(who).length;
      if (have < needed) out.push({ day: day, needed: needed, scheduled: have });
    });
    return out;
  }

  function mondayOf(dateStr) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(dateStr || ""))) return "";
    var parts = dateStr.split("-");
    var d = new Date(Date.UTC(+parts[0], +parts[1] - 1, +parts[2]));
    if (isNaN(d.getTime())) return "";
    var day = d.getUTCDay();
    var diff = day === 0 ? -6 : 1 - day;
    d.setUTCDate(d.getUTCDate() + diff);
    return d.toISOString().slice(0, 10);
  }

  function dateForDay(weekStart, dayKey) {
    var monday = mondayOf(weekStart);
    var i = DAYS.indexOf(dayKey);
    if (!monday || i < 0) return "";
    var d = new Date(monday + "T00:00:00Z");
    d.setUTCDate(d.getUTCDate() + i);
    return d.toISOString().slice(0, 10);
  }

  function timeOffConflicts(shifts, weekStart, requests) {
    var out = [];
    var seen = {};
    (shifts || []).forEach(function (s) {
      if (shiftMinutes(s.start, s.end) <= 0) return;
      var date = dateForDay(weekStart, s.day);
      var name = String(s.employeeName || "").trim().toLowerCase();
      if (!name || !date) return;
      (requests || []).forEach(function (r) {
        if (String(r.status || "").toLowerCase() !== "approved") return;
        if (String(r.employee || "").trim().toLowerCase() !== name) return;
        if (!r.start || !r.end || date < r.start || date > r.end) return;
        var key = name + "|" + date;
        if (seen[key]) return;
        seen[key] = true;
        out.push({
          employeeId: s.employeeId,
          employeeName: s.employeeName,
          day: s.day,
          date: date
        });
      });
    });
    return out;
  }

  return {
    DAYS: DAYS,
    DAY_LABEL: DAY_LABEL,
    parseMinutes: parseMinutes,
    shiftMinutes: shiftMinutes,
    shiftHours: shiftHours,
    weeklyHours: weeklyHours,
    overFortyWarnings: overFortyWarnings,
    conflictWarnings: conflictWarnings,
    coverageGaps: coverageGaps,
    mondayOf: mondayOf,
    dateForDay: dateForDay,
    timeOffConflicts: timeOffConflicts
  };
});
