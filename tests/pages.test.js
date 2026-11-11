"use strict";

var assert = require("assert");
var fs = require("fs");
var path = require("path");
var cp = require("child_process");

var root = path.join(__dirname, "..");
var pages = [
  "index.html",
  "payroll.html",
  "scheduler.html",
  "time-off.html",
  "invoices.html",
  "hiring.html",
  "fleet.html",
  "reports.html"
];

function read(file) {
  return fs.readFileSync(path.join(root, file), "utf8");
}

test("home links to every tool and the pages do not call the network", function () {
  var home = read("index.html");
  pages.slice(1).forEach(function (file) {
    assert.ok(home.indexOf(file) >= 0, "home should link to " + file);
    var html = read(file);
    assert.ok(html.indexOf('href="index.html"') >= 0, file + " should link home");
    assert.ok(html.indexOf("js/suite.js") >= 0, file + " should load the shared helper");
    assert.ok(html.indexOf('id="data-tools"') >= 0, file + " should offer backup");
    assert.ok(!/<script[^>]+src\s*=\s*["']https?:/i.test(html), file + " should not load a remote script");
    assert.ok(!/<link[^>]+href\s*=\s*["']https?:/i.test(html), file + " should not load a remote style");
  });
  assert.ok(home.indexOf("How your data is stored") >= 0);
  assert.ok(/same browser/i.test(home));
  assert.ok(/Nothing is uploaded/i.test(home));
  ["js", "css"].forEach(function (dir) {
    fs.readdirSync(path.join(root, dir)).forEach(function (name) {
      var text = read(path.join(dir, name));
      assert.ok(text.indexOf("http://") < 0 && text.indexOf("https://") < 0, dir + "/" + name + " should not reference the network");
    });
  });
});

test("every script file parses", function () {
  fs.readdirSync(path.join(root, "js")).forEach(function (name) {
    if (!name.endsWith(".js")) return;
    cp.execFileSync(process.execPath, ["--check", path.join(root, "js", name)], { stdio: "pipe" });
  });
});
