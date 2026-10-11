/* ==========================================================================
   ui.js — shared UI helpers: escaping, formatting, toasts, modals, validation
   Exposes: window.UI
   ========================================================================== */
(function (global) {
  "use strict";

  /* ---------- escaping ---------- */

  var ESCAPES = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };

  function esc(value) {
    if (value === null || value === undefined) return "";
    return String(value).replace(/[&<>"']/g, function (ch) { return ESCAPES[ch]; });
  }

  /* ---------- formatting ---------- */

  function formatDate(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" });
  }

  function formatDateTime(iso) {
    if (!iso) return "—";
    var d = new Date(iso);
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-PH", { year: "numeric", month: "short", day: "numeric" }) +
      " · " + d.toLocaleTimeString("en-PH", { hour: "numeric", minute: "2-digit" });
  }

  function initials(name) {
    var parts = String(name || "?").trim().split(/\s+/);
    if (parts.length === 1) return parts[0].charAt(0).toUpperCase();
    return (parts[0].charAt(0) + parts[parts.length - 1].charAt(0)).toUpperCase();
  }

  function statusBadge(status) {
    var map = {
      pending: { cls: "badge-pending", label: "Pending" },
      approved: { cls: "badge-approved", label: "Approved" },
      rejected: { cls: "badge-rejected", label: "Rejected" }
    };
    var s = map[status] || map.pending;
    return '<span class="badge ' + s.cls + '">' + s.label + "</span>";
  }

  function roleBadge(role) {
    if (role === "admin") return '<span class="badge badge-gold">Admin</span>';
    return '<span class="badge badge-neutral">Customer</span>';
  }

  /* ---------- toast ---------- */

  function toastStack() {
    var stack = document.querySelector(".toast-stack");
    if (!stack) {
      stack = document.createElement("div");
      stack.className = "toast-stack";
      stack.setAttribute("role", "status");
      stack.setAttribute("aria-live", "polite");
      document.body.appendChild(stack);
    }
    return stack;
  }

  function toast(message, type, timeout) {
    var stack = toastStack();
    var kind = type === "error" ? "toast-error" : (type === "success" ? "toast-success" : "");
    var el = document.createElement("div");
    el.className = "toast " + kind;
    el.innerHTML = '<span>' + esc(message) + "</span>" +
      '<button class="t-close" type="button" aria-label="Dismiss">&times;</button>';

    function dismiss() {
      el.style.opacity = "0";
      setTimeout(function () { if (el.parentNode) el.parentNode.removeChild(el); }, 200);
    }
    el.querySelector(".t-close").addEventListener("click", dismiss);
    stack.appendChild(el);
    setTimeout(dismiss, timeout || 3800);
  }

  /* ---------- modal ---------- */

  var openModalEl = null;
  var lastFocused = null;

  function openModal(options) {
    var opts = options || {};
    closeModal();

    var backdrop = document.createElement("div");
    backdrop.className = "modal-backdrop open";
    backdrop.innerHTML =
      '<div class="modal' + (opts.wide ? " modal-wide" : "") + '" role="dialog" aria-modal="true" aria-labelledby="modal-title">' +
        '<div class="modal-head">' +
          "<div><h3 id=\"modal-title\">" + esc(opts.title || "") + "</h3>" +
          (opts.subtitle ? "<p>" + esc(opts.subtitle) + "</p>" : "") + "</div>" +
          '<button class="modal-close" type="button" aria-label="Close">&times;</button>' +
        "</div>" +
        '<div class="modal-body"></div>' +
        (opts.footer === false ? "" : '<div class="modal-foot"></div>') +
      "</div>";

    var body = backdrop.querySelector(".modal-body");
    if (typeof opts.body === "string") body.innerHTML = opts.body;
    else if (opts.body) body.appendChild(opts.body);

    var foot = backdrop.querySelector(".modal-foot");
    if (foot) {
      (opts.buttons || []).forEach(function (b) {
        var btn = document.createElement("button");
        btn.type = "button";
        btn.className = "btn " + (b.className || "btn-outline");
        btn.textContent = b.label;
        btn.addEventListener("click", function () {
          if (!b.onClick || b.onClick(backdrop) !== false) closeModal();
        });
        foot.appendChild(btn);
      });
    }

    lastFocused = document.activeElement;
    document.body.appendChild(backdrop);
    document.body.style.overflow = "hidden";
    openModalEl = backdrop;

    backdrop.addEventListener("mousedown", function (e) {
      if (e.target === backdrop && opts.dismissible !== false) closeModal();
    });
    backdrop.querySelector(".modal-close").addEventListener("click", closeModal);

    document.addEventListener("keydown", modalKeyHandler);

    var focusTarget = backdrop.querySelector("[autofocus]") || backdrop.querySelector(".modal-close");
    if (focusTarget) focusTarget.focus();

    if (typeof opts.onOpen === "function") opts.onOpen(backdrop);
    return backdrop;
  }

  function modalKeyHandler(e) {
    if (e.key === "Escape") closeModal();
  }

  function closeModal() {
    if (!openModalEl) return;
    var el = openModalEl;
    openModalEl = null;
    document.removeEventListener("keydown", modalKeyHandler);
    el.parentNode.removeChild(el);
    document.body.style.overflow = "";
    if (lastFocused && lastFocused.focus) lastFocused.focus();
  }

  /**
   * Destructive confirmation. Resolves true when the user confirms.
   */
  function confirmDialog(options) {
    var opts = options || {};
    return new Promise(function (resolve) {
      var settled = false;
      function done(value) {
        if (settled) return;
        settled = true;
        document.removeEventListener("keydown", onKey);
        resolve(value);
      }
      function onKey(e) {
        if (e.key === "Escape") done(false);
      }

      var body =
        '<div class="alert alert-warn" style="margin-bottom:1rem">' +
          "<span>&#9888;</span><span><b>This action cannot be undone.</b> The record will be permanently removed.</span>" +
        "</div>" +
        '<p style="margin-bottom:1rem">' + (opts.message || "Are you sure you want to continue?") + "</p>" +
        (opts.detail ? '<p class="small muted">' + esc(opts.detail) + "</p>" : "");

      var backdrop = openModal({
        title: opts.title || "Please confirm",
        body: body,
        buttons: [
          { label: opts.cancelLabel || "Cancel", className: "btn-outline", onClick: function () { done(false); } },
          {
            label: opts.confirmLabel || "Yes, delete",
            className: "btn-danger",
            onClick: function () { done(true); return true; }
          }
        ],
      });

      // Focus the destructive choice by default. NOTE: this must happen AFTER
      // openModal() returns — reading `backdrop` inside an onOpen callback would
      // run before the variable is assigned, which rejects the promise.
      var confirmBtn = backdrop.querySelector(".modal-foot .btn-danger");
      if (confirmBtn) confirmBtn.focus();

      document.addEventListener("keydown", onKey);
      // closing via the backdrop or the X button also resolves false
      var observer = new MutationObserver(function () {
        if (!document.body.contains(backdrop)) { observer.disconnect(); done(false); }
      });
      observer.observe(document.body, { childList: true });
    });
  }

  /* ---------- form validation helpers ---------- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  function setFieldError(inputEl, message) {
    if (!inputEl) return;
    var field = inputEl.closest(".field") || inputEl.parentNode;
    var errEl = field ? field.querySelector(".field-error") : null;

    if (message) {
      inputEl.setAttribute("aria-invalid", "true");
      if (errEl) {
        errEl.textContent = message;
        errEl.classList.add("show");
      }
    } else {
      inputEl.removeAttribute("aria-invalid");
      if (errEl) {
        errEl.textContent = "";
        errEl.classList.remove("show");
      }
    }
  }

  function clearFormErrors(form) {
    var errEls = form.querySelectorAll(".field-error");
    for (var i = 0; i < errEls.length; i++) {
      errEls[i].textContent = "";
      errEls[i].classList.remove("show");
    }
    var inputs = form.querySelectorAll("[aria-invalid]");
    for (var j = 0; j < inputs.length; j++) inputs[j].removeAttribute("aria-invalid");
  }

  function showFormAlert(form, message, type) {
    var alert = form.querySelector(".form-alert");
    if (!alert) {
      alert = document.createElement("div");
      alert.className = "form-alert";
      form.insertBefore(alert, form.firstChild);
    }
    alert.className = "form-alert show form-alert-" + (type || "error");
    alert.textContent = message;
    return alert;
  }

  function hideFormAlert(form) {
    var alert = form.querySelector(".form-alert");
    if (alert) alert.classList.remove("show");
  }

  /* ---------- business field validation (shared by customer + admin) ---------- */

  function validateBusinessField(field, value) {
    var v = String(value == null ? "" : value).trim();

    switch (field) {
      case "businessName":
        if (!v) return { ok: false, message: "Please enter the business name." };
        if (v.length < 3) return { ok: false, message: "Business name must be at least 3 characters." };
        if (v.length > 80) return { ok: false, message: "Business name must be 80 characters or fewer." };
        return { ok: true, value: v };

      case "ownerName":
        if (!v) return { ok: false, message: "Please enter the owner's / proprietor's name." };
        if (v.length < 2) return { ok: false, message: "Name must be at least 2 characters." };
        if (v.length > 80) return { ok: false, message: "Name must be 80 characters or fewer." };
        return { ok: true, value: v };

      case "email":
        if (!v) return { ok: false, message: "Please enter a contact email address." };
        if (v.length > 120) return { ok: false, message: "Email address is too long." };
        if (!EMAIL_RE.test(v)) return { ok: false, message: "Please enter a valid email address." };
        return { ok: true, value: v.toLowerCase() };

      case "phone":
        if (!v) return { ok: false, message: "Please enter a contact number." };
        if (!/^[0-9+\-\s()]+$/.test(v)) {
          return { ok: false, message: "Phone number may only contain digits, spaces and + - ( ) characters." };
        }
        var digits = v.replace(/\D/g, "");
        if (digits.indexOf("63") === 0) digits = digits.slice(2);
        if (digits.charAt(0) === "0") digits = digits.slice(1);

        var isMobile = digits.length === 10 && digits.charAt(0) === "9";
        var isLandline = digits.length === 8 && digits.charAt(0) === "8";

        if (!isMobile && !isLandline) {
          return {
            ok: false,
            message: "Enter a valid Cainta/Rizal number — a mobile like 0917 123 4567 or a landline like 8 123 4567."
          };
        }
        return { ok: true, value: v };

      case "category":
        if (!v) return { ok: false, message: "Please choose a business category." };
        if (global.DB.CATEGORIES.indexOf(v) === -1) {
          return { ok: false, message: "Please choose a category from the list." };
        }
        return { ok: true, value: v };

      case "address":
        if (!v) return { ok: false, message: "Please enter the business address." };
        if (v.length < 8) return { ok: false, message: "Please enter a complete address (street, barangay, city)." };
        if (v.length > 160) return { ok: false, message: "Address must be 160 characters or fewer." };
        return { ok: true, value: v };

      case "description":
        if (!v) return { ok: false, message: "Please describe the business." };
        if (v.length < 20) return { ok: false, message: "Description must be at least 20 characters." };
        if (v.length > 400) return { ok: false, message: "Description must be 400 characters or fewer." };
        return { ok: true, value: v };

      default:
        return { ok: true, value: v };
    }
  }

  /* ---------- misc ---------- */

  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("mobile-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
    links.addEventListener("click", function (e) {
      if (e.target.closest("a")) {
        links.classList.remove("mobile-open");
        toggle.setAttribute("aria-expanded", "false");
      }
    });
  }

  function debounce(fn, wait) {
    var timer = null;
    return function () {
      var args = arguments;
      var self = this;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(self, args); }, wait || 200);
    };
  }

  function queryAll(selector, root) {
    return Array.prototype.slice.call((root || document).querySelectorAll(selector));
  }

  function passwordStrength(value) {
    var score = 0;
    var v = String(value || "");
    if (v.length >= 8) score++;
    if (v.length >= 12) score++;
    if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
    if (/[0-9]/.test(v)) score++;
    if (/[^A-Za-z0-9]/.test(v)) score++;
    if (v.length < 8) score = 0;
    return Math.min(score, 5);
  }

  global.UI = {
    esc: esc,
    formatDate: formatDate,
    formatDateTime: formatDateTime,
    initials: initials,
    statusBadge: statusBadge,
    roleBadge: roleBadge,

    toast: toast,
    openModal: openModal,
    closeModal: closeModal,
    confirmDialog: confirmDialog,

    setFieldError: setFieldError,
    clearFormErrors: clearFormErrors,
    showFormAlert: showFormAlert,
    hideFormAlert: hideFormAlert,
    validateBusinessField: validateBusinessField,

    initNav: initNav,
    debounce: debounce,
    queryAll: queryAll,
    passwordStrength: passwordStrength
  };
})(window);