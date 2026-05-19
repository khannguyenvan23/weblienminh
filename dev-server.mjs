import { createServer } from "node:http";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { pbkdf2Sync, randomBytes, randomUUID, timingSafeEqual } from "node:crypto";
import { extname, join, resolve } from "node:path";

const root = resolve(".");
const port = Number(process.env.PORT ?? 4173);
const host = process.env.HOST ?? "0.0.0.0";
const dataDir = join(root, "data");
const usersFile = join(dataDir, "users.json");
const gameAccountsFile = join(dataDir, "game-accounts.json");
const storeItemsFile = join(dataDir, "store-items.json");
const databaseUrl = process.env.DATABASE_URL;
const useDatabase = Boolean(databaseUrl);
let dbPool;
const sessions = new Map();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

async function getDbPool() {
  if (!useDatabase) {
    return null;
  }

  if (!dbPool) {
    const { Pool } = await import("pg");
    dbPool = new Pool({
      connectionString: databaseUrl,
      ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: false } : undefined,
    });
  }

  return dbPool;
}

async function query(sql, params = []) {
  const pool = await getDbPool();
  return pool.query(sql, params);
}

async function initDatabase() {
  if (!useDatabase) {
    return;
  }

  await query(`
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      username TEXT UNIQUE NOT NULL,
      email TEXT UNIQUE NOT NULL,
      salt TEXT NOT NULL,
      password_hash TEXT NOT NULL,
      balance INTEGER NOT NULL DEFAULT 0,
      role TEXT NOT NULL DEFAULT 'Người dùng',
      zalo TEXT NOT NULL DEFAULT '',
      line TEXT NOT NULL DEFAULT '',
      facebook TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL,
      updated_at TEXT
    )
  `);

  for (const table of ["game_accounts", "store_items"]) {
    await query(`
      CREATE TABLE IF NOT EXISTS ${table} (
        id TEXT PRIMARY KEY,
        title TEXT NOT NULL,
        price INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'Đang bán',
        description TEXT NOT NULL DEFAULT '',
        secret TEXT NOT NULL DEFAULT '',
        image TEXT NOT NULL DEFAULT '',
        gallery TEXT NOT NULL DEFAULT '',
        content TEXT NOT NULL DEFAULT '',
        created_at TEXT NOT NULL,
        updated_at TEXT
      )
    `);
  }

  await seedDatabaseFromJson();
}

async function seedDatabaseFromJson() {
  const users = await readJsonFile(usersFile);
  const userCount = Number((await query("SELECT COUNT(*) AS count FROM users")).rows[0].count);
  if (userCount === 0 && users.length) {
    await saveUsers(users);
  } else {
    const admin = users.find((user) => user.role === "Admin" || user.username === "admin");
    const adminExists = Number((await query("SELECT COUNT(*) AS count FROM users WHERE role = 'Admin'")).rows[0].count);
    if (admin && adminExists === 0) {
      await saveUsers([admin]);
    }
  }

  for (const [file, table] of [
    [gameAccountsFile, "game_accounts"],
    [storeItemsFile, "store_items"],
  ]) {
    const count = Number((await query(`SELECT COUNT(*) AS count FROM ${table}`)).rows[0].count);
    if (count === 0) {
      const records = await readJsonFile(file);
      if (records.length) {
        await saveCollection(file, records);
      }
    }
  }
}

async function readJsonBody(request) {
  const chunks = [];

  for await (const chunk of request) {
    chunks.push(chunk);
  }

  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch {
    return {};
  }
}

async function readUsers() {
  if (useDatabase) {
    const result = await query("SELECT * FROM users ORDER BY created_at ASC");
    return result.rows.map(rowToUser);
  }

  return readJsonFile(usersFile);
}

async function readJsonFile(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  if (useDatabase) {
    for (const user of users) {
      await query(
        `
          INSERT INTO users (
            id, username, email, salt, password_hash, balance, role, zalo, line, facebook, created_at, updated_at
          ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12)
          ON CONFLICT (id) DO UPDATE SET
            username = EXCLUDED.username,
            email = EXCLUDED.email,
            salt = EXCLUDED.salt,
            password_hash = EXCLUDED.password_hash,
            balance = EXCLUDED.balance,
            role = EXCLUDED.role,
            zalo = EXCLUDED.zalo,
            line = EXCLUDED.line,
            facebook = EXCLUDED.facebook,
            updated_at = EXCLUDED.updated_at
        `,
        [
          user.id,
          user.username,
          user.email,
          user.salt,
          user.passwordHash,
          user.balance ?? 0,
          user.role ?? "Người dùng",
          user.zalo ?? "",
          user.line ?? "",
          user.facebook ?? "",
          user.createdAt ?? new Date().toISOString(),
          user.updatedAt ?? null,
        ]
      );
    }
    return;
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

async function readCollection(file) {
  if (useDatabase) {
    const table = tableForFile(file);
    const result = await query(`SELECT * FROM ${table} ORDER BY created_at DESC`);
    return result.rows.map(rowToRecord);
  }

  return readJsonFile(file);
}

async function saveCollection(file, records) {
  if (useDatabase) {
    const table = tableForFile(file);
    await query("BEGIN");
    try {
      await query(`DELETE FROM ${table}`);
      for (const record of records) {
        await query(
          `
            INSERT INTO ${table} (
              id, title, price, status, description, secret, image, gallery, content, created_at, updated_at
            ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11)
          `,
          [
            record.id,
            record.title,
            Number(record.price ?? 0),
            record.status ?? "Đang bán",
            record.description ?? "",
            record.secret ?? "",
            record.image ?? "",
            record.gallery ?? "",
            record.content ?? "",
            record.createdAt ?? new Date().toISOString(),
            record.updatedAt ?? null,
          ]
        );
      }
      await query("COMMIT");
    } catch (error) {
      await query("ROLLBACK");
      throw error;
    }
    return;
  }

  await mkdir(dataDir, { recursive: true });
  await writeFile(file, JSON.stringify(records, null, 2), "utf8");
}

function tableForFile(file) {
  return file === gameAccountsFile ? "game_accounts" : "store_items";
}

function rowToUser(row) {
  return {
    id: row.id,
    username: row.username,
    email: row.email,
    salt: row.salt,
    passwordHash: row.password_hash,
    balance: row.balance,
    role: row.role,
    zalo: row.zalo,
    line: row.line,
    facebook: row.facebook,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function rowToRecord(row) {
  return {
    id: row.id,
    title: row.title,
    price: row.price,
    status: row.status,
    description: row.description,
    secret: row.secret,
    image: row.image,
    gallery: row.gallery,
    content: row.content,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

function sendJson(response, status, payload, headers = {}) {
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    ...headers,
  });
  response.end(JSON.stringify(payload));
}

function hashPassword(password, salt = randomBytes(16).toString("hex")) {
  const hash = pbkdf2Sync(password, salt, 120000, 32, "sha256").toString("hex");
  return { salt, hash };
}

function verifyPassword(password, user) {
  const candidate = Buffer.from(hashPassword(password, user.salt).hash, "hex");
  const saved = Buffer.from(user.passwordHash, "hex");
  return candidate.length === saved.length && timingSafeEqual(candidate, saved);
}

function parseCookies(request) {
  return Object.fromEntries(
    (request.headers.cookie ?? "")
      .split(";")
      .map((cookie) => cookie.trim().split("="))
      .filter(([key, value]) => key && value)
  );
}

function publicUser(user) {
  return {
    id: user.id,
    username: user.username,
    email: user.email,
    balance: user.balance ?? 0,
    role: user.role ?? "Người dùng",
    zalo: user.zalo ?? "",
    line: user.line ?? "",
    facebook: user.facebook ?? "",
    createdAt: user.createdAt,
  };
}

async function handleApi(request, response, url) {
  if (url.pathname === "/api/health" && request.method === "GET") {
    sendJson(response, 200, {
      ok: true,
      storage: useDatabase ? "postgresql" : "json",
      databaseUrl: useDatabase ? "set" : "missing",
    });
    return true;
  }

  if (url.pathname === "/api/me" && request.method === "GET") {
    const sid = parseCookies(request).rz_session;
    const userId = sessions.get(sid);
    const user = (await readUsers()).find((item) => item.id === userId);
    sendJson(response, 200, { user: user ? publicUser(user) : null });
    return true;
  }

  if (url.pathname === "/api/register" && request.method === "POST") {
    const body = await readJsonBody(request);
    const username = String(body.username ?? "").trim();
    const email = String(body.email ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");

    if (username.length < 3 || !email.includes("@") || password.length < 6) {
      sendJson(response, 400, {
        message: "Tên tối thiểu 3 ký tự, email hợp lệ và mật khẩu tối thiểu 6 ký tự.",
      });
      return true;
    }

    const users = await readUsers();
    if (users.some((user) => user.email === email || user.username.toLowerCase() === username.toLowerCase())) {
      sendJson(response, 409, { message: "Email hoặc tên tài khoản đã tồn tại." });
      return true;
    }

    const { salt, hash } = hashPassword(password);
    const user = {
      id: randomUUID(),
      username,
      email,
      salt,
      passwordHash: hash,
      balance: 0,
      role: "Người dùng",
      zalo: "",
      line: "",
      facebook: "",
      createdAt: new Date().toISOString(),
    };

    users.push(user);
    await saveUsers(users);

    const sid = randomUUID();
    sessions.set(sid, user.id);
    sendJson(response, 201, { user: publicUser(user) }, {
      "Set-Cookie": `rz_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
    });
    return true;
  }

  if (url.pathname === "/api/profile" && request.method === "PUT") {
    const sid = parseCookies(request).rz_session;
    const userId = sessions.get(sid);

    if (!userId) {
      sendJson(response, 401, { message: "Bạn cần đăng nhập để cập nhật thông tin." });
      return true;
    }

    const body = await readJsonBody(request);
    const email = String(body.email ?? "").trim().toLowerCase();
    const zalo = String(body.zalo ?? "").trim();
    const line = String(body.line ?? "").trim();
    const facebook = String(body.facebook ?? "").trim();

    if (!email.includes("@")) {
      sendJson(response, 400, { message: "Email không hợp lệ." });
      return true;
    }

    const users = await readUsers();
    const user = users.find((item) => item.id === userId);

    if (!user) {
      sendJson(response, 404, { message: "Không tìm thấy tài khoản." });
      return true;
    }

    if (users.some((item) => item.id !== user.id && item.email === email)) {
      sendJson(response, 409, { message: "Email này đã được tài khoản khác sử dụng." });
      return true;
    }

    user.email = email;
    user.zalo = zalo;
    user.line = line;
    user.facebook = facebook;
    user.updatedAt = new Date().toISOString();
    await saveUsers(users);

    sendJson(response, 200, { user: publicUser(user) });
    return true;
  }

  if (url.pathname === "/api/login" && request.method === "POST") {
    const body = await readJsonBody(request);
    const login = String(body.login ?? "").trim().toLowerCase();
    const password = String(body.password ?? "");
    const users = await readUsers();
    const user = users.find((item) => item.email === login || item.username.toLowerCase() === login);

    if (!user || !verifyPassword(password, user)) {
      sendJson(response, 401, { message: "Thông tin đăng nhập không đúng." });
      return true;
    }

    const sid = randomUUID();
    sessions.set(sid, user.id);
    sendJson(response, 200, { user: publicUser(user) }, {
      "Set-Cookie": `rz_session=${sid}; HttpOnly; SameSite=Lax; Path=/; Max-Age=86400`,
    });
    return true;
  }

  if (url.pathname === "/api/logout" && request.method === "POST") {
    const sid = parseCookies(request).rz_session;
    sessions.delete(sid);
    sendJson(response, 200, { ok: true }, {
      "Set-Cookie": "rz_session=; HttpOnly; SameSite=Lax; Path=/; Max-Age=0",
    });
    return true;
  }

  if (url.pathname === "/api/products/accounts" && request.method === "GET") {
    const id = url.searchParams.get("id");
    const records = (await readCollection(gameAccountsFile)).filter((item) => item.status !== "Ẩn");

    if (id) {
      const record = records.find((item) => item.id === id);
      sendJson(response, record ? 200 : 404, record ? { record } : { message: "Không tìm thấy account." });
      return true;
    }

    sendJson(response, 200, { records });
    return true;
  }

  if (url.pathname === "/api/products/items" && request.method === "GET") {
    const records = (await readCollection(storeItemsFile)).filter((item) => item.status !== "Ẩn");
    sendJson(response, 200, { records });
    return true;
  }

  if (url.pathname.startsWith("/api/admin/")) {
    const sid = parseCookies(request).rz_session;
    const userId = sessions.get(sid);
    const user = (await readUsers()).find((item) => item.id === userId);

    if (!user || user.role !== "Admin") {
      sendJson(response, 403, { message: "Bạn cần quyền Admin để dùng chức năng này." });
      return true;
    }

    const type = url.pathname.split("/")[3];
    const file = type === "accounts" ? gameAccountsFile : type === "items" ? storeItemsFile : null;

    if (!file) {
      sendJson(response, 404, { message: "Không tìm thấy mục quản lý." });
      return true;
    }

    const records = await readCollection(file);

    if (request.method === "GET") {
      sendJson(response, 200, { records });
      return true;
    }

    if (request.method === "POST") {
      const body = await readJsonBody(request);
      const record = {
        id: randomUUID(),
        title: String(body.title ?? "").trim(),
        price: Number(body.price ?? 0),
        status: String(body.status ?? "Đang bán").trim(),
        description: String(body.description ?? "").trim(),
        secret: String(body.secret ?? "").trim(),
        image: String(body.image ?? "").trim(),
        gallery: String(body.gallery ?? "").trim(),
        content: String(body.content ?? "").trim(),
        createdAt: new Date().toISOString(),
      };

      if (!record.title || record.price < 0) {
        sendJson(response, 400, { message: "Tên và giá sản phẩm không hợp lệ." });
        return true;
      }

      records.push(record);
      await saveCollection(file, records);
      sendJson(response, 201, { record });
      return true;
    }

    if (request.method === "PUT") {
      const id = url.searchParams.get("id");
      const body = await readJsonBody(request);
      const record = records.find((item) => item.id === id);

      if (!record) {
        sendJson(response, 404, { message: "Không tìm thấy sản phẩm." });
        return true;
      }

      record.title = String(body.title ?? record.title).trim();
      record.price = Number(body.price ?? record.price);
      record.status = String(body.status ?? record.status).trim();
      record.description = String(body.description ?? record.description).trim();
      record.secret = String(body.secret ?? record.secret ?? "").trim();
      record.image = String(body.image ?? record.image ?? "").trim();
      record.gallery = String(body.gallery ?? record.gallery ?? "").trim();
      record.content = String(body.content ?? record.content ?? "").trim();
      record.updatedAt = new Date().toISOString();
      await saveCollection(file, records);
      sendJson(response, 200, { record });
      return true;
    }

    if (request.method === "DELETE") {
      const id = url.searchParams.get("id");
      const nextRecords = records.filter((item) => item.id !== id);

      if (nextRecords.length === records.length) {
        sendJson(response, 404, { message: "Không tìm thấy sản phẩm." });
        return true;
      }

      await saveCollection(file, nextRecords);
      sendJson(response, 200, { ok: true });
      return true;
    }
  }

  return false;
}

await initDatabase();

createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host}`);
  if (await handleApi(request, response, url)) {
    return;
  }

  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const file = resolve(join(root, decodeURIComponent(pathname)));

  if (!file.startsWith(root)) {
    response.writeHead(403);
    response.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(file);
    response.writeHead(200, { "Content-Type": types[extname(file)] ?? "application/octet-stream" });
    response.end(body);
  } catch {
    response.writeHead(404);
    response.end("Not found");
  }
}).listen(port, host, () => {
  console.log(`RiftZone demo running on ${host}:${port}`);
});
