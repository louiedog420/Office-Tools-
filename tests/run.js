"use strict";

var passed = 0;
var failed = 0;

function test(name, fn) {
  try {
    fn();
    passed += 1;
    console.log("  ok  " + name);
  } catch (err) {
    failed += 1;
    console.error("  FAIL " + name);
    console.error(err && err.stack ? err.stack : err);
  }
}

global.test = test;

require("./payroll.test.js");
require("./schedule.test.js");
require("./fleet.test.js");
require("./report.test.js");
require("./pages.test.js");

console.log("");
console.log(passed + " passed, " + failed + " failed");
if (failed) process.exit(1);
