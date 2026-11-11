"use strict";

var assert = require("assert");
var R = require("../js/report-logic.js");

test("the summary keeps the lists the office needs to see", function () {
  var report = R.buildReport({
    payroll: {
      peopleCount: 2,
      regularHours: 80,
      otHours: 5,
      snowHours: 5,
      regularPay: 1600,
      snowPay: 25,
      otPay: 51.39,
      gross: 1676.39,
      period: "weekly"
    },
    invoices: {
      items: [
        { kind: "bill", party: "Sample Fuel Co.", amount: 80, due: "2026-11-20", status: "unpaid" },
        { kind: "bill", party: "Sample Paid Co.", amount: 10, due: "2026-11-01", status: "paid" },
        { kind: "bill", party: "Sample Late Parts", amount: 40, due: "2026-11-01", status: "unpaid" },
        { kind: "invoice", party: "Sample Customer - Oak Street", amount: 200, due: "2026-11-01", status: "unpaid" },
        { kind: "invoice", party: "Sample Customer - Later", amount: 50, due: "2026-12-20", status: "unpaid" }
      ]
    },
    fleet: {
      units: [
        { unitNumber: "S-101", kind: "truck", year: "2018", make: "Sample", model: "Hauler", registrationExp: "2026-11-20", insuranceExp: "2027-06-01", inspectionDue: "2027-06-01" },
        { unitNumber: "S-103", kind: "trailer", year: "2020", make: "Sample", model: "Tag", registrationExp: "2027-08-01", insuranceExp: "2027-08-01", inspectionDue: "2027-08-01" }
      ]
    },
    timeoff: {
      requests: [
        { employee: "Alex Sample", status: "Pending", type: "Vacation", start: "2026-11-18", end: "2026-11-19" },
        { employee: "Jordan Demo", status: "Approved", type: "Sick", start: "2026-11-12", end: "2026-11-12" }
      ]
    },
    hiring: {
      applicants: [
        { name: "Sam Practice", role: "Driver", stage: "Interview" },
        { name: "Pat Done", role: "Office", stage: "Hired" },
        { name: "No Go Example", role: "Laborer", stage: "Not moving forward" }
      ],
      hires: [
        {
          name: "Jamie Sample",
          role: "Driver",
          checklist: { offer: true, i9: false, w4: false, mw507: false, directDeposit: false, handbook: true, emergency: false }
        },
        {
          name: "Casey Finished",
          role: "Office",
          checklist: { offer: true, i9: true, w4: true, mw507: true, directDeposit: true, handbook: true, emergency: true }
        }
      ]
    }
  }, "2026-11-11");

  assert.strictEqual(report.payroll.gross, 1676.39);
  assert.strictEqual(report.payroll.otHours, 5);
  assert.strictEqual(report.upcomingBills.length, 1);
  assert.strictEqual(report.upcomingBills[0].party, "Sample Fuel Co.");
  assert.strictEqual(report.overdueBills.length, 1);
  assert.strictEqual(report.overdueInvoices.length, 1);
  assert.strictEqual(report.overdueInvoices[0].party, "Sample Customer - Oak Street");
  assert.strictEqual(report.upcomingInvoices.length, 0);
  assert.strictEqual(report.fleetAttention.length, 1);
  assert.strictEqual(report.fleetAttention[0].unitNumber, "S-101");
  assert.strictEqual(report.pendingTimeOff.length, 1);
  assert.strictEqual(report.pendingTimeOff[0].employee, "Alex Sample");
  assert.strictEqual(report.openHires.length, 1);
  assert.strictEqual(report.openHires[0].name, "Sam Practice");
  assert.strictEqual(report.onboarding.length, 1);
  assert.strictEqual(report.onboarding[0].name, "Jamie Sample");
  assert.ok(report.onboarding[0].missing.indexOf("Form I-9") >= 0);
  assert.ok(report.onboarding[0].missing.indexOf("Maryland MW 507") >= 0);
  assert.ok(report.onboarding[0].missing.indexOf("Offer letter") < 0);
});
