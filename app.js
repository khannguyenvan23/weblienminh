const menuToggle = document.querySelector(".menu-toggle");
const mainMenu = document.querySelector(".main-menu");
const loginModal = document.querySelector(".login-modal");
const loginButtons = document.querySelectorAll("[data-open-login]");
const authLabel = document.querySelector("[data-auth-label]");
const personalMenu = document.querySelector("[data-personal-menu]");
const personalDropdown = document.querySelector("[data-personal-dropdown]");
const userButton = document.querySelector(".user-button");
const userInitials = document.querySelector("[data-user-initials]");
const userBalance = document.querySelector("[data-user-balance]");
const menuActions = document.querySelectorAll("[data-menu-action]");
const authTabs = document.querySelectorAll("[data-auth-tab]");
const authForms = document.querySelectorAll("[data-auth-form]");
const authMessage = document.querySelector(".auth-message");
const closeModal = document.querySelector(".close-modal");
const accountSection = document.querySelector(".account-section");
const accountCard = document.querySelector(".account-card");
const accountTabs = document.querySelectorAll(".account-tab");
const accountViews = document.querySelectorAll("[data-account-view]");
const adminSection = document.querySelector(".admin-section");
const adminOnlyItems = document.querySelectorAll("[data-admin-only]");
const adminTypeButtons = document.querySelectorAll("[data-admin-type]");
const adminForm = document.querySelector(".admin-form");
const adminList = document.querySelector("[data-admin-list]");
const adminMessage = document.querySelector(".admin-message");
const adminReset = document.querySelector("[data-admin-reset]");
const profileForm = document.querySelector(".profile-form");
const profileMessage = document.querySelector(".profile-message");
const profileInitials = document.querySelector("[data-profile-initials]");
const profileName = document.querySelector("[data-profile-name]");
const profileUid = document.querySelector("[data-profile-uid]");
const profileBalance = document.querySelector("[data-profile-balance]");
const profileRole = document.querySelector("[data-profile-role]");
const filters = document.querySelectorAll(".filter");
const productGrid = document.querySelector(".product-grid");
const accountEmpty = document.querySelector("[data-account-empty]");
const itemList = document.querySelector(".item-list");
const detailSection = document.querySelector(".detail-section");
const detailClose = document.querySelector("[data-detail-close]");
const detailImage = document.querySelector("[data-detail-image]");
const detailStatus = document.querySelector("[data-detail-status]");
const detailTitle = document.querySelector("[data-detail-title]");
const detailPrice = document.querySelector("[data-detail-price]");
const detailDescription = document.querySelector("[data-detail-description]");
const detailCode = document.querySelector("[data-detail-code]");
const searchForm = document.querySelector(".hero-search");
const depositForm = document.querySelector(".deposit-form");
const depositTabs = document.querySelectorAll("[data-deposit-method]");
const quickAmountButtons = document.querySelectorAll("[data-amount]");
const depositAmountInput = document.querySelector(".deposit-form input[name='amount']");
const depositMessage = document.querySelector(".deposit-message");
const bankBox = document.querySelector("[data-bank-box]");
const cardBox = document.querySelector("[data-card-box]");
const depositCode = document.querySelector("[data-deposit-code]");

let currentUser = null;
let depositMethod = "bank";
let adminType = "accounts";
let adminRecords = [];

menuToggle?.addEventListener("click", () => {
  const isOpen = mainMenu.classList.toggle("open");
  menuToggle.setAttribute("aria-expanded", String(isOpen));
});

userButton?.addEventListener("click", () => {
  const isOpen = personalDropdown.classList.toggle("open");
  userButton.setAttribute("aria-expanded", String(isOpen));
});

document.addEventListener("click", (event) => {
  if (!personalMenu?.contains(event.target)) {
    personalDropdown?.classList.remove("open");
    userButton?.setAttribute("aria-expanded", "false");
  }
});

loginButtons.forEach((button) => {
  button.addEventListener("click", () => openLoginModal());
});

closeModal?.addEventListener("click", () => loginModal.close());

authTabs.forEach((button) => {
  button.addEventListener("click", () => setAuthMode(button.dataset.authTab));
});

