/* ==========================================================================
   admin.js — Admin Console
   Full Create / Read / Update / Delete over ALL business registrations,
   plus user and role management.
   ========================================================================== */
(function () {
  "use strict";

  var user = null;
  var activeTab = "overview";

  var els = {};

  /* ---------- rendering: overview ---------- */

  function renderOverview() {
    var stats = window.DB.getStats();

    els.tabBody.innerHTML =
      '<div class="grid grid-4" style="margin-bottom:1.5rem">' +
        statCard(stats.businesses, "Total registrations") +
        statCard(stats.approved, "Approved & published") +
        statCard(stats.pending, "Awaiting review") +
        statCard(stats.rejected, "Marked for correction") +
      "</div>" +

      '<div class="grid grid-2">' +
        '<div class="card">' +
          "<h3>Quick actions</h3>" +
          '<p class="small muted">Review pending submissions first — approved listings appear immediately on the public landing page.</p>' +
          '<div class="btn-row mt-2">' +
            '<button class="btn btn-primary" data-quick="pending">Review pending (' + stats.pending + ")</button>" +
            '<button class="btn btn-outline" data-quick="add">+ Add a listing</button>' +
          "</div>" +
        "</div>" +
        '<div class="card">' +
          "<h3>Registrations by category</h3>" +
          (categoryBreakdown(stats.byCategory) || '<p class="small muted">No registrations yet.</p>') +
        "</div>" +
      "</div>";

    function statCard(value, label) {
      return '<div class="stat"><strong>' + value + "</strong><span>" + window.UI.esc(label) + "</span></div>";
    }

    els.tabBody.querySelectorAll("[data-quick]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var action = btn.getAttribute("data-quick");
        if (action === "pending") {
          els.statusFilter.value = "pending";
          switchTab("businesses");
          renderBusinesses();
        } else {
          switchTab("businesses");
          openCreate();
        }
      });
    });
  }

  function categoryBreakdown(byCategory) {
    var keys = Object.keys(byCategory);
    if (keys.length === 0) return "";

    var total = keys.reduce(function (sum, k) { return sum + byCategory[k]; }, 0);

    return keys.sort(function (a, b) { return byCategory[b] - byCategory[a]; }).map(function (k) {
      var pct = Math.round(byCategory[k] / total * 100);
      return (
        '<div style="margin-bottom:.6rem">' +
          '<div style="display:flex;justify-content:space-between;font-size:.86rem">' +
            "<span>" + window.UI.esc(k) + "</span>" +
            "<b>" + byCategory[k] + " (" + pct + "%)</b>" +
          "</div>" +
          '<div style="height:8px;background:var(--line-soft);border-radius:999px;overflow:hidden;margin-top:.2rem">' +
            '<span style="display:block;height:100%;width:' + pct + "%;background:var(--gold-500)\"></span>" +
          "</div>" +
        "</div>"
      );
    }).join("");
  }

  /* ---------- rendering: businesses ---------- */

  function filteredBusinesses() {
    var term = (els.search.value || "").trim().toLowerCase();
    var status = els.statusFilter.value;
    var category = els.categoryFilter.value;

    return window.DB.getBusinesses().filter(function (b) {
      if (status && b.status !== status) return false;
      if (category && b.category !== category) return false;
      if (!term) return true;
      var haystack = [b.businessName, b.ownerName, b.email, b.phone, b.address, b.description]
        .join(" ").toLowerCase();
      return haystack.indexOf(term) > -1;
    }).sort(function (a, b) { return new Date(b.createdAt) - new Date(a.createdAt); });
  }

  function renderBusinesses() {
    var list = filteredBusinesses();

    els.resultCount.textContent =
      list.length + (list.length === 1 ? " record" : " records") +
      (list.length === window.DB.getBusinesses().length ? "" : " (filtered)");

    if (list.length === 0) {
      els.tableWrap.innerHTML =
        '<div class="empty"><div class="icon">&#128203;</div><h3>No records found</h3>' +
        "<p>No business registration matches the current filters. Adjust the search or add a new listing.</p></div>";
      return;
    }

    els.tableWrap.innerHTML =
      '<div class="only-mobile biz-list">' + list.map(businessCard).join("") + "</div>" +
      '<div class="only-desktop table-scroll">' + businessTable(list) + "</div>";

    bindBusinessActions();
  }

  function businessCard(b) {
    return (
      '<article class="biz-card">' +
        '<div class="biz-card-top">' +
          "<div><h3>" + window.UI.esc(b.businessName) + "</h3>" +
          '<p class="meta" style="margin:.15rem 0 0">' + window.UI.esc(b.category) + "</p></div>" +
          window.UI.statusBadge(b.status) +
        "</div>" +
        '<p class="meta" style="margin:0">Owner: ' + window.UI.esc(b.ownerName) + "</p>" +
        '<p class="meta" style="margin:0">' + window.UI.esc(b.phone) + " · " + window.UI.esc(b.email) + "</p>" +
        '<p class="meta" style="margin:0">' + window.UI.esc(b.address) + "</p>" +
        '<p class="meta" style="margin:0">Registered ' + window.UI.formatDate(b.createdAt) + "</p>" +
        '<div class="foot">' +
          '<label class="small muted" for="st-' + b.id + '">Status</label>' +
          '<select class="select" id="st-' + b.id + '" data-action="status" data-id="' + b.id + '" style="max-width:150px;min-height:36px;padding:.25rem .6rem;font-size:.85rem">' +
            window.DB.STATUSES.map(function (s) {
              return '<option value="' + s + '"' + (s === b.status ? " selected" : "") + ">" +
                s.charAt(0).toUpperCase() + s.slice(1) + "</option>";
            }).join("") +
          "</select>" +
          '<button class="btn btn-sm btn-outline" data-action="edit" data-id="' + b.id + '">Edit</button>' +
          '<button class="btn btn-sm btn-danger-soft" data-action="delete" data-id="' + b.id + '">Delete</button>' +
        "</div>" +
      "</article>"
    );
  }

  function businessTable(list) {
    return (
      '<table class="data">' +
        "<thead><tr>" +
          "<th>Business</th><th>Owner</th><th>Category</th><th>Contact</th>" +
          "<th>Status</th><th>Registered</th><th class=\"actions\">Actions</th>" +
        "</tr></thead><tbody>" +
        list.map(function (b) {
          return (
            "<tr>" +
              '<td><strong>' + window.UI.esc(b.businessName) + "</strong><br>" +
                '<span class="small muted">' + window.UI.esc(b.address) + "</span></td>" +
              "<td>" + window.UI.esc(b.ownerName) + "</td>" +
              "<td>" + window.UI.esc(b.category) + "</td>" +
              '<td class="small">' + window.UI.esc(b.phone) + "<br>" + window.UI.esc(b.email) + "</td>" +
              '<td><select class="select" data-action="status" data-id="' + b.id +
                '" style="min-height:36px;padding:.25rem .6rem;font-size:.85rem">' +
                window.DB.STATUSES.map(function (s) {
                  return '<option value="' + s + '"' + (s === b.status ? " selected" : "") + ">" +
                    s.charAt(0).toUpperCase() + s.slice(1) + "</option>";
                }).join("") +
              "</select></td>" +
              '<td class="small nowrap">' + window.UI.formatDate(b.createdAt) + "</td>" +
              '<td class="actions">' +
                '<button class="btn btn-sm btn-outline" data-action="edit" data-id="' + b.id + '">Edit</button>' +
                '<button class="btn btn-sm btn-danger-soft" data-action="delete" data-id="' + b.id + '">Delete</button>' +
              "</td>" +
            "</tr>"
          );
        }).join("") +
        "</tbody></table>"
    );
  }

  function bindBusinessActions() {
    els.tableWrap.querySelectorAll("[data-action]").forEach(function (el) {
      var action = el.getAttribute("data-action");
      var id = el.getAttribute("data-id");

      if (el.tagName === "SELECT") {
        el.addEventListener("change", function () { changeStatus(id, el.value, el); });
      } else {
        el.addEventListener("click", function () {
          if (action === "edit") openEdit(id);
          else if (action === "delete") handleDelete(id);
        });
      }
    });
  }

  /* ---------- rendering: users ---------- */

  function renderUsers() {
    var users = window.DB.getUsers().sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    var businessCount = window.DB.getBusinesses().reduce(function (acc, b) {
      if (b.ownerId) acc[b.ownerId] = (acc[b.ownerId] || 0) + 1;
      return acc;
    }, {});

    els.tabBody.innerHTML =
      '<div class="table-wrap"><div class="table-scroll">' +
        '<table class="data">' +
          "<thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Listings</th><th>Registered</th>" +
          '<th class="actions">Actions</th></tr></thead><tbody>' +
          users.map(function (u) {
            var isSelf = u.id === user.id;
            return (
              "<tr>" +
                "<td><strong>" + window.UI.esc(u.name) + "</strong>" +
                  (isSelf ? ' <span class="badge badge-gold">You</span>' : "") + "</td>" +
                "<td>" + window.UI.esc(u.email) + "</td>" +
                '<td><select class="select" data-action="role" data-id="' + u.id + '"' +
                  (isSelf ? " disabled" : "") +
                  ' style="min-height:36px;padding:.25rem .6rem;font-size:.85rem">' +
                  window.DB.ROLES.map(function (r) {
                    return '<option value="' + r + '"' + (r === u.role ? " selected" : "") + ">" +
                      (r === "admin" ? "Administrator" : "Customer") + "</option>";
                  }).join("") +
                "</select></td>" +
                '<td>' + (businessCount[u.id] || 0) + "</td>" +
                '<td class="small nowrap">' + window.UI.formatDate(u.createdAt) + "</td>" +
                '<td class="actions">' +
                  (isSelf
                    ? '<span class="small muted">—</span>'
                    : '<button class="btn btn-sm btn-danger-soft" data-action="delete-user" data-id="' +
                      u.id + '">Delete</button>') +
                "</td>" +
              "</tr>"
            );
          }).join("") +
        "</tbody></table>" +
      "</div></div>" +

      '<p class="small muted mt-2">Deleting a user account also deletes every business registration owned by that user.</p>';

    els.tabBody.querySelectorAll("[data-action]").forEach(function (el) {
      if (el.tagName === "SELECT") {
        el.addEventListener("change", function () {
          changeRole(el.getAttribute("data-id"), el.value);
        });
      } else {
        el.addEventListener("click", function () {
          if (el.getAttribute("data-action") === "delete-user") handleDeleteUser(el.getAttribute("data-id"));
        });
      }
    });
  }

  /* ---------- actions ---------- */

  function openCreate() {
    window.BusinessForm.open({
      mode: "create",
      allowStatus: true,
      ownerName: "",
      onSubmit: function (payload) {
        var res = window.DB.addBusiness(Object.assign({}, payload, { ownerId: null }));
        if (!res.ok) { window.UI.toast(res.error, "error"); return false; }
        window.UI.toast('"' + res.business.businessName + '" was added to the registry.', "success");
        refreshCurrentTab();
        return true;
      }
    });
  }

  function openEdit(id) {
    var b = window.DB.getBusinessById(id);
    if (!b) { window.UI.toast("Record not found.", "error"); refreshCurrentTab(); return; }

    window.BusinessForm.open({
      mode: "edit",
      business: b,
      allowStatus: true,
      onSubmit: function (payload) {
        var res = window.DB.updateBusiness(id, payload);
        if (!res.ok) { window.UI.toast(res.error, "error"); return false; }
        window.UI.toast('"' + res.business.businessName + '" was updated.', "success");
        refreshCurrentTab();
        return true;
      }
    });
  }

  function changeStatus(id, status, selectEl) {
    var b = window.DB.getBusinessById(id);
    if (!b) { window.UI.toast("Record not found.", "error"); refreshCurrentTab(); return; }

    var previous = b.status;
    if (previous === status) return;

    var message = {
      approved: 'was approved and published',
      rejected: "was rejected and pulled from the directory",
      pending: "was moved back to pending review"
    }[status];

    var run = function () {
      var res = window.DB.updateBusiness(id, { status: status });
      if (!res.ok) {
        window.UI.toast(res.error, "error");
        refreshCurrentTab();
        return;
      }
      window.UI.toast('"' + b.businessName + '" ' + message + ".", "success");
      refreshCurrentTab();
    };

    if (status === "rejected") {
      window.UI.confirmDialog({
        title: "Reject this registration?",
        message: 'The listing for <b>"' + window.UI.esc(b.businessName) + '"</b> will be removed from the public directory.',
        detail: "The owner will see a notice asking them to correct their details.",
        confirmLabel: "Yes, reject listing",
        cancelLabel: "Cancel"
      }).then(function (ok) { if (ok) run(); else refreshCurrentTab(); });
    } else if (status === "approved") {
      window.UI.confirmDialog({
        title: "Approve this registration?",
        message: '<b>"' + window.UI.esc(b.businessName) + '"</b> will be published in the public business directory immediately.',
        confirmLabel: "Yes, approve & publish",
        cancelLabel: "Cancel"
      }).then(function (ok) { if (ok) run(); else refreshCurrentTab(); });
    } else {
      run();
    }
  }

  function handleDelete(id) {
    var b = window.DB.getBusinessById(id);
    if (!b) { window.UI.toast("Record not found.", "error"); refreshCurrentTab(); return; }

    window.UI.confirmDialog({
      title: "Delete business registration?",
      message: 'You are about to permanently delete <b>"' + window.UI.esc(b.businessName) + '"</b>.',
      detail: "This removes the record from the registry and the public directory. This action cannot be undone.",
      confirmLabel: "Yes, delete permanently"
    }).then(function (confirmed) {
      if (!confirmed) return;
      var res = window.DB.deleteBusiness(id);
      if (!res.ok) { window.UI.toast(res.error, "error"); return; }
      window.UI.toast('"' + b.businessName + '" was deleted.', "success");
      refreshCurrentTab();
    });
  }

  function changeRole(id, role) {
    var u = window.DB.getUserById(id);
    if (!u || u.role === role) return;

    if (u.role === "admin" && role === "customer") {
      var admins = window.DB.getUsers().filter(function (x) { return x.role === "admin"; });
      if (admins.length <= 1) {
        window.UI.toast("There must be at least one administrator.", "error");
        refreshCurrentTab();
        return;
      }
    }

    var res = window.DB.updateUser(id, { role: role });
    if (!res.ok) { window.UI.toast(res.error, "error"); refreshCurrentTab(); return; }
    window.UI.toast(u.name + " is now " + (role === "admin" ? "an administrator" : "a customer") + ".", "success");
    refreshCurrentTab();
  }

  function handleDeleteUser(id) {
    var u = window.DB.getUserById(id);
    if (!u) { window.UI.toast("User not found.", "error"); refreshCurrentTab(); return; }
    if (u.id === user.id) { window.UI.toast("You cannot delete your own account.", "error"); return; }

    var owned = window.DB.businessesByOwner(u.id).length;

    window.UI.confirmDialog({
      title: "Delete user account?",
      message: 'You are about to permanently delete the account of <b>' + window.UI.esc(u.name) + "</b>.",
      detail: owned > 0
        ? "This will also delete " + owned + " business registration" + (owned === 1 ? "" : "s") + " owned by this user."
        : "This account has no business registrations.",
      confirmLabel: "Yes, delete account"
    }).then(function (confirmed) {
      if (!confirmed) return;
      var res = window.DB.deleteUser(id);
      if (!res.ok) { window.UI.toast(res.error, "error"); return; }
      window.UI.toast("Account deleted.", "success");
      refreshCurrentTab();
    });
  }

  /* ---------- tabs ---------- */

  function switchTab(name) {
    activeTab = name;
    document.querySelectorAll("[data-tab]").forEach(function (btn) {
      var on = btn.getAttribute("data-tab") === name;
      btn.classList.toggle("active", on);
      btn.setAttribute("aria-selected", on ? "true" : "false");
    });

    if (els.tabBody) els.tabBody.classList.toggle("hidden", name === "businesses");
    if (els.tabBusinesses) els.tabBusinesses.classList.toggle("hidden", name !== "businesses");

    refreshCurrentTab();
  }

  function refreshCurrentTab() {
    if (activeTab === "overview") renderOverview();
    else if (activeTab === "businesses") renderBusinesses();
    else renderUsers();
  }

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    els.tabBody = document.getElementById("tab-body");
    els.tabButtons = Array.prototype.slice.call(document.querySelectorAll("[data-tab]"));
    els.tableWrap = document.getElementById("biz-table-wrap");
    els.search = document.getElementById("biz-search");
    els.statusFilter = document.getElementById("status-filter");
    els.categoryFilter = document.getElementById("category-filter");
    els.resultCount = document.getElementById("result-count");
    els.tabBusinesses = document.getElementById("tab-businesses");

    window.Auth.ensureSeed().then(function () {
      user = window.Auth.guard({ adminOnly: true });
      if (!user) return; // redirected to login (or a customer to their dashboard)

      window.UI.initNav();

      var chip = document.getElementById("user-chip");
      if (chip) {
        chip.innerHTML = '<span class="name">' + window.UI.esc(user.name) + "</span>" + window.UI.roleBadge(user.role);
      }

      // category filter options
      if (els.categoryFilter) {
        els.categoryFilter.innerHTML = '<option value="">All categories</option>' +
          window.DB.CATEGORIES.map(function (c) {
            return '<option value="' + window.UI.esc(c) + '">' + window.UI.esc(c) + "</option>";
          }).join("");
      }

      els.tabButtons.forEach(function (btn) {
        btn.addEventListener("click", function () { switchTab(btn.getAttribute("data-tab")); });
      });

      var addBtn = document.getElementById("btn-add-biz");
      if (addBtn) addBtn.addEventListener("click", openCreate);
      if (els.search) els.search.addEventListener("input", window.UI.debounce(renderBusinesses, 150));
      if (els.statusFilter) els.statusFilter.addEventListener("change", renderBusinesses);
      if (els.categoryFilter) els.categoryFilter.addEventListener("change", renderBusinesses);

      var logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) {
        logoutBtn.addEventListener("click", function () {
          window.UI.confirmDialog({
            title: "Sign out of the Admin Console?",
            message: "You will be returned to the public landing page.",
            confirmLabel: "Sign out",
            cancelLabel: "Stay signed in"
          }).then(function (ok) { if (ok) window.Auth.logout("index.html"); });
        });
      }

      switchTab("overview");

      var params = new URLSearchParams(window.location.search);
      if (params.get("denied") === "1") {
        window.UI.toast("The Admin Console is restricted to administrator accounts.", "error");
      }

      // live refresh when another tab edits the data
      window.addEventListener("storage", function (e) {
        if (e.key === window.DB.STORAGE_KEY) refreshCurrentTab();
      });
    });
  });
})();