"use strict";

var assert = require("assert");
var P = require("../js/payroll-calc.js");

var snowOpts = { period: "weekly", lunchMinutes: 30, snowPremium: 5, snowStart: "4:00 PM", snowEnd: "7:00 PM" };

test("45 hours at $20 with 5 snow hours grosses $976.39", function () {
  var w = P.calcWeekPay(45, 0, 20, 1.5, 2, 5, 5);
  assert.strictEqual(w.regular, 40);
  assert.strictEqual(w.ot, 5);
  assert.strictEqual(w.snow, 5);
  assert.strictEqual(w.regularPay, 900);
  assert.strictEqual(w.snowPay, 25);
  assert.strictEqual(w.otPay, 51.39);
  assert.strictEqual(w.weekGross, 976.39);
});

test("45 hours at $20 with no snow grosses $950", function () {
  var w = P.calcWeekPay(45, 0, 20, 1.5, 2, 0, 5);
  assert.strictEqual(w.ot, 5);
  assert.strictEqual(w.otPay, 50);
  assert.strictEqual(w.weekGross, 950);
});

test("exactly 40 hours has no overtime", function () {
  var w = P.calcWeekPay(40, 0, 20, 1.5, 2, 0, 5);
  assert.strictEqual(w.regular, 40);
  assert.strictEqual(w.ot, 0);
  assert.strictEqual(w.weekGross, 800);
});

test("snow hours count toward the 40 and blend into overtime", function () {
  var w = P.calcWeekPay(42, 0, 20, 1.5, 2, 3, 5);
  assert.strictEqual(w.ot, 2);
  assert.strictEqual(w.snow, 3);
  assert.strictEqual(w.regularPay, 840);
  assert.strictEqual(w.snowPay, 15);
  assert.strictEqual(w.otPay, 20.36);
  assert.strictEqual(w.weekGross, 875.36);
});

test("biweekly 50 + 30 is 10 overtime hours, not zero", function () {
  var emp = P.newEmployee();
  emp.rate = 20;
  emp.week1 = { sun: "", mon: "10", tue: "10", wed: "10", thu: "10", fri: "10", sat: "" };
  emp.week2 = { sun: "", mon: "6", tue: "6", wed: "6", thu: "6", fri: "6", sat: "" };
  var c = P.calcEmployee(emp, { period: "biweekly", lunchMinutes: 30, snowPremium: 5 });
  assert.strictEqual(c.w1.ot, 10);
  assert.strictEqual(c.w2.ot, 0);
  assert.strictEqual(c.otHours, 10);
  assert.strictEqual(c.w1.weekGross, 1100);
  assert.strictEqual(c.w2.weekGross, 600);
  assert.strictEqual(c.gross, 1700);
  assert.ok(c.w1.total + c.w2.total <= 80);
});

test("weekly mode ignores the second week", function () {
  var emp = P.newEmployee();
  emp.rate = 20;
  emp.week1 = { sun: "", mon: "8", tue: "8", wed: "8", thu: "8", fri: "8", sat: "" };
  emp.week2 = { sun: "", mon: "10", tue: "10", wed: "10", thu: "10", fri: "10", sat: "" };
  var c = P.calcEmployee(emp, { period: "weekly", lunchMinutes: 30, snowPremium: 5 });
  assert.strictEqual(c.otHours, 0);
  assert.strictEqual(c.gross, 800);
});

test("double-time hours are taken out of the overtime split first", function () {
  var w = P.calcWeekPay(45, 5, 20, 1.5, 2, 0, 5);
  assert.strictEqual(w.dt, 5);
  assert.strictEqual(w.regular, 40);
  assert.strictEqual(w.ot, 0);
  assert.strictEqual(w.regularPay, 900);
  assert.strictEqual(w.dtPay, 100);
  assert.strictEqual(w.weekGross, 1000);
});

test("sample Maria matches the written snow example", function () {
  var maria = P.sampleEmployees()[0];
  var c = P.calcEmployee(maria, snowOpts);
  assert.strictEqual(maria.name, "Maria Garcia");
  assert.strictEqual(c.otHours, 5);
  assert.strictEqual(c.snowHours, 5);
  assert.strictEqual(c.gross, 976.39);
});

test("sample Keisha biweekly keeps overtime in the 50-hour week only", function () {
  var keisha = P.sampleEmployees()[2];
  var c = P.calcEmployee(keisha, {
    period: "biweekly", lunchMinutes: 30, snowPremium: 5, snowStart: "4:00 PM", snowEnd: "7:00 PM"
  });
  assert.strictEqual(c.w1.total, 50);
  assert.strictEqual(c.w2.total, 30);
  assert.strictEqual(c.otHours, 10);
  assert.strictEqual(c.snowHours, 5);
  assert.strictEqual(c.gross, 1897.5);
});

test("clock times figure hours, lunch, and snow automatically", function () {
  var luis = P.sampleEmployees()[3];
  var c = P.calcEmployee(luis, snowOpts);
  assert.strictEqual(c.w1.total, 40);
  assert.strictEqual(c.otHours, 0);
  assert.strictEqual(c.snowHours, 5);
  assert.strictEqual(c.gross, 685);
});

test("bonus is added after the hourly math", function () {
  var anna = P.sampleEmployees()[4];
  var c = P.calcEmployee(anna, snowOpts);
  assert.strictEqual(c.bonus, 50);
  assert.strictEqual(c.gross, 1050);
});

test("employee CSV import keeps Name, Rate, and optional overtime multiplier", function () {
  var rows = P.importEmployeesCSV("Name,Rate\nMaria Garcia,20\nJames Lee,18.50\n");
  assert.strictEqual(rows.length, 2);
  assert.strictEqual(rows[0].name, "Maria Garcia");
  assert.strictEqual(rows[0].rate, 20);
  assert.strictEqual(rows[0].otMult, 1.5);
  assert.strictEqual(rows[1].rate, 18.5);
  var quoted = P.importEmployeesCSV('Name,Hourly Rate,OT Multiplier\n"Lee, James","$20.00",2\n');
  assert.strictEqual(quoted.length, 1);
  assert.strictEqual(quoted[0].name, "Lee, James");
  assert.strictEqual(quoted[0].rate, 20);
  assert.strictEqual(quoted[0].otMult, 2);
  var plain = P.importEmployeesCSV("Maria Garcia,20\n");
  assert.strictEqual(plain[0].name, "Maria Garcia");
  assert.strictEqual(plain[0].rate, 20);
});

test("hours and money round to hundredths and cents", function () {
  assert.strictEqual(P.roundHours(8.126), 8.13);
  assert.strictEqual(P.roundMoney(1.005), 1.01);
  var bad = P.parseDayInput("-2", 30);
  assert.strictEqual(bad.kind, "error");
  assert.strictEqual(bad.hours, 0);
});
