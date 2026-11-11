/* One-page office summary built from the other tools' saved data. */
(function (root, factory) {
  var api = typeof module === "object" && module.exports
    ? factory(require("./due-dates"))
    : factory(root.DueDates);
  if (typeof module === "object" && module.exports) module.exports = api;
  else root.ReportLogic = api;
})(typeof globalThis !== "undefined" ? globalThis : this, function (DueDates) {
  "use strict";

  var HIRE_CHECKS = [
    ["offer", "Offer letter"],
    ["i9", "Form I-9"],
    ["w4", "W-4"],
    ["mw507", "Maryland MW 507"],
    ["directDeposit", "Direct deposit form"],
    ["handbook", "Handbook acknowledgment"],
    ["emergency", "Emergency contact"]
  ];

  var OPEN_STAGES = { "new application": true, "interview": true, "offer": true };

  function list(value) {
    return Array.isArray(value) ? value : [];
  }

  function buildReport(data, today) {
    data = data || {};
    var items = list(data.invoices && data.invoices.items);
    var upcomingBills = [];
    var overdueBills = [];
    var overdueInvoices = [];
    var upcomingInvoices = [];
    items.forEach(function (item) {
      if (!item || item.status === "paid") return;
      var timing = DueDates.billTiming(item.due, today, 14);
      if (item.kind === "bill") {
        if (timing.timing === "overdue") overdueBills.push(Object.assign({ days: timing.days }, item));
        else if (timing.timing === "upcoming") upcomingBills.push(Object.assign({ days: timing.days }, item));
      } else if (item.kind === "invoice") {
        if (timing.timing === "overdue") overdueInvoices.push(Object.assign({ days: timing.days }, item));
        else if (timing.timing === "upcoming") upcomingInvoices.push(Object.assign({ days: timing.days }, item));
      }
    });
    function byDue(a, b) { return String(a.due || "").localeCompare(String(b.due || "")); }
    upcomingBills.sort(byDue);
    overdueBills.sort(byDue);
    overdueInvoices.sort(byDue);
    upcomingInvoices.sort(byDue);

    var fleetAttention = [];
    DueDates.sortUnits(list(data.fleet && data.fleet.units)).forEach(function (unit) {
      var summary = DueDates.unitSummary(unit, today);
      if (summary.worst === "expired" || summary.worst === "soon30" || summary.worst === "soon60") {
        fleetAttention.push({
          unitNumber: unit.unitNumber || "(no unit #)",
          kind: unit.kind || "truck",
          label: [unit.year, unit.make, unit.model].filter(Boolean).join(" "),
          worst: summary.worst,
          nextDue: summary.nextDue,
          parts: summary.parts.filter(function (p) {
            return p.status === "expired" || p.status === "soon30" || p.status === "soon60";
          })
        });
      }
    });

    var pendingTimeOff = list(data.timeoff && data.timeoff.requests).filter(function (r) {
      return String(r.status || "Pending") === "Pending";
    }).map(function (r) {
      return {
        employee: r.employee || "(no name)",
        type: r.type || "Time off",
        start: r.start || "",
        end: r.end || ""
      };
    });

    var openHires = list(data.hiring && data.hiring.applicants).filter(function (a) {
      return OPEN_STAGES[String(a.stage || "").toLowerCase()];
    }).map(function (a) {
      return { name: a.name || "(no name)", role: a.role || "", stage: a.stage || "" };
    });

    var onboarding = [];
    list(data.hiring && data.hiring.hires).forEach(function (hire) {
      var checks = hire.checklist || {};
      var missing = [];
      HIRE_CHECKS.forEach(function (pair) {
        if (!checks[pair[0]]) missing.push(pair[1]);
      });
      if (missing.length) {
        onboarding.push({
          name: hire.name || "(no name)",
          role: hire.role || "",
          missing: missing
        });
      }
    });

    return {
      payroll: data.payroll || null,
      upcomingBills: upcomingBills,
      overdueBills: overdueBills,
      overdueInvoices: overdueInvoices,
      upcomingInvoices: upcomingInvoices,
      fleetAttention: fleetAttention,
      pendingTimeOff: pendingTimeOff,
      openHires: openHires,
      onboarding: onboarding
    };
  }

  return { HIRE_CHECKS: HIRE_CHECKS, buildReport: buildReport };
});
