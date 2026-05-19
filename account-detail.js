const params = new URLSearchParams(window.location.search);
const id = params.get("id");
const fallbackImage = "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=1400&q=85";

const article = document.querySelector("[data-account-article]");
const image = document.querySelector("[data-article-image]");
const statusBadge = document.querySelector("[data-article-status]");
const statusText = document.querySelector("[data-article-status-text]");
const title = document.querySelector("[data-article-title]");
const price = document.querySelector("[data-article-price]");
const description = document.querySelector("[data-article-description]");
const code = document.querySelector("[data-article-code]");
const content = document.querySelector("[data-article-content]");
const gallery = document.querySelector("[data-article-gallery]");
const loginModal = document.querySelector(".login-modal");
const buyButton = document.querySelector("[data-buy-account]");
const openLoginButtons = document.querySelectorAll("[data-open-detail-login]");
const closeLoginButton = document.querySelector("[data-close-detail-login]");
const loginForm = document.querySelector("[data-detail-login-form]");
const loginMessage = document.querySelector("[data-detail-login-message]");
let currentUser = null;

loadAccount();
loadCurrentUser();

buyButton?.addEventListener("click", () => {
  if (!currentUser) {
    openLoginModal();
    return;
  }

  setLoginMessage("Bạn đã đăng nhập. Chức năng thanh toán sẽ được nối ở bước tiếp theo.", "success");
  openLoginModal();
});

openLoginButtons.forEach((button) => {
  button.addEventListener("click", openLoginModal);
});

closeLoginButton?.addEventListener("click", () => {
  loginModal.close();
});

loginForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  setLoginMessage("Đang đăng nhập...");

  try {
    const response = await fetch("/api/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(loginForm))),
    });
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Không thể đăng nhập.");
    }

    currentUser = result.user;
    setLoginMessage("Đăng nhập thành công. Bạn có thể mua tài khoản.", "success");
    window.setTimeout(() => loginModal.close(), 650);
  } catch (error) {
    setLoginMessage(error.message, "error");
  }
});

async function loadAccount() {
  if (!id) {
    renderError("Thiếu mã account.");
    return;
  }

  try {
    const response = await fetch(`/api/products/accounts?id=${encodeURIComponent(id)}`);
    const result = await response.json();

    if (!response.ok) {
      throw new Error(result.message || "Không tìm thấy account.");
    }

    renderAccount(result.record);
  } catch (error) {
    renderError(error.message);
  }
}

function renderAccount(record) {
  const mainImage = record.image || fallbackImage;
  image.src = mainImage;
  image.alt = record.title;
  statusBadge.textContent = record.status;
  statusText.textContent = record.status;
  title.textContent = record.title;
  price.textContent = formatMoney(Number(record.price || 0));
  description.textContent = record.description || "Account mới được admin đăng bán.";
  code.textContent = `RZ-${record.id.slice(0, 8).toUpperCase()}`;

  content.innerHTML = paragraphs(record.content || record.description || "Admin chưa nhập nội dung bài viết chi tiết.");

  const images = (record.gallery || "")
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean);

  gallery.innerHTML = images.length
    ? images.map((src) => `<img src="${escapeHtml(src)}" alt="Ảnh chi tiết ${escapeHtml(record.title)}" />`).join("")
    : `<img src="${escapeHtml(mainImage)}" alt="Ảnh chi tiết ${escapeHtml(record.title)}" />`;
}

function renderError(message) {
  article.innerHTML = `<div class="admin-empty">${escapeHtml(message)}</div>`;
}

async function loadCurrentUser() {
  try {
    const response = await fetch("/api/me");
    const result = await response.json();
    currentUser = result.user;
  } catch {
    currentUser = null;
  }
}

function openLoginModal() {
  if (typeof loginModal?.showModal === "function") {
    setLoginMessage("");
    loginModal.showModal();
  }
}

function setLoginMessage(message, type = "") {
  if (!loginMessage) return;
  loginMessage.textContent = message;
  loginMessage.className = `auth-message ${type}`.trim();
}

function paragraphs(value) {
  return escapeHtml(value)
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => `<p>${line}</p>`)
    .join("");
}

function formatMoney(value) {
  return `${new Intl.NumberFormat("vi-VN").format(value)}đ`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
