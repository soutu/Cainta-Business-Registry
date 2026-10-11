/* ==========================================================================
   dashboard.js — Customer dashboard
   A signed-in customer can Create, Read, Update and Delete ONLY their own
   business registrations. Any admin hitting this page is routed to admin.html.
   ========================================================================== */
(function () {
  "use strict";

  var user = null;
  var listEl, statsEl, emptyEl;

  /* ---------- data helpers ---------- */

  function myBusinesses() {
    return window.DB.businessesByOwner(user.id).sort(function (a, b) {
      return new Date(b.createdAt) - new Date(a.createdAt);
    });
  }

  /* ---------- rendering ---------- */

  function renderUserChip() {
    var chip = document.getElementById("user-chip");
    if (!chip) return;
    chip.innerHTML =
      '<span class="name">' + window.UI.esc(user.name) + "</span>" +
      window.UI.roleBadge(user.role);
  }

  function renderStats() {
    var list = myBusinesses();
    var counts = { pending: 0, approved: 0, rejected: 0 };
    list.forEach(function (b) { if (counts[b.status] !== undefined) counts[b.status]++; });

    statsEl.innerHTML =
      statCard(list.length, "Total listings") +
      statCard(counts.approved, "Approved & promoted") +
      statCard(counts.pending, "Awaiting review") +
      statCard(counts.rejected, "Needs correction");

    function statCard(value, label) {
      return '<div class="stat"><strong>' + value + "</strong><span>" + window.UI.esc(label) + "</span></div>";
    }
  }

  function renderList() {
    var list = myBusinesses();

    if (list.length === 0) {
      emptyEl.classList.remove("hidden");
      listEl.innerHTML = "";
      return;
    }
    emptyEl.classList.add("hidden");

    listEl.innerHTML = list.map(function (b) {
      return (
        '<article class="biz-card card-hover">' +
          '<div class="biz-card-top">' +
            "<div>" +
              "<h3>" + window.UI.esc(b.businessName) + "</h3>" +
              '<p class="meta" style="margin:.15rem 0 0">' + window.UI.esc(b.category) + "</p>" +
            "</div>" +
            window.UI.statusBadge(b.status) +
          "</div>" +

          '<p class="desc">' + window.UI.esc(b.description) + "</p>" +

          '<p class="meta" style="margin:0">&#128205; ' + window.UI.esc(b.address) + "</p>" +
          '<p class="meta" style="margin:0">&#128222; ' + window.UI.esc(b.phone) + " · " + window.UI.esc(b.email) + "</p>" +
          '<p class="meta" style="margin:0">Registered ' + window.UI.formatDate(b.createdAt) +
            (b.updatedAt ? " · Updated " + window.UI.formatDate(b.updatedAt) : "") + "</p>" +

          (b.status === "rejected"
            ? '<div class="alert alert-warn mt-1"><span>&#9888;</span><span>An administrator marked this listing for correction. Please edit the details and save again.</span></div>'
            : "") +

          (b.status === "approved"
            ? '<div class="alert alert-info mt-1"><span>&#10004;</span><span>This business is published in the public directory.</span></div>'
            : "") +

          '<div class="foot">' +
            '<button class="btn btn-sm btn-outline" data-action="view" data-id="' + b.id + '">View</button>' +
            '<button class="btn btn-sm btn-primary" data-action="edit" data-id="' + b.id + '">Edit</button>' +
            '<button class="btn btn-sm btn-danger-soft" data-action="delete" data-id="' + b.id + '">Delete</button>' +
          "</div>" +
        "</article>"
      );
    }).join("");
  }

  function renderAll() {
    renderStats();
    renderList();
  }

  /* ---------- actions ---------- */

  function openCreate() {
    window.BusinessForm.open({
      mode: "create",
      ownerName: user.name,
      ownerEmail: user.email,
      onSubmit: function (payload) {
        var res = window.DB.addBusiness(Object.assign({}, payload, { ownerId: user.id, status: "pending" }));
        if (!res.ok) { window.UI.toast(res.error, "error"); return false; }
        window.UI.toast('"' + res.business.businessName + '" was submitted for review.', "success");
        renderAll();
        return true;
      }
    });
  }

  function openEdit(id) {
    var business = window.DB.getBusinessById(id);
    if (!business) { window.UI.toast("That record no longer exists.", "error"); renderAll(); return; }
    if (business.ownerId !== user.id) {
      window.UI.toast("You can only edit your own listings.", "error");
      return;
    }

    window.BusinessForm.open({
      mode: "edit",
      business: business,
      onSubmit: function (payload) {
        // Customers may edit content, but cannot self-approve: keep whatever
        // status an administrator already granted.
        payload.status = business.status;
        var res = window.DB.updateBusiness(id, payload);
        if (!res.ok) { window.UI.toast(res.error, "error"); return false; }
        window.UI.toast("Changes saved.", "success");
        renderAll();
        return true;
      }
    });
  }

  function openView(id) {
    var b = window.DB.getBusinessById(id);
    if (!b) return;

    var rows = [
      ["Business name", b.businessName],
      ["Owner / Proprietor", b.ownerName],
      ["Category", b.category],
      ["Contact email", b.email],
      ["Contact number", b.phone],
      ["Address", b.address],
      ["Status", b.status.charAt(0).toUpperCase() + b.status.slice(1)],
      ["Registered", window.UI.formatDateTime(b.createdAt)],
      ["Last updated", b.updatedAt ? window.UI.formatDateTime(b.updatedAt) : "Never"]
    ];

    var body =
      '<div class="grid grid-2">' +
        rows.map(function (r) {
          return '<div><span class="label">' + window.UI.esc(r[0]) + "</span>" +
            '<p style="margin:0">' + window.UI.esc(r[1]) + "</p></div>";
        }).join("") +
      "</div>" +
      '<hr class="divider">' +
      '<span class="label">Description</span><p>' + window.UI.esc(b.description) + "</p>";

    window.UI.openModal({
      title: b.businessName,
      subtitle: "Registration details",
      body: body,
      buttons: [{ label: "Close", className: "btn-outline" }]
    });
  }

  function handleDelete(id) {
    var b = window.DB.getBusinessById(id);
    if (!b) { window.UI.toast("That record no longer exists.", "error"); renderAll(); return; }
    if (b.ownerId !== user.id) { window.UI.toast("You can only delete your own listings.", "error"); return; }

    window.UI.confirmDialog({
      title: "Delete business registration?",
      message: 'You are about to permanently delete <b>"' + window.UI.esc(b.businessName) + '"</b>.',
      detail: "This removes the listing from the registry and from the public directory. This action cannot be undone.",
      confirmLabel: "Yes, delete permanently"
    }).then(function (confirmed) {
      if (!confirmed) return;
      var res = window.DB.deleteBusiness(id);
      if (!res.ok) { window.UI.toast(res.error, "error"); return; }
      window.UI.toast('"' + b.businessName + '" was deleted.', "success");
      renderAll();
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    listEl = document.getElementById("biz-list");
    statsEl = document.getElementById("stat-grid");
    emptyEl = document.getElementById("empty-state");

    window.Auth.ensureSeed().then(function () {
      user = window.Auth.guard({ customerOnly: true });
      if (!user) return; // guard redirected the visitor to the login page

      window.UI.initNav();
      renderUserChip();
      renderAll();

      var addBtn = document.getElementById("add-btn");
      if (addBtn) addBtn.addEventListener("click", openCreate);

      var emptyAddBtn = document.getElementById("empty-add-btn");
      if (emptyAddBtn) emptyAddBtn.addEventListener("click", openCreate);

      var logoutBtn = document.getElementById("logout-btn");
      if (logoutBtn) logoutBtn.addEventListener("click", function () {
        window.UI.confirmDialog({
          title: "Sign out?",
          message: "You will be returned to the public landing page.",
          confirmLabel: "Sign out",
          cancelLabel: "Stay signed in"
        }).then(function (ok) { if (ok) window.Auth.logout("index.html"); });
      });

      if (listEl) {
        listEl.addEventListener("click", function (e) {
          var btn = e.target.closest("[data-action]");
          if (!btn) return;
          var id = btn.getAttribute("data-id");
          var action = btn.getAttribute("data-action");
          if (action === "view") openView(id);
          else if (action === "edit") openEdit(id);
          else if (action === "delete") handleDelete(id);
        });
      }

      var params = new URLSearchParams(window.location.search);
      if (params.get("denied") === "1") {
        window.UI.toast("Administrator accounts use the Admin Console, not the customer dashboard.", "info");
      }
    });
  });
})();