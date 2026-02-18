/**
 * Rental Reservation Widget
 * Generic rental system - works with any product type.
 *
 * Product page flow:  Dates -> Add-ons -> Details -> Confirmation
 * Browse flow:        [Type] -> Item -> Dates -> Add-ons -> Details -> Confirmation
 */
(function () {
  "use strict";

  const CFG = window.RentalConfig || {};
  const API = CFG.appUrl || "";
  const SHOP = CFG.shop || "";
  const CURRENCY = CFG.currency || "USD";
  const PRODUCT_ID = CFG.productId || "";

  const HAS_PRODUCT = !!PRODUCT_ID;

  // Step definitions
  // Product page:  1=dates  2=addons  3=details  4=success
  // Browse:        1=item   2=dates   3=addons   4=details  5=success
  const STEPS = HAS_PRODUCT
    ? { DATES: 1, ADDONS: 2, DETAILS: 3, SUCCESS: 4, TOTAL: 3 }
    : { ITEM: 1, DATES: 2, ADDONS: 3, DETAILS: 4, SUCCESS: 5, TOTAL: 4 };

  let currentStep = 1;
  let state = freshState();

  function freshState() {
    return {
      types: [],
      items: [],
      selectedItemId: null,
      selectedItem: null,
      startDate: "",
      endDate: "",
      available: null,
      pricing: null,
      addons: [],
      selectedAddons: [],
      customer: { firstName: "", lastName: "", email: "", phone: "" },
      loading: false,
      error: null,
      reservation: null,
    };
  }

  // ── API helpers ──────────────────────────────────────────

  async function apiFetch(endpoint, params = {}) {
    const url = new URL(`${API}${endpoint}`);
    url.searchParams.set("shop", SHOP);
    Object.entries(params).forEach(([k, v]) => {
      if (v != null) url.searchParams.set(k, v);
    });
    const res = await fetch(url.toString());
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data.error || `API error ${res.status}`);
    }
    return res.json();
  }

  async function apiPost(endpoint, body) {
    const res = await fetch(`${API}${endpoint}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ shop: SHOP, ...body }),
    });
    const data = await res.json();
    if (!res.ok) throw new Error(data.error || "Request failed");
    return data;
  }

  // ── Data fetching ────────────────────────────────────────

  async function fetchItems() {
    state.loading = true;
    state.error = null;
    render();
    try {
      const data = await apiFetch("/api/rental-items");
      state.items = data.items || [];
      state.types = data.types || [];
    } catch (err) {
      state.error = err.message;
    }
    state.loading = false;
    render();
  }

  async function checkAvailabilityAndPricing() {
    state.loading = true;
    state.error = null;
    state.available = null;
    state.pricing = null;
    render();
    try {
      const itemParam = HAS_PRODUCT
        ? { productId: PRODUCT_ID }
        : { itemId: state.selectedItemId };

      const availData = await apiFetch("/api/rental-items", {
        ...itemParam,
        start: state.startDate,
        end: state.endDate,
      });
      state.available = availData.available;

      if (state.available) {
        const pricingData = await apiFetch("/api/pricing", {
          ...itemParam,
          start: state.startDate,
          end: state.endDate,
        });
        state.pricing = pricingData;

        const addonData = await apiFetch("/api/addons");
        state.addons = addonData.addons || [];
      }
    } catch (err) {
      state.error = err.message;
    }
    state.loading = false;
    render();
  }

  async function submitReservation() {
    state.loading = true;
    state.error = null;
    render();
    try {
      const body = {
        startDate: state.startDate,
        endDate: state.endDate,
        customer: state.customer,
        selectedAddons: state.selectedAddons.map((a) => ({ id: a.id, quantity: 1 })),
      };
      if (HAS_PRODUCT) {
        body.productId = PRODUCT_ID;
      } else {
        body.itemId = state.selectedItemId;
      }
      const data = await apiPost("/api/reservations", body);
      state.reservation = data.reservation;
      currentStep = STEPS.SUCCESS;
    } catch (err) {
      state.error = err.message;
    }
    state.loading = false;
    render();
  }

  // ── Rendering ────────────────────────────────────────────

  function getContainer() {
    return document.getElementById("rental-reservation-modal");
  }

  function render() {
    const container = getContainer();
    if (!container || !container.dataset.open) return;
    container.innerHTML = renderOverlay();
    attachEvents();
  }

  function renderOverlay() {
    return `<div class="rr-overlay rr-active" id="rr-overlay">${renderModal()}</div>`;
  }

  function renderModal() {
    return `
      <div class="rr-modal">
        ${renderHeader()}
        ${renderSteps()}
        <div class="rr-body">
          ${state.error ? `<div class="rr-alert">${esc(state.error)}</div>` : ""}
          ${state.loading ? renderLoading() : renderCurrentStep()}
        </div>
        ${currentStep <= STEPS.TOTAL && !state.loading ? renderFooter() : ""}
      </div>
    `;
  }

  function renderHeader() {
    let title;
    if (currentStep === STEPS.SUCCESS) title = "Reservation Confirmed!";
    else if (currentStep === STEPS.ITEM) title = "Choose a Rental";
    else if (currentStep === STEPS.DATES) title = "Select Dates";
    else if (currentStep === STEPS.ADDONS) title = "Add Extras";
    else if (currentStep === STEPS.DETAILS) title = "Your Details";
    else title = "Reserve";
    return `
      <div class="rr-header">
        <h2>${title}</h2>
        <button class="rr-close" id="rr-close">&times;</button>
      </div>
    `;
  }

  function renderSteps() {
    if (currentStep === STEPS.SUCCESS) return "";
    let html = '<div class="rr-steps">';
    for (let i = 1; i <= STEPS.TOTAL; i++) {
      const cls = i === currentStep ? "rr-active" : i < currentStep ? "rr-done" : "";
      html += `<div class="rr-step ${cls}"></div>`;
    }
    html += "</div>";
    return html;
  }

  function renderLoading() {
    return `<div class="rr-loading"><div class="rr-spinner"></div><p>Loading...</p></div>`;
  }

  function renderCurrentStep() {
    if (currentStep === STEPS.SUCCESS) return renderSuccessStep();
    if (currentStep === STEPS.ITEM) return renderItemStep();
    if (currentStep === STEPS.DATES) return renderDateStep();
    if (currentStep === STEPS.ADDONS) return renderAddonStep();
    if (currentStep === STEPS.DETAILS) return renderCustomerStep();
    return "";
  }

  // ── Step: Choose Item ────────────────────────────────────

  function renderItemStep() {
    if (state.items.length === 0 && !state.loading) {
      return `
        <div class="rr-empty">
          <h3>No rentals available</h3>
          <p>There are no items available for rental at this time.</p>
        </div>
      `;
    }

    // Group items by type
    const grouped = {};
    for (const item of state.items) {
      const typeName = item.rentalItemType?.name || "Other";
      if (!grouped[typeName]) grouped[typeName] = [];
      grouped[typeName].push(item);
    }

    let html = '<h3>Select an item to rent</h3>';

    for (const [typeName, typeItems] of Object.entries(grouped)) {
      if (Object.keys(grouped).length > 1) {
        html += `<div class="rr-type-label">${esc(typeName)}</div>`;
      }
      html += '<div class="rr-items">';
      for (const item of typeItems) {
        const selected = state.selectedItemId === item.id;
        const imgSrc = item.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23ccc' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
        html += `
          <div class="rr-item-card ${selected ? "rr-selected" : ""}" data-item-id="${item.id}">
            <img class="rr-item-img" src="${esc(imgSrc)}" alt="${esc(item.name)}" />
            <div class="rr-item-info">
              <h4>${esc(item.name)}</h4>
              ${item.description ? `<p>${esc(item.description).substring(0, 80)}</p>` : ""}
            </div>
            <div class="rr-item-check">${selected ? "&#10003;" : ""}</div>
          </div>
        `;
      }
      html += "</div>";
    }

    return html;
  }

  // ── Step: Date selection ─────────────────────────────────

  function renderDateStep() {
    const today = new Date().toISOString().split("T")[0];
    const itemName = HAS_PRODUCT ? "" : state.selectedItem ? state.selectedItem.name : "";
    let html = `
      <h3>When would you like to rent${itemName ? " " + esc(itemName) : ""}?</h3>
      <div class="rr-date-row">
        <div class="rr-field">
          <label for="rr-start">Pick-up Date & Time</label>
          <input type="datetime-local" id="rr-start" value="${state.startDate}" min="${today}T00:00" />
        </div>
        <div class="rr-field">
          <label for="rr-end">Return Date & Time</label>
          <input type="datetime-local" id="rr-end" value="${state.endDate}" ${state.startDate ? `min="${state.startDate}"` : `min="${today}T00:00"`} />
        </div>
      </div>
      <p class="rr-hint">Minimum rental: half day (4 hours)</p>
    `;

    if (state.available === false) {
      html += `<div class="rr-alert" style="margin-top: 16px;">Sorry, this item is not available for the selected dates.</div>`;
    }

    if (state.available && state.pricing) {
      html += renderPricingSummary(state.pricing);
    }

    return html;
  }

  // ── Step: Add-ons ────────────────────────────────────────

  function renderAddonStep() {
    if (state.addons.length === 0) {
      return `<h3>No extras available</h3><p style="color: var(--rr-text-light);">Continue to fill in your details.</p>`;
    }

    const durationHours = state.pricing?.durationHours || 24;
    const days = Math.ceil(durationHours / 24);

    let html = '<h3>Add extras to your rental</h3><div class="rr-addons">';
    for (const addon of state.addons) {
      const selected = state.selectedAddons.some((a) => a.id === addon.id);
      const priceLabel = addon.priceType === "per_day"
        ? `${addon.price} ${CURRENCY}/day (${addon.price * days} ${CURRENCY} total)`
        : `${addon.price} ${CURRENCY}`;
      html += `
        <div class="rr-addon-card ${selected ? "rr-selected" : ""}" data-addon-id="${addon.id}">
          <div class="rr-addon-info">
            <h4>${esc(addon.name)}</h4>
            ${addon.description ? `<p>${esc(addon.description)}</p>` : ""}
          </div>
          <span class="rr-addon-price">${priceLabel}</span>
        </div>
      `;
    }
    html += "</div>";

    if (state.pricing) {
      let addonTotal = 0;
      for (const sa of state.selectedAddons) {
        addonTotal += sa.priceType === "per_day" ? sa.price * days : sa.price;
      }
      const grandTotal = state.pricing.total + addonTotal;
      const depositPct = state.pricing.depositPercentage || 30;
      const deposit = Math.round(grandTotal * (depositPct / 100) * 100) / 100;

      html += `
        <div class="rr-pricing" style="margin-top: 16px;">
          <div class="rr-pricing-row"><span>Rental</span><span>${state.pricing.total} ${CURRENCY}</span></div>
          ${state.selectedAddons.map((a) => {
            const p = a.priceType === "per_day" ? a.price * days : a.price;
            return `<div class="rr-pricing-row"><span>${esc(a.name)}</span><span>${p} ${CURRENCY}</span></div>`;
          }).join("")}
          <div class="rr-pricing-row rr-total"><span>Total</span><span>${grandTotal.toFixed(2)} ${CURRENCY}</span></div>
          <div class="rr-pricing-row rr-deposit"><span>Deposit (${depositPct}%)</span><span>${deposit.toFixed(2)} ${CURRENCY}</span></div>
          <div class="rr-pricing-row"><span>Pay on pickup</span><span>${(grandTotal - deposit).toFixed(2)} ${CURRENCY}</span></div>
        </div>
      `;
    }
    return html;
  }

  // ── Step: Customer details ───────────────────────────────

  function renderCustomerStep() {
    const c = state.customer;
    return `
      <h3>Your information</h3>
      <div class="rr-customer-grid">
        <div class="rr-field">
          <label for="rr-fname">First Name *</label>
          <input type="text" id="rr-fname" value="${esc(c.firstName)}" placeholder="John" required />
        </div>
        <div class="rr-field">
          <label for="rr-lname">Last Name *</label>
          <input type="text" id="rr-lname" value="${esc(c.lastName)}" placeholder="Doe" required />
        </div>
        <div class="rr-field">
          <label for="rr-email">Email *</label>
          <input type="email" id="rr-email" value="${esc(c.email)}" placeholder="john@example.com" required />
        </div>
        <div class="rr-field">
          <label for="rr-phone">Phone *</label>
          <input type="tel" id="rr-phone" value="${esc(c.phone)}" placeholder="+1 555-0100" required />
        </div>
      </div>
      <p style="color: var(--rr-text-light); font-size: 12px; margin-top: 8px;">
        * Required fields. Your information is used only for this reservation.
      </p>
    `;
  }

  // ── Step: Success ────────────────────────────────────────

  function renderSuccessStep() {
    const r = state.reservation;
    if (!r) return "<p>Something went wrong.</p>";
    return `
      <div class="rr-success">
        <div class="rr-success-icon">&#10003;</div>
        <h3>Reservation Confirmed!</h3>
        <div class="rr-code">${esc(r.confirmationCode)}</div>
        <p><strong>${esc(r.item?.name || "")}</strong></p>
        <p>
          ${new Date(r.startDate).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}
          &mdash;
          ${new Date(r.endDate).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}
        </p>
        <div class="rr-pricing" style="text-align: left; margin-top: 16px;">
          <div class="rr-pricing-row rr-total"><span>Total</span><span>${r.totalPrice} ${r.currency}</span></div>
          <div class="rr-pricing-row rr-deposit"><span>Deposit</span><span>${r.depositAmount} ${r.currency}</span></div>
          <div class="rr-pricing-row"><span>Pay on pickup</span><span>${r.remainingAmount} ${r.currency}</span></div>
        </div>
        ${r.pickupLocation ? `<p style="margin-top: 16px;"><strong>Pickup:</strong> ${esc(r.pickupLocation)}</p>` : ""}
        ${r.pickupInstructions ? `<p style="font-size: 13px;">${esc(r.pickupInstructions)}</p>` : ""}
        <p style="margin-top: 16px;">Save your code: <strong>${esc(r.confirmationCode)}</strong></p>
        <button class="rr-btn rr-btn-primary" style="margin-top: 16px;" id="rr-done">Done</button>
      </div>
    `;
  }

  // ── Shared ───────────────────────────────────────────────

  function renderPricingSummary(p) {
    return `
      <div class="rr-pricing" style="margin-top: 16px;">
        <div class="rr-pricing-row"><span>${esc(p.tierName || "Rental")}</span><span>${p.subtotal} ${CURRENCY}</span></div>
        ${p.seasonalMultiplier !== 1 ? `<div class="rr-pricing-row"><span>Seasonal</span><span>&times;${p.seasonalMultiplier}</span></div>` : ""}
        <div class="rr-pricing-row rr-total"><span>Total</span><span>${p.total} ${CURRENCY}</span></div>
        <div class="rr-pricing-row rr-deposit"><span>Deposit (${p.depositPercentage}%)</span><span>${p.depositAmount} ${CURRENCY}</span></div>
        <div class="rr-pricing-row"><span>Pay on pickup</span><span>${p.remainingAmount} ${CURRENCY}</span></div>
      </div>
    `;
  }

  function renderFooter() {
    const canNext = canAdvance();
    const isLast = currentStep === STEPS.DETAILS;
    const nextLabel = isLast ? "Confirm Reservation" : "Continue";
    return `
      <div class="rr-footer">
        ${currentStep > 1 ? '<button class="rr-btn rr-btn-back" id="rr-back">Back</button>' : '<div></div>'}
        <button class="rr-btn rr-btn-primary" id="rr-next" ${canNext ? "" : "disabled"}>${nextLabel}</button>
      </div>
    `;
  }

  function canAdvance() {
    if (currentStep === STEPS.ITEM) return !!state.selectedItemId;
    if (currentStep === STEPS.DATES) return state.available === true && !!state.pricing;
    if (currentStep === STEPS.ADDONS) return true;
    if (currentStep === STEPS.DETAILS) {
      const c = state.customer;
      return !!(c.firstName && c.lastName && c.email && c.phone);
    }
    return false;
  }

  // ── Events ───────────────────────────────────────────────

  function attachEvents() {
    const closeBtn = document.getElementById("rr-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    const overlay = document.getElementById("rr-overlay");
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    const nextBtn = document.getElementById("rr-next");
    if (nextBtn) nextBtn.addEventListener("click", handleNext);

    const backBtn = document.getElementById("rr-back");
    if (backBtn) backBtn.addEventListener("click", handleBack);

    const doneBtn = document.getElementById("rr-done");
    if (doneBtn) doneBtn.addEventListener("click", closeModal);

    if (currentStep === STEPS.ITEM) attachItemEvents();
    if (currentStep === STEPS.DATES) attachDateEvents();
    if (currentStep === STEPS.ADDONS) attachAddonEvents();
    if (currentStep === STEPS.DETAILS) attachCustomerEvents();
  }

  function attachItemEvents() {
    document.querySelectorAll(".rr-item-card").forEach((card) => {
      card.addEventListener("click", () => {
        const itemId = card.dataset.itemId;
        state.selectedItemId = itemId;
        state.selectedItem = state.items.find((i) => i.id === itemId) || null;
        state.available = null;
        state.pricing = null;
        render();
      });
    });
  }

  function attachDateEvents() {
    const startInput = document.getElementById("rr-start");
    const endInput = document.getElementById("rr-end");
    if (startInput) {
      startInput.addEventListener("change", (e) => {
        state.startDate = e.target.value;
        state.available = null;
        state.pricing = null;
        if (endInput) endInput.min = e.target.value;
        render();
      });
    }
    if (endInput) {
      endInput.addEventListener("change", (e) => {
        state.endDate = e.target.value;
        state.available = null;
        state.pricing = null;
        render();
        if (state.startDate && state.endDate) {
          const hours = (new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60);
          if (hours >= 4) checkAvailabilityAndPricing();
        }
      });
    }
  }

  function attachAddonEvents() {
    document.querySelectorAll(".rr-addon-card").forEach((card) => {
      card.addEventListener("click", () => {
        const addonId = card.dataset.addonId;
        const idx = state.selectedAddons.findIndex((a) => a.id === addonId);
        if (idx >= 0) {
          state.selectedAddons.splice(idx, 1);
        } else {
          const addon = state.addons.find((a) => a.id === addonId);
          if (addon) state.selectedAddons.push(addon);
        }
        render();
      });
    });
  }

  function attachCustomerEvents() {
    const fields = {
      "rr-fname": "firstName", "rr-lname": "lastName",
      "rr-email": "email", "rr-phone": "phone",
    };
    Object.entries(fields).forEach(([elemId, field]) => {
      const el = document.getElementById(elemId);
      if (el) {
        el.addEventListener("input", (e) => {
          state.customer[field] = e.target.value;
          const nextBtn = document.getElementById("rr-next");
          if (nextBtn) nextBtn.disabled = !canAdvance();
        });
      }
    });
  }

  // ── Navigation ───────────────────────────────────────────

  async function handleNext() {
    state.error = null;

    if (currentStep === STEPS.ITEM) {
      if (!state.selectedItemId) {
        state.error = "Please select an item.";
        render();
        return;
      }
      currentStep = STEPS.DATES;
      render();
      return;
    }

    if (currentStep === STEPS.DATES) {
      if (!state.startDate || !state.endDate) {
        state.error = "Please select both pick-up and return dates.";
        render();
        return;
      }
      const hours = (new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60);
      if (hours < 4) {
        state.error = "Minimum rental is 4 hours (half day).";
        render();
        return;
      }
      if (state.available === null) {
        await checkAvailabilityAndPricing();
        if (!state.available) return;
      }
      if (!state.available) {
        state.error = "This item is not available for the selected dates.";
        render();
        return;
      }
      currentStep = STEPS.ADDONS;
      render();
      return;
    }

    if (currentStep === STEPS.ADDONS) {
      currentStep = STEPS.DETAILS;
      render();
      return;
    }

    if (currentStep === STEPS.DETAILS) {
      const c = state.customer;
      if (!c.firstName || !c.lastName || !c.email || !c.phone) {
        state.error = "Please fill in all required fields.";
        render();
        return;
      }
      await submitReservation();
      return;
    }
  }

  function handleBack() {
    if (currentStep > 1) {
      currentStep--;
      state.error = null;
      render();
    }
  }

  // ── Open / Close ─────────────────────────────────────────

  function openModal() {
    const container = getContainer();
    if (!container) return;
    currentStep = 1;
    state = freshState();
    container.dataset.open = "true";
    document.body.style.overflow = "hidden";
    render();
    if (!HAS_PRODUCT) fetchItems();
  }

  function closeModal() {
    const container = getContainer();
    if (!container) return;
    const overlay = document.getElementById("rr-overlay");
    if (overlay) {
      overlay.classList.remove("rr-active");
      overlay.classList.add("rr-closing");
      setTimeout(() => {
        delete container.dataset.open;
        container.innerHTML = "";
        document.body.style.overflow = "";
      }, 300);
    } else {
      delete container.dataset.open;
      container.innerHTML = "";
      document.body.style.overflow = "";
    }
  }

  function esc(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  window.RentalReservation = { open: openModal, close: closeModal };
})();
