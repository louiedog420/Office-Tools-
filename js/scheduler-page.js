(function () {
  "use strict";

  var KEY = "office-tools-scheduler";
  var DAYS = ScheduleLogic.DAYS;

  function blank() {
    return {
      weekStart: ScheduleLogic.mondayOf(Suite.todayISO()),
      lunchMinutes: 0,
      employees: [],
      shifts: [],
      coverage: { mon: "", tue: "", wed: "", thu: "", fri: "", sat: "", sun: "" }
    };
  }

  var state = blank();

  function findEmp(id) {
    for (var i = 0; i < state.employees.length; i++) {
      if (state.employees[i].id === id) return state.employees[i];
    }
    return null;
  }

  function setStatus(msg) {
    var el = document.getElementById("status-line");
    if (el) el.textContent = msg;
  }

  function load() {
    var saved = Suite.loadStore(KEY, null);
    if (!saved || typeof saved !== "object") return;
    var next = blank();
    if (saved.weekStart) next.weekStart = ScheduleLogic.mondayOf(saved.weekStart) || next.weekStart;
    next.lunchMinutes = Number(saved.lunchMinutes) || 0;
    if (Array.isArray(saved.employees)) next.employees = saved.employees;
    if (Array.isArray(saved.shifts)) next.shifts = saved.shifts;
    DAYS.forEach(function (day) {
      if (saved.coverage && saved.coverage[day] != null) next.coverage[day] = saved.coverage[day];
    });
    state = next;
  }

  function save() {
    if (Suite.saveStore(KEY, state)) setStatus("Saved on this computer.");
  }

  function currentShifts() {
    return state.shifts.filter(function (s) { return s.weekStart === state.weekStart; });
  }

  function namedShifts() {
    return currentShifts().map(function (s) {
      var emp = findEmp(s.employeeId);
      return {
        id: s.id,
        employeeId: s.employeeId,
        employeeName: emp ? emp.name : "",
        day: s.day,
        start: s.start,
        end: s.end,
        place: s.place || ""
      };
    });
  }

  function prettyTime(hhmm) {
    var mins = ScheduleLogic.parseMinutes(hhmm);
    if (mins == null) return hhmm || "";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    var ap = h >= 12 ? "PM" : "AM";
    var h12 = h % 12;
    if (h12 === 0) h12 = 12;
    return h12 + ":" + (m < 10 ? "0" : "") + m + " " + ap;
  }

  function shiftRowHtml(shift) {
    var idAttr = shift ? ' data-shift="' + Suite.escapeHtml(shift.id) + '"' : "";
    return '<div class="shift-row"' + idAttr + '>'
      + '<input class="shift-start" type="time" aria-label="Start time" value="' + Suite.escapeHtml(shift ? shift.start : "") + '">'
      + '<input class="shift-end" type="time" aria-label="End time" value="' + Suite.escapeHtml(shift ? shift.end : "") + '">'
      + '<input class="shift-place" type="text" aria-label="Where" placeholder="Where" value="' + Suite.escapeHtml(shift ? (shift.place || "") : "") + '">'
      + '<button type="button" class="btn tiny danger remove-shift">Remove</button>'
      + "</div>";
  }

  function renderCoverage() {
    var html = "";
    DAYS.forEach(function (day) {
      html += '<div class="field"><label for="cov-' + day + '">' + ScheduleLogic.DAY_LABEL[day] + '</label>'
        + '<input id="cov-' + day + '" data-cov="' + day + '" type="number" min="0" step="1" inputmode="numeric" placeholder="Any" value="' + Suite.escapeHtml(state.coverage[day]) + '"></div>';
    });
    document.getElementById("coverage-fields").innerHTML = html;
  }

  function renderGrid() {
    var wrap = document.getElementById("grid");
    if (!state.employees.length) {
      wrap.innerHTML = '<div class="empty-state"><p>No one is on the schedule yet.</p><p>Add a person, or click Load sample to practice with made-up names.</p></div>';
      return;
    }
    var html = '<table class="sheet"><thead><tr><th class="sticky">Name</th><th>Job</th>';
    DAYS.forEach(function (day) {
      var date = ScheduleLogic.dateForDay(state.weekStart, day);
      html += "<th>" + ScheduleLogic.DAY_LABEL[day].slice(0, 3) + "<br>" + Suite.escapeHtml(date.slice(5)) + "</th>";
    });
    html += "<th>Week hours</th><th></th></tr></thead><tbody>";
    state.employees.forEach(function (emp) {
      html += '<tr data-emp-row="' + Suite.escapeHtml(emp.id) + '">';
      html += '<td class="sticky"><input class="emp-name name-in" data-emp-id="' + Suite.escapeHtml(emp.id) + '" type="text" value="' + Suite.escapeHtml(emp.name) + '" aria-label="Name"></td>';
      html += '<td><input class="emp-role" data-emp-id="' + Suite.escapeHtml(emp.id) + '" type="text" value="' + Suite.escapeHtml(emp.role || "") + '" aria-label="Job"></td>';
      DAYS.forEach(function (day) {
        var list = currentShifts().filter(function (s) { return s.employeeId === emp.id && s.day === day; });
        html += '<td><div class="shift-cell" data-emp="' + Suite.escapeHtml(emp.id) + '" data-day="' + day + '">';
        if (!list.length) html += shiftRowHtml(null);
        list.forEach(function (s) { html += shiftRowHtml(s); });
        html += '<button type="button" class="btn tiny secondary add-split">+ Split shift</button></div></td>';
      });
      html += '<td class="num week-hours" data-emp="' + Suite.escapeHtml(emp.id) + '">0.00</td>';
      html += '<td><button type="button" class="btn tiny danger remove-emp" data-emp-id="' + Suite.escapeHtml(emp.id) + '">Remove person</button></td>';
      html += "</tr>";
    });
    html += "</tbody></table>";
    wrap.innerHTML = html;
  }

  function renderWeekLabel() {
    var end = Suite.addDays(state.weekStart, 6);
    document.getElementById("week-label").textContent = "Week of Monday, " + Suite.prettyDate(state.weekStart) + " through " + Suite.prettyDate(end) + ".";
    document.getElementById("lunchMinutes").value = state.lunchMinutes;
  }

  function renderWarnings() {
    var shifts = namedShifts();
    var lunch = Number(state.lunchMinutes) || 0;
    var over = ScheduleLogic.overFortyWarnings(state.employees, shifts, lunch);
    var conflicts = ScheduleLogic.conflictWarnings(shifts);
    var gaps = ScheduleLogic.coverageGaps(shifts, state.coverage);
    var timeoff = Suite.loadStore("office-tools-timeoff", { requests: [] });
    var off = ScheduleLogic.timeOffConflicts(shifts, state.weekStart, (timeoff && timeoff.requests) || []);
    var html = '<ul class="warn-list">';
    if (!state.employees.length) {
      html += '<li>Add your people to start this week.</li>';
    } else if (!over.length && !conflicts.length && !gaps.length && !off.length) {
      html += '<li class="ok">Nothing to fix this week. Nobody is over 40 hours, no shifts overlap, and the days you filled in for coverage are covered.</li>';
    }
    over.forEach(function (w) {
      html += '<li class="bad">' + Suite.escapeHtml(w.name || "Someone") + " is scheduled for " + w.hours.toFixed(2) + " hours this week. That is over 40.</li>";
    });
    conflicts.forEach(function (c) {
      var emp = findEmp(c.employeeId);
      html += '<li class="bad">' + Suite.escapeHtml(emp && emp.name ? emp.name : "Someone") + " has overlapping shifts on " + ScheduleLogic.DAY_LABEL[c.day] + ".</li>";
    });
    off.forEach(function (c) {
      html += '<li class="bad">' + Suite.escapeHtml(c.employeeName) + " is scheduled on " + ScheduleLogic.DAY_LABEL[c.day] + ", and that day is approved time off.</li>";
    });
    gaps.forEach(function (g) {
      html += "<li>" + ScheduleLogic.DAY_LABEL[g.day] + " needs " + g.needed + " " + (g.needed === 1 ? "person" : "people") + " and only " + g.scheduled + " " + (g.scheduled === 1 ? "is" : "are") + " scheduled.</li>";
    });
    html += "</ul>";
    document.getElementById("warnings").innerHTML = html;

    state.employees.forEach(function (emp) {
      var mine = shifts.filter(function (s) { return s.employeeId === emp.id; });
      var hours = ScheduleLogic.weeklyHours(mine, lunch);
      var cell = document.querySelector('.week-hours[data-emp="' + emp.id + '"]');
      var row = document.querySelector('tr[data-emp-row="' + emp.id + '"]');
      if (cell) {
        cell.textContent = hours.toFixed(2);
        cell.classList.toggle("ot-num", hours > 40);
      }
      if (row) row.classList.toggle("has-ot", hours > 40);
    });
    renderPrint(shifts, gaps);
  }

  function renderPrint(shifts, gaps) {
    var lunch = Number(state.lunchMinutes) || 0;
    var html = "<h2>Schedule · week of " + Suite.escapeHtml(Suite.prettyDate(state.weekStart)) + "</h2>";
    if (!state.employees.length) {
      document.getElementById("print-schedule").innerHTML = html + "<p>No one is on the schedule.</p>";
      return;
    }
    html += '<table class="summary"><thead><tr><th>Name</th><th>Job</th>';
    DAYS.forEach(function (day) {
      html += "<th>" + ScheduleLogic.DAY_LABEL[day].slice(0, 3) + " " + Suite.escapeHtml(ScheduleLogic.dateForDay(state.weekStart, day).slice(5)) + "</th>";
    });
    html += "<th>Hours</th></tr></thead><tbody>";
    state.employees.forEach(function (emp) {
      var mine = shifts.filter(function (s) { return s.employeeId === emp.id; });
      var hours = ScheduleLogic.weeklyHours(mine, lunch);
      html += "<tr><td>" + Suite.escapeHtml(emp.name || "(no name)") + "</td><td>" + Suite.escapeHtml(emp.role || "") + "</td>";
      DAYS.forEach(function (day) {
        var text = mine.filter(function (s) { return s.day === day && s.start && s.end; }).map(function (s) {
          return prettyTime(s.start) + "–" + prettyTime(s.end) + (s.place ? " " + s.place : "");
        }).join("; ");
        html += "<td>" + Suite.escapeHtml(text || "Off") + "</td>";
      });
      html += "<td>" + hours.toFixed(2) + (hours > 40 ? " (over 40)" : "") + "</td></tr>";
    });
    html += "</tbody></table>";
    if (gaps.length) {
      html += "<p>Still short: " + gaps.map(function (g) {
        return ScheduleLogic.DAY_LABEL[g.day] + " needs " + g.needed + ", has " + g.scheduled;
      }).join(". ") + ".</p>";
    }
    document.getElementById("print-schedule").innerHTML = html;
  }

  function renderAll() {
    renderWeekLabel();
    renderCoverage();
    renderGrid();
    renderWarnings();
  }

  function upsertFromRow(row) {
    var cell = row.closest(".shift-cell");
    if (!cell) return;
    var placeEl = row.querySelector(".shift-place");
    var msg = Suite.sensitiveWarning(placeEl.value, { blockPlainSsn: true });
    if (msg) {
      placeEl.value = "";
      Suite.showNotice(msg);
    }
    var start = row.querySelector(".shift-start").value;
    var end = row.querySelector(".shift-end").value;
    var place = placeEl.value.trim();
    var id = row.getAttribute("data-shift");
    if (!start && !end && !place) {
      if (id) state.shifts = state.shifts.filter(function (s) { return s.id !== id; });
      row.removeAttribute("data-shift");
      save();
      renderWarnings();
      return;
    }
    if (!id) {
      id = Suite.uid();
      row.setAttribute("data-shift", id);
      state.shifts.push({
        id: id,
        weekStart: state.weekStart,
        employeeId: cell.getAttribute("data-emp"),
        day: cell.getAttribute("data-day"),
        start: start,
        end: end,
        place: place
      });
    } else {
      var shift = null;
      state.shifts.forEach(function (s) { if (s.id === id) shift = s; });
      if (!shift) return;
      shift.start = start;
      shift.end = end;
      shift.place = place;
    }
    save();
    renderWarnings();
  }

  function sampleData() {
    var week = state.weekStart;
    function person(name, role) {
      return { id: Suite.uid(), name: name, role: role };
    }
    var alex = person("Alex Sample", "Driver");
    var jordan = person("Jordan Demo", "Driver");
    var riley = person("Riley Example", "Laborer");
    var casey = person("Casey Practice", "Office");
    var people = [alex, jordan, riley, casey];
    var shifts = [];
    function add(emp, day, start, end, place) {
      shifts.push({ id: Suite.uid(), weekStart: week, employeeId: emp.id, day: day, start: start, end: end, place: place });
    }
    ["mon", "tue", "wed", "thu", "fri"].forEach(function (day) {
      add(alex, day, "07:00", "16:00", "Sample route");
      add(riley, day, "08:00", "16:00", "Sample yard");
      add(casey, day, "09:00", "17:00", "Sample office");
    });
    ["mon", "tue", "wed", "thu"].forEach(function (day) {
      add(jordan, day, "08:00", "16:00", "Sample shop");
    });
    add(jordan, "fri", "08:00", "12:00", "Sample shop");
    add(jordan, "fri", "11:00", "15:00", "Sample shop");
    return {
      employees: people,
      shifts: shifts,
      coverage: { mon: "3", tue: "3", wed: "3", thu: "3", fri: "5", sat: "2", sun: "" },
      lunchMinutes: 0
    };
  }

  function applySample() {
    var sample = sampleData();
    var kept = state.shifts.filter(function (s) { return s.weekStart !== state.weekStart; });
    state.employees = sample.employees;
    state.shifts = kept.concat(sample.shifts);
    state.coverage = sample.coverage;
    state.lunchMinutes = 0;
    save();
    renderAll();
    setStatus("Loaded made-up sample names so you can practice. Replace them with your real list when you are ready.");
  }

  function dayKey(raw) {
    var s = String(raw || "").trim().toLowerCase();
    var map = {
      monday: "mon", tuesday: "tue", wednesday: "wed", thursday: "thu",
      friday: "fri", saturday: "sat", sunday: "sun",
      mon: "mon", tue: "tue", wed: "wed", thu: "thu", fri: "fri", sat: "sat", sun: "sun"
    };
    return map[s] || "";
  }

  function toHHMM(raw) {
    var mins = ScheduleLogic.parseMinutes(raw);
    if (mins == null) return "";
    var h = Math.floor(mins / 60);
    var m = mins % 60;
    return (h < 10 ? "0" : "") + h + ":" + (m < 10 ? "0" : "") + m;
  }

  function exportCSV() {
    var rows = [["Name", "Role", "Day", "Start", "End", "Where", "Week Start"]];
    currentShifts().forEach(function (s) {
      var emp = findEmp(s.employeeId);
      if (!emp) return;
      rows.push([emp.name, emp.role || "", s.day, s.start || "", s.end || "", s.place || "", s.weekStart]);
    });
    Suite.download("schedule-" + state.weekStart + ".csv", Suite.toCSV(rows));
  }

  function importCSV(text) {
    var table = Suite.parseCSV(text);
    if (!table.length) return 0;
    var header = table[0].map(function (h) { return String(h).trim().toLowerCase(); });
    var startRow = 0;
    var nameI = 0, roleI = 1, dayI = 2, startI = 3, endI = 4, whereI = 5, weekI = 6;
    if (header.indexOf("name") >= 0) {
      startRow = 1;
      nameI = header.indexOf("name");
      roleI = header.indexOf("role");
      dayI = header.indexOf("day");
      startI = Math.max(header.indexOf("start"), header.indexOf("start time"));
      endI = Math.max(header.indexOf("end"), header.indexOf("end time"));
      whereI = header.indexOf("where");
      if (whereI < 0) whereI = header.indexOf("place");
      weekI = header.indexOf("week start");
    }
    var incoming = [];
    var weeks = {};
    for (var r = startRow; r < table.length; r++) {
      var cells = table[r];
      var name = String(cells[nameI] || "").trim();
      var day = dayKey(cells[dayI]);
      if (!name || !day) continue;
      if (Suite.sensitiveWarning(name, { blockPlainSsn: true })) continue;
      var week = weekI >= 0 ? ScheduleLogic.mondayOf(String(cells[weekI] || "").trim()) : state.weekStart;
      if (!week) week = state.weekStart;
      weeks[week] = true;
      var emp = null;
      state.employees.forEach(function (e) {
        if (e.name.trim().toLowerCase() === name.toLowerCase()) emp = e;
      });
      if (!emp) {
        emp = { id: Suite.uid(), name: name, role: roleI >= 0 ? String(cells[roleI] || "").trim() : "" };
        state.employees.push(emp);
      } else if (roleI >= 0 && String(cells[roleI] || "").trim()) {
        emp.role = String(cells[roleI] || "").trim();
      }
      incoming.push({
        id: Suite.uid(),
        weekStart: week,
        employeeId: emp.id,
        day: day,
        start: toHHMM(cells[startI]),
        end: toHHMM(cells[endI]),
        place: whereI >= 0 ? String(cells[whereI] || "").trim() : ""
      });
    }
    if (!incoming.length) return 0;
    state.shifts = state.shifts.filter(function (s) { return !weeks[s.weekStart]; }).concat(incoming);
    if (weeks[state.weekStart] == null) {
      var first = Object.keys(weeks)[0];
      if (first) state.weekStart = first;
    }
    return incoming.length;
  }

  document.getElementById("coverage-fields").addEventListener("input", function (e) {
    var day = e.target.getAttribute("data-cov");
    if (!day) return;
    state.coverage[day] = e.target.value;
    save();
    renderWarnings();
  });

  document.getElementById("lunchMinutes").addEventListener("input", function (e) {
    state.lunchMinutes = e.target.value === "" ? 0 : Number(e.target.value);
    save();
    renderWarnings();
  });

  document.getElementById("grid").addEventListener("input", function (e) {
    var input = e.target;
    if (input.classList.contains("emp-name") || input.classList.contains("emp-role")) {
      var emp = findEmp(input.getAttribute("data-emp-id"));
      if (!emp) return;
      if (input.classList.contains("emp-name")) {
        var msg = Suite.sensitiveWarning(input.value, { blockPlainSsn: true });
        if (msg) {
          input.value = emp.name;
          Suite.showNotice(msg);
          return;
        }
        emp.name = input.value;
      } else {
        var roleMsg = Suite.sensitiveWarning(input.value, { blockPlainSsn: true });
        if (roleMsg) {
          input.value = emp.role || "";
          Suite.showNotice(roleMsg);
          return;
        }
        emp.role = input.value;
      }
      save();
      renderWarnings();
      return;
    }
    var row = input.closest(".shift-row");
    if (row) upsertFromRow(row);
  });

  document.getElementById("grid").addEventListener("click", function (e) {
    var add = e.target.closest(".add-split");
    if (add) {
      add.insertAdjacentHTML("beforebegin", shiftRowHtml(null));
      return;
    }
    var delShift = e.target.closest(".remove-shift");
    if (delShift) {
      var row = delShift.closest(".shift-row");
      var id = row.getAttribute("data-shift");
      if (id) state.shifts = state.shifts.filter(function (s) { return s.id !== id; });
      var cell = row.closest(".shift-cell");
      row.remove();
      if (cell && !cell.querySelector(".shift-row")) cell.insertAdjacentHTML("afterbegin", shiftRowHtml(null));
      save();
      renderWarnings();
      return;
    }
    var delEmp = e.target.closest(".remove-emp");
    if (delEmp) {
      var empId = delEmp.getAttribute("data-emp-id");
      var emp = findEmp(empId);
      Suite.confirm("Remove " + (emp && emp.name ? emp.name : "this person") + " from the schedule?", "Yes, remove").then(function (ok) {
        if (!ok) return;
        state.employees = state.employees.filter(function (person) { return person.id !== empId; });
        state.shifts = state.shifts.filter(function (s) { return s.employeeId !== empId; });
        save();
        renderAll();
      });
    }
  });

  document.getElementById("btn-add-emp").addEventListener("click", function () {
    var name = document.getElementById("new-name").value.trim();
    var role = document.getElementById("new-role").value.trim();
    if (!name) { setStatus("Type a name first."); return; }
    var msg = Suite.sensitiveWarning(name + " " + role, { blockPlainSsn: true });
    if (msg) { Suite.showNotice(msg); return; }
    state.employees.push({ id: Suite.uid(), name: name, role: role });
    document.getElementById("new-name").value = "";
    document.getElementById("new-role").value = "";
    save();
    renderAll();
    setStatus("Added " + name + ".");
  });
  document.getElementById("new-name").addEventListener("keydown", function (e) {
    if (e.key === "Enter") document.getElementById("btn-add-emp").click();
  });

  document.getElementById("btn-prev").addEventListener("click", function () {
    state.weekStart = Suite.addDays(state.weekStart, -7);
    save();
    renderAll();
  });
  document.getElementById("btn-next").addEventListener("click", function () {
    state.weekStart = Suite.addDays(state.weekStart, 7);
    save();
    renderAll();
  });
  document.getElementById("btn-this").addEventListener("click", function () {
    state.weekStart = ScheduleLogic.mondayOf(Suite.todayISO());
    save();
    renderAll();
  });
  document.getElementById("btn-copy").addEventListener("click", function () {
    var prev = Suite.addDays(state.weekStart, -7);
    var prevShifts = state.shifts.filter(function (s) {
      return s.weekStart === prev && findEmp(s.employeeId);
    });
    if (!prevShifts.length) { setStatus("Last week has no shifts to copy."); return; }
    Suite.confirm("Copy last week's shifts into this week? Shifts already on this week will be replaced.", "Yes, copy").then(function (ok) {
      if (!ok) return;
      state.shifts = state.shifts.filter(function (s) { return s.weekStart !== state.weekStart; });
      prevShifts.forEach(function (s) {
        state.shifts.push({
          id: Suite.uid(),
          weekStart: state.weekStart,
          employeeId: s.employeeId,
          day: s.day,
          start: s.start,
          end: s.end,
          place: s.place
        });
      });
      save();
      renderAll();
      setStatus("Copied last week into this week.");
    });
  });
  document.getElementById("btn-sample").addEventListener("click", function () {
    if (!state.employees.length && !currentShifts().length) { applySample(); return; }
    Suite.confirm("Replace the people and this week's shifts with made-up sample names?", "Yes, load samples").then(function (ok) {
      if (ok) applySample();
    });
  });
  document.getElementById("btn-export").addEventListener("click", exportCSV);
  document.getElementById("btn-import").addEventListener("click", function () {
    document.getElementById("import-file").click();
  });
  document.getElementById("import-file").addEventListener("change", function (e) {
    var file = e.target.files && e.target.files[0];
    e.target.value = "";
    if (!file) return;
    var reader = new FileReader();
    reader.onload = function () {
      Suite.confirm("Replace the shifts for the weeks in that file? People stay on the list.", "Yes, import").then(function (ok) {
        if (!ok) return;
        var n = importCSV(String(reader.result || ""));
        if (!n) { setStatus("No shifts were found. Use columns Name, Role, Day, Start, End, Where, Week Start."); return; }
        save();
        renderAll();
        setStatus("Imported " + n + " shift" + (n === 1 ? "" : "s") + ".");
      });
    };
    reader.readAsText(file);
  });
  document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
  document.getElementById("btn-clear").addEventListener("click", function () {
    Suite.confirm("Clear the whole schedule saved on this computer? Payroll and the other tools stay.", "Yes, clear schedule").then(function (ok) {
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (err) {}
      state = blank();
      save();
      renderAll();
      setStatus("Schedule cleared.");
    });
  });

  load();
  renderAll();
})();
