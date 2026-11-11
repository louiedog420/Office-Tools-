(function () {
  "use strict";

  var KEY = "office-tools-fleet";
  var today = Suite.todayISO();
  var editing = null;
  var state = { units: [] };

  function setStatus(msg) {
    var el = document.getElementById("status-line");
    if (el) el.textContent = msg;
  }
  function bad(value, strict) {
    var msg = Suite.sensitiveWarning(value, { blockPlainSsn: !!strict });
    if (msg) Suite.showNotice(msg);
    return !!msg;
  }
  function load() {
    var saved = Suite.loadStore(KEY, null);
    if (saved && Array.isArray(saved.units)) state.units = saved.units;
  }
  function save() {
    if (Suite.saveStore(KEY, state)) setStatus("Saved on this computer.");
  }
  function kind() {
    var picked = document.querySelector('input[name="kind"]:checked');
    return picked ? picked.value : "truck";
  }
  function fieldText(id) { return document.getElementById(id).value.trim(); }

  function render() {
    var units = DueDates.sortUnits(state.units);
    if (!units.length) {
      document.getElementById("unit-list").innerHTML = '<p class="empty-state">No trucks or trailers yet. Add one, or load the made-up sample.</p>';
      return;
    }
    document.getElementById("unit-list").innerHTML = units.map(function (unit) {
      var summary = DueDates.unitSummary(unit, today);
      var title = [unit.year, unit.make, unit.model].filter(Boolean).join(" ");
      var parts = summary.parts.map(function (part) {
        return '<p class="meta"><span class="pill ' + part.status + '">' + Suite.escapeHtml(DueDates.statusLabel(part.status)) + "</span> "
          + Suite.escapeHtml(part.label) + ": "
          + (part.date ? Suite.escapeHtml(Suite.prettyDate(part.date)) + " (" + Suite.escapeHtml(DueDates.duePhrase(part.days)) + ")" : "no date")
          + "</p>";
      }).join("");
      return '<article class="record ' + summary.worst + '"><div class="record-top"><h3>'
        + Suite.escapeHtml((unit.kind === "trailer" ? "Trailer" : "Truck") + " " + (unit.unitNumber || "(no unit #)"))
        + "</h3><span class=\"pill " + summary.worst + "\">" + Suite.escapeHtml(DueDates.statusLabel(summary.worst)) + "</span></div>"
        + (title ? '<p class="meta">' + Suite.escapeHtml(title) + "</p>" : "")
        + '<p class="meta">Plate ' + Suite.escapeHtml(unit.plate || "—") + " · VIN " + Suite.escapeHtml(unit.vin || "—") + "</p>"
        + parts
        + (unit.notes ? '<p class="meta">' + Suite.escapeHtml(unit.notes) + "</p>" : "")
        + '<div class="row-actions no-print"><button type="button" class="btn small secondary" data-edit="' + Suite.escapeHtml(unit.id) + '">Edit</button>'
        + '<button type="button" class="btn small danger" data-remove="' + Suite.escapeHtml(unit.id) + '">Remove</button></div></article>';
    }).join("");
  }

  function clearForm() {
    editing = null;
    ["unit", "year", "make", "model", "vin", "plate", "registration", "insurance", "inspection", "notes"].forEach(function (id) {
      document.getElementById(id).value = "";
    });
    document.querySelector('input[name="kind"][value="truck"]').checked = true;
    document.getElementById("form-title").textContent = "Add a truck or trailer";
    document.getElementById("btn-save").textContent = "Save unit";
    document.getElementById("btn-cancel").hidden = true;
  }

  document.getElementById("btn-save").addEventListener("click", function () {
    var unitNumber = fieldText("unit");
    var notes = fieldText("notes");
    var vin = fieldText("vin");
    var make = fieldText("make");
    var model = fieldText("model");
    var plate = fieldText("plate");
    if (!unitNumber) { setStatus("Type a unit number, like S-101."); return; }
    if (bad(unitNumber, true) || bad(notes, true) || bad(make, true) || bad(model, true) || bad(plate, true) || bad(vin, false)) return;
    var unit = {
      id: editing || Suite.uid(),
      kind: kind(),
      unitNumber: unitNumber,
      year: fieldText("year"),
      make: make,
      model: model,
      vin: vin,
      plate: plate,
      registrationExp: document.getElementById("registration").value,
      insuranceExp: document.getElementById("insurance").value,
      inspectionDue: document.getElementById("inspection").value,
      notes: notes
    };
    if (editing) state.units = state.units.map(function (existing) { return existing.id === editing ? unit : existing; });
    else state.units.push(unit);
    clearForm();
    save();
    render();
    setStatus("Saved " + unit.unitNumber + ".");
  });
  document.getElementById("btn-cancel").addEventListener("click", function () {
    clearForm();
    setStatus("Edit cancelled.");
  });

  document.getElementById("unit-list").addEventListener("click", function (e) {
    var edit = e.target.getAttribute("data-edit");
    var remove = e.target.getAttribute("data-remove");
    if (edit) {
      var unit = null;
      state.units.forEach(function (candidate) { if (candidate.id === edit) unit = candidate; });
      if (!unit) return;
      editing = unit.id;
      document.querySelectorAll('input[name="kind"]').forEach(function (el) { el.checked = el.value === (unit.kind || "truck"); });
      document.getElementById("unit").value = unit.unitNumber || "";
      document.getElementById("year").value = unit.year || "";
      document.getElementById("make").value = unit.make || "";
      document.getElementById("model").value = unit.model || "";
      document.getElementById("vin").value = unit.vin || "";
      document.getElementById("plate").value = unit.plate || "";
      document.getElementById("registration").value = unit.registrationExp || "";
      document.getElementById("insurance").value = unit.insuranceExp || "";
      document.getElementById("inspection").value = unit.inspectionDue || "";
      document.getElementById("notes").value = unit.notes || "";
      document.getElementById("form-title").textContent = "Edit unit " + (unit.unitNumber || "");
      document.getElementById("btn-save").textContent = "Save changes";
      document.getElementById("btn-cancel").hidden = false;
      document.getElementById("unit").focus();
      return;
    }
    if (remove) {
      Suite.confirm("Remove this truck or trailer from the list?", "Yes, remove").then(function (ok) {
        if (!ok) return;
        state.units = state.units.filter(function (unit) { return unit.id !== remove; });
        if (editing === remove) clearForm();
        save();
        render();
      });
    }
  });

  function applySample() {
    function unit(kindName, number, year, make, model, vin, plate, reg, ins, insp, notes) {
      return {
        id: Suite.uid(),
        kind: kindName,
        unitNumber: number,
        year: year,
        make: make,
        model: model,
        vin: vin,
        plate: plate,
        registrationExp: reg,
        insuranceExp: ins,
        inspectionDue: insp,
        notes: notes
      };
    }
    state.units = [
      unit("truck", "S-101", "2018", "Sample", "Hauler", "SAMPLE0VIN0000101", "SMP101", Suite.addDays(today, -5), Suite.addDays(today, 120), Suite.addDays(today, 20), "Practice record. Not a real truck."),
      unit("truck", "S-102", "2020", "Sample", "Cab", "SAMPLE0VIN0000102", "SMP102", Suite.addDays(today, 20), Suite.addDays(today, 45), Suite.addDays(today, 100), "Practice record. Not a real truck."),
      unit("trailer", "T-1", "2016", "Sample", "Tag", "SAMPLE0VIN0000TR1", "SMP201", Suite.addDays(today, 10), Suite.addDays(today, 10), Suite.addDays(today, 10), "Practice record. Not a real trailer."),
      unit("trailer", "T-2", "2022", "Sample", "Tag", "SAMPLE0VIN0000TR2", "SMP202", Suite.addDays(today, 50), Suite.addDays(today, 50), Suite.addDays(today, 50), "Practice record. Not a real trailer."),
      unit("truck", "S-103", "2019", "Sample", "Hauler", "SAMPLE0VIN0000103", "SMP103", Suite.addDays(today, 120), Suite.addDays(today, 120), Suite.addDays(today, 120), "Practice record. Not a real truck."),
      unit("truck", "S-104", "2015", "Sample", "Cab", "SAMPLE0VIN0000104", "SMP104", Suite.addDays(today, 90), Suite.addDays(today, -2), Suite.addDays(today, 90), "Practice record. Insurance date is made up.")
    ];
    save();
    render();
    setStatus("Loaded made-up trucks and trailers. These are not real vehicles.");
  }

  document.getElementById("btn-sample").addEventListener("click", function () {
    if (!state.units.length) { applySample(); return; }
    Suite.confirm("Replace the fleet list with made-up sample trucks and trailers?", "Yes, load samples").then(function (ok) {
      if (ok) applySample();
    });
  });

  document.getElementById("btn-export").addEventListener("click", function () {
    var rows = [["Kind", "Unit Number", "Year", "Make", "Model", "VIN", "Plate", "Registration Expiration", "Insurance Expiration", "Inspection Due", "Notes"]];
    DueDates.sortUnits(state.units).forEach(function (unit) {
      rows.push([
        unit.kind === "trailer" ? "Trailer" : "Truck",
        unit.unitNumber, unit.year, unit.make, unit.model, unit.vin, unit.plate,
        unit.registrationExp || "", unit.insuranceExp || "", unit.inspectionDue || "", unit.notes || ""
      ]);
    });
    Suite.download("fleet.csv", Suite.toCSV(rows));
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
      var start = header.indexOf("unit number") >= 0 || header.indexOf("kind") >= 0 ? 1 : 0;
      function col(names, fallback) {
        for (var i = 0; i < names.length; i++) {
          var at = header.indexOf(names[i]);
          if (at >= 0) return at;
        }
        return fallback;
      }
      var added = 0;
      var badDates = 0;
      for (var r = start; r < table.length; r++) {
        var c = table[r];
        var number = String(c[col(["unit number", "unit"], 1)] || "").trim();
        if (!number || bad(number, true)) continue;
        function dateCell(names, fallback) {
          var raw = String(c[col(names, fallback)] || "").trim();
          if (!raw) return "";
          var iso = DueDates.normalizeDate(raw);
          if (!iso) badDates += 1;
          return iso;
        }
        var notes = String(c[col(["notes"], 10)] || "").trim();
        var vin = String(c[col(["vin"], 5)] || "").trim();
        if (bad(notes, true) || bad(vin, false)) continue;
        var kindRaw = String(c[col(["kind"], 0)] || "").toLowerCase();
        state.units.push({
          id: Suite.uid(),
          kind: kindRaw.indexOf("trail") >= 0 ? "trailer" : "truck",
          unitNumber: number,
          year: String(c[col(["year"], 2)] || "").trim(),
          make: String(c[col(["make"], 3)] || "").trim(),
          model: String(c[col(["model"], 4)] || "").trim(),
          vin: vin,
          plate: String(c[col(["plate"], 6)] || "").trim(),
          registrationExp: dateCell(["registration expiration", "registration"], 7),
          insuranceExp: dateCell(["insurance expiration", "insurance"], 8),
          inspectionDue: dateCell(["inspection due", "inspection"], 9),
          notes: notes
        });
        added += 1;
      }
      if (!added) { setStatus("No units were added. Include a unit number."); return; }
      save();
      render();
      setStatus("Imported " + added + " unit" + (added === 1 ? "" : "s") + (badDates ? ". " + badDates + " date" + (badDates === 1 ? " was" : "s were") + " left blank because it could not be read." : "."));
    };
    reader.readAsText(file);
  });

  document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
  document.getElementById("btn-clear").addEventListener("click", function () {
    Suite.confirm("Clear every truck and trailer saved on this computer? The other tools stay.", "Yes, clear fleet").then(function (ok) {
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (err) {}
      state.units = [];
      clearForm();
      save();
      render();
      setStatus("Fleet cleared.");
    });
  });

  load();
  render();
  setStatus("Saved on this computer as you type.");
})();
