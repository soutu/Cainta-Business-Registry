/* ==========================================================================
   db.js — persistent data layer (localStorage backed)
   Exposes: window.DB
   Storage survives page reloads and browser restarts.
   ========================================================================== */
(function (global) {
  "use strict";

  var STORAGE_KEY = "cbr_db_v1";
  var DB_VERSION = 1;

  var CATEGORIES = [
    "Retail & Merchandise",
    "Food & Beverage",
    "Health & Wellness",
    "Education & Training",
    "Home & Construction",
    "Transportation & Logistics",
    "Professional Services",
    "Tourism & Hospitality",
    "Agriculture & Fresh Produce",
    "Arts & Recreation",
    "Other Services"
  ];

  var STATUSES = ["pending", "approved", "rejected"];
  var ROLES = ["admin", "customer"];

  var EMPTY = { version: DB_VERSION, users: [], businesses: [] };

  /* ---------- raw read / write ---------- */

  function read() {
    var raw;
    try {
      raw = global.localStorage.getItem(STORAGE_KEY);
    } catch (err) {
      console.error("LocalStorage is unavailable.", err);
      return JSON.parse(JSON.stringify(EMPTY));
    }
    if (!raw) return JSON.parse(JSON.stringify(EMPTY));

    var parsed;
    try {
      parsed = JSON.parse(raw);
    } catch (err) {
      console.error("Stored data was corrupt and has been reset.", err);
      parsed = null;
    }
    if (!parsed || typeof parsed !== "object") parsed = JSON.parse(JSON.stringify(EMPTY));

    return {
      version: parsed.version || DB_VERSION,
      users: Array.isArray(parsed.users) ? parsed.users : [],
      businesses: Array.isArray(parsed.businesses) ? parsed.businesses : []
    };
  }

  function write(data) {
    try {
      global.localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
      return { ok: true };
    } catch (err) {
      console.error("Could not save data.", err);
      return { ok: false, error: "We could not save your changes. Your browser storage may be full or blocked." };
    }
  }

  function mutate(fn) {
    var data = read();
    var result = fn(data);
    if (result && result.ok === false) return result; // fn refused
    var saved = write(data);
    return saved.ok ? result : saved;
  }

  /* ---------- helpers ---------- */

  function uid(prefix) {
    var rand = Math.random().toString(36).slice(2, 10);
    var time = Date.now().toString(36);
    return (prefix || "id") + "_" + time + "_" + rand;
  }

  function nowISO() {
    return new Date().toISOString();
  }

  function lower(s) {
    return String(s == null ? "" : s).trim().toLowerCase();
  }

  /* ---------- Users ---------- */

  function getUsers() {
    return read().users;
  }

  function getUserById(id) {
    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      if (users[i].id === id) return users[i];
    }
    return null;
  }

  function getUserByEmail(email) {
    var target = lower(email);
    var users = getUsers();
    for (var i = 0; i < users.length; i++) {
      if (lower(users[i].email) === target) return users[i];
    }
    return null;
  }

  function addUser(user) {
    return mutate(function (data) {
      if (getUserByEmail(user.email)) {
        return { ok: false, error: "That email address is already registered." };
      }
      var record = {
        id: uid("usr"),
        name: String(user.name).trim(),
        email: lower(user.email),
        role: ROLES.indexOf(user.role) > -1 ? user.role : "customer",
        passwordHash: user.passwordHash,
        passwordAlgo: user.passwordAlgo,
        salt: user.salt,
        createdAt: nowISO()
      };
      data.users.push(record);
      return { ok: true, user: record };
    });
  }

  function updateUser(id, patch) {
    return mutate(function (data) {
      for (var i = 0; i < data.users.length; i++) {
        if (data.users[i].id === id) {
          Object.keys(patch).forEach(function (key) {
            if (patch[key] !== undefined && key !== "id") data.users[i][key] = patch[key];
          });
          data.users[i].updatedAt = nowISO();
          return { ok: true, user: data.users[i] };
        }
      }
      return { ok: false, error: "User not found." };
    });
  }

  function deleteUser(id) {
    return mutate(function (data) {
      var target = null;
      for (var i = 0; i < data.users.length; i++) {
        if (data.users[i].id === id) target = data.users[i];
      }
      if (!target) return { ok: false, error: "User not found." };

      var admins = data.users.filter(function (u) { return u.role === "admin"; });
      if (target.role === "admin" && admins.length <= 1) {
        return { ok: false, error: "You cannot delete the last remaining administrator account." };
      }

      var owned = data.businesses.filter(function (b) { return b.ownerId === id; }).length;
      data.users = data.users.filter(function (u) { return u.id !== id; });
      data.businesses = data.businesses.filter(function (b) { return b.ownerId !== id; });
      return { ok: true, removedBusinesses: owned };
    });
  }

  function countUsers() {
    return getUsers().length;
  }

  /* ---------- Businesses ---------- */

  function getBusinesses() {
    return read().businesses;
  }

  function getBusinessById(id) {
    var list = getBusinesses();
    for (var i = 0; i < list.length; i++) {
      if (list[i].id === id) return list[i];
    }
    return null;
  }

  function addBusiness(business) {
    return mutate(function (data) {
      var record = {
        id: uid("biz"),
        businessName: String(business.businessName).trim(),
        ownerName: String(business.ownerName).trim(),
        email: lower(business.email),
        phone: String(business.phone).trim(),
        category: business.category,
        address: String(business.address).trim(),
        description: String(business.description).trim(),
        status: STATUSES.indexOf(business.status) > -1 ? business.status : "pending",
        ownerId: business.ownerId || null,
        createdAt: nowISO(),
        updatedAt: null
      };
      data.businesses.push(record);
      return { ok: true, business: record };
    });
  }

  function updateBusiness(id, patch) {
    return mutate(function (data) {
      for (var i = 0; i < data.businesses.length; i++) {
        if (data.businesses[i].id === id) {
          Object.keys(patch).forEach(function (key) {
            if (patch[key] !== undefined && key !== "id") data.businesses[i][key] = patch[key];
          });
          data.businesses[i].updatedAt = nowISO();
          return { ok: true, business: data.businesses[i] };
        }
      }
      return { ok: false, error: "Business record not found." };
    });
  }

  function deleteBusiness(id) {
    return mutate(function (data) {
      var before = data.businesses.length;
      data.businesses = data.businesses.filter(function (b) { return b.id !== id; });
      if (data.businesses.length === before) {
        return { ok: false, error: "Business record not found." };
      }
      return { ok: true };
    });
  }

  function businessesByOwner(ownerId) {
    return getBusinesses().filter(function (b) { return b.ownerId === ownerId; });
  }

  function getApprovedBusinesses() {
    return getBusinesses()
      .filter(function (b) { return b.status === "approved"; })
      .sort(function (a, b) { return a.businessName.localeCompare(b.businessName); });
  }

  function getStats() {
    var businesses = getBusinesses();
    var byStatus = { pending: 0, approved: 0, rejected: 0 };
    businesses.forEach(function (b) {
      if (byStatus[b.status] !== undefined) byStatus[b.status] += 1;
    });

    var byCategory = {};
    businesses.forEach(function (b) {
      byCategory[b.category] = (byCategory[b.category] || 0) + 1;
    });

    return {
      businesses: businesses.length,
      users: countUsers(),
      pending: byStatus.pending,
      approved: byStatus.approved,
      rejected: byStatus.rejected,
      byCategory: byCategory
    };
  }

  /* ---------- Admin / demo seed ---------- */

  function seedFlags() {
    var raw = null;
    try { raw = global.localStorage.getItem(STORAGE_KEY + "_seed"); } catch (e) { /* ignore */ }
    return raw ? JSON.parse(raw) : {};
  }

  function setSeedFlag(key, value) {
    var flags = seedFlags();
    flags[key] = value;
    try {
      global.localStorage.setItem(STORAGE_KEY + "_seed", JSON.stringify(flags));
    } catch (e) { /* non-critical */ }
  }

  global.DB = {
    STORAGE_KEY: STORAGE_KEY,
    CATEGORIES: CATEGORIES,
    STATUSES: STATUSES,
    ROLES: ROLES,

    read: read,
    write: write,
    uid: uid,
    nowISO: nowISO,

    getUsers: getUsers,
    getUserById: getUserById,
    getUserByEmail: getUserByEmail,
    addUser: addUser,
    updateUser: updateUser,
    deleteUser: deleteUser,
    countUsers: countUsers,

    getBusinesses: getBusinesses,
    getBusinessById: getBusinessById,
    addBusiness: addBusiness,
    updateBusiness: updateBusiness,
    deleteBusiness: deleteBusiness,
    businessesByOwner: businessesByOwner,
    getApprovedBusinesses: getApprovedBusinesses,
    getStats: getStats,

    seedFlags: seedFlags,
    setSeedFlag: setSeedFlag
  };
})(window);