(function () {
  "use strict";

  var KEY = "office-tools-invoices";
  var today = Suite.todayISO();
  var editing = null;

  function blankDraft() {
    return {
      toName: "",
      toAddress: "",
      invoiceNumber: "",
      invoiceDate: today,
      dueDate: Suite.addDays(today, 14),
      note: "",
      lines: [{ desc: "", qty: 1, price: "" }]
    };
  }
  function blank() {
    return {
      businessName: "",
      businessAddress: "",
      businessPhone: "",
      items: [],
      draft: blankDraft()
    };
  }
  var state = blank();

  function setStatus(msg) {
    var el = document.getElementById("status-line");
    if (el) el.textContent = msg;
  }
  function money(n) { return Suite.formatMoney(n); }
  function round2(n) { return Math.round((Number(n) || 0) * 100) / 100; }
  function kindOf() {
    var picked = document.querySelector('input[name="kind"]:checked');
    return picked ? picked.value : "bill";
  }
  function bad(value) {
    var msg = Suite.sensitiveWarning(value, { blockPlainSsn: true });
    if (msg) Suite.showNotice(msg);
    return !!msg;
  }

  function load() {
    var saved = Suite.loadStore(KEY, null);
    if (saved && typeof saved === "object") {
      state.businessName = saved.businessName || "";
      state.businessAddress = saved.businessAddress || "";
      state.businessPhone = saved.businessPhone || "";
      state.items = Array.isArray(saved.items) ? saved.items : [];
      state.draft = saved.draft && typeof saved.draft === "object" ? saved.draft : blankDraft();
      if (!Array.isArray(state.draft.lines) || !state.draft.lines.length) state.draft.lines = blankDraft().lines;
    }
    if (!state.businessName) {
      var pay = Suite.loadStore("payroll-helper-v1", null);
      if (pay && pay.businessName) state.businessName = pay.businessName;
    }
  }
  function save() {
    if (Suite.saveStore(KEY, state)) setStatus("Saved on this computer.");
  }

  function timing(item) {
    if (item.status === "paid") return { timing: "paid", days: DueDates.daysUntil(item.due, today) };
    return DueDates.billTiming(item.due, today, 14);
  }

  function renderAttention() {
    var overdueBills = [];
    var upcomingBills = [];
    var overdueInv = [];
    var upcomingInv = [];
    state.items.forEach(function (item) {
      var t = timing(item);
      if (item.kind === "bill" && t.timing === "overdue") overdueBills.push(item);
      else if (item.kind === "bill" && t.timing === "upcoming") upcomingBills.push(item);
      else if (item.kind === "invoice" && t.timing === "overdue") overdueInv.push(item);
      else if (item.kind === "invoice" && t.timing === "upcoming") upcomingInv.push(item);
    });
    if (!overdueBills.length && !upcomingBills.length && !overdueInv.length && !upcomingInv.length) {
      document.getElementById("attention").innerHTML = "<p>Nothing unpaid is overdue or due in the next 14 days.</p>";
      return;
    }
    function lines(title, list) {
      if (!list.length) return "";
      return "<p><strong>" + title + "</strong></p><ul>" + list.map(function (item) {
        var t = timing(item);
        return "<li>" + Suite.escapeHtml(item.party || "(no name)") + " · " + money(item.amount) + " · due " + Suite.escapeHtml(Suite.prettyDate(item.due)) + " (" + Suite.escapeHtml(DueDates.duePhrase(t.days)) + ")</li>";
      }).join("") + "</ul>";
    }
    document.getElementById("attention").innerHTML = lines("Overdue bills", overdueBills) + lines("Bills due in the next 14 days", upcomingBills) + lines("Overdue invoices you sent", overdueInv) + lines("Invoices due in the next 14 days", upcomingInv);
  }

  function renderList() {
    var items = state.items.slice().sort(function (a, b) {
      var rank = { overdue: 0, upcoming: 1, later: 2, none: 3, paid: 4 };
      var ta = timing(a).timing;
      var tb = timing(b).timing;
      if (rank[ta] !== rank[tb]) return rank[ta] - rank[tb];
      return String(a.due || "").localeCompare(String(b.due || ""));
    });
    if (!items.length) {
      document.getElementById("item-list").innerHTML = '<p class="empty-state">Nothing here yet. Add a bill, or click Load sample to see made-up ones.</p>';
      return;
    }
    document.getElementById("item-list").innerHTML = items.map(function (item) {
      var t = timing(item);
      var cls = t.timing === "overdue" ? "overdue" : "";
      var pill = item.status === "paid" ? "paid" : (t.timing === "overdue" ? "overdue" : (t.timing === "upcoming" ? "soon30" : "unpaid"));
      var label = item.status === "paid" ? "Paid" : (t.timing === "overdue" ? "Overdue" : (t.timing === "upcoming" ? "Due soon" : "Unpaid"));
      return '<article class="record ' + cls + '"><div class="record-top"><h3>' + Suite.escapeHtml(item.party || "(no name)") + "</h3>"
        + '<span class="pill ' + pill + '">' + label + "</span></div>"
        + '<p class="meta">' + (item.kind === "invoice" ? "Invoice you sent" : "Bill to pay")
        + " · " + money(item.amount)
        + (item.due ? " · due " + Suite.escapeHtml(Suite.prettyDate(item.due)) + " (" + Suite.escapeHtml(DueDates.duePhrase(t.days)) + ")" : " · no due date")
        + (item.number ? " · #" + Suite.escapeHtml(item.number) : "")
        + "</p>"
        + (item.notes ? '<p class="meta">' + Suite.escapeHtml(item.notes) + "</p>" : "")
        + '<div class="row-actions no-print">'
        + (item.status !== "paid" ? '<button type="button" class="btn small" data-paid="' + Suite.escapeHtml(item.id) + '">Mark paid</button>' : '<button type="button" class="btn small secondary" data-unpaid="' + Suite.escapeHtml(item.id) + '">Mark unpaid</button>')
        + '<button type="button" class="btn small secondary" data-edit="' + Suite.escapeHtml(item.id) + '">Edit</button>'
        + '<button type="button" class="btn small danger" data-remove="' + Suite.escapeHtml(item.id) + '">Remove</button>'
        + "</div></article>";
    }).join("");
  }

  function lineTotal() {
    var total = 0;
    (state.draft.lines || []).forEach(function (line) {
      total += (Number(line.qty) || 0) * (Number(line.price) || 0);
    });
    return round2(total);
  }

  function renderLines() {
    var html = "";
    state.draft.lines.forEach(function (line, i) {
      html += '<div class="settings" data-line="' + i + '">'
        + '<div class="field"><label>Description</label><input type="text" data-line-field="desc" data-i="' + i + '" value="' + Suite.escapeHtml(line.desc || "") + '"></div>'
        + '<div class="field"><label>Quantity</label><input type="number" min="0" step="0.01" data-line-field="qty" data-i="' + i + '" value="' + Suite.escapeHtml(line.qty) + '"></div>'
        + '<div class="field"><label>Price each</label><input type="number" min="0" step="0.01" data-line-field="price" data-i="' + i + '" value="' + Suite.escapeHtml(line.price) + '"></div>'
        + '<div class="field"><label>&nbsp;</label><button type="button" class="btn secondary" data-remove-line="' + i + '">Remove line</button></div>'
        + "</div>";
    });
    document.getElementById("lines").innerHTML = html;
  }

  function renderSheet() {
    var d = state.draft;
    var rows = (d.lines || []).map(function (line) {
      var qty = Number(line.qty) || 0;
      var price = Number(line.price) || 0;
      var amount = round2(qty * price);
      if (!line.desc && !amount) return "";
      return "<tr><td>" + Suite.escapeHtml(line.desc || "") + "</td><td class='num'>" + qty + "</td><td class='num'>" + money(price) + "</td><td class='num'>" + money(amount) + "</td></tr>";
    }).join("");
    document.getElementById("invoice-sheet").innerHTML = ""
      + "<h3>Invoice</h3>"
      + "<p><strong>" + Suite.escapeHtml(state.businessName || "Your business") + "</strong><br>"
      + Suite.escapeHtml(state.businessAddress || "").replace(/\n/g, "<br>")
      + (state.businessPhone ? "<br>" + Suite.escapeHtml(state.businessPhone) : "")
      + "</p>"
      + "<div class='two'><div><p><strong>Bill to</strong><br>" + Suite.escapeHtml(d.toName || "Customer") + "<br>" + Suite.escapeHtml(d.toAddress || "").replace(/\n/g, "<br>") + "</p></div>"
      + "<div><p>Invoice number: " + Suite.escapeHtml(d.invoiceNumber || "—") + "<br>Date: " + Suite.escapeHtml(Suite.prettyDate(d.invoiceDate)) + "<br>Due: " + Suite.escapeHtml(Suite.prettyDate(d.dueDate)) + "</p></div></div>"
      + "<table><thead><tr><th>Description</th><th class='num'>Qty</th><th class='num'>Price</th><th class='num'>Amount</th></tr></thead><tbody>"
      + (rows || "<tr><td colspan='4'>No lines yet.</td></tr>")
      + "</tbody></table>"
      + "<p style='text-align:right'><strong>Total " + money(lineTotal()) + "</strong></p>"
      + (d.note ? "<p>" + Suite.escapeHtml(d.note) + "</p>" : "")
      + "<p class='hint'>Please pay by the due date. This page does not take payment online.</p>";
  }

  function renderForm() {
    document.getElementById("from-name").value = state.businessName || "";
    document.getElementById("from-address").value = state.businessAddress || "";
    document.getElementById("from-phone").value = state.businessPhone || "";
    document.getElementById("to-name").value = state.draft.toName || "";
    document.getElementById("to-address").value = state.draft.toAddress || "";
    document.getElementById("inv-number").value = state.draft.invoiceNumber || "";
    document.getElementById("inv-date").value = state.draft.invoiceDate || "";
    document.getElementById("inv-due").value = state.draft.dueDate || "";
    document.getElementById("inv-note").value = state.draft.note || "";
    renderLines();
    renderSheet();
  }

  function render() {
    renderAttention();
    renderList();
    renderForm();
  }

  function clearEditor() {
    editing = null;
    document.getElementById("party").value = "";
    document.getElementById("amount").value = "";
    document.getElementById("due").value = "";
    document.getElementById("status").value = "unpaid";
    document.getElementById("number").value = "";
    document.getElementById("notes").value = "";
    document.getElementById("form-title").textContent = "Add a bill or invoice";
    document.getElementById("btn-save-item").textContent = "Save";
    document.getElementById("btn-cancel-edit").hidden = true;
  }

  document.getElementById("btn-save-item").addEventListener("click", function () {
    var party = document.getElementById("party").value.trim();
    var amount = round2(document.getElementById("amount").value);
    var due = document.getElementById("due").value;
    var notes = document.getElementById("notes").value.trim();
    var number = document.getElementById("number").value.trim();
    if (!party) { setStatus("Type the vendor or customer."); return; }
    if (bad(party) || bad(notes) || bad(number)) return;
    if (!(amount > 0)) { setStatus("Type an amount greater than zero."); return; }
    var item = {
      id: editing || Suite.uid(),
      kind: kindOf(),
      party: party,
      amount: amount,
      due: due,
      status: document.getElementById("status").value,
      number: number,
      notes: notes
    };
    if (editing) {
      state.items = state.items.map(function (existing) { return existing.id === editing ? item : existing; });
    } else state.items.push(item);
    clearEditor();
    save();
    render();
    setStatus(editing ? "Saved changes." : "Saved.");
  });
  document.getElementById("btn-cancel-edit").addEventListener("click", function () {
    clearEditor();
    render();
  });

  document.getElementById("item-list").addEventListener("click", function (e) {
    var paid = e.target.getAttribute("data-paid");
    var unpaid = e.target.getAttribute("data-unpaid");
    var edit = e.target.getAttribute("data-edit");
    var remove = e.target.getAttribute("data-remove");
    if (paid || unpaid) {
      state.items.forEach(function (item) {
        if (item.id === (paid || unpaid)) item.status = paid ? "paid" : "unpaid";
      });
      save();
      render();
      return;
    }
    if (edit) {
      var item = null;
      state.items.forEach(function (candidate) { if (candidate.id === edit) item = candidate; });
      if (!item) return;
      editing = item.id;
      document.querySelectorAll('input[name="kind"]').forEach(function (el) { el.checked = el.value === item.kind; });
      document.getElementById("party").value = item.party || "";
      document.getElementById("amount").value = item.amount;
      document.getElementById("due").value = item.due || "";
      document.getElementById("status").value = item.status || "unpaid";
      document.getElementById("number").value = item.number || "";
      document.getElementById("notes").value = item.notes || "";
      document.getElementById("form-title").textContent = "Edit this " + (item.kind === "invoice" ? "invoice" : "bill");
      document.getElementById("btn-save-item").textContent = "Save changes";
      document.getElementById("btn-cancel-edit").hidden = false;
      document.getElementById("bills-area").scrollIntoView({ behavior: "smooth", block: "start" });
      return;
    }
    if (remove) {
      Suite.confirm("Remove this from the list?", "Yes, remove").then(function (ok) {
        if (!ok) return;
        state.items = state.items.filter(function (item) { return item.id !== remove; });
        if (editing === remove) clearEditor();
        save();
        render();
      });
    }
  });

  function readDraftFromForm() {
    var fields = {
      "from-name": "businessName",
      "from-address": "businessAddress",
      "from-phone": "businessPhone"
    };
    Object.keys(fields).forEach(function (id) {
      var value = document.getElementById(id).value;
      if (bad(value)) {
        document.getElementById(id).value = state[fields[id]] || "";
        return;
      }
      state[fields[id]] = value;
    });
    var draftFields = {
      "to-name": "toName",
      "to-address": "toAddress",
      "inv-number": "invoiceNumber",
      "inv-date": "invoiceDate",
      "inv-due": "dueDate",
      "inv-note": "note"
    };
    Object.keys(draftFields).forEach(function (id) {
      var value = document.getElementById(id).value;
      if (bad(value)) {
        document.getElementById(id).value = state.draft[draftFields[id]] || "";
        return;
      }
      state.draft[draftFields[id]] = value;
    });
  }

  document.getElementById("invoice-generator").addEventListener("input", function (e) {
    var field = e.target.getAttribute("data-line-field");
    if (field) {
      var i = +e.target.getAttribute("data-i");
      if (!state.draft.lines[i]) return;
      if (field === "desc" && bad(e.target.value)) {
        e.target.value = "";
        state.draft.lines[i].desc = "";
      } else state.draft.lines[i][field] = e.target.value;
      save();
      renderSheet();
      return;
    }
    if (e.target.id) {
      readDraftFromForm();
      save();
      renderSheet();
    }
  });

  document.getElementById("btn-add-line").addEventListener("click", function () {
    state.draft.lines.push({ desc: "", qty: 1, price: "" });
    save();
    renderLines();
    renderSheet();
  });
  document.getElementById("lines").addEventListener("click", function (e) {
    var index = e.target.getAttribute("data-remove-line");
    if (index == null) return;
    state.draft.lines.splice(+index, 1);
    if (!state.draft.lines.length) state.draft.lines.push({ desc: "", qty: 1, price: "" });
    save();
    renderLines();
    renderSheet();
  });

  document.getElementById("btn-save-invoice").addEventListener("click", function () {
    readDraftFromForm();
    var total = lineTotal();
    if (!state.draft.toName.trim()) { setStatus("Type who the invoice is for."); return; }
    if (!(total > 0)) { setStatus("Add a line with a quantity and a price."); return; }
    state.items.push({
      id: Suite.uid(),
      kind: "invoice",
      party: state.draft.toName.trim(),
      amount: total,
      due: state.draft.dueDate,
      status: "unpaid",
      number: state.draft.invoiceNumber.trim(),
      notes: state.draft.note.trim() || "Saved from the printable invoice."
    });
    save();
    render();
    setStatus("Saved that invoice on your list.");
  });

  document.getElementById("btn-print-invoice").addEventListener("click", function () {
    document.body.classList.add("printing-invoice");
    window.print();
  });
  window.addEventListener("afterprint", function () {
    document.body.classList.remove("printing-invoice");
  });

  function applySample() {
    state.items = [
      { id: Suite.uid(), kind: "bill", party: "Sample Fuel Co.", amount: 842.16, due: Suite.addDays(today, 5), status: "unpaid", number: "SAMPLE-BILL-1", notes: "Made-up fuel bill." },
      { id: Suite.uid(), kind: "bill", party: "Sample Insurance Agency", amount: 1200, due: Suite.addDays(today, -10), status: "unpaid", number: "SAMPLE-BILL-2", notes: "Made-up overdue bill." },
      { id: Suite.uid(), kind: "bill", party: "Sample Uniforms", amount: 300, due: Suite.addDays(today, -2), status: "paid", number: "SAMPLE-BILL-3", notes: "Made-up paid bill." },
      { id: Suite.uid(), kind: "invoice", party: "Sample Customer - Harbor Lot", amount: 2400, due: Suite.addDays(today, -3), status: "unpaid", number: "SAMPLE-1001", notes: "Made-up overdue invoice." },
      { id: Suite.uid(), kind: "invoice", party: "Sample Customer - Oak Street", amount: 860, due: Suite.addDays(today, 10), status: "unpaid", number: "SAMPLE-1002", notes: "Made-up invoice." },
      { id: Suite.uid(), kind: "invoice", party: "Sample Customer - Maple Ave", amount: 400, due: Suite.addDays(today, -20), status: "paid", number: "SAMPLE-1003", notes: "Made-up paid invoice." }
    ];
    if (!state.businessName) state.businessName = "Sample Snow & Site Co.";
    state.draft = {
      toName: "Sample Customer - Oak Street",
      toAddress: "100 Practice Lane\nSampletown, MD 00000",
      invoiceNumber: "SAMPLE-1002",
      invoiceDate: today,
      dueDate: Suite.addDays(today, 10),
      note: "Thank you. This is a practice invoice, not a real bill.",
      lines: [{ desc: "Sample site work", qty: 8, price: 107.5 }]
    };
    if (!state.businessAddress) state.businessAddress = "1 Practice Road\nSampletown, MD 00000";
    save();
    render();
    setStatus("Loaded made-up bills and invoices. None of these are real.");
  }

  document.getElementById("btn-sample").addEventListener("click", function () {
    if (!state.items.length) { applySample(); return; }
    Suite.confirm("Replace the list with made-up sample bills and invoices?", "Yes, load samples").then(function (ok) {
      if (ok) applySample();
    });
  });

  document.getElementById("btn-export").addEventListener("click", function () {
    var rows = [["Kind", "Party", "Amount", "Due Date", "Status", "Number", "Notes"]];
    state.items.forEach(function (item) {
      rows.push([item.kind === "invoice" ? "Invoice" : "Bill", item.party, item.amount, item.due || "", item.status, item.number || "", item.notes || ""]);
    });
    Suite.download("invoices-and-bills.csv", Suite.toCSV(rows));
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
      var start = header.indexOf("party") >= 0 || header.indexOf("kind") >= 0 ? 1 : 0;
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
        var party = String(c[col(["party", "vendor", "customer"], 1)] || "").trim();
        if (!party || bad(party)) continue;
        var kindRaw = String(c[col(["kind"], 0)] || "").toLowerCase();
        var amount = round2(String(c[col(["amount"], 2)] || "").replace(/[$,]/g, ""));
        if (!(amount > 0)) continue;
        var due = DueDates.normalizeDate(c[col(["due date", "due"], 3)]);
        var statusRaw = String(c[col(["status"], 4)] || "").toLowerCase();
        var number = String(c[col(["number", "reference number"], 5)] || "").trim();
        var notes = String(c[col(["notes", "note"], 6)] || "").trim();
        if (bad(notes) || bad(number)) continue;
        state.items.push({
          id: Suite.uid(),
          kind: kindRaw.indexOf("inv") >= 0 ? "invoice" : "bill",
          party: party,
          amount: amount,
          due: due,
          status: statusRaw.indexOf("paid") >= 0 && statusRaw.indexOf("unpaid") < 0 ? "paid" : "unpaid",
          number: number,
          notes: notes
        });
        added += 1;
      }
      if (!added) { setStatus("No rows were added. Include a name and an amount."); return; }
      save();
      render();
      setStatus("Imported " + added + " row" + (added === 1 ? "" : "s") + ".");
    };
    reader.readAsText(file);
  });

  document.getElementById("btn-print").addEventListener("click", function () { window.print(); });
  document.getElementById("btn-clear").addEventListener("click", function () {
    Suite.confirm("Clear bills, invoices, and the invoice draft on this computer? The other tools stay.", "Yes, clear").then(function (ok) {
      if (!ok) return;
      try { localStorage.removeItem(KEY); } catch (err) {}
      state = blank();
      clearEditor();
      save();
      render();
      setStatus("Cleared.");
    });
  });

  load();
  if (!document.getElementById("due").value) document.getElementById("due").value = Suite.addDays(today, 14);
  render();
  if (!document.getElementById("status-line").textContent) setStatus("Saved on this computer as you type.");
})();
