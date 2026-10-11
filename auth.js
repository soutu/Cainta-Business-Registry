/* ==========================================================================
   auth.js — registration, login, session, route protection, password hashing
   Exposes: window.Auth

   Password storage: the plain password is NEVER written anywhere.
   We store  salt + PBKDF2-SHA256 hash  (Web Crypto) when available, and fall
   back to a pure-JS iterated SHA-256 when Web Crypto is missing (e.g. when a
   page is opened straight from disk with file://).
   ========================================================================== */
(function (global) {
  "use strict";

  var SESSION_KEY = "cbr_session_v1";
  var PBKDF2_ITERATIONS = 210000;
  var FALLBACK_ITERATIONS = 12000;

  var ALGO_PBKDF2 = "PBKDF2-SHA256-" + PBKDF2_ITERATIONS;
  var ALGO_FALLBACK = "SHA256-ITER-" + FALLBACK_ITERATIONS;

  function hasWebCrypto() {
    return !!(global.crypto && global.crypto.subtle && global.TextEncoder);
  }

  function randomSalt() {
    var bytes = new Uint8Array(16);
    if (hasWebCrypto() && global.crypto.getRandomValues) {
      global.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    return toHex(bytes);
  }

  /* ---------- encoding helpers ---------- */

  function toHex(bytes) {
    var out = "";
    for (var i = 0; i < bytes.length; i++) {
      out += (bytes[i] >>> 4).toString(16);
      out += (bytes[i] & 15).toString(16);
    }
    return out;
  }

  /* ---------- pure-JS SHA-256 (fallback only) ---------- */

  var K = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
    0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
    0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
    0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2
  ]);

  function rotr(x, n) { return ((x >>> n) | (x << (32 - n))) >>> 0; }

  function sha256Bytes(bytes) {
    var H = new Uint32Array([
      0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
      0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19
    ]);

    var len = bytes.length;
    var bitLen = len * 8;
    var total = Math.ceil((len + 9) / 64) * 64;

    var buf = new Uint8Array(total);
    buf.set(bytes);
    buf[len] = 0x80;

    var dv = new DataView(buf.buffer);
    dv.setUint32(total - 8, Math.floor(bitLen / 4294967296), false);
    dv.setUint32(total - 4, bitLen >>> 0, false);

    var w = new Uint32Array(64);

    for (var off = 0; off < total; off += 64) {
      for (var i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4, false);
      for (var j = 16; j < 64; j++) {
        var v15 = w[j - 15];
        var v2 = w[j - 2];
        var s0 = rotr(v15, 7) ^ rotr(v15, 18) ^ (v15 >>> 3);
        var s1 = rotr(v2, 17) ^ rotr(v2, 19) ^ (v2 >>> 10);
        w[j] = (w[j - 16] + s0 + w[j - 7] + s1) >>> 0;
      }

      var a = H[0], b = H[1], c = H[2], d = H[3], e = H[4], f = H[5], g = H[6], h = H[7];

      for (var t = 0; t < 64; t++) {
        var S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
        var ch = (e & f) ^ (~e & g);
        var t1 = (h + S1 + ch + K[t] + w[t]) >>> 0;
        var S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
        var maj = (a & b) ^ (a & c) ^ (b & c);
        var t2 = (S0 + maj) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0;
        d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }

      H[0] = (H[0] + a) >>> 0; H[1] = (H[1] + b) >>> 0;
      H[2] = (H[2] + c) >>> 0; H[3] = (H[3] + d) >>> 0;
      H[4] = (H[4] + e) >>> 0; H[5] = (H[5] + f) >>> 0;
      H[6] = (H[6] + g) >>> 0; H[7] = (H[7] + h) >>> 0;
    }

    var out = new Uint8Array(32);
    var odv = new DataView(out.buffer);
    for (var k = 0; k < 8; k++) odv.setUint32(k * 4, H[k], false);
    return out;
  }

  function utf8(str) {
    if (global.TextEncoder) return new global.TextEncoder().encode(str);
    var arr = [];
    for (var i = 0; i < str.length; i++) {
      var c = str.charCodeAt(i);
      if (c < 128) arr.push(c);
      else if (c < 2048) arr.push(192 | (c >> 6), 128 | (c & 63));
      else arr.push(224 | (c >> 12), 128 | ((c >> 6) & 63), 128 | (c & 63));
    }
    return new Uint8Array(arr);
  }

  /* ---------- hashing API (Promise based) ---------- */

  function hashWithAlgo(password, salt, algo) {
    if (algo === ALGO_PBKDF2 && hasWebCrypto()) {
      return global.crypto.subtle
        .importKey("raw", utf8(password), { name: "PBKDF2" }, false, ["deriveBits"])
        .then(function (key) {
          return global.crypto.subtle.deriveBits(
            { name: "PBKDF2", salt: utf8(salt), iterations: PBKDF2_ITERATIONS, hash: "SHA-256" },
            key,
            256
          );
        })
        .then(function (bits) { return toHex(new Uint8Array(bits)); });
    }

    // Fallback: iterated SHA-256
    return new Promise(function (resolve) {
      var acc = utf8(salt + "|" + password + "|" + salt);
      for (var i = 0; i < FALLBACK_ITERATIONS; i++) {
        acc = sha256Bytes(acc);
        if (i % 500 === 0) { /* keep the tab responsive on slow devices */ }
      }
      resolve(toHex(acc));
    });
  }

  function hashPassword(password) {
    var salt = randomSalt();
    var algo = hasWebCrypto() ? ALGO_PBKDF2 : ALGO_FALLBACK;
    return hashWithAlgo(password, salt, algo).then(function (hash) {
      return { passwordHash: hash, passwordAlgo: algo, salt: salt };
    });
  }

  function verifyPassword(password, user) {
    return hashWithAlgo(password, user.salt, user.passwordAlgo).then(function (hash) {
      return timingSafeEqual(hash, user.passwordHash);
    });
  }

  function timingSafeEqual(a, b) {
    if (typeof a !== "string" || typeof b !== "string") return false;
    if (a.length !== b.length) return false;
    var diff = 0;
    for (var i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
    return diff === 0;
  }

  /* ---------- validation ---------- */

  var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-zA-Z]{2,}$/;

  function validateRegistration(data) {
    var errors = {};
    var name = (data.name || "").trim();
    var email = (data.email || "").trim();
    var password = data.password || "";
    var confirm = data.confirmPassword;

    if (!name) {
      errors.name = "Please enter your full name.";
    } else if (name.length < 2) {
      errors.name = "Your name must be at least 2 characters long.";
    } else if (name.length > 60) {
      errors.name = "Your name must be 60 characters or fewer.";
    } else if (!/[a-zA-Z]/.test(name)) {
      errors.name = "Your name must contain at least one letter.";
    }

    if (!email) {
      errors.email = "Please enter your email address.";
    } else if (email.length > 120) {
      errors.email = "That email address is too long.";
    } else if (!EMAIL_RE.test(email)) {
      errors.email = "Please enter a valid email address (example: name@email.com).";
    }

    if (!password) {
      errors.password = "Please choose a password.";
    } else if (password.length < 8) {
      errors.password = "Password must be at least 8 characters long.";
    } else if (password.length > 72) {
      errors.password = "Password must be 72 characters or fewer.";
    } else if (!/[a-zA-Z]/.test(password) || !/[0-9]/.test(password)) {
      errors.password = "Password must include at least one letter and one number.";
    }

    if (!confirm) {
      if (password) errors.confirmPassword = "Please re-type your password to confirm it.";
    } else if (password !== confirm) {
      errors.confirmPassword = "The two passwords do not match.";
    }

    return errors;
  }

  /* ---------- register / login / session ---------- */

  function register(data) {
    var errors = validateRegistration(data);
    if (Object.keys(errors).length > 0) {
      return Promise.resolve({ ok: false, errors: errors, error: "Please fix the highlighted fields." });
    }

    if (global.DB.getUserByEmail(data.email)) {
      return Promise.resolve({
        ok: false,
        errors: { email: "An account with this email already exists. Please log in instead." },
        error: "That email is already registered."
      });
    }

    return hashPassword(data.password).then(function (hashed) {
      return global.DB.addUser({
        name: data.name,
        email: data.email,
        role: "customer", // public sign-up can only ever create a customer
        passwordHash: hashed.passwordHash,
        passwordAlgo: hashed.passwordAlgo,
        salt: hashed.salt
      });
    });
  }

  function login(email, password) {
    var user = global.DB.getUserByEmail(email);

    // Always run a comparison so a missing account is not instantly detectable by timing.
    var work = user
      ? verifyPassword(password, user)
      : hashWithAlgo(password || "invalid", "decoy-salt", ALGO_FALLBACK).then(function () { return false; });

    return work.then(function (valid) {
      if (!user || !valid) {
        return { ok: false, error: "Incorrect email or password. Please try again." };
      }
      setSession(user.id);
      return { ok: true, user: publicUser(user) };
    });
  }

  function setSession(userId) {
    try { global.sessionStorage.setItem(SESSION_KEY, userId); } catch (e) { /* ignore */ }
    try { global.localStorage.setItem(SESSION_KEY, userId); } catch (e) { /* ignore */ }
  }

  function clearSession() {
    try { global.sessionStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
    try { global.localStorage.removeItem(SESSION_KEY); } catch (e) { /* ignore */ }
  }

  function sessionId() {
    var id = null;
    try { id = global.sessionStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    if (!id) {
      try { id = global.localStorage.getItem(SESSION_KEY); } catch (e) { /* ignore */ }
    }
    return id;
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      createdAt: user.createdAt
    };
  }

  function currentUser() {
    var id = sessionId();
    if (!id) return null;
    return publicUser(global.DB.getUserById(id));
  }

  function isAdmin() {
    var user = currentUser();
    return !!user && user.role === "admin";
  }

  function logout(redirectTo) {
    clearSession();
    var target = redirectTo || "index.html";
    if (/^[a-z0-9_.-]+$/i.test(target)) {
      global.location.href = target;
    } else {
      global.location.href = "index.html";
    }
  }

  /* ---------- route protection ---------- */

  function guard(options) {
    var opts = options || {};
    var user = currentUser();

    if (!user) {
      var next = global.location.pathname.split("/").pop() || "";
      global.location.replace("login.html?next=" + encodeURIComponent(next) +
        (global.location.search ? "&" + global.location.search.slice(1) : ""));
      return null;
    }

    if (opts.adminOnly && user.role !== "admin") {
      global.location.replace("dashboard.html?denied=1");
      return null;
    }

    if (opts.customerOnly && user.role !== "customer") {
      global.location.replace("admin.html?denied=1");
      return null;
    }

    return user;
  }

  /* ---------- first-run seed (demo admin + sample listings) ---------- */

  var DEMO_ADMIN = { email: "admin@cainta.gov.ph", password: "Admin@123", name: "System Administrator" };

  var SAMPLE_BUSINESSES = [
    {
      businessName: "Kambal Sari-Sari Store",
      ownerName: "Maria L. Santos",
      email: "contact@kambalstore.ph",
      phone: "0917 123 4567",
      category: "Retail & Merchandise",
      address: "118 Sampaguita St., Barangay Sto. Niño, Cainta, Rizal",
      description: "Neighbourhood sari-sari store offering daily groceries, canned goods, and basic household items with home delivery inside the barangay.",
      status: "approved"
    },
    {
      businessName: "Bundok Fresh Palabok",
      ownerName: "Rico P. Mendoza",
      email: "orders@bundokpasta.ph",
      phone: "0928 555 0143",
      category: "Food & Beverage",
      address: "45 Boni Avenue, Cainta, Rizal",
      description: "Family-run eatery specialising in fresh Palabok, Tapsilog and budget-friendly meals available for dine-in, take-out and delivery.",
      status: "approved"
    },
    {
      businessName: "Sierra Bee Health Services",
      ownerName: "Engr. Liza Ramos",
      email: "care@sierrabeeph.com",
      phone: "0918 404 7788",
      category: "Health & Wellness",
      address: "7 Katipunan Ave., Barangay Dolores, Cainta, Rizal",
      description: "Community-based wellness centre offering wellness consultations, health education seminars and basic screening services.",
      status: "approved"
    },
    {
      businessName: "Cainta Tech Academy",
      ownerName: "Jose P. Dela Cruz",
      email: "admin@caintatechacademy.ph",
      phone: "0945 222 8890",
      category: "Education & Training",
      address: "22 ML Quezon St., Cainta, Rizal",
      description: "Computer literacy and TESDA-accredited vocational training centre offering short courses in encoding, networking and bookkeeping.",
      status: "approved"
    },
    {
      businessName: "Green Valley Poultry Farm",
      ownerName: "Ana P. Bautista",
      email: "greenvalley.poultry@gmail.com",
      phone: "0966 314 2277",
      category: "Agriculture & Fresh Produce",
      address: "Sitio Maligaya, Barangay Kayugan, Cainta, Rizal",
      description: "Family-run poultry farm supplying fresh dressed chicken and eggs to restaurants and wet markets across Cainta and nearby towns.",
      status: "approved"
    },
    {
      businessName: "Kampan Logistics Services",
      ownerName: "Carlo R. Villanueva",
      email: "dispatch@kampanlogistics.ph",
      phone: "0917 889 3321",
      category: "Transportation & Logistics",
      address: "3 P. Burgos St., Cainta, Rizal",
      description: "Same-day delivery and rider services for small businesses within Cainta, Pasig and Antipolo commercial centres.",
      status: "pending"
    }
  ];

  function ensureSeed() {
    var flags = global.DB.seedFlags();
    var needsAdmin = !global.DB.getUserByEmail(DEMO_ADMIN.email);

    if (needsAdmin) {
      return hashPassword(DEMO_ADMIN.password).then(function (hashed) {
        var res = global.DB.addUser({
          name: DEMO_ADMIN.name,
          email: DEMO_ADMIN.email,
          role: "admin",
          passwordHash: hashed.passwordHash,
          passwordAlgo: hashed.passwordAlgo,
          salt: hashed.salt
        });
        if (!res.ok) return res;

        if (!flags.admin) {
          global.DB.setSeedFlag("admin", true);
          SAMPLE_BUSINESSES.forEach(function (b) {
            global.DB.addBusiness(Object.assign({}, b, { ownerId: null }));
          });
          global.DB.setSeedFlag("sampleBusinesses", true);
        }
        return res;
      });
    }
    return Promise.resolve({ ok: true });
  }

  /* ---------- export ---------- */

  global.Auth = {
    SESSION_KEY: SESSION_KEY,
    DEMO_ADMIN: DEMO_ADMIN,
    ALGO_PBKDF2: ALGO_PBKDF2,
    ALGO_FALLBACK: ALGO_FALLBACK,

    hasWebCrypto: hasWebCrypto,
    hashPassword: hashPassword,
    verifyPassword: verifyPassword,
    validateRegistration: validateRegistration,

    register: register,
    login: login,
    logout: logout,

    currentUser: currentUser,
    isAdmin: isAdmin,
    guard: guard,
    publicUser: publicUser,

    ensureSeed: ensureSeed,
    seedSampleBusinesses: function () { global.DB.setSeedFlag("sampleBusinesses", false); }
  };
})(window);