authForms.forEach((form) => {
  form.addEventListener("submit", async (event) => {
    event.preventDefault();
    const mode = form.dataset.authForm;
    const data = Object.fromEntries(new FormData(form));

    setAuthMessage("Đang xử lý...");

    try {
      const response = await fetch(`/api/${mode}`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      const result = await response.json();

      if (!response.ok) throw new Error(result.message || "Không thể xử lý yêu cầu.");

      currentUser = result.user;
      updateAuthView();
      updateProfileView();
      setAuthMessage(mode === "register" ? "Tạo tài khoản thành công." : "Đăng nhập thành công.", "success");
      window.setTimeout(() => loginModal.close(), 500);
      form.reset();
    } catch (error) {
      setAuthMessage(error.message, "error");
    }
  });
});

menuActions.forEach((button) => {
  button.addEventListener("click", async () => {
    const action = button.dataset.menuAction;
    personalDropdown?.classList.remove("open");
    userButton?.setAttribute("aria-expanded", "false");

    if (action === "logout") return logout();
    if (action === "admin") return showAdminPanel();
    if (!currentUser) return openLoginModal();

    showAccountPanel(action);
  });
});

profileForm?.addEventListener("submit", async (event) => {
  event.preventDefault();

  if (!currentUser) {
    setProfileMessage("Bạn cần đăng nhập trước khi lưu thông tin.", "error");
    openLoginModal();
    return;
  }

  setProfileMessage("Đang lưu thay đổi...");

  try {
    const response = await fetch("/api/profile", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(Object.fromEntries(new FormData(profileForm))),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.message || "Không thể lưu thông tin.");

    currentUser = result.user;
    updateAuthView();
    updateProfileView();
    setProfileMessage("Thông tin đã được đồng bộ", "success");
  } catch (error) {
    setProfileMessage(error.message, "error");
  }
});

depositTabs.forEach((button) => {
  button.addEventListener("click", () => {
    depositMethod = button.dataset.depositMethod;
    depositTabs.forEach((tab) => tab.classList.toggle("active", tab === button));
    bankBox.hidden = depositMethod !== "bank";
    cardBox.hidden = depositMethod !== "card";
    setDepositMessage(
      depositMethod === "bank"
        ? "Chuyển khoản đúng nội dung để hệ thống cộng tiền tự động."
        : "Nhập đúng loại thẻ, mã thẻ và serial trước khi gửi."
    );
  });
});

quickAmountButtons.forEach((button) => {
  button.addEventListener("click", () => {
    quickAmountButtons.forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    depositAmountInput.value = button.dataset.amount;
    setDepositMessage(`Đã chọn ${formatMoney(Number(button.dataset.amount))}.`);
  });
});

depositAmountInput?.addEventListener("input", () => {
  quickAmountButtons.forEach((item) => {
    item.classList.toggle("active", item.dataset.amount === depositAmountInput.value);
  });
});

depositForm?.addEventListener("submit", (event) => {
  event.preventDefault();

  if (!currentUser) {
    setDepositMessage("Bạn cần đăng nhập trước khi nạp tiền.", "error");
    openLoginModal();
    return;
  }

  const amount = Number(depositAmountInput.value);
  if (!Number.isFinite(amount) || amount < 10000) {
    setDepositMessage("Số tiền nạp tối thiểu là 10.000đ.", "error");
    return;
  }

  if (depositMethod === "bank") {
    setDepositMessage(`Đã tạo yêu cầu nạp ${formatMoney(amount)}. Vui lòng chuyển khoản đúng nội dung.`, "success");
    return;
  }

  const formData = new FormData(depositForm);
  if (!formData.get("cardCode") || !formData.get("cardSerial")) {
    setDepositMessage("Vui lòng nhập mã thẻ và serial.", "error");
    return;
  }

  setDepositMessage(`Đã nhận yêu cầu nạp thẻ ${formatMoney(amount)}. Hệ thống sẽ xử lý sau ít phút.`, "success");
});

adminTypeButtons.forEach((button) => {
  button.addEventListener("click", async () => {
    adminType = button.dataset.adminType;
    adminTypeButtons.forEach((item) => item.classList.toggle("active", item === button));
    resetAdminForm();
    await loadAdminRecords();
  });
});

adminForm?.addEventListener("submit", async (event) => {
  event.preventDefault();
  const formData = Object.fromEntries(new FormData(adminForm));
  const id = formData.id;
  const method = id ? "PUT" : "POST";
  const url = `/api/admin/${adminType}${id ? `?id=${encodeURIComponent(id)}` : ""}`;

  setAdminMessage("Đang lưu...");

  try {
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(formData),
    });
    const result = await response.json();

    if (!response.ok) throw new Error(result.message || "Không thể lưu sản phẩm.");

    resetAdminForm();
    await loadAdminRecords();
    await loadStorefrontProducts();
    setAdminMessage("Đã lưu sản phẩm.");
  } catch (error) {
    setAdminMessage(error.message, "error");
  }
});

