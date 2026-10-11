/* ==========================================================================
   business-form.js — the Create / Update form for the core entity
   "Business Registration". Shared by the Customer dashboard and the Admin page.
   Exposes: window.BusinessForm
   ========================================================================== */
(function (global) {
  "use strict";

  var FIELDS = [
    { name: "businessName", label: "Business Name", type: "text", required: true,
      placeholder: "e.g. Kambal Sari-Sari Store", maxlength: 80,
      hint: "The name shown in the public business directory." },
    { name: "ownerName", label: "Owner / Proprietor", type: "text", required: true,
      placeholder: "e.g. Maria L. Santos", maxlength: 80 },
    { name: "category", label: "Business Category", type: "select", required: true, optionsFrom: "DB.CATEGORIES" },
    { name: "email", label: "Contact Email", type: "email", required: true,
      placeholder: "e.g. contact@business.ph", maxlength: 120 },
    { name: "phone", label: "Contact Number", type: "tel", required: true,
      placeholder: "e.g. 0917 123 4567", maxlength: 20,
      hint: "Mobile (0917 123 4567) or Cainta landline (8 123 4567)." },
    { name: "address", label: "Business Address", type: "text", required: true,
      placeholder: "Street, Barangay, Cainta, Rizal", maxlength: 160 },
    { name: "description", label: "Business Description", type: "textarea", required: true,
      placeholder: "What does the business offer? (minimum 20 characters)",
      maxlength: 400,
      hint: "Minimum 20 characters, maximum 400." }
  ];

  function fieldMarkup(f) {
    var id = "bf-" + f.name;
    var control;
    var hint = f.hint ? '<p class="hint">' + global.UI.esc(f.hint) + "</p>" : "";
    var error = '<p class="field-error" id="' + id + '-error"></p>';

    if (f.type === "select") {
      var opts = global.DB.CATEGORIES.map(function (c) {
        return '<option value="' + global.UI.esc(c) + '">' + global.UI.esc(c) + "</option>";
      }).join("");
      control =
        '<select class="select" id="' + id + '" name="' + f.name + '" aria-describedby="' + id + '-error">' +
          '<option value="">-- Select a category --</option>' + opts +
        "</select>";
    } else if (f.type === "textarea") {
      control =
        '<textarea class="textarea" id="' + id + '" name="' + f.name + '" maxlength="' + (f.maxlength || 400) +
        '" placeholder="' + global.UI.esc(f.placeholder || "") + '" aria-describedby="' + id + '-error"></textarea>';
    } else {
      control =
        '<input class="input" id="' + id + '" name="' + f.name + '" type="' + f.type + '" ' +
        'maxlength="' + (f.maxlength || 120) + '" placeholder="' + global.UI.esc(f.placeholder || "") + '" ' +
        'aria-describedby="' + id + '-error">';
    }

    return (
      '<div class="field">' +
        '<label for="' + id + '">' + global.UI.esc(f.label) +
        (f.required ? ' <span class="req" aria-hidden="true">*</span>' : "") +
        (f.required ? '<span class="sr-only" hidden>required</span>' : "") +
        "</label>" + control + hint + error +
      "</div>"
    );
  }

  function buildMarkup(options) {
    var opts = options || {};
    var title = opts.mode === "edit" ? "Edit Business Registration" : "Register a Business";
    var subtitle = opts.mode === "edit"
      ? "Update the details of this listing. Changes are saved immediately."
      : "Fill in the details below. Your listing will be reviewed by an administrator before it appears in the public directory.";

    var form =
      '<form id="business-form" novalidate>' +
        '<div class="form-alert"></div>' +
        '<div class="grid grid-2">' +
          FIELDS.slice(0, 4).map(function (f) { return "<div>" + fieldMarkup(f) + "</div>"; }).join("") +
        "</div>" +
        FIELDS.slice(4).map(function (f) { return fieldMarkup(f); }).join("") +
        (opts.allowStatus
          ? '<div class="field"><label for="bf-status">Registration Status</label>' +
            '<select class="select" id="bf-status" name="status">' +
              global.DB.STATUSES.map(function (s) {
                var label = s.charAt(0).toUpperCase() + s.slice(1);
                return '<option value="' + s + '">' + label + "</option>";
              }).join("") +
            "</select><p class=\"field-error\" id=\"bf-status-error\"></p></div>"
          : "") +
        '<div class="btn-row" style="margin-top:.5rem">' +
          '<button type="submit" class="btn btn-primary">' +
            (opts.mode === "edit" ? "Save changes" : "Submit registration") +
          "</button>" +
          '<button type="button" class="btn btn-ghost" data-cancel="1">Cancel</button>' +
        "</div>" +
      "</form>";

    return { title: title, subtitle: subtitle, html: form };
  }

  function collect(form) {
    var values = {};
    FIELDS.forEach(function (f) {
      var el = form.querySelector("[name='" + f.name + "']");
      values[f.name] = el ? el.value : "";
    });
    var statusEl = form.querySelector("[name='status']");
    if (statusEl) values.status = statusEl.value;
    return values;
  }

  function validate(form) {
    var raw = collect(form);
    var cleaned = {};
    var errors = 0;

    FIELDS.forEach(function (f) {
      var el = form.querySelector("[name='" + f.name + "']");
      var result = global.UI.validateBusinessField(f.name, raw[f.name]);

      if (result.ok) {
        cleaned[f.name] = result.value;
        global.UI.setFieldError(el, "");
      } else {
        cleaned[f.name] = result.value || String(raw[f.name] || "").trim();
        global.UI.setFieldError(el, result.message);
        errors++;
      }
    });

    if (errors > 0) {
      var firstBad = form.querySelector('[aria-invalid="true"]');
      if (firstBad) firstBad.focus();
      global.UI.toast("Please correct the highlighted fields.", "error");
    }

    // admin-only field: carry the chosen status through
    if (raw.status && global.DB.STATUSES.indexOf(raw.status) > -1) cleaned.status = raw.status;

    return { ok: errors === 0, data: cleaned, errorCount: errors };
  }

  /** Live validation while typing. */
  function bindLiveValidation(form) {
    FIELDS.forEach(function (f) {
      var el = form.querySelector("[name='" + f.name + "']");
      if (!el) return;
      var event = (f.type === "select" || f.type === "text") ? "change" : "input";

      el.addEventListener("blur", function () {
        var result = global.UI.validateBusinessField(f.name, el.value);
        global.UI.setFieldError(el, result.ok ? "" : result.message);
      });

      el.addEventListener(event, function () {
        if (el.getAttribute("aria-invalid") === "true") {
          var result = global.UI.validateBusinessField(f.name, el.value);
          global.UI.setFieldError(el, result.ok ? "" : result.message);
        }
      });
    });
  }

  /**
   * Opens the form inside a modal.
   * opts = { mode, business, ownerName, ownerEmail, allowStatus, onSubmit(data) }
   */
  function open(options) {
    var opts = options || {};
    var markup = buildMarkup(opts);

    var backdrop = global.UI.openModal({
      title: markup.title,
      subtitle: markup.subtitle,
      wide: true,
      body: markup.html,
      footer: false,
      onOpen: function (el) {
        var form = el.querySelector("#business-form");
        var business = opts.business || null;

        if (business) {
          FIELDS.forEach(function (f) {
            var input = form.querySelector("[name='" + f.name + "']");
            if (input) input.value = business[f.name] == null ? "" : business[f.name];
          });
          var statusInput = form.querySelector("[name='status']");
          if (statusInput && business.status) statusInput.value = business.status;
        } else {
          var ownerField = form.querySelector("[name='ownerName']");
          var emailField = form.querySelector("[name='email']");
          if (ownerField && opts.ownerName) { ownerField.value = opts.ownerName; ownerField.readOnly = true; }
          if (emailField && opts.ownerEmail) { emailField.value = opts.ownerEmail; emailField.readOnly = true; }
        }

        bindLiveValidation(form);

        var cancelBtn = form.querySelector("[data-cancel]");
        if (cancelBtn) cancelBtn.addEventListener("click", function () { global.UI.closeModal(); });

        form.addEventListener("submit", function (e) {
          e.preventDefault();
          global.UI.hideFormAlert(form);

          var result = validate(form);
          if (!result.ok) return;

          var payload = {
            businessName: result.data.businessName,
            ownerName: result.data.ownerName,
            email: result.data.email,
            phone: result.data.phone,
            category: result.data.category,
            address: result.data.address,
            description: result.data.description
          };
          if (opts.allowStatus && result.data.status) payload.status = result.data.status;

          var saved = opts.onSubmit ? opts.onSubmit(payload) : false;
          if (saved === false) return; // handler reported its own error
          global.UI.closeModal();
        });

        var focusEl = business ? form.querySelector("[name='businessName']") : form.querySelector("[name='businessName']");
        if (focusEl) focusEl.focus();
      }
    });

    return backdrop;
  }

  global.BusinessForm = {
    FIELDS: FIELDS,
    open: open,
    validate: validate,
    collect: collect,
    buildMarkup: buildMarkup
  };
})(window);