"use strict";

const path = require("path");
const fs = require("fs");
const crypto = require("crypto");
const express = require("express");
const cookieParser = require("cookie-parser");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const multer = require("multer");

const { db, getSetting, getSessionSecret, UPLOAD_DIR } = require("./db");

const PORT = process.env.PORT || 3001;
const SECRET = getSessionSecret();
const COOKIE = "ak_session";
const IS_PROD = process.env.NODE_ENV !== "development";

const app = express();
app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(express.json({ limit: "1mb" }));
app.use(cookieParser());

/* ------------------------------------------------------------------
   Auth
   ------------------------------------------------------------------ */

// Simple in-memory throttle: after 8 bad attempts, lock out for 15 min.
const attempts = new Map();
const MAX_ATTEMPTS = 8;
const LOCKOUT_MS = 15 * 60 * 1000;

function throttleKey(req) {
  return req.ip || "unknown";
}

function isLockedOut(req) {
  const record = attempts.get(throttleKey(req));
  if (!record) return false;
  if (Date.now() - record.first > LOCKOUT_MS) {
    attempts.delete(throttleKey(req));
    return false;
  }
  return record.count >= MAX_ATTEMPTS;
}

function noteFailure(req) {
  const key = throttleKey(req);
  const record = attempts.get(key);
  if (!record || Date.now() - record.first > LOCKOUT_MS) {
    attempts.set(key, { count: 1, first: Date.now() });
  } else {
    record.count += 1;
  }
}

function requireAuth(req, res, next) {
  const token = req.cookies[COOKIE];
  if (!token) return res.status(401).json({ error: "Not signed in." });
  try {
    jwt.verify(token, SECRET);
    next();
  } catch {
    res.status(401).json({ error: "Session expired. Sign in again." });
  }
}

app.post("/api/login", (req, res) => {
  if (isLockedOut(req)) {
    return res.status(429).json({ error: "Too many attempts. Try again in 15 minutes." });
  }

  const hash = getSetting("admin_password_hash");
  if (!hash) {
    return res.status(503).json({
      error: "No admin password is set yet. Run `npm run set-password` on the server."
    });
  }

  const password = String(req.body?.password || "");
  if (!password || !bcrypt.compareSync(password, hash)) {
    noteFailure(req);
    return res.status(401).json({ error: "Wrong password." });
  }

  attempts.delete(throttleKey(req));
  const token = jwt.sign({ sub: "admin" }, SECRET, { expiresIn: "7d" });
  res.cookie(COOKIE, token, {
    httpOnly: true,
    sameSite: "strict",
    secure: IS_PROD,
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: "/"
  });
  res.json({ ok: true });
});

app.post("/api/logout", (req, res) => {
  res.clearCookie(COOKIE, { path: "/" });
  res.json({ ok: true });
});

app.get("/api/me", requireAuth, (_req, res) => res.json({ ok: true }));

/* ------------------------------------------------------------------
   Helpers
   ------------------------------------------------------------------ */

function slugify(text) {
  return String(text)
    .toLowerCase()
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 70) || "dispatch";
}

function uniqueSlug(base, ignoreId) {
  let slug = base;
  let n = 2;
  const find = db.prepare("SELECT id FROM posts WHERE slug = ?");
  for (;;) {
    const row = find.get(slug);
    if (!row || row.id === ignoreId) return slug;
    slug = `${base}-${n++}`;
  }
}

function readPost(body, existing) {
  const title = String(body?.title || "").trim();
  if (!title) throw new Error("Title is required.");
  return {
    title,
    category: String(body?.category || "UPDATE").trim().toUpperCase().slice(0, 24),
    excerpt: String(body?.excerpt || "").trim().slice(0, 400),
    body: String(body?.body || ""),
    image: body?.image ? String(body.image).trim() : null,
    published: body?.published ? 1 : 0,
    slug: uniqueSlug(slugify(body?.slug || title), existing?.id)
  };
}

/* ------------------------------------------------------------------
   Public API
   ------------------------------------------------------------------ */

app.get("/api/posts", (req, res) => {
  const limit = Math.min(Math.max(parseInt(req.query.limit, 10) || 12, 1), 50);
  const offset = Math.max(parseInt(req.query.offset, 10) || 0, 0);
  const rows = db.prepare(`
    SELECT slug, title, category, excerpt, image, created_at
      FROM posts
     WHERE published = 1
     ORDER BY created_at DESC
     LIMIT ? OFFSET ?
  `).all(limit, offset);
  const total = db.prepare("SELECT COUNT(*) AS n FROM posts WHERE published = 1").get().n;
  res.json({ posts: rows, total });
});

app.get("/api/posts/:slug", (req, res) => {
  const row = db.prepare(`
    SELECT slug, title, category, excerpt, body, image, created_at, updated_at
      FROM posts
     WHERE slug = ? AND published = 1
  `).get(req.params.slug);
  if (!row) return res.status(404).json({ error: "Dispatch not found." });
  res.json(row);
});

/* ------------------------------------------------------------------
   Admin API
   ------------------------------------------------------------------ */

app.get("/api/admin/posts", requireAuth, (_req, res) => {
  res.json({
    posts: db.prepare(`
      SELECT id, slug, title, category, excerpt, image, published, created_at, updated_at
        FROM posts ORDER BY created_at DESC
    `).all()
  });
});

app.get("/api/admin/posts/:id", requireAuth, (req, res) => {
  const row = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!row) return res.status(404).json({ error: "Dispatch not found." });
  res.json(row);
});

app.post("/api/admin/posts", requireAuth, (req, res) => {
  let data;
  try {
    data = readPost(req.body, null);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  const now = new Date().toISOString();
  const info = db.prepare(`
    INSERT INTO posts (slug, title, category, excerpt, body, image, published, created_at, updated_at)
    VALUES (@slug, @title, @category, @excerpt, @body, @image, @published, @created_at, @updated_at)
  `).run({ ...data, created_at: req.body?.created_at || now, updated_at: now });
  res.status(201).json({ id: info.lastInsertRowid, slug: data.slug });
});

app.put("/api/admin/posts/:id", requireAuth, (req, res) => {
  const existing = db.prepare("SELECT * FROM posts WHERE id = ?").get(req.params.id);
  if (!existing) return res.status(404).json({ error: "Dispatch not found." });

  let data;
  try {
    data = readPost(req.body, existing);
  } catch (err) {
    return res.status(400).json({ error: err.message });
  }
  db.prepare(`
    UPDATE posts SET slug=@slug, title=@title, category=@category, excerpt=@excerpt,
                     body=@body, image=@image, published=@published,
                     created_at=@created_at, updated_at=@updated_at
     WHERE id=@id
  `).run({
    ...data,
    id: existing.id,
    created_at: req.body?.created_at || existing.created_at,
    updated_at: new Date().toISOString()
  });
  res.json({ ok: true, slug: data.slug });
});

app.delete("/api/admin/posts/:id", requireAuth, (req, res) => {
  const info = db.prepare("DELETE FROM posts WHERE id = ?").run(req.params.id);
  if (!info.changes) return res.status(404).json({ error: "Dispatch not found." });
  res.json({ ok: true });
});

/* ------------------------------------------------------------------
   Image upload
   ------------------------------------------------------------------ */

const ALLOWED = {
  "image/webp": ".webp",
  "image/jpeg": ".jpg",
  "image/png": ".png",
  "image/gif": ".gif"
};

const upload = multer({
  storage: multer.diskStorage({
    destination: (_req, _file, cb) => cb(null, UPLOAD_DIR),
    filename: (_req, file, cb) => {
      const ext = ALLOWED[file.mimetype] || ".bin";
      cb(null, crypto.randomBytes(10).toString("hex") + ext);
    }
  }),
  limits: { fileSize: 6 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (ALLOWED[file.mimetype]) return cb(null, true);
    cb(new Error("Only WebP, JPEG, PNG or GIF images are allowed."));
  }
});

app.post("/api/admin/upload", requireAuth, (req, res) => {
  upload.single("image")(req, res, (err) => {
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: "No image was sent." });
    res.json({ url: "/uploads/" + req.file.filename });
  });
});

app.get("/api/admin/uploads", requireAuth, (_req, res) => {
  const files = fs.readdirSync(UPLOAD_DIR)
    .filter((f) => /\.(webp|jpg|png|gif)$/i.test(f))
    .map((f) => ({ url: "/uploads/" + f, mtime: fs.statSync(path.join(UPLOAD_DIR, f)).mtimeMs }))
    .sort((a, b) => b.mtime - a.mtime)
    .slice(0, 60);
  res.json({ files });
});

/* ------------------------------------------------------------------
   Static: admin panel + uploaded images
   (nginx serves these in production; this keeps `npm start` usable
   on its own for local testing.)
   ------------------------------------------------------------------ */

app.use("/uploads", express.static(UPLOAD_DIR, { maxAge: "7d", index: false }));
app.use("/admin", express.static(path.join(__dirname, "public", "admin"), { index: "index.html" }));

app.use((err, _req, res, _next) => {
  console.error(err);
  res.status(500).json({ error: "Something went wrong on the server." });
});

app.listen(PORT, "127.0.0.1", () => {
  console.log(`Aura Kingdom API listening on 127.0.0.1:${PORT}`);
  if (!getSetting("admin_password_hash")) {
    console.warn("No admin password set yet — run `npm run set-password`.");
  }
});
