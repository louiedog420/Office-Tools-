"use strict";

var assert = require("assert");
var D = require("../js/due-dates.js");

var TODAY = "2026-11-11";

test("dates before today are expired", function () {
  var st = D.expirationStatus("2026-11-10", TODAY);
  assert.strictEqual(st.status, "expired");
  assert.strictEqual(st.days, -1);
  assert.strictEqual(D.duePhrase(st.days), "1 day ago");
});

test("today through 30 days is the 30-day warning", function () {
  assert.strictEqual(D.expirationStatus(TODAY, TODAY).status, "soon30");
  assert.strictEqual(D.expirationStatus(TODAY, TODAY).days, 0);
  assert.strictEqual(D.duePhrase(0), "due today");
  var in30 = D.expirationStatus("2026-12-11", TODAY);
  assert.strictEqual(in30.days, 30);
  assert.strictEqual(in30.status, "soon30");
});

test("31 through 60 days is the 60-day warning", function () {
  var in31 = D.expirationStatus("2026-12-12", TODAY);
  assert.strictEqual(in31.days, 31);
  assert.strictEqual(in31.status, "soon60");
  var in60 = D.expirationStatus("2027-01-10", TODAY);
  assert.strictEqual(in60.days, 60);
  assert.strictEqual(in60.status, "soon60");
});

test("61 days and blank or bad dates are not warnings", function () {
  var in61 = D.expirationStatus("2027-01-11", TODAY);
  assert.strictEqual(in61.days, 61);
  assert.strictEqual(in61.status, "ok");
  assert.strictEqual(D.expirationStatus("", TODAY).status, "none");
  assert.strictEqual(D.expirationStatus("2026-02-31", TODAY).status, "none");
  assert.strictEqual(D.expirationStatus("not a date", TODAY).status, "none");
});

test("US dates normalize to year-month-day", function () {
  assert.strictEqual(D.normalizeDate("11/30/2026"), "2026-11-30");
  assert.strictEqual(D.normalizeDate("2026-11-30"), "2026-11-30");
  assert.strictEqual(D.normalizeDate("02/31/2026"), "");
});

test("one expired date makes the unit expired", function () {
  var summary = D.unitSummary({
    registrationExp: "2026-11-01",
    insuranceExp: "2027-06-01",
    inspectionDue: "2026-12-01"
  }, TODAY);
  assert.strictEqual(summary.worst, "expired");
  assert.strictEqual(summary.nextDue, "2026-11-01");
});

test("units sort by the soonest due date, blanks last", function () {
  var sorted = D.sortUnits([
    { unitNumber: "103", registrationExp: "2027-06-01", insuranceExp: "", inspectionDue: "" },
    { unitNumber: "101", registrationExp: "2026-11-01", insuranceExp: "2027-01-01", inspectionDue: "" },
    { unitNumber: "102", registrationExp: "2026-12-01", insuranceExp: "", inspectionDue: "2026-11-20" },
    { unitNumber: "104", registrationExp: "", insuranceExp: "", inspectionDue: "" }
  ]);
  assert.deepStrictEqual(sorted.map(function (u) { return u.unitNumber; }), ["101", "102", "103", "104"]);
});

test("bills due before today are overdue and the next 14 days are upcoming", function () {
  assert.strictEqual(D.billTiming("2026-11-01", TODAY, 14).timing, "overdue");
  assert.strictEqual(D.billTiming("2026-11-20", TODAY, 14).timing, "upcoming");
  assert.strictEqual(D.billTiming("2026-11-25", TODAY, 14).timing, "upcoming");
  assert.strictEqual(D.billTiming("2026-11-26", TODAY, 14).timing, "later");
  assert.strictEqual(D.billTiming("", TODAY, 14).timing, "none");
});
