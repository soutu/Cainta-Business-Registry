/* ==========================================================================
   auth-page.js — handles both login.html and register.html
   Reads the page type from <body data-page="login|register">
   ========================================================================== */
(function () {
  "use strict";

  var page, form, submitBtn;

  /* ---------- shared ---------- */

  function safeNext() {
    var params = new URLSearchParams(window.location.search);
    var next = params.get("next") || "";
    // only allow same-site .html targets — never an arbitrary URL
    if (/^[a-z0-9_-]+\.html$/i.test(next)) return next;
    return null;
  }

  function initNav() {
    var toggle = document.querySelector(".nav-toggle");
    var links = document.getElementById("nav-links");
    if (!toggle || !links) return;
    toggle.addEventListener("click", function () {
      var open = links.classList.toggle("mobile-open");
      toggle.setAttribute("aria-expanded", open ? "true" : "false");
    });
  }

  function bindPasswordToggles() {
    document.querySelectorAll("[data-toggle-password]").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var input = document.getElementById(btn.getAttribute("data-toggle-password"));
        if (!input) return;
        var showing = input.type === "text";
        input.type = showing ? "password" : "text";
        btn.textContent = showing ? "Show" : "Hide";
      });
    });
  }

  function setBusy(busy, label) {
    submitBtn.disabled = busy;
    submitBtn.textContent = busy ? (label || "Please wait…") : submitBtn.getAttribute("data-label");
  }

  function redirectAfterAuth(user) {
    var next = safeNext();
    if (next) { window.location.href = next; return; }
    window.location.href = user.role === "admin" ? "admin.html" : "dashboard.html";
  }

  function flashDenied() {
    var params = new URLSearchParams(window.location.search);
    if (params.get("expired") === "1") {
      window.UI.toast("Your session ended. Please log in again.", "error");
    }
  }

  /* ---------- login ---------- */

  function initLogin() {
    form = document.getElementById("login-form");
    submitBtn = form.querySelector("button[type=submit]");

    form.querySelectorAll("input").forEach(function (input) {
      input.addEventListener("input", function () { window.UI.setFieldError(input, ""); });
      input.addEventListener("blur", function () {
        if (input.value) {
          // login only needs a presence + email shape check
          if (!input.value.trim()) {
            window.UI.setFieldError(input, input.name === "email" ? "Please enter your email address." : "Please enter your password.");
          } else if (input.name === "email" && !/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(input.value.trim())) {
            window.UI.setFieldError(input, "Please enter a valid email address.");
          }
        }
      });
    });

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.UI.clearFormErrors(form);
      window.UI.hideFormAlert(form);

      var email = form.email.value.trim();
      var password = form.password.value;
      var invalid = false;

      if (!email) { window.UI.setFieldError(form.email, "Please enter your email address."); invalid = true; }
      else if (!/^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/.test(email)) {
        window.UI.setFieldError(form.email, "Please enter a valid email address.");
        invalid = true;
      }
      if (!password) { window.UI.setFieldError(form.password, "Please enter your password."); invalid = true; }
      if (invalid) return;

      setBusy(true, "Signing in…");

      window.Auth.login(email, password).then(function (res) {
        if (!res.ok) {
          setBusy(false);
          window.UI.showFormAlert(form, res.error, "error");
          form.password.value = "";
          form.password.focus();
          return;
        }
        window.UI.toast("Welcome back, " + res.user.name.split(" ")[0] + "!", "success");
        setTimeout(function () { redirectAfterAuth(res.user); }, 450);
      }).catch(function (err) {
        setBusy(false);
        console.error(err);
        window.UI.showFormAlert(form, "Something went wrong while signing in. Please try again.", "error");
      });
    });
  }

  /* ---------- register ---------- */

  function initRegister() {
    form = document.getElementById("register-form");
    submitBtn = form.querySelector("button[type=submit]");

    var strengthBar = document.querySelector("#strength-bar");
    var strengthText = document.getElementById("strength-text");
    var labels = ["Very weak", "Weak", "Fair", "Good", "Strong", "Very strong"];
    var colors = ["#b3372c", "#b3372c", "#9a6b12", "#1d4b7a", "#127a4d", "#127a4d"];

    form.password.addEventListener("input", function () {
      var score = window.UI.passwordStrength(form.password.value);
      if (strengthBar) {
        strengthBar.style.width = (score / 5 * 100) + "%";
        strengthBar.style.backgroundColor = colors[score];
      }
      if (strengthText) strengthText.textContent = form.password.value ? labels[score] : "";
    });

    function liveClear(input) {
      input.addEventListener("input", function () { window.UI.setFieldError(input, ""); });
    }
    form.querySelectorAll("input").forEach(liveClear);

    form.addEventListener("submit", function (e) {
      e.preventDefault();
      window.UI.clearFormErrors(form);
      window.UI.hideFormAlert(form);

      var payload = {
        name: form.name.value.trim(),
        email: form.email.value.trim(),
        password: form.password.value,
        confirmPassword: form.confirmPassword.value
      };

      var errors = window.Auth.validateRegistration(payload);
      Object.keys(errors).forEach(function (key) {
        if (form[key]) window.UI.setFieldError(form[key], errors[key]);
      });

      if (Object.keys(errors).length > 0) {
        window.UI.showFormAlert(form, "Please correct the highlighted fields before continuing.", "error");
        var firstBad = form.querySelector('[aria-invalid="true"]');
        if (firstBad) firstBad.focus();
        return;
      }

      if (form.terms && !form.terms.checked) {
        window.UI.showFormAlert(form, "Please agree to the terms and conditions to continue.", "error");
        return;
      }

      setBusy(true, "Creating account…");

      window.Auth.register(payload).then(function (res) {
        if (!res.ok) {
          setBusy(false);
          window.UI.showFormAlert(form, res.error, "error");
          if (res.errors) {
            Object.keys(res.errors).forEach(function (key) {
              if (form[key]) window.UI.setFieldError(form[key], res.errors[key]);
            });
          }
          return;
        }

        window.Auth.login(payload.email, payload.password).then(function (loginRes) {
          setBusy(false);
          if (!loginRes.ok) {
            window.UI.showFormAlert(form,
              "Account created. Please log in with your new credentials.", "success");
            setTimeout(function () {
              window.location.href = "login.html?next=" + encodeURIComponent("dashboard.html");
            }, 900);
            return;
          }
          window.UI.toast("Account created successfully. Welcome!", "success");
          setTimeout(function () { redirectAfterAuth(loginRes.user); }, 550);
        });
      }).catch(function (err) {
        setBusy(false);
        console.error(err);
        window.UI.showFormAlert(form, "Something went wrong while creating your account. Please try again.", "error");
      });
    });
  }

  /* ---------- boot ---------- */

  document.addEventListener("DOMContentLoaded", function () {
    page = document.body.getAttribute("data-page");
    initNav();
    bindPasswordToggles();
    flashDenied();

    var yearEl = document.getElementById("year");
    if (yearEl) yearEl.textContent = new Date().getFullYear();

    window.Auth.ensureSeed().then(function () {
      // already signed in? skip straight to the dashboard
      var user = window.Auth.currentUser();
      if (user) {
        window.UI.toast("You are already signed in as " + user.name + ".", "info");
        setTimeout(function () { redirectAfterAuth(user); }, 700);
        return;
      }
      if (page === "login") initLogin();
      else if (page === "register") initRegister();
    });
  });
})();