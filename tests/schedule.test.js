"use strict";

var assert = require("assert");
var S = require("../js/schedule-logic.js");

function weekOf(employeeId, start, end) {
  return S.DAYS.slice(0, 5).map(function (day, i) {
    return { id: day + i, employeeId: employeeId, day: day, start: start, end: end };
  });
}

test("five 9-hour days warn over 40", function () {
  var employees = [{ id: "a", name: "Alex Sample" }];
  var shifts = weekOf("a", "07:00", "16:00");
  assert.strictEqual(S.weeklyHours(shifts, 0), 45);
  var warnings = S.overFortyWarnings(employees, shifts, 0);
  assert.strictEqual(warnings.length, 1);
  assert.strictEqual(warnings[0].name, "Alex Sample");
  assert.strictEqual(warnings[0].hours, 45);
});

test("exactly 40 scheduled hours does not warn", function () {
  var employees = [{ id: "a", name: "Alex Sample" }, { id: "b", name: "Jordan Demo" }];
  var shifts = weekOf("a", "08:00", "16:00");
  assert.strictEqual(S.weeklyHours(shifts, 0), 40);
  assert.strictEqual(S.overFortyWarnings(employees, shifts, 0).length, 0);
});

test("a person with no shifts is not warned", function () {
  var warnings = S.overFortyWarnings([{ id: "a", name: "Riley Example" }], [], 0);
  assert.strictEqual(warnings.length, 0);
});

test("unpaid lunch comes off shifts that are 5 hours or longer", function () {
  var shifts = weekOf("a", "08:00", "16:30");
  assert.strictEqual(S.shiftHours("08:00", "16:30", 0), 8.5);
  assert.strictEqual(S.shiftHours("08:00", "16:30", 30), 8);
  assert.strictEqual(S.weeklyHours(shifts, 30), 40);
  assert.strictEqual(S.overFortyWarnings([{ id: "a", name: "Alex Sample" }], shifts, 30).length, 0);
  var longer = weekOf("a", "08:00", "17:00");
  assert.strictEqual(S.weeklyHours(longer, 30), 42.5);
  assert.strictEqual(S.overFortyWarnings([{ id: "a", name: "Alex Sample" }], longer, 30)[0].hours, 42.5);
});

test("a short shift does not lose a lunch break", function () {
  assert.strictEqual(S.shiftHours("08:00", "12:00", 30), 4);
});

test("equal start and end is zero hours, overnight still counts", function () {
  assert.strictEqual(S.shiftHours("08:00", "08:00", 0), 0);
  assert.strictEqual(S.shiftHours("22:00", "06:00", 0), 8);
});

test("overlapping shifts on the same day are a conflict", function () {
  var conflicts = S.conflictWarnings([
    { id: "1", employeeId: "b", day: "fri", start: "08:00", end: "12:00" },
    { id: "2", employeeId: "b", day: "fri", start: "11:00", end: "15:00" }
  ]);
  assert.strictEqual(conflicts.length, 1);
  assert.strictEqual(conflicts[0].day, "fri");
});

test("back-to-back shifts and different people are not conflicts", function () {
  assert.strictEqual(S.conflictWarnings([
    { employeeId: "b", day: "mon", start: "08:00", end: "12:00" },
    { employeeId: "b", day: "mon", start: "12:00", end: "16:00" }
  ]).length, 0);
  assert.strictEqual(S.conflictWarnings([
    { employeeId: "a", day: "mon", start: "08:00", end: "12:00" },
    { employeeId: "b", day: "mon", start: "08:00", end: "12:00" }
  ]).length, 0);
  assert.strictEqual(S.conflictWarnings([
    { employeeId: "b", day: "mon", start: "08:00", end: "12:00" },
    { employeeId: "b", day: "tue", start: "08:00", end: "12:00" }
  ]).length, 0);
});

test("coverage gap counts people, not split shifts", function () {
  var gaps = S.coverageGaps([
    { employeeId: "a", day: "fri", start: "08:00", end: "12:00" },
    { employeeId: "a", day: "fri", start: "13:00", end: "17:00" },
    { employeeId: "b", day: "fri", start: "08:00", end: "16:00" }
  ], { fri: 4, sat: "" });
  assert.strictEqual(gaps.length, 1);
  assert.strictEqual(gaps[0].scheduled, 2);
  assert.strictEqual(gaps[0].needed, 4);
});

test("approved time off on a scheduled day is a conflict", function () {
  var found = S.timeOffConflicts(
    [{ employeeId: "a", employeeName: "Alex Sample", day: "mon", start: "08:00", end: "16:00" }],
    "2026-11-09",
    [{ employee: "alex sample", status: "Approved", start: "2026-11-09", end: "2026-11-10" }]
  );
  assert.strictEqual(found.length, 1);
  assert.strictEqual(found[0].date, "2026-11-09");
  var pending = S.timeOffConflicts(
    [{ employeeId: "a", employeeName: "Alex Sample", day: "mon", start: "08:00", end: "16:00" }],
    "2026-11-09",
    [{ employee: "Alex Sample", status: "Pending", start: "2026-11-09", end: "2026-11-10" }]
  );
  assert.strictEqual(pending.length, 0);
});

test("week starts snap to Monday", function () {
  assert.strictEqual(S.mondayOf("2026-11-11"), "2026-11-09");
  assert.strictEqual(S.mondayOf("2026-11-09"), "2026-11-09");
  assert.strictEqual(S.mondayOf("2026-11-15"), "2026-11-09");
  assert.strictEqual(S.dateForDay("2026-11-11", "wed"), "2026-11-11");
});
