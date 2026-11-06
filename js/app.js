(function () {
  "use strict";

  const cfg = window.JOYSTICK;
  const products = window.JOYSTICK_PRODUCTS;
  const zar = new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency: "ZAR",
    minimumFractionDigits: 0,
  });

  const els = {
    gate: document.getElementById("age-gate"),
    site: document.getElementById("site"),
    grid: document.getElementById("product-grid"),
    chips: document.getElementById("category-chips"),
    cartBtn: document.getElementById("cart-btn"),
    badge: document.getElementById("cart-badge"),
    overlay: document.getElementById("cart-overlay"),
    drawer: document.getElementById("cart-drawer"),
    closeCart: document.getElementById("close-cart"),
    cartBody: document.getElementById("cart-body"),
    cartTotal: document.getElementById("cart-total"),
    checkoutStart: document.getElementById("checkout-start"),
    checkoutPanel: document.getElementById("checkout-panel"),
    waBtn: document.getElementById("wa-checkout"),
    eftBtn: document.getElementById("eft-checkout"),
    eftBox: document.getElementById("eft-box"),
  };

  let cart = loadCart();
  let filter = "All";

  function loadCart() {
    try {
      const raw = localStorage.getItem(cfg.cartKey);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }
  function saveCart() {
    localStorage.setItem(cfg.cartKey, JSON.stringify(cart));
  }
  function ageOk() {
    return localStorage.getItem(cfg.ageKey) === "1";
  }
  function setAgeOk() {
    localStorage.setItem(cfg.ageKey, "1");
  }

  function cartCount() {
    return Object.values(cart).reduce((n, q) => n + q, 0);
  }
  function cartLines() {
    return Object.entries(cart)
      .map(([id, qty]) => {
        const p = products.find((x) => x.id === id);
        return p ? { ...p, qty } : null;
      })
      .filter(Boolean);
  }
  function cartTotal() {
    return cartLines().reduce((s, l) => s + l.price * l.qty, 0);
  }
  function orderRef() {
    const t = Date.now().toString(36).toUpperCase();
    return cfg.bank.referencePrefix + t.slice(-6);
  }

  function enterSite() {
    els.gate.hidden = true;
    els.site.hidden = false;
    document.body.style.overflow = "";
  }

  function initAgeGate() {
    if (ageOk()) {
      enterSite();
      return;
    }
    document.body.style.overflow = "hidden";
    document.getElementById("age-yes").addEventListener("click", () => {
      setAgeOk();
      enterSite();
    });
    document.getElementById("age-no").addEventListener("click", () => {
      window.location.href = "https://www.google.com";
    });
  }

  function categories() {
    const set = new Set(products.map((p) => p.category));
    return ["All", ...set];
  }

  function renderChips() {
    els.chips.innerHTML = "";
    categories().forEach((c) => {
      const b = document.createElement("button");
      b.type = "button";
      b.className = "chip";
      b.textContent = c;
      b.setAttribute("aria-pressed", String(c === filter));
      b.addEventListener("click", () => {
        filter = c;
        renderChips();
        renderProducts();
      });
      els.chips.appendChild(b);
    });
  }

  function renderProducts() {
    const list =
      filter === "All" ? products : products.filter((p) => p.category === filter);
    els.grid.innerHTML = "";
    list.forEach((p) => {
      const art = document.createElement("article");
      art.className = "card";
      art.innerHTML = `
        <div class="card-visual" style="--hue:${p.hue}" aria-hidden="true"></div>
        <div class="card-body">
          <div class="card-cat">${escapeHtml(p.category)}</div>
          <h3>${escapeHtml(p.name)}</h3>
          <p>${escapeHtml(p.description)}</p>
          <div class="card-row">
            <div class="price">${zar.format(p.price)} <small>· placeholder</small></div>
            <button type="button" class="btn btn-primary btn-sm" data-add="${p.id}">Add</button>
          </div>
        </div>`;
      art.querySelector("[data-add]").addEventListener("click", () => addToCart(p.id));
      els.grid.appendChild(art);
    });
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function addToCart(id) {
    cart[id] = (cart[id] || 0) + 1;
    saveCart();
    updateCartUI();
    openCart();
  }
  function setQty(id, qty) {
    if (qty <= 0) delete cart[id];
    else cart[id] = qty;
    saveCart();
    updateCartUI();
  }

  function updateCartUI() {
    const n = cartCount();
    els.badge.textContent = n ? String(n) : "";
    els.badge.dataset.count = String(n);
    els.cartTotal.textContent = zar.format(cartTotal());

    const lines = cartLines();
    if (!lines.length) {
      els.cartBody.innerHTML = `<p class="cart-empty">Your bag is empty.</p>`;
      els.checkoutPanel.classList.remove("show");
      els.checkoutStart.disabled = true;
      return;
    }
    els.checkoutStart.disabled = false;
    els.cartBody.innerHTML = "";
    lines.forEach((l) => {
      const row = document.createElement("div");
      row.className = "cart-item";
      row.innerHTML = `
        <div>
          <h3>${escapeHtml(l.name)}</h3>
          <div class="meta">${zar.format(l.price)} · placeholder</div>
        </div>
        <div class="qty" aria-label="Quantity">
          <button type="button" data-dec aria-label="Decrease">−</button>
          <span>${l.qty}</span>
          <button type="button" data-inc aria-label="Increase">+</button>
        </div>`;
      row.querySelector("[data-dec]").addEventListener("click", () => setQty(l.id, l.qty - 1));
      row.querySelector("[data-inc]").addEventListener("click", () => setQty(l.id, l.qty + 1));
      els.cartBody.appendChild(row);
    });
  }

  function openCart() {
    els.overlay.classList.add("open");
    els.drawer.classList.add("open");
    els.drawer.setAttribute("aria-hidden", "false");
    els.cartBtn.setAttribute("aria-expanded", "true");
  }
  function closeCart() {
    els.overlay.classList.remove("open");
    els.drawer.classList.remove("open");
    els.drawer.setAttribute("aria-hidden", "true");
    els.cartBtn.setAttribute("aria-expanded", "false");
    els.checkoutPanel.classList.remove("show");
    els.eftBox.hidden = true;
  }

  function buildOrderText(ref) {
    const lines = cartLines();
    const items = lines
      .map((l) => `• ${l.name} × ${l.qty} — ${zar.format(l.price * l.qty)}`)
      .join("\n");
    return [
      `Hi Joystick — I'd like to place an order.`,
      ``,
      `Order ref: ${ref}`,
      ``,
      items,
      ``,
      `Total: ${zar.format(cartTotal())} (placeholder prices)`,
      ``,
      `Please confirm stock + discreet shipping to Durban / SA.`,
    ].join("\n");
  }

  function whatsappUrl(ref) {
    const num = String(cfg.whatsappNumber || "").replace(/\D/g, "");
    const text = encodeURIComponent(buildOrderText(ref));
    return `https://wa.me/${num}?text=${text}`;
  }

  function showEft(ref) {
    const b = cfg.bank;
    els.eftBox.hidden = false;
    els.eftBox.innerHTML = `
      <strong style="color:var(--ink)">EFT / Instant EFT</strong>
      <span class="todo-flag">TODO</span>
      <p style="margin:10px 0 0">Use these placeholder bank details until the real account is set in <code>js/config.js</code>.</p>
      <div style="margin-top:12px">
        Bank<code>${escapeHtml(b.bankName)}</code>
        Account name<code>${escapeHtml(b.accountName)}</code>
        Account number<code>${escapeHtml(b.accountNumber)}</code>
        Branch code<code>${escapeHtml(b.branchCode)}</code>
        Payment reference<code>${escapeHtml(ref)}</code>
        Amount<code>${zar.format(cartTotal())} (placeholder)</code>
      </div>
      <p class="hint" style="margin-top:12px">After payment, WhatsApp us your proof + the reference above.</p>`;
  }

  function wireCheckout() {
    els.checkoutStart.addEventListener("click", () => {
      els.checkoutPanel.classList.add("show");
      els.eftBox.hidden = true;
    });
    els.waBtn.addEventListener("click", () => {
      const ref = orderRef();
      const url = whatsappUrl(ref);
      // Flag if still on placeholder number
      if (String(cfg.whatsappNumber).replace(/\D/g, "") === "27000000000") {
        alert(
          "WhatsApp number is still a TODO placeholder in js/config.js.\nOpening WhatsApp with a draft order anyway."
        );
      }
      window.open(url, "_blank", "noopener,noreferrer");
    });
    els.eftBtn.addEventListener("click", () => {
      showEft(orderRef());
    });
  }

  function wireCart() {
    els.cartBtn.addEventListener("click", openCart);
    els.closeCart.addEventListener("click", closeCart);
    els.overlay.addEventListener("click", closeCart);
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeCart();
    });
  }

  initAgeGate();
  renderChips();
  renderProducts();
  updateCartUI();
  wireCart();
  wireCheckout();
})();
