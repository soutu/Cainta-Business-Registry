/* ==========================================================================
   landing.js — public landing page (no login required)
   ========================================================================== */
(function () {
  "use strict";

  var searchInput, categorySelect, resultsEl, countEl;
  var allBusinesses = [];

  /* ---------- mobile nav ---------- */
  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;

    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("mobile-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.tagName === "A") {
        links.classList.remove("mobile-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  /* ---------- personalise nav when a session exists ---------- */
  function personaliseNav() {
    var user = window.Auth.currentUser();
    var loginLinks = document.querySelectorAll("[data-when-logged-out]");
    var loggedInLinks = document.querySelectorAll("[data-when-logged-in]");

    loginLinks.forEach(function (el) {
      el.classList.toggle("hidden", !!user);
    });
    loggedInLinks.forEach(function (el) {
      el.classList.toggle("hidden", !user);
      if (user) {
        var target = user.role === "admin" ? "admin.html" : "dashboard.html";
        el.setAttribute("href", target);
        var label = el.querySelector("[data-user-label]");
        if (label) label.textContent = user.name.split(" ")[0] + "'s Dashboard";
      }
    });
  }

  /* ---------- public statistics ---------- */
  function renderStats() {
    var stats = window.DB.getStats();
    var approved = window.DB.getApprovedBusinesses().length;

    setStat("stat-businesses", stats.businesses);
    setStat("stat-approved", approved);
    setStat("stat-categories", Object.keys(stats.byCategory).length || window.DB.CATEGORIES.length);
    setStat("stat-members", stats.users);
  }

  function setStat(id, value) {
    var el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  /* ---------- public directory ---------- */
  function loadBusinesses() {
    allBusinesses = window.DB.getApprovedBusinesses();

    // category filter options
    if (categorySelect) {
      var used = {};
      allBusinesses.forEach(function (b) { used[b.category] = true; });
      var current = categorySelect.value;
      categorySelect.innerHTML = '<option value="">All categories</option>' +
        window.DB.CATEGORIES.filter(function (c) { return used[c]; })
          .map(function (c) { return '<option value="' + window.UI.esc(c) + '">' + window.UI.esc(c) + "</option>"; })
          .join("");
      categorySelect.value = current;
    }
    render();
  }

  function filtered() {
    var term = (searchInput ? searchInput.value : "").trim().toLowerCase();
    var cat = categorySelect ? categorySelect.value : "";

    return allBusinesses.filter(function (b) {
      if (cat && b.category !== cat) return false;
      if (!term) return true;
      var haystack = [b.businessName, b.ownerName, b.category, b.address, b.description]
        .join(" ").toLowerCase();
      return haystack.indexOf(term) > -1;
    });
  }

  function render() {
    if (!resultsEl) return;
    var list = filtered();

    if (countEl) {
      countEl.textContent = list.length === 1 ? "1 business listed" : list.length + " businesses listed";
    }

    if (list.length === 0) {
      resultsEl.innerHTML =
        '<div class="card empty" style="grid-column:1/-1">' +
          '<div class="icon">&#128269;</div>' +
          "<h3>No matching businesses</h3>" +
          "<p>No approved listings match your search yet. Try another keyword, or register your own business to be the first.</p>" +
          '<a class="btn btn-gold" href="register.html">Register your business</a>' +
        "</div>";
      return;
    }

    resultsEl.innerHTML = list.map(function (b) {
      return (
        '<article class="biz-card card-hover">' +
          '<div class="biz-card-top">' +
            "<div>" +
              "<h3>" + window.UI.esc(b.businessName) + "</h3>" +
              '<p class="meta" style="margin:.15rem 0 0">' + window.UI.esc(b.ownerName) + " · Owner</p>" +
            "</div>" +
            '<span class="badge badge-info">' + window.UI.esc(b.category) + "</span>" +
          "</div>" +
          '<p class="desc">' + window.UI.esc(b.description) + "</p>" +
          '<p class="meta" style="margin:0">&#128205; ' + window.UI.esc(b.address) + "</p>" +
          '<p class="meta" style="margin:0">&#128222; ' + window.UI.esc(b.phone) + " · " + window.UI.esc(b.email) + "</p>" +
        "</article>"
      );
    }).join("");
  }

  /* ---------- year stamp ---------- */
  function initYear() {
    var el = document.getElementById("year");
    if (el) el.textContent = new Date().getFullYear();
  }

  /* ---------- boot ---------- */
  document.addEventListener("DOMContentLoaded", function () {
    initNav();
    initYear();

    searchInput = document.getElementById("dir-search");
    categorySelect = document.getElementById("dir-category");
    resultsEl = document.getElementById("dir-results");
    countEl = document.getElementById("dir-count");

    if (searchInput) searchInput.addEventListener("input", window.UI.debounce(render, 150));
    if (categorySelect) categorySelect.addEventListener("change", render);

    window.Auth.ensureSeed().then(function () {
      personaliseNav();
      renderStats();
      loadBusinesses();
    });
  });
})();