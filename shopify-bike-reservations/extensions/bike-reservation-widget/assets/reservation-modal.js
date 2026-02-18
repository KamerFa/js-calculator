/**
 * Bike Reservation Widget
 * Works on product pages (bike pre-selected) and any other page (bike picker shown).
 *
 * Flow on product pages:  Dates → Add-ons → Details → Confirmation
 * Flow on other pages:    Choose Bike → Dates → Add-ons → Details → Confirmation
 */
(function () {
  "use strict";

  const CFG = window.BikeReservationConfig || {};
  const API = CFG.appUrl || "";
  const SHOP = CFG.shop || "";
  const CURRENCY = CFG.currency || "BAM";
  const PRODUCT_ID = CFG.productId || "";

  // When there's no product context we need an extra bike-selection step
  const HAS_PRODUCT = !!PRODUCT_ID;

  // Step definitions differ depending on context
  // Product page:  1=dates  2=addons  3=details  4=success
  // General page:  1=bike   2=dates   3=addons   4=details  5=success
  const STEPS = HAS_PRODUCT
    ? { DATES: 1, ADDONS: 2, DETAILS: 3, SUCCESS: 4, TOTAL: 3 }
    : { BIKE: 1, DATES: 2, ADDONS: 3, DETAILS: 4, SUCCESS: 5, TOTAL: 4 };

  let currentStep = 1;
  let state = freshState();

  function freshState() {
    return {
      bikes: [],
      selectedBikeId: null,
      selectedBike: null,
      startDate: "",
      endDate: "",
      available: null,
      pricing: null,
      addons: [],
      selectedAddons: [],
      customer: {
        firstName: "", lastName: "", email: "", phone: "",
        licenseNumber: "", idNumber: "", nationality: "",
      },
      loading: false,
      error: null,
      reservation: null,
    };
  }

  // ── API helpers ────────────────────────────────────────

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

  // ── Data fetching ──────────────────────────────────────

  async function fetchBikes() {
    state.loading = true;
    state.error = null;
    render();
    try {
      const data = await apiFetch("/api/bikes");
      state.bikes = data.bikes || [];
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
      const bikeParam = HAS_PRODUCT
        ? { productId: PRODUCT_ID }
        : { bikeId: state.selectedBikeId };

      const availData = await apiFetch("/api/bikes", {
        ...bikeParam,
        start: state.startDate,
        end: state.endDate,
      });
      state.available = availData.available;

      if (state.available) {
        const pricingData = await apiFetch("/api/pricing", {
          ...bikeParam,
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
        body.bikeId = state.selectedBikeId;
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

  // ── Rendering ──────────────────────────────────────────

  function getContainer() {
    if (CFG.inline) return document.getElementById("bike-reservation-inline");
    return document.getElementById("bike-reservation-modal");
  }

  function render() {
    const container = getContainer();
    if (!container) return;

    if (CFG.inline) {
      container.innerHTML = renderModal(false);
      attachEvents();
      return;
    }

    if (!container.dataset.open) return;
    container.innerHTML = renderOverlay();
    attachEvents();
  }

  function renderOverlay() {
    return `<div class="br-overlay br-active" id="br-overlay">${renderModal(true)}</div>`;
  }

  function renderModal(showClose) {
    const wrapClass = CFG.inline ? "br-inline" : "";
    return `
      <div class="br-modal ${wrapClass}">
        ${renderHeader(showClose)}
        ${renderSteps()}
        <div class="br-body">
          ${state.error ? `<div class="br-alert">${esc(state.error)}</div>` : ""}
          ${state.loading ? renderLoading() : renderCurrentStep()}
        </div>
        ${currentStep <= STEPS.TOTAL && !state.loading ? renderFooter() : ""}
      </div>
    `;
  }

  function renderHeader(showClose) {
    let title;
    if (currentStep === STEPS.SUCCESS) title = "Reservation Confirmed!";
    else if (currentStep === STEPS.BIKE) title = "Choose a Motorbike";
    else if (currentStep === STEPS.DATES) title = "Select Dates";
    else if (currentStep === STEPS.ADDONS) title = "Add Extras";
    else if (currentStep === STEPS.DETAILS) title = "Your Details";
    else title = "Reserve";
    return `
      <div class="br-header">
        <h2>${title}</h2>
        ${showClose ? '<button class="br-close" id="br-close">&times;</button>' : ""}
      </div>
    `;
  }

  function renderSteps() {
    if (currentStep === STEPS.SUCCESS) return "";
    let html = '<div class="br-steps">';
    for (let i = 1; i <= STEPS.TOTAL; i++) {
      const cls = i === currentStep ? "br-active" : i < currentStep ? "br-done" : "";
      html += `<div class="br-step ${cls}"></div>`;
    }
    html += "</div>";
    return html;
  }

  function renderLoading() {
    return `<div class="br-loading"><div class="br-spinner"></div><p>Loading...</p></div>`;
  }

  function renderCurrentStep() {
    if (currentStep === STEPS.SUCCESS) return renderSuccessStep();
    if (currentStep === STEPS.BIKE) return renderBikeStep();
    if (currentStep === STEPS.DATES) return renderDateStep();
    if (currentStep === STEPS.ADDONS) return renderAddonStep();
    if (currentStep === STEPS.DETAILS) return renderCustomerStep();
    return "";
  }

  // ── Step: Choose Bike (general pages only) ─────────────

  function renderBikeStep() {
    if (state.bikes.length === 0 && !state.loading) {
      return `
        <div class="br-empty">
          <h3>No bikes available</h3>
          <p>There are no motorbikes available for rental at this time.</p>
        </div>
      `;
    }

    let html = "<h3>Select a motorbike</h3><div class=\"br-bikes\">";
    for (const bike of state.bikes) {
      const selected = state.selectedBikeId === bike.id;
      const imgSrc = bike.imageUrl || "data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 100 100'%3E%3Crect fill='%23f0f0f0' width='100' height='100'/%3E%3Ctext x='50' y='55' text-anchor='middle' fill='%23ccc' font-size='14'%3ENo Image%3C/text%3E%3C/svg%3E";
      html += `
        <div class="br-bike-card ${selected ? "br-selected" : ""}" data-bike-id="${bike.id}">
          <img class="br-bike-img" src="${esc(imgSrc)}" alt="${esc(bike.name)}" />
          <div class="br-bike-info">
            <h4>${esc(bike.name)}</h4>
            ${bike.description ? `<p>${esc(bike.description).substring(0, 80)}</p>` : ""}
          </div>
          <div class="br-bike-check">${selected ? "&#10003;" : ""}</div>
        </div>
      `;
    }
    html += "</div>";
    return html;
  }

  // ── Step: Date selection ───────────────────────────────

  function renderDateStep() {
    const today = new Date().toISOString().split("T")[0];
    const bikeName = HAS_PRODUCT ? "" : (state.selectedBike ? state.selectedBike.name : "");
    let html = `
      <h3>When would you like to rent${bikeName ? " " + esc(bikeName) : ""}?</h3>
      <div class="br-date-row">
        <div class="br-field">
          <label for="br-start">Pick-up Date & Time</label>
          <input type="datetime-local" id="br-start" value="${state.startDate}" min="${today}T00:00" />
        </div>
        <div class="br-field">
          <label for="br-end">Return Date & Time</label>
          <input type="datetime-local" id="br-end" value="${state.endDate}" ${state.startDate ? `min="${state.startDate}"` : `min="${today}T00:00"`} />
        </div>
      </div>
      <p class="br-hint" style="color: var(--br-text-light); font-size: 13px; margin-top: 8px;">
        Minimum rental: half day (4 hours)
      </p>
    `;

    if (state.available === false) {
      html += `
        <div class="br-alert" style="margin-top: 16px;">
          Sorry, this bike is not available for the selected dates. Please try different dates.
        </div>
      `;
    }

    if (state.available && state.pricing) {
      html += renderPricingSummary(state.pricing);
    }

    return html;
  }

  // ── Step: Add-ons ──────────────────────────────────────

  function renderAddonStep() {
    if (state.addons.length === 0) {
      return `
        <h3>No extras available</h3>
        <p style="color: var(--br-text-light);">Continue to fill in your details.</p>
      `;
    }

    const durationHours = state.pricing?.durationHours || 24;
    const days = Math.ceil(durationHours / 24);

    let html = '<h3>Add extras to your rental</h3><div class="br-addons">';
    for (const addon of state.addons) {
      const selected = state.selectedAddons.some((a) => a.id === addon.id);
      const priceLabel = addon.priceType === "per_day"
        ? `${addon.price} ${CURRENCY}/day (${addon.price * days} ${CURRENCY} total)`
        : `${addon.price} ${CURRENCY}`;
      html += `
        <div class="br-addon-card ${selected ? "br-selected" : ""}" data-addon-id="${addon.id}">
          <div class="br-addon-info">
            <h4>${esc(addon.name)}</h4>
            ${addon.description ? `<p>${esc(addon.description)}</p>` : ""}
          </div>
          <span class="br-addon-price">${priceLabel}</span>
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
        <div class="br-pricing" style="margin-top: 16px;">
          <div class="br-pricing-row"><span>Bike rental</span><span>${state.pricing.total} ${CURRENCY}</span></div>
          ${state.selectedAddons.map((a) => {
            const p = a.priceType === "per_day" ? a.price * days : a.price;
            return `<div class="br-pricing-row"><span>${esc(a.name)}</span><span>${p} ${CURRENCY}</span></div>`;
          }).join("")}
          <div class="br-pricing-row br-total"><span>Total</span><span>${grandTotal.toFixed(2)} ${CURRENCY}</span></div>
          <div class="br-pricing-row br-deposit"><span>Deposit (${depositPct}%)</span><span>${deposit.toFixed(2)} ${CURRENCY}</span></div>
          <div class="br-pricing-row"><span>Pay on pickup</span><span>${(grandTotal - deposit).toFixed(2)} ${CURRENCY}</span></div>
        </div>
      `;
    }
    return html;
  }

  // ── Step: Customer details ─────────────────────────────

  function renderCustomerStep() {
    const c = state.customer;
    return `
      <h3>Your information</h3>
      <div class="br-customer-grid">
        <div class="br-field">
          <label for="br-fname">First Name *</label>
          <input type="text" id="br-fname" value="${esc(c.firstName)}" placeholder="John" required />
        </div>
        <div class="br-field">
          <label for="br-lname">Last Name *</label>
          <input type="text" id="br-lname" value="${esc(c.lastName)}" placeholder="Doe" required />
        </div>
        <div class="br-field">
          <label for="br-email">Email *</label>
          <input type="email" id="br-email" value="${esc(c.email)}" placeholder="john@example.com" required />
        </div>
        <div class="br-field">
          <label for="br-phone">Phone *</label>
          <input type="tel" id="br-phone" value="${esc(c.phone)}" placeholder="+387 61 XXX XXX" required />
        </div>
        <div class="br-field">
          <label for="br-license">Driver's License Number</label>
          <input type="text" id="br-license" value="${esc(c.licenseNumber)}" placeholder="License #" />
        </div>
        <div class="br-field">
          <label for="br-idnum">ID / Passport Number</label>
          <input type="text" id="br-idnum" value="${esc(c.idNumber)}" placeholder="ID or Passport #" />
        </div>
        <div class="br-field br-field-full">
          <label for="br-nationality">Nationality</label>
          <input type="text" id="br-nationality" value="${esc(c.nationality)}" placeholder="e.g. Bosnian" />
        </div>
      </div>
      <p style="color: var(--br-text-light); font-size: 12px; margin-top: 8px;">
        * Required fields. Your information is used only for this reservation.
      </p>
    `;
  }

  // ── Step: Success ──────────────────────────────────────

  function renderSuccessStep() {
    const r = state.reservation;
    if (!r) return "<p>Something went wrong.</p>";
    return `
      <div class="br-success">
        <div class="br-success-icon">&#10003;</div>
        <h3>Reservation Confirmed!</h3>
        <div class="br-code">${esc(r.confirmationCode)}</div>
        <p><strong>${esc(r.bike.name)}</strong></p>
        <p>
          ${new Date(r.startDate).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}
          &mdash;
          ${new Date(r.endDate).toLocaleDateString("en-GB", { weekday: "short", month: "short", day: "numeric" })}
        </p>
        <div class="br-pricing" style="text-align: left; margin-top: 16px;">
          <div class="br-pricing-row br-total"><span>Total</span><span>${r.totalPrice} ${r.currency}</span></div>
          <div class="br-pricing-row br-deposit"><span>Deposit to pay</span><span>${r.depositAmount} ${r.currency}</span></div>
          <div class="br-pricing-row"><span>Pay on pickup</span><span>${r.remainingAmount} ${r.currency}</span></div>
        </div>
        ${r.pickupLocation ? `<p style="margin-top: 16px;"><strong>Pickup:</strong> ${esc(r.pickupLocation)}</p>` : ""}
        ${r.pickupInstructions ? `<p style="font-size: 13px;">${esc(r.pickupInstructions)}</p>` : ""}
        <p style="margin-top: 16px;">A confirmation email has been sent. Save your code: <strong>${esc(r.confirmationCode)}</strong></p>
        <button class="br-btn br-btn-primary" style="margin-top: 16px;" id="br-done">Done</button>
      </div>
    `;
  }

  // ── Shared rendering helpers ───────────────────────────

  function renderPricingSummary(p) {
    return `
      <div class="br-pricing" style="margin-top: 16px;">
        <div class="br-pricing-row"><span>${esc(p.tierName || "Rental")}</span><span>${p.subtotal} ${CURRENCY}</span></div>
        ${p.seasonalMultiplier !== 1 ? `<div class="br-pricing-row"><span>Seasonal adjustment</span><span>&times;${p.seasonalMultiplier}</span></div>` : ""}
        <div class="br-pricing-row br-total"><span>Total</span><span>${p.total} ${CURRENCY}</span></div>
        <div class="br-pricing-row br-deposit"><span>Deposit (${p.depositPercentage}%)</span><span>${p.depositAmount} ${CURRENCY}</span></div>
        <div class="br-pricing-row"><span>Pay on pickup</span><span>${p.remainingAmount} ${CURRENCY}</span></div>
      </div>
    `;
  }

  function renderFooter() {
    const canNext = canAdvance();
    const isLast = currentStep === STEPS.DETAILS;
    const nextLabel = isLast ? "Confirm Reservation" : "Continue";
    return `
      <div class="br-footer">
        ${currentStep > 1 ? '<button class="br-btn br-btn-back" id="br-back">Back</button>' : '<div></div>'}
        <button class="br-btn br-btn-primary" id="br-next" ${canNext ? "" : "disabled"}>${nextLabel}</button>
      </div>
    `;
  }

  function canAdvance() {
    if (currentStep === STEPS.BIKE) return !!state.selectedBikeId;
    if (currentStep === STEPS.DATES) return state.available === true && !!state.pricing;
    if (currentStep === STEPS.ADDONS) return true;
    if (currentStep === STEPS.DETAILS) {
      const c = state.customer;
      return !!(c.firstName && c.lastName && c.email && c.phone);
    }
    return false;
  }

  // ── Event handling ─────────────────────────────────────

  function attachEvents() {
    const closeBtn = document.getElementById("br-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    const overlay = document.getElementById("br-overlay");
    if (overlay) overlay.addEventListener("click", (e) => { if (e.target === overlay) closeModal(); });

    const nextBtn = document.getElementById("br-next");
    if (nextBtn) nextBtn.addEventListener("click", handleNext);

    const backBtn = document.getElementById("br-back");
    if (backBtn) backBtn.addEventListener("click", handleBack);

    const doneBtn = document.getElementById("br-done");
    if (doneBtn) doneBtn.addEventListener("click", closeModal);

    if (currentStep === STEPS.BIKE) attachBikeEvents();
    if (currentStep === STEPS.DATES) attachDateEvents();
    if (currentStep === STEPS.ADDONS) attachAddonEvents();
    if (currentStep === STEPS.DETAILS) attachCustomerEvents();
  }

  function attachBikeEvents() {
    document.querySelectorAll(".br-bike-card").forEach((card) => {
      card.addEventListener("click", () => {
        const bikeId = card.dataset.bikeId;
        state.selectedBikeId = bikeId;
        state.selectedBike = state.bikes.find((b) => b.id === bikeId) || null;
        // Reset downstream state when bike changes
        state.available = null;
        state.pricing = null;
        render();
      });
    });
  }

  function attachDateEvents() {
    const startInput = document.getElementById("br-start");
    const endInput = document.getElementById("br-end");
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
    document.querySelectorAll(".br-addon-card").forEach((card) => {
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
      "br-fname": "firstName", "br-lname": "lastName",
      "br-email": "email", "br-phone": "phone",
      "br-license": "licenseNumber", "br-idnum": "idNumber",
      "br-nationality": "nationality",
    };
    Object.entries(fields).forEach(([elemId, field]) => {
      const el = document.getElementById(elemId);
      if (el) {
        el.addEventListener("input", (e) => {
          state.customer[field] = e.target.value;
          const nextBtn = document.getElementById("br-next");
          if (nextBtn) nextBtn.disabled = !canAdvance();
        });
      }
    });
  }

  // ── Navigation ─────────────────────────────────────────

  async function handleNext() {
    state.error = null;

    if (currentStep === STEPS.BIKE) {
      if (!state.selectedBikeId) {
        state.error = "Please select a motorbike.";
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
        state.error = "This bike is not available for the selected dates.";
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

  // ── Open / Close ───────────────────────────────────────

  function openModal() {
    const container = getContainer();
    if (!container) return;
    currentStep = 1;
    state = freshState();
    container.dataset.open = "true";
    document.body.style.overflow = "hidden";
    render();
    // If general page, load bikes immediately
    if (!HAS_PRODUCT) fetchBikes();
  }

  function closeModal() {
    const container = getContainer();
    if (!container) return;
    const overlay = document.getElementById("br-overlay");
    if (overlay) {
      overlay.classList.remove("br-active");
      overlay.classList.add("br-closing");
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

  // ── Util ───────────────────────────────────────────────

  function esc(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }

  // ── Public API ─────────────────────────────────────────

  window.BikeReservation = { open: openModal, close: closeModal };

  // Auto-init inline mode
  if (CFG.inline) {
    document.addEventListener("DOMContentLoaded", () => {
      currentStep = 1;
      const container = getContainer();
      if (container) {
        container.dataset.open = "true";
        render();
        if (!HAS_PRODUCT) fetchBikes();
      }
    });
  }
})();