adminReset?.addEventListener("click", () => {
  resetAdminForm();
  setAdminMessage("");
});

adminList?.addEventListener("click", async (event) => {
  const button = event.target.closest("button[data-admin-action]");
  if (!button) return;

  const record = adminRecords.find((item) => item.id === button.dataset.id);
  if (!record) return;

  if (button.dataset.adminAction === "edit") {
    adminForm.id.value = record.id;
    adminForm.title.value = record.title;
    adminForm.price.value = record.price;
    adminForm.status.value = record.status;
    adminForm.description.value = record.description ?? "";
    adminForm.image.value = record.image ?? "";
    adminForm.gallery.value = record.gallery ?? "";
    adminForm.content.value = record.content ?? "";
    adminForm.secret.value = record.secret ?? "";
    setAdminMessage("Đang sửa sản phẩm.");
    adminForm.scrollIntoView({ behavior: "smooth", block: "center" });
    return;
  }

  const response = await fetch(`/api/admin/${adminType}?id=${encodeURIComponent(record.id)}`, { method: "DELETE" });
  const result = await response.json();

  if (!response.ok) {
    setAdminMessage(result.message || "Không thể xóa sản phẩm.", "error");
    return;
  }

  await loadAdminRecords();
  await loadStorefrontProducts();
  setAdminMessage("Đã xóa sản phẩm.");
});

filters.forEach((button) => {
  button.addEventListener("click", () => {
    filters.forEach((filter) => filter.classList.remove("active"));
    button.classList.add("active");
    applyProductFilter(button.dataset.filter);
  });
});

searchForm?.addEventListener("submit", (event) => {
  event.preventDefault();
  document.querySelector("#accounts")?.scrollIntoView({ behavior: "smooth" });
});

productGrid?.addEventListener("click", (event) => {
  const button = event.target.closest("button");
  const card = event.target.closest(".product-card");
  if (!button || !card) return;

  if (card.dataset.productId) {
    window.location.href = `/account-detail.html?id=${encodeURIComponent(card.dataset.productId)}`;
    return;
  }

  openProductDetail({
    title: card.querySelector("h3")?.textContent ?? "Thông tin tài khoản",
    price: card.querySelector(".price-row strong")?.textContent ?? "0đ",
    description: card.querySelector("p")?.textContent ?? "",
    status: card.querySelector(".badge")?.textContent?.trim() ?? button.textContent.trim(),
    image: card.querySelector("img")?.src ?? "",
    code: card.dataset.productId ? `RZ-${card.dataset.productId.slice(0, 8).toUpperCase()}` : `RZ-${Math.random().toString(16).slice(2, 8).toUpperCase()}`,
  });
});

detailClose?.addEventListener("click", () => {
  detailSection.hidden = true;
  document.querySelector("#accounts")?.scrollIntoView({ behavior: "smooth", block: "start" });
});

function setAuthMode(mode) {
  authTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.authTab === mode));
  authForms.forEach((form) => form.classList.toggle("hidden", form.dataset.authForm !== mode));
  setAuthMessage("");
}

function setAuthMessage(message, type = "") {
  if (!authMessage) return;
  authMessage.textContent = message;
  authMessage.className = `auth-message ${type}`.trim();
}

function updateAuthView() {
  if (authLabel) {
    authLabel.hidden = Boolean(currentUser);
    authLabel.textContent = "Đăng nhập/Đăng ký";
  }

  if (personalMenu) personalMenu.hidden = !currentUser;
  if (userInitials) userInitials.textContent = getInitials(currentUser?.username);
  if (userBalance) userBalance.textContent = `${Math.floor((currentUser?.balance ?? 0) / 1000)} K`;

  adminOnlyItems.forEach((item) => {
    item.hidden = currentUser?.role !== "Admin";
  });
}

