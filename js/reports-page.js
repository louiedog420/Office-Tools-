(function () {
  "use strict";

  var today = Suite.todayISO();
  var lastReport = null;

  function livePayroll() {
    var pay = Suite.loadStore("payroll-helper-v1", null);
    if (!pay || !window.PayrollCalc) return null;
    var PC = window.PayrollCalc;
    var opts = {
      period: pay.period || "weekly",
      lunchMinutes: pay.lunchMinutes == null ? 30 : pay.lunchMinutes,
      snowPremium: pay.snowPremium == null || pay.snowPremium === "" ? 5 : pay.snowPremium,
      snowStart: pay.snowStart,
      snowEnd: pay.snowEnd
    };
    var people = [];
    var g = { peopleCount: 0, regularHours: 0, otHours: 0, snowHours: 0, regularPay: 0, snowPay: 0, otPay: 0, gross: 0 };
    (pay.employees || []).forEach(function (emp) {
      var calc = PC.calcEmployee(emp, opts);
      if (!emp.name && !calc.gross && !(calc.w1 && calc.w1.total) && !(calc.w2 && calc.w2.total)) return;
      g.peopleCount += 1;
      g.regularHours = PC.roundHours(g.regularHours + calc.regularHours);
      g.otHours = PC.roundHours(g.otHours + calc.otHours);
      g.snowHours = PC.roundHours(g.snowHours + calc.snowHours);
      g.regularPay = PC.roundMoney(g.regularPay + calc.regularPay);
      g.snowPay = PC.roundMoney(g.snowPay + calc.snowPay);
      g.otPay = PC.roundMoney(g.otPay + calc.otPay);
      g.gross = PC.roundMoney(g.gross + calc.gross);
      people.push({
        name: emp.name || "(no name yet)",
        regularHours: calc.regularHours,
        otHours: calc.otHours,
        snowHours: calc.snowHours,
        gross: calc.gross
      });
    });
    if (!g.peopleCount && !g.gross) return null;
    g.businessName = pay.businessName || "";
    g.period = pay.period || "weekly";
    g.periodStart = pay.periodStart || "";
    g.periodEnd = pay.periodEnd || "";
    g.employees = people;
    g.source = "current";
    return g;
  }

  function payrollForReport() {
    var snap = Suite.loadStore("office-tools-payroll-snapshot", null);
    if (snap && (Number(snap.gross) > 0 || Number(snap.otHours) > 0 || Number(snap.regularHours) > 0)) {
      snap.source = "snapshot";
      return snap;
    }
    return livePayroll();
  }

  function money(n) { return Suite.formatMoney(n); }
  function hours(n) { return (Math.round((Number(n) || 0) * 100) / 100).toFixed(2); }
  function empty(href, label, sentence) {
    return '<p>' + sentence + ' <a href="' + href + '">Open ' + label + '</a>.</p>';
  }

  function render() {
    var payroll = payrollForReport();
    var report = ReportLogic.buildReport({
      payroll: payroll,
      invoices: Suite.loadStore("office-tools-invoices", { items: [] }),
      fleet: Suite.loadStore("office-tools-fleet", { units: [] }),
      timeoff: Suite.loadStore("office-tools-timeoff", { requests: [] }),
      hiring: Suite.loadStore("office-tools-hiring", { applicants: [], hires: [] })
    }, today);
    lastReport = report;
    var html = '<p class="print-only"><strong>Office summary</strong> · ' + Suite.escapeHtml(Suite.prettyDate(today)) + "</p>";

    html += '<section class="card"><h2>Last payroll</h2>';
    if (!report.payroll) {
      html += empty("payroll.html", "Payroll", "No payroll has been saved on this computer yet.");
    } else {
      var p = report.payroll;
      var when = p.savedAt ? "Saved " + Suite.prettyDate(String(p.savedAt).slice(0, 10)) + ". " : "";
      html += "<p>" + when + (p.source === "current" ? "This is the payroll list currently saved on this computer." : "This is the last payroll that had hours or pay.") + "</p>";
      if (p.businessName) html += "<p><strong>" + Suite.escapeHtml(p.businessName) + "</strong></p>";
      html += "<p>" + (p.period === "biweekly" ? "Biweekly" : "Weekly");
      if (p.periodStart || p.periodEnd) html += " · " + Suite.escapeHtml(Suite.prettyDate(p.periodStart) || "…") + " to " + Suite.escapeHtml(Suite.prettyDate(p.periodEnd) || "…");
      html += "</p>";
      html += '<div class="kpi-grid">'
        + kpi("People", p.peopleCount || (p.employees || []).length)
        + kpi("Regular hours", hours(p.regularHours))
        + kpi("Overtime hours", hours(p.otHours))
        + kpi("Snow hours", hours(p.snowHours))
        + kpi("Overtime pay", money(p.otPay))
        + kpi("Gross pay", money(p.gross))
        + "</div>";
      if (p.employees && p.employees.length) {
        html += '<div class="table-wrap"><table class="summary"><thead><tr><th>Name</th><th>Regular hours</th><th>OT hours</th><th>Snow hours</th><th>Gross pay</th></tr></thead><tbody>';
        p.employees.forEach(function (emp) {
          html += "<tr><td>" + Suite.escapeHtml(emp.name) + "</td><td>" + hours(emp.regularHours) + "</td><td>" + hours(emp.otHours) + "</td><td>" + hours(emp.snowHours) + "</td><td>" + money(emp.gross) + "</td></tr>";
        });
        html += "</tbody></table></div>";
      }
      html += '<p class="hint">Gross pay only, before taxes. <a href="payroll.html">Open Payroll</a>.</p>';
    }
    html += "</section>";

    html += '<section class="card"><h2>Bills to pay</h2>';
    if (!report.overdueBills.length && !report.upcomingBills.length) {
      html += empty("invoices.html", "Invoices", "No unpaid bills are overdue or due in the next 14 days.");
    } else {
      html += moneyList("Overdue", report.overdueBills) + moneyList("Due in the next 14 days", report.upcomingBills);
    }
    html += "</section>";

    html += '<section class="card"><h2>Invoices you sent</h2>';
    if (!report.overdueInvoices.length && !report.upcomingInvoices.length) {
      html += empty("invoices.html", "Invoices", "No unpaid invoices are overdue or due in the next 14 days.");
    } else {
      html += moneyList("Overdue", report.overdueInvoices) + moneyList("Due in the next 14 days", report.upcomingInvoices);
    }
    html += "</section>";

    html += '<section class="card"><h2>Fleet renewals</h2>';
    if (!report.fleetAttention.length) {
      html += empty("fleet.html", "Fleet", "Nothing is expired or due within 60 days.");
    } else {
      html += "<ul>";
      report.fleetAttention.forEach(function (unit) {
        var bits = unit.parts.map(function (part) {
          return part.label + " " + DueDates.statusLabel(part.status).toLowerCase() + " (" + DueDates.duePhrase(part.days) + ")";
        }).join("; ");
        html += "<li><strong>" + Suite.escapeHtml((unit.kind === "trailer" ? "Trailer " : "Truck ") + unit.unitNumber) + "</strong>"
          + (unit.label ? " · " + Suite.escapeHtml(unit.label) : "")
          + " · " + Suite.escapeHtml(bits) + "</li>";
      });
      html += "</ul>";
    }
    html += "</section>";

    html += '<section class="card"><h2>Pending time off</h2>';
    if (!report.pendingTimeOff.length) {
      html += empty("time-off.html", "Time off", "No requests are waiting for a yes or no.");
    } else {
      html += "<ul>";
      report.pendingTimeOff.forEach(function (req) {
        html += "<li>" + Suite.escapeHtml(req.employee) + " · " + Suite.escapeHtml(req.type) + " · "
          + Suite.escapeHtml(Suite.prettyDate(req.start)) + " to " + Suite.escapeHtml(Suite.prettyDate(req.end)) + "</li>";
      });
      html += "</ul>";
    }
    html += "</section>";

    html += '<section class="card"><h2>Open hires</h2>';
    if (!report.openHires.length && !report.onboarding.length) {
      html += empty("hiring.html", "Hiring", "No open applicants, and no new-hire checklist is unfinished.");
    } else {
      if (report.openHires.length) {
        html += "<p><strong>Applicants still in progress</strong></p><ul>";
        report.openHires.forEach(function (app) {
          html += "<li>" + Suite.escapeHtml(app.name) + (app.role ? " · " + Suite.escapeHtml(app.role) : "") + " · " + Suite.escapeHtml(app.stage) + "</li>";
        });
        html += "</ul>";
      } else html += "<p>No applicants are in New application, Interview, or Offer.</p>";
      if (report.onboarding.length) {
        html += "<p><strong>Onboarding still open</strong></p><ul>";
        report.onboarding.forEach(function (hire) {
          html += "<li>" + Suite.escapeHtml(hire.name) + " is missing " + Suite.escapeHtml(hire.missing.join(", ")) + ".</li>";
        });
        html += "</ul>";
      }
    }
    html += "</section>";

    document.getElementById("report").innerHTML = html;
  }

  function kpi(label, value) {
    return '<div class="kpi"><span>' + label + "</span><strong>" + Suite.escapeHtml(String(value)) + "</strong></div>";
  }
  function moneyList(title, list) {
    if (!list.length) return "";
    return "<p><strong>" + title + "</strong></p><ul>" + list.map(function (item) {
      return "<li>" + Suite.escapeHtml(item.party || "(no name)") + " · " + money(item.amount) + " · due " + Suite.escapeHtml(Suite.prettyDate(item.due)) + " (" + Suite.escapeHtml(DueDates.duePhrase(item.days)) + ")</li>";
    }).join("") + "</ul>";
  }

  document.getElementById("btn-refresh").addEventListener("click", function () {
    render();
  });
  document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
  document.getElementById("btn-export").addEventListener("click", function () {
    if (!lastReport) render();
    var rows = [["Section", "Name", "Detail", "Amount or hours", "Date"]];
    var p = lastReport.payroll;
    if (p) {
      rows.push(["Payroll", "Team gross", p.period || "", p.gross, ""]);
      rows.push(["Payroll", "Overtime hours", "", p.otHours, ""]);
      rows.push(["Payroll", "Overtime pay", "", p.otPay, ""]);
      (p.employees || []).forEach(function (emp) {
        rows.push(["Payroll person", emp.name, "Gross", emp.gross, ""]);
      });
    }
    function pushMoney(section, list) {
      list.forEach(function (item) {
        rows.push([section, item.party, item.status || "", item.amount, item.due || ""]);
      });
    }
    pushMoney("Overdue bill", lastReport.overdueBills);
    pushMoney("Upcoming bill", lastReport.upcomingBills);
    pushMoney("Overdue invoice", lastReport.overdueInvoices);
    pushMoney("Upcoming invoice", lastReport.upcomingInvoices);
    lastReport.fleetAttention.forEach(function (unit) {
      rows.push(["Fleet", unit.unitNumber, unit.parts.map(function (part) { return part.label + " " + part.status; }).join("; "), "", unit.nextDue || ""]);
    });
    lastReport.pendingTimeOff.forEach(function (req) {
      rows.push(["Pending time off", req.employee, req.type, "", req.start]);
    });
    lastReport.openHires.forEach(function (app) {
      rows.push(["Open hire", app.name, app.stage, "", ""]);
    });
    lastReport.onboarding.forEach(function (hire) {
      rows.push(["Onboarding", hire.name, hire.missing.join("; "), "", ""]);
    });
    Suite.download("office-summary-" + today + ".csv", Suite.toCSV(rows));
  });

  render();
})();
