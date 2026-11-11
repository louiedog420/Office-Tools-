(function () {
  "use strict";

  var KEY = "office-tools-hiring";
  var CHECKS = ReportLogic.HIRE_CHECKS;
  var STAGES = ["New application", "Interview", "Offer", "Hired", "Not moving forward"];
  var today = Suite.todayISO();
  var editing = null;

  function emptyChecks() {
    var checks = {};
    CHECKS.forEach(function (pair) { checks[pair[0]] = false; });
    return checks;
  }
  function blank() {
    return { applicants: [], hires: [] };
  }
  var state = blank();

  function setStatus(msg) {
    var el = document.getElementById("status-line");
    if (el) el.textContent = msg;
  }
  function bad(value) {
    var msg = Suite.sensitiveWarning(value, { blockPlainSsn: true });
    if (msg) Suite.showNotice(msg);
    return !!msg;
  }
  function load() {
    var saved = Suite.loadStore(KEY, null);
    if (!saved) return;
    state.applicants = Array.isArray(saved.applicants) ? saved.applicants : [];
    state.hires = Array.isArray(saved.hires) ? saved.hires : [];
    state.hires.forEach(function (hire) {
      var checks = emptyChecks();
      CHECKS.forEach(function (pair) {
        if (hire.checklist && hire.checklist[pair[0]]) checks[pair[0]] = true;
      });
      hire.checklist = checks;
    });
  }
  function save() {
    if (Suite.saveStore(KEY, state)) setStatus("Saved on this computer.");
  }
  function findHireByName(name) {
    var key = String(name || "").trim().toLowerCase();
    for (var i = 0; i < state.hires.length; i++) {
      if (String(state.hires[i].name || "").trim().toLowerCase() === key) return state.hires[i];
    }
    return null;
  }
  function ensureHire(name, role, startDate) {
    var existing = findHireByName(name);
    if (existing) return existing;
    var hire = {
      id: Suite.uid(),
      name: name,
      role: role || "",
      startDate: startDate || "",
      emergencyName: "",
      emergencyPhone: "",
      checklist: emptyChecks()
    };
    state.hires.push(hire);
    return hire;
  }
  function doneCount(hire) {
    var n = 0;
    CHECKS.forEach(function (pair) { if (hire.checklist && hire.checklist[pair[0]]) n += 1; });
    return n;
  }

  function render() {
    var apps = state.applicants.slice().sort(function (a, b) {
      return String(a.name || "").localeCompare(String(b.name || ""));
    });
    document.getElementById("app-list").innerHTML = apps.map(function (app) {
      return '<article class="record"><div class="record-top"><h3>' + Suite.escapeHtml(app.name || "(no name)") + "</h3>"
        + '<span class="pill">' + Suite.escapeHtml(app.stage || "New application") + "</span></div>"
        + '<p class="meta">' + Suite.escapeHtml(app.role || "Job not set")
        + (app.phone ? " · " + Suite.escapeHtml(app.phone) : "")
        + (app.email ? " · " + Suite.escapeHtml(app.email) : "")
        + (app.applied ? " · applied " + Suite.escapeHtml(Suite.prettyDate(app.applied)) : "")
        + "</p>"
        + (app.notes ? '<p class="meta">' + Suite.escapeHtml(app.notes) + "</p>" : "")
        + '<div class="row-actions no-print"><label>Stage <select data-stage="' + Suite.escapeHtml(app.id) + '">'
        + STAGES.map(function (stage) {
          return "<option" + (stage === app.stage ? " selected" : "") + ">" + stage + "</option>";
        }).join("")
        + '</select></label>'
        + '<button type="button" class="btn small secondary" data-edit="' + Suite.escapeHtml(app.id) + '">Edit</button>'
        + '<button type="button" class="btn small danger" data-remove="' + Suite.escapeHtml(app.id) + '">Remove</button></div></article>';
    }).join("") || '<p class="empty-state">No applicants yet. Add someone, or load the made-up sample.</p>';

    document.getElementById("hire-list").innerHTML = state.hires.map(function (hire) {
      var done = doneCount(hire);
      var boxes = CHECKS.map(function (pair) {
        return '<label><input type="checkbox" data-check="' + pair[0] + '" data-hire="' + Suite.escapeHtml(hire.id) + '"' + (hire.checklist[pair[0]] ? " checked" : "") + "> "
          + Suite.escapeHtml(pair[1]) + "</label>";
      }).join("");
      return '<article class="record"><div class="record-top"><h3>' + Suite.escapeHtml(hire.name || "(no name)") + "</h3>"
        + '<span class="pill ' + (done === CHECKS.length ? "ok" : "pending") + '">' + done + " of " + CHECKS.length + " done</span></div>"
        + '<p class="meta">' + Suite.escapeHtml(hire.role || "New hire")
        + (hire.startDate ? " · start " + Suite.escapeHtml(Suite.prettyDate(hire.startDate)) : "")
        + "</p>"
        + '<div class="settings no-print"><div class="field"><label>Start date<input type="date" data-start="' + Suite.escapeHtml(hire.id) + '" value="' + Suite.escapeHtml(hire.startDate || "") + '"></label></div>'
        + '<div class="field"><label>Emergency contact name (optional)<input type="text" data-em-name="' + Suite.escapeHtml(hire.id) + '" value="' + Suite.escapeHtml(hire.emergencyName || "") + '" autocomplete="off"></label></div>'
        + '<div class="field"><label>Emergency contact phone (optional)<input type="tel" data-em-phone="' + Suite.escapeHtml(hire.id) + '" value="' + Suite.escapeHtml(hire.emergencyPhone || "") + '" autocomplete="off"></label></div></div>'
        + '<div class="check-list">' + boxes + "</div>"
        + '<p class="hint">Direct deposit is a checkbox only. Do not type account numbers.</p>'
        + '<div class="row-actions no-print"><button type="button" class="btn small danger" data-remove-hire="' + Suite.escapeHtml(hire.id) + '">Remove checklist</button></div></article>';
    }).join("") || '<p class="empty-state">No new-hire checklists yet. Mark an applicant as Hired, or they will appear here.</p>';
  }

  function clearAppForm() {
    editing = null;
    ["app-name", "app-role", "app-phone", "app-email", "app-notes"].forEach(function (id) {
      document.getElementById(id).value = "";
    });
    document.getElementById("app-stage").value = "New application";
    document.getElementById("app-date").value = today;
    document.getElementById("app-form-title").textContent = "Add an applicant";
    document.getElementById("btn-save-app").textContent = "Save applicant";
    document.getElementById("btn-cancel-app").hidden = true;
  }

  document.getElementById("btn-save-app").addEventListener("click", function () {
    var name = document.getElementById("app-name").value.trim();
    var role = document.getElementById("app-role").value.trim();
    var phone = document.getElementById("app-phone").value.trim();
    var email = document.getElementById("app-email").value.trim();
    var notes = document.getElementById("app-notes").value.trim();
    var stage = document.getElementById("app-stage").value;
    if (!name) { setStatus("Type the applicant's name."); return; }
    if (bad(name) || bad(role) || bad(phone) || bad(email) || bad(notes)) return;
    var app = {
      id: editing || Suite.uid(),
      name: name,
      role: role,
      phone: phone,
      email: email,
      stage: stage,
      applied: document.getElementById("app-date").value,
      notes: notes
    };
    if (editing) state.applicants = state.applicants.map(function (existing) { return existing.id === editing ? app : existing; });
    else state.applicants.push(app);
    if (stage === "Hired") ensureHire(name, role, "");
    clearAppForm();
    save();
    render();
    setStatus(stage === "Hired" ? "Saved. A new-hire checklist is ready." : "Saved applicant.");
  });
  document.getElementById("btn-cancel-app").addEventListener("click", clearAppForm);

  document.getElementById("app-list").addEventListener("change", function (e) {
    var id = e.target.getAttribute("data-stage");
    if (!id) return;
    state.applicants.forEach(function (app) {
      if (app.id !== id) return;
      app.stage = e.target.value;
      if (app.stage === "Hired") ensureHire(app.name, app.role, "");
    });
    save();
    render();
  });
  document.getElementById("app-list").addEventListener("click", function (e) {
    var edit = e.target.getAttribute("data-edit");
    var remove = e.target.getAttribute("data-remove");
    if (edit) {
      var app = null;
      state.applicants.forEach(function (candidate) { if (candidate.id === edit) app = candidate; });
      if (!app) return;
      editing = app.id;
      document.getElementById("app-name").value = app.name || "";
      document.getElementById("app-role").value = app.role || "";
      document.getElementById("app-phone").value = app.phone || "";
      document.getElementById("app-email").value = app.email || "";
      document.getElementById("app-stage").value = app.stage || "New application";
      document.getElementById("app-date").value = app.applied || "";
      document.getElementById("app-notes").value = app.notes || "";
      document.getElementById("app-form-title").textContent = "Edit applicant";
      document.getElementById("btn-save-app").textContent = "Save changes";
      document.getElementById("btn-cancel-app").hidden = false;
      document.getElementById("app-name").focus();
      return;
    }
    if (remove) {
      Suite.confirm("Remove this applicant? Their checklist, if any, stays until you remove it separately.", "Yes, remove").then(function (ok) {
        if (!ok) return;
        state.applicants = state.applicants.filter(function (app) { return app.id !== remove; });
        save();
        render();
      });
    }
  });

  document.getElementById("hire-list").addEventListener("change", function (e) {
    var hireId = e.target.getAttribute("data-hire") || e.target.getAttribute("data-start") || e.target.getAttribute("data-em-name") || e.target.getAttribute("data-em-phone");
    if (!hireId) return;
    var hire = null;
    state.hires.forEach(function (candidate) { if (candidate.id === hireId) hire = candidate; });
    if (!hire) return;
    if (e.target.getAttribute("data-check")) {
      hire.checklist[e.target.getAttribute("data-check")] = e.target.checked;
    } else if (e.target.getAttribute("data-start")) {
      hire.startDate = e.target.value;
    } else if (bad(e.target.value)) {
      e.target.value = "";
      return;
    } else if (e.target.getAttribute("data-em-name")) hire.emergencyName = e.target.value.trim();
    else if (e.target.getAttribute("data-em-phone")) hire.emergencyPhone = e.target.value.trim();
    save();
    render();
  });
  document.getElementById("hire-list").addEventListener("click", function (e) {
    var id = e.target.getAttribute("data-remove-hire");
    if (!id) return;
    Suite.confirm("Remove this new-hire checklist?", "Yes, remove").then(function (ok) {
      if (!ok) return;
      state.hires = state.hires.filter(function (hire) { return hire.id !== id; });
      save();
      render();
    });
  });

  function applySample() {
    state.applicants = [
      { id: Suite.uid(), name: "Sam Practice", role: "Driver", phone: "410-555-0101", email: "sam.practice@example.com", stage: "Interview", applied: Suite.addDays(today, -3), notes: "Made-up applicant." },
      { id: Suite.uid(), name: "Taylor Example", role: "Laborer", phone: "410-555-0102", email: "taylor.example@example.com", stage: "New application", applied: Suite.addDays(today, -1), notes: "Practice application." },
      { id: Suite.uid(), name: "Morgan Demo", role: "Office", phone: "410-555-0103", email: "morgan.demo@example.com", stage: "Offer", applied: Suite.addDays(today, -10), notes: "Made-up offer." }
    ];
    var checks = emptyChecks();
    checks.offer = true;
    checks.handbook = true;
    state.hires = [{
      id: Suite.uid(),
      name: "Jamie Sample",
      role: "Driver",
      startDate: Suite.addDays(today, 14),
      emergencyName: "Pat Sample",
      emergencyPhone: "410-555-0199",
      checklist: checks
    }];
    save();
    render();
    setStatus("Loaded made-up applicants. These are not real people, and there are no real ID numbers.");
  }

  document.getElementById("btn-sample").addEventListener("click", function () {
    if (!state.applicants.length && !state.hires.length) { applySample(); return; }
    Suite.confirm("Replace applicants and checklists with made-up samples?", "Yes, load samples").then(function (ok) {
      if (ok) applySample();
    });
  });

  document.getElementById("btn-export").addEventListener("click", function () {
    var rows = [["Record", "Name", "Role", "Phone", "Email", "Stage", "Applied or start", "Notes or emergency", "Checklist done", "Checklist missing"]];
    state.applicants.forEach(function (app) {
      rows.push(["Applicant", app.name, app.role, app.phone, app.email, app.stage, app.applied, app.notes, "", ""]);
    });
    state.hires.forEach(function (hire) {
      var done = [];
      var missing = [];
      CHECKS.forEach(function (pair) {
        if (hire.checklist[pair[0]]) done.push(pair[1]);
        else missing.push(pair[1]);
      });
      var contact = [hire.emergencyName, hire.emergencyPhone].filter(Boolean).join(" ");
      rows.push(["New hire", hire.name, hire.role, "", "", "", hire.startDate, contact, done.join("; "), missing.join("; ")]);
    });
    Suite.download("hiring.csv", Suite.toCSV(rows));
  });
  document.getElementById("btn-import").addEventListener("click", function () {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      var table = Suite.parseCSV(String(reader.result || ""));
      if (!table.length) { setStatus("That file was empty."); return; }
      var header = table[0].map(function (h) { return String(h).trim().toLowerCase(); });
      var start = header.indexOf("name") >= 0 ? 1 : 0;
      function col(names, fallback) {
        for (var i = 0; i < names.length; i++) {
          var at = header.indexOf(names[i]);
          if (at >= 0) return at;
        }
        return fallback;
      }
      var added = 0;
      for (var r = start; r < table.length; r++) {
        var c = table[r];
        var record = String(c[col(["record"], 0)] || "").toLowerCase();
        var name = String(c[col(["name"], 1)] || "").trim();
        if (!name || bad(name)) continue;
        var role = String(c[col(["role", "job"], 2)] || "").trim();
        if (record.indexOf("hire") >= 0 || record.indexOf("checklist") >= 0) {
          var hire = ensureHire(name, role, DueDates.normalizeDate(c[col(["applied or start", "start", "start date"], 6)]));
          var missing = String(c[col(["checklist missing"], 9)] || "");
          var done = String(c[col(["checklist done"], 8)] || "");
          if (done || missing) {
            CHECKS.forEach(function (pair) {
              if (done.indexOf(pair[1]) >= 0) hire.checklist[pair[0]] = true;
              if (missing.indexOf(pair[1]) >= 0) hire.checklist[pair[0]] = false;
            });
          }
          added += 1;
          continue;
        }
        var stage = String(c[col(["stage"], 5)] || "").trim();
        if (STAGES.indexOf(stage) < 0) stage = "New application";
        var phone = String(c[col(["phone"], 3)] || "").trim();
        var email = String(c[col(["email"], 4)] || "").trim();
        var notes = String(c[col(["notes", "notes or emergency"], 7)] || "").trim();
        if (bad(phone) || bad(email) || bad(notes) || bad(role)) continue;
        state.applicants.push({
          id: Suite.uid(),
          name: name,
          role: role,
          phone: phone,
          email: email,
          stage: stage,
          applied: DueDates.normalizeDate(c[col(["applied", "applied or start", "date applied"], 6)]),
          notes: notes
        });
        if (stage === "Hired") ensureHire(name, role, "");
        added += 1;
      }
      if (!added) { setStatus("No people were added."); return; }
      save();
      render();
      setStatus("Imported " + added + " row" + (added === 1 ? "" : "s") + ".");
    };
    reader.readAsText(file);
  });

  document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
  document.getElementById("btn-clear").addEventListener("click", function () {
    Suite.confirm("Clear applicants and new-hire checklists on this computer? The other tools stay.", "Yes, clear hiring").then(function (ok) {
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (err) {}
      state = blank();
      clearAppForm();
      save();
      render();
      setStatus("Hiring cleared.");
    });
  });

  document.getElementById("app-date").value = today;
  load();
  render();
  setStatus("Saved on this computer as you type.");
})();