function updateProfileView() {
  const user = currentUser;
  const uid = user?.id ? user.id.slice(0, 12).toUpperCase() : "Đăng nhập để xem";
  const balance = new Intl.NumberFormat("vi-VN").format(user?.balance ?? 0);
  const initials = getInitials(user?.username);

  if (profileInitials) profileInitials.textContent = initials === "U" ? "RZ" : initials;
  if (profileName) profileName.textContent = user?.username ?? "Khách hàng";
  if (profileUid) profileUid.textContent = uid;
  if (profileBalance) profileBalance.textContent = `${balance} VND`;
  if (profileRole) profileRole.textContent = user?.role ?? "Người dùng";

  if (profileForm) {
    profileForm.username.value = user?.username ?? "";
    profileForm.email.value = user?.email ?? "";
    profileForm.zalo.value = user?.zalo ?? "";
    profileForm.line.value = user?.line ?? "";
    profileForm.facebook.value = user?.facebook ?? "";
    profileForm.querySelectorAll("input:not([readonly]), button.save-profile").forEach((element) => {
      element.disabled = !user;
    });
  }

  setProfileMessage(user ? "Thông tin đã được đồng bộ" : "Đăng nhập để đồng bộ thông tin", user ? "success" : "");
}

function showAccountPanel(action = "profile") {
  if (!accountSection) return;

  if (adminSection) adminSection.hidden = true;
  accountSection.hidden = false;

  const view = ["deposit", "accounts", "items"].includes(action) ? action : "profile";
  if (accountCard) accountCard.hidden = view !== "profile";
  accountViews.forEach((panel) => {
    panel.hidden = panel.dataset.accountView !== view;
  });
  accountTabs.forEach((tab) => {
    tab.classList.toggle("active", tab.dataset.menuAction === action);
  });

  if (action === "profile") setProfileMessage("Thông tin đã được đồng bộ", "success");
  if (action === "deposit") {
    updateDepositCode();
    setDepositMessage("Chọn số tiền để tạo yêu cầu nạp.");
  }

  accountSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadCurrentUser() {
  try {
    const response = await fetch("/api/me");
    const result = await response.json();
    currentUser = result.user;
  } catch {
    currentUser = null;
  }

  updateAuthView();
  updateProfileView();
}

async function loadStorefrontProducts() {
  await Promise.all([loadHomeAccounts(), loadHomeItems()]);
  const activeFilter = document.querySelector(".filter.active")?.dataset.filter ?? "all";
  applyProductFilter(activeFilter);
}

async function loadHomeAccounts() {
  if (!productGrid) return;

  productGrid.querySelectorAll("[data-admin-product='account']").forEach((item) => item.remove());

  try {
    const response = await fetch("/api/products/accounts");
    const result = await response.json();
    const records = result.records ?? [];

    productGrid.insertAdjacentHTML(
      "beforeend",
      records.map((record) => renderAccountCard(record)).join("")
    );
    if (accountEmpty) accountEmpty.hidden = records.length > 0;
  } catch {
    if (accountEmpty) accountEmpty.hidden = true;
    productGrid.insertAdjacentHTML("beforeend", `<p class="storefront-note" data-admin-product="account">Không tải được account mới.</p>`);
  }
}

async function loadHomeItems() {
  if (!itemList) return;

  itemList.querySelectorAll("[data-admin-product='item']").forEach((item) => item.remove());

  try {
    const response = await fetch("/api/products/items");
    const result = await response.json();
    const records = result.records ?? [];

    itemList.insertAdjacentHTML(
      "beforeend",
      records.map((record, index) => renderStoreItem(record, index + 4)).join("")
    );
  } catch {
    itemList.insertAdjacentHTML("beforeend", `<p class="storefront-note" data-admin-product="item">Không tải được vật phẩm mới.</p>`);
  }
}

function renderAccountCard(record) {
  const category = record.price <= 500000 ? "budget" : record.description?.toLowerCase().includes("skin") ? "skin" : "rank";
  const badgeClass = category === "skin" ? "badge badge-blue" : category === "budget" ? "badge badge-green" : "badge";
  const badge = record.status === "Đã bán" ? "ĐÃ BÁN" : category === "budget" ? "GIÁ TỐT" : "ADMIN";

  const image = record.image || "https://images.unsplash.com/photo-1560253023-3ec5d502959f?auto=format&fit=crop&w=900&q=80";

  return `
    <article class="product-card" data-category="${category}" data-admin-product="account" data-product-id="${record.id}">
      <img src="${escapeHtml(image)}" alt="${escapeHtml(record.title)}" />
      <div class="card-body">
        <span class="${badgeClass}">${badge}</span>
        <h3>${escapeHtml(record.title)}</h3>
        <p>${escapeHtml(record.description || "Account mới được admin đăng bán.")}</p>
        <div class="price-row">
          <strong>${formatMoney(Number(record.price || 0))}</strong>
          <button>${record.status === "Đã bán" ? "Đã bán" : "Chi tiết"}</button>
        </div>
      </div>
    </article>
  `;
}

function openProductDetail(product) {
  if (!detailSection) return;

  detailImage.src = product.image;
  detailImage.alt = product.title;
  detailStatus.textContent = product.status;
  detailTitle.textContent = product.title;
  detailPrice.textContent = product.price;
  detailDescription.textContent = product.description || "Thông tin chi tiết của tài khoản sẽ được cập nhật thêm bởi admin.";
  detailCode.textContent = product.code;
  detailSection.hidden = false;
  detailSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function renderStoreItem(record, number) {
  return `
    <article data-admin-product="item">
      <span>${String(number).padStart(2, "0")}</span>
      <div>
        <h3>${escapeHtml(record.title)}</h3>
        <p>${escapeHtml(record.description || `${formatMoney(Number(record.price || 0))}, trạng thái ${record.status}.`)}</p>
      </div>
    </article>
  `;
}

function applyProductFilter(category) {
  document.querySelectorAll(".product-card").forEach((product) => {
    product.hidden = category !== "all" && product.dataset.category !== category;
  });
}

async function logout() {
  await fetch("/api/logout", { method: "POST" });
  currentUser = null;
  if (accountSection) accountSection.hidden = true;
  if (adminSection) adminSection.hidden = true;
  personalDropdown?.classList.remove("open");
  updateAuthView();
  updateProfileView();
  setProfileMessage("Bạn đã đăng xuất.");
}

function setProfileMessage(message, type = "") {
  if (!profileMessage) return;
  profileMessage.lastChild.textContent = ` ${message}`;
  profileMessage.className = `profile-message ${type}`.trim();
}

function openLoginModal() {
  if (typeof loginModal?.showModal === "function") {
    setAuthMode("login");
    setAuthMessage("");
    loginModal.showModal();
  }
}

function getInitials(name) {
  return name
    ? name
        .split(/\s+/)
        .map((part) => part[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "U";
}

function updateDepositCode() {
  if (!depositCode) return;
  const uid = currentUser?.id ? currentUser.id.slice(0, 8).toUpperCase() : "UID";
  depositCode.textContent = `RZ ${uid}`;
}

function setDepositMessage(message, type = "") {
  if (!depositMessage) return;
  depositMessage.textContent = message;
  depositMessage.className = `deposit-message ${type}`.trim();
}

async function showAdminPanel() {
  if (currentUser?.role !== "Admin") {
    openLoginModal();
    return;
  }

  if (accountSection) accountSection.hidden = true;
  adminSection.hidden = false;
  await loadAdminRecords();
  adminSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

async function loadAdminRecords() {
  if (!adminList) return;

  const response = await fetch(`/api/admin/${adminType}`);
  const result = await response.json();

  if (!response.ok) {
    setAdminMessage(result.message || "Không thể tải dữ liệu.", "error");
    return;
  }

  adminRecords = result.records;
  renderAdminRecords();
}

function renderAdminRecords() {
  if (!adminRecords.length) {
    adminList.innerHTML = `<div class="admin-empty">Chưa có ${adminType === "accounts" ? "account" : "vật phẩm"} nào.</div>`;
    return;
  }

  adminList.innerHTML = adminRecords
    .map(
      (record) => `
        <article class="admin-row">
          <div>
            <strong>${escapeHtml(record.title)}</strong>
            <small>${escapeHtml(record.description || "Chưa có mô tả")}</small>
          </div>
          <span>${formatMoney(Number(record.price || 0))}</span>
          <span>${escapeHtml(record.status)}</span>
          <div class="admin-actions">
            <button type="button" data-admin-action="edit" data-id="${record.id}">Sửa</button>
            <button class="danger" type="button" data-admin-action="delete" data-id="${record.id}">Xóa</button>
          </div>
        </article>
      `
    )
    .join("");
}

function resetAdminForm() {
  adminForm?.reset();
  if (adminForm?.id) adminForm.id.value = "";
}

function setAdminMessage(message, type = "") {
  if (!adminMessage) return;
  adminMessage.textContent = message;
  adminMessage.className = `admin-message ${type}`.trim();
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

loadCurrentUser();
loadStorefrontProducts();
updateProfileView();
