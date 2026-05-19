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
const sessions = new Map();
const types = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "application/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
};

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
  try {
    return JSON.parse(await readFile(usersFile, "utf8"));
  } catch {
    return [];
  }
}

async function saveUsers(users) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(usersFile, JSON.stringify(users, null, 2), "utf8");
}

async function readCollection(file) {
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch {
    return [];
  }
}

async function saveCollection(file, records) {
  await mkdir(dataDir, { recursive: true });
  await writeFile(file, JSON.stringify(records, null, 2), "utf8");
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
