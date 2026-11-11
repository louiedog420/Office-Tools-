(function () {
  "use strict";

  var KEY = "office-tools-timeoff";
  var today = Suite.todayISO();
  var view = { year: +today.slice(0, 4), month: +today.slice(5, 7) - 1 };

  function blank() {
    return { requests: [], callouts: [], tardies: [] };
  }
  var state = blank();

  function setStatus(msg) {
    var el = document.getElementById("status-line");
    if (el) el.textContent = msg;
  }
  function load() {
    var saved = Suite.loadStore(KEY, null);
    if (!saved) return;
    state.requests = Array.isArray(saved.requests) ? saved.requests : [];
    state.callouts = Array.isArray(saved.callouts) ? saved.callouts : [];
    state.tardies = Array.isArray(saved.tardies) ? saved.tardies : [];
  }
  function save() {
    if (Suite.saveStore(KEY, state)) setStatus("Saved on this computer.");
    Suite.fillNameList("people-names");
  }
  function badText(value) {
    var msg = Suite.sensitiveWarning(value, { blockPlainSsn: true });
    if (msg) Suite.showNotice(msg);
    return msg;
  }
  function spanDays(start, end) {
    var n = DueDates.daysUntil(end, start);
    if (n == null) return null;
    if (n < 0) return -1;
    return n + 1;
  }
  function pill(status) {
    var cls = String(status || "").toLowerCase();
    return '<span class="pill ' + cls + '">' + Suite.escapeHtml(status || "") + "</span>";
  }

  function renderLists() {
    var requests = state.requests.slice().sort(function (a, b) { return String(a.start).localeCompare(String(b.start)); });
    var reqHtml = requests.map(function (r) {
      var days = spanDays(r.start, r.end);
      var dayText = days == null ? "Add both dates." : (days < 0 ? "The last day is before the first day." : days + (days === 1 ? " calendar day" : " calendar days"));
      return '<article class="record"><div class="record-top"><h3>' + Suite.escapeHtml(r.employee || "(no name)") + "</h3>" + pill(r.status) + "</div>"
        + '<p class="meta">' + Suite.escapeHtml(r.type || "Time off") + " · " + Suite.escapeHtml(Suite.prettyDate(r.start)) + " to " + Suite.escapeHtml(Suite.prettyDate(r.end)) + " · " + Suite.escapeHtml(dayText) + "</p>"
        + (r.notes ? '<p class="meta">' + Suite.escapeHtml(r.notes) + "</p>" : "")
        + '<div class="row-actions"><label>Status <select data-status="' + Suite.escapeHtml(r.id) + '">'
        + ["Pending", "Approved", "Denied"].map(function (s) {
          return '<option' + (s === r.status ? " selected" : "") + ">" + s + "</option>";
        }).join("")
        + '</select></label><button type="button" class="btn tiny danger" data-remove-request="' + Suite.escapeHtml(r.id) + '">Remove</button></div></article>';
    }).join("");
    document.getElementById("request-list").innerHTML = reqHtml || '<p class="empty-state">No requests yet.</p>';

    var calls = state.callouts.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    document.getElementById("call-list").innerHTML = calls.map(function (r) {
      return '<article class="record"><div class="record-top"><h3>' + Suite.escapeHtml(r.employee || "(no name)") + '</h3><span class="pill denied">Call-out</span></div>'
        + '<p class="meta">' + Suite.escapeHtml(Suite.prettyDate(r.date)) + " · " + Suite.escapeHtml(r.reason || "") + "</p>"
        + (r.notes ? '<p class="meta">' + Suite.escapeHtml(r.notes) + "</p>" : "")
        + '<div class="row-actions"><button type="button" class="btn tiny danger" data-remove-call="' + Suite.escapeHtml(r.id) + '">Remove</button></div></article>';
    }).join("") || '<p class="empty-state">No call-outs yet.</p>';

    var tardies = state.tardies.slice().sort(function (a, b) { return String(b.date).localeCompare(String(a.date)); });
    document.getElementById("tardy-list").innerHTML = tardies.map(function (r) {
      return '<article class="record"><div class="record-top"><h3>' + Suite.escapeHtml(r.employee || "(no name)") + '</h3><span class="pill pending">Tardy</span></div>'
        + '<p class="meta">' + Suite.escapeHtml(Suite.prettyDate(r.date)) + " · " + Suite.escapeHtml(String(r.minutes || 0)) + " minutes late</p>"
        + (r.notes ? '<p class="meta">' + Suite.escapeHtml(r.notes) + "</p>" : "")
        + '<div class="row-actions"><button type="button" class="btn tiny danger" data-remove-tardy="' + Suite.escapeHtml(r.id) + '">Remove</button></div></article>';
    }).join("") || '<p class="empty-state">No tardies yet.</p>';
  }

  function renderTotals() {
    var map = {};
    function row(name) {
      var key = String(name || "").trim() || "(no name)";
      if (!map[key]) map[key] = { name: key, approved: 0, pending: 0, denied: 0, callouts: 0, tardies: 0, minutes: 0 };
      return map[key];
    }
    state.requests.forEach(function (r) {
      var rec = row(r.employee);
      var days = spanDays(r.start, r.end);
      if (days == null || days < 0) days = 0;
      if (r.status === "Approved") rec.approved += days;
      else if (r.status === "Denied") rec.denied += 1;
      else rec.pending += days;
    });
    state.callouts.forEach(function (r) {
      row(r.employee).callouts += 1;
    });
    state.tardies.forEach(function (r) {
      var rec = row(r.employee);
      rec.tardies += 1;
      rec.minutes += Number(r.minutes) || 0;
    });
    var people = Object.keys(map).sort(function (a, b) { return a.localeCompare(b); });
    if (!people.length) {
      document.getElementById("totals").innerHTML = '<p class="empty-state">Totals show up after you add someone.</p>';
      return;
    }
    var html = '<table class="summary"><thead><tr><th>Employee</th><th>Approved days</th><th>Pending days</th><th>Denied requests</th><th>Call-outs</th><th>Tardies</th><th>Minutes late</th></tr></thead><tbody>';
    people.forEach(function (name) {
      var r = map[name];
      html += "<tr><td>" + Suite.escapeHtml(r.name) + "</td><td>" + r.approved + "</td><td>" + r.pending + "</td><td>" + r.denied + "</td><td>" + r.callouts + "</td><td>" + r.tardies + "</td><td>" + r.minutes + "</td></tr>";
    });
    html += "</tbody></table>";
    document.getElementById("totals").innerHTML = html;
  }

  function eventsOn(iso) {
    var out = [];
    state.requests.forEach(function (r) {
      if (r.start && r.end && iso >= r.start && iso <= r.end) {
        out.push({ cls: r.status === "Pending" ? "pending" : (r.status === "Denied" ? "denied" : "request"), text: (r.employee || "Request") + " " + (r.type || "") });
      }
    });
    state.callouts.forEach(function (r) {
      if (r.date === iso) out.push({ cls: "callout", text: (r.employee || "Call-out") + " call-out" });
    });
    state.tardies.forEach(function (r) {
      if (r.date === iso) out.push({ cls: "tardy", text: (r.employee || "Tardy") + " late" });
    });
    return out;
  }

  function renderCalendar() {
    var names = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    document.getElementById("cal-title").textContent = names[view.month] + " " + view.year;
    var first = new Date(view.year, view.month, 1);
    var startPad = first.getDay();
    var daysInMonth = new Date(view.year, view.month + 1, 0).getDate();
    var html = '<div class="cal-grid">';
    ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].forEach(function (d) {
      html += '<div class="cal-head">' + d + "</div>";
    });
    for (var i = 0; i < startPad; i++) html += '<div class="cal-day out"></div>';
    for (var day = 1; day <= daysInMonth; day++) {
      var iso = view.year + "-" + ("0" + (view.month + 1)).slice(-2) + "-" + ("0" + day).slice(-2);
      var ev = eventsOn(iso);
      html += '<div class="cal-day' + (iso === today ? " today" : "") + '"><span class="n">' + day + "</span>";
      ev.slice(0, 3).forEach(function (item) {
        html += '<span class="ev ' + item.cls + '">' + Suite.escapeHtml(item.text) + "</span>";
      });
      if (ev.length > 3) html += '<span class="ev">' + (ev.length - 3) + " more</span>";
      html += "</div>";
    }
    html += "</div>";
    document.getElementById("calendar").innerHTML = html;
  }

  function render() {
    renderLists();
    renderTotals();
    renderCalendar();
    Suite.fillNameList("people-names");
  }

  function readPerson(id) {
    var name = document.getElementById(id).value.trim();
    if (!name) { setStatus("Type the person's name."); return ""; }
    if (badText(name)) return "";
    return name;
  }

  document.getElementById("btn-add-request").addEventListener("click", function () {
    var name = readPerson("req-name");
    if (!name) return;
    var start = document.getElementById("req-start").value;
    var end = document.getElementById("req-end").value;
    var notes = document.getElementById("req-notes").value.trim();
    if (badText(notes)) return;
    if (!start || !end) { setStatus("Choose the first day and the last day."); return; }
    if (spanDays(start, end) < 0) { setStatus("The last day needs to be the same day or later."); return; }
    state.requests.push({
      id: Suite.uid(),
      employee: name,
      type: document.getElementById("req-type").value,
      start: start,
      end: end,
      status: document.getElementById("req-status").value,
      notes: notes
    });
    document.getElementById("req-notes").value = "";
    save();
    render();
    setStatus("Added a request for " + name + ".");
  });

  document.getElementById("btn-add-call").addEventListener("click", function () {
    var name = readPerson("call-name");
    if (!name) return;
    var date = document.getElementById("call-date").value;
    var notes = document.getElementById("call-notes").value.trim();
    if (!date) { setStatus("Choose the date of the call-out."); return; }
    if (badText(notes)) return;
    state.callouts.push({
      id: Suite.uid(),
      employee: name,
      date: date,
      reason: document.getElementById("call-reason").value,
      notes: notes
    });
    document.getElementById("call-notes").value = "";
    save();
    render();
    setStatus("Added a call-out for " + name + ".");
  });

  document.getElementById("btn-add-tardy").addEventListener("click", function () {
    var name = readPerson("tardy-name");
    if (!name) return;
    var date = document.getElementById("tardy-date").value;
    var minutes = Number(document.getElementById("tardy-minutes").value);
    var notes = document.getElementById("tardy-notes").value.trim();
    if (!date) { setStatus("Choose the date."); return; }
    if (!minutes || minutes < 1) { setStatus("Type how many minutes late."); return; }
    if (badText(notes)) return;
    state.tardies.push({ id: Suite.uid(), employee: name, date: date, minutes: minutes, notes: notes });
    document.getElementById("tardy-notes").value = "";
    save();
    render();
    setStatus("Added a tardy for " + name + ".");
  });

  document.body.addEventListener("change", function (e) {
    var id = e.target.getAttribute && e.target.getAttribute("data-status");
    if (!id) return;
    state.requests.forEach(function (r) { if (r.id === id) r.status = e.target.value; });
    save();
    render();
  });
  document.body.addEventListener("click", function (e) {
    var req = e.target.getAttribute && e.target.getAttribute("data-remove-request");
    var call = e.target.getAttribute && e.target.getAttribute("data-remove-call");
    var tardy = e.target.getAttribute && e.target.getAttribute("data-remove-tardy");
    if (!req && !call && !tardy) return;
    Suite.confirm("Remove this entry?", "Yes, remove").then(function (ok) {
      if (!ok) return;
      if (req) state.requests = state.requests.filter(function (r) { return r.id !== req; });
      if (call) state.callouts = state.callouts.filter(function (r) { return r.id !== call; });
      if (tardy) state.tardies = state.tardies.filter(function (r) { return r.id !== tardy; });
      save();
      render();
    });
  });

  document.getElementById("btn-cal-prev").addEventListener("click", function () {
    view.month -= 1;
    if (view.month < 0) { view.month = 11; view.year -= 1; }
    renderCalendar();
  });
  document.getElementById("btn-cal-next").addEventListener("click", function () {
    view.month += 1;
    if (view.month > 11) { view.month = 0; view.year += 1; }
    renderCalendar();
  });

  function applySample() {
    state = {
      requests: [
        { id: Suite.uid(), employee: "Alex Sample", type: "Vacation", start: Suite.addDays(today, 7), end: Suite.addDays(today, 8), status: "Approved", notes: "Made-up vacation." },
        { id: Suite.uid(), employee: "Jordan Demo", type: "Sick", start: Suite.addDays(today, 1), end: Suite.addDays(today, 1), status: "Pending", notes: "Practice request. Not a real person." },
        { id: Suite.uid(), employee: "Riley Example", type: "Personal", start: Suite.addDays(today, 14), end: Suite.addDays(today, 14), status: "Denied", notes: "Practice denial." }
      ],
      callouts: [
        { id: Suite.uid(), employee: "Casey Practice", date: today, reason: "Sick", notes: "Made-up call-out." }
      ],
      tardies: [
        { id: Suite.uid(), employee: "Alex Sample", date: Suite.addDays(today, -1), minutes: 12, notes: "Practice tardy." }
      ]
    };
    save();
    render();
    setStatus("Loaded made-up sample attendance. These are not real people.");
  }

  document.getElementById("btn-sample").addEventListener("click", function () {
    var has = state.requests.length || state.callouts.length || state.tardies.length;
    if (!has) { applySample(); return; }
    Suite.confirm("Replace time off, call-outs, and tardies with made-up samples?", "Yes, load samples").then(function (ok) {
      if (ok) applySample();
    });
  });

  document.getElementById("btn-export").addEventListener("click", function () {
    var rows = [["Type", "Employee", "Detail", "Start", "End", "Status", "Minutes", "Notes"]];
    state.requests.forEach(function (r) {
      rows.push(["Request", r.employee, r.type, r.start, r.end, r.status, "", r.notes || ""]);
    });
    state.callouts.forEach(function (r) {
      rows.push(["Call-out", r.employee, r.reason, r.date, "", "", "", r.notes || ""]);
    });
    state.tardies.forEach(function (r) {
      rows.push(["Tardy", r.employee, "", r.date, "", "", r.minutes, r.notes || ""]);
    });
    Suite.download("time-off.csv", Suite.toCSV(rows));
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
      var start = header.indexOf("type") >= 0 || header.indexOf("employee") >= 0 ? 1 : 0;
      function col(name, fallback) {
        var i = header.indexOf(name);
        return i >= 0 ? i : fallback;
      }
      var added = 0;
      for (var r = start; r < table.length; r++) {
        var c = table[r];
        var type = String(c[col("type", 0)] || "").trim().toLowerCase();
        var employee = String(c[col("employee", 1)] || "").trim();
        if (!employee || badText(employee)) continue;
        var detail = String(c[col("detail", 2)] || "").trim();
        var startDate = DueDates.normalizeDate(c[col("start", 3)]);
        var endDate = DueDates.normalizeDate(c[col("end", 4)]);
        var status = String(c[col("status", 5)] || "").trim();
        var minutes = parseInt(c[col("minutes", 6)], 10);
        var notes = String(c[col("notes", 7)] || "").trim();
        if (badText(notes) || badText(detail)) continue;
        if (type.indexOf("call") >= 0) {
          if (!startDate) continue;
          state.callouts.push({ id: Suite.uid(), employee: employee, date: startDate, reason: detail || "Other", notes: notes });
          added += 1;
        } else if (type.indexOf("tard") >= 0) {
          if (!startDate) continue;
          state.tardies.push({ id: Suite.uid(), employee: employee, date: startDate, minutes: minutes > 0 ? minutes : 1, notes: notes });
          added += 1;
        } else {
          if (!startDate) continue;
          var st = ["Pending", "Approved", "Denied"].indexOf(status) >= 0 ? status : "Pending";
          state.requests.push({
            id: Suite.uid(),
            employee: employee,
            type: detail || "Other",
            start: startDate,
            end: endDate || startDate,
            status: st,
            notes: notes
          });
          added += 1;
        }
      }
      if (!added) { setStatus("No rows were added. Check the column names and dates."); return; }
      save();
      render();
      setStatus("Imported " + added + " row" + (added === 1 ? "" : "s") + ".");
    };
    reader.readAsText(file);
  });

  document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
  document.getElementById("btn-clear").addEventListener("click", function () {
    Suite.confirm("Clear time off, call-outs, and tardies on this computer? The other tools stay.", "Yes, clear time off").then(function (ok) {
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (err) {}
      state = blank();
      save();
      render();
      setStatus("Time off cleared.");
    });
  });

  ["req-start", "req-end", "call-date", "tardy-date"].forEach(function (id) {
    var el = document.getElementById(id);
    if (el && !el.value) el.value = today;
  });
  load();
  render();
})();
