/**
 * Bike Reservation Widget
 * Streamlined booking flow for Shopify product pages.
 *
 * The widget knows which product it's on (from Liquid context),
 * so the customer just picks dates, optionally adds extras,
 * fills in details, and confirms. No bike selection needed.
 *
 * Steps:
 * 1. Select dates → check availability & show pricing
 * 2. Select add-ons (optional extras)
 * 3. Customer details → confirm reservation
 * 4. Confirmation / success
 */
(function () {
  "use strict";

  const CFG = window.BikeReservationConfig || {};
  const API = CFG.appUrl || "";
  const SHOP = CFG.shop || "";
  const CURRENCY = CFG.currency || "BAM";
  const PRODUCT_ID = CFG.productId || ""; // Shopify product GID from page context

  // State
  let currentStep = 1;
  const TOTAL_STEPS = 3;
  let state = {
    startDate: "",
    endDate: "",
    available: null, // null = not checked, true/false
    pricing: null,
    addons: [],
    selectedAddons: [],
    customer: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      licenseNumber: "",
      idNumber: "",
      nationality: "",
    },
    loading: false,
    error: null,
    reservation: null,
  };

  // ── API Calls ──────────────────────────────────────────

  async function apiFetch(endpoint, params = {}) {
    const url = new URL(`${API}${endpoint}`);
    url.searchParams.set("shop", SHOP);
    if (PRODUCT_ID) url.searchParams.set("productId", PRODUCT_ID);
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

  async function checkAvailabilityAndPricing() {
    state.loading = true;
    state.error = null;
    state.available = null;
    state.pricing = null;
    render();
    try {
      // Check availability for this product
      const availData = await apiFetch("/api/bikes", {
        start: state.startDate,
        end: state.endDate,
      });
      state.available = availData.available;

      if (state.available) {
        // Fetch pricing
        const pricingData = await apiFetch("/api/pricing", {
          start: state.startDate,
          end: state.endDate,
        });
        state.pricing = pricingData;

        // Fetch add-ons
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
      const data = await apiPost("/api/reservations", {
        productId: PRODUCT_ID,
        startDate: state.startDate,
        endDate: state.endDate,
        customer: state.customer,
        selectedAddons: state.selectedAddons.map((a) => ({
          id: a.id,
          quantity: 1,
        })),
      });
      state.reservation = data.reservation;
      currentStep = 4; // success
    } catch (err) {
      state.error = err.message;
    }
    state.loading = false;
    render();
  }

  // ── Rendering ──────────────────────────────────────────

  function getContainer() {
    if (CFG.inline) {
      return document.getElementById("bike-reservation-inline");
    }
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

    // Modal mode — only render if open
    if (!container.dataset.open) return;
    container.innerHTML = renderOverlay();
    attachEvents();
  }

  function renderOverlay() {
    return `
      <div class="br-overlay br-active" id="br-overlay">
        ${renderModal(true)}
      </div>
    `;
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
        ${currentStep <= TOTAL_STEPS && !state.loading ? renderFooter() : ""}
      </div>
    `;
  }

  function renderHeader(showClose) {
    const titles = {
      1: "Select Dates",
      2: "Add Extras",
      3: "Your Details",
      4: "Reservation Confirmed!",
    };
    return `
      <div class="br-header">
        <h2>${titles[currentStep] || "Reserve"}</h2>
        ${showClose ? '<button class="br-close" id="br-close">&times;</button>' : ""}
      </div>
    `;
  }

  function renderSteps() {
    if (currentStep === 4) return "";
    let html = '<div class="br-steps">';
    for (let i = 1; i <= TOTAL_STEPS; i++) {
      const cls = i === currentStep ? "br-active" : i < currentStep ? "br-done" : "";
      html += `<div class="br-step ${cls}"></div>`;
    }
    html += "</div>";
    return html;
  }

  function renderLoading() {
    return `
      <div class="br-loading">
        <div class="br-spinner"></div>
        <p>Loading...</p>
      </div>
    `;
  }

  function renderCurrentStep() {
    switch (currentStep) {
      case 1: return renderDateStep();
      case 2: return renderAddonStep();
      case 3: return renderCustomerStep();
      case 4: return renderSuccessStep();
      default: return "";
    }
  }

  // Step 1: Date selection + availability + pricing
  function renderDateStep() {
    const today = new Date().toISOString().split("T")[0];
    let html = `
      <h3>When would you like to rent?</h3>
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

    // Show availability result
    if (state.available === false) {
      html += `
        <div class="br-alert" style="margin-top: 16px;">
          Sorry, this bike is not available for the selected dates. Please try different dates.
        </div>
      `;
    }

    // Show pricing if available
    if (state.available && state.pricing) {
      html += `
        <div class="br-pricing" style="margin-top: 16px;">
          <div class="br-pricing-row">
            <span>${esc(state.pricing.tierName || "Rental")}</span>
            <span>${state.pricing.subtotal} ${CURRENCY}</span>
          </div>
          ${state.pricing.seasonalMultiplier !== 1 ? `
            <div class="br-pricing-row">
              <span>Seasonal adjustment</span>
              <span>&times;${state.pricing.seasonalMultiplier}</span>
            </div>
          ` : ""}
          <div class="br-pricing-row br-total">
            <span>Total</span>
            <span>${state.pricing.total} ${CURRENCY}</span>
          </div>
          <div class="br-pricing-row br-deposit">
            <span>Deposit (${state.pricing.depositPercentage}%)</span>
            <span>${state.pricing.depositAmount} ${CURRENCY}</span>
          </div>
          <div class="br-pricing-row">
            <span>Pay on pickup</span>
            <span>${state.pricing.remainingAmount} ${CURRENCY}</span>
          </div>
        </div>
      `;
    }

    return html;
  }

  // Step 2: Add-ons
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

    // Updated pricing summary with addons
    if (state.pricing) {
      let addonTotal = 0;
      for (const sa of state.selectedAddons) {
        if (sa.priceType === "per_day") {
          addonTotal += sa.price * days;
        } else {
          addonTotal += sa.price;
        }
      }
      const grandTotal = state.pricing.total + addonTotal;
      const depositPct = state.pricing.depositPercentage || 30;
      const deposit = Math.round(grandTotal * (depositPct / 100) * 100) / 100;

      html += `
        <div class="br-pricing" style="margin-top: 16px;">
          <div class="br-pricing-row">
            <span>Bike rental</span>
            <span>${state.pricing.total} ${CURRENCY}</span>
          </div>
          ${state.selectedAddons.map((a) => {
            const p = a.priceType === "per_day" ? a.price * days : a.price;
            return `<div class="br-pricing-row"><span>${esc(a.name)}</span><span>${p} ${CURRENCY}</span></div>`;
          }).join("")}
          <div class="br-pricing-row br-total">
            <span>Total</span>
            <span>${grandTotal.toFixed(2)} ${CURRENCY}</span>
          </div>
          <div class="br-pricing-row br-deposit">
            <span>Deposit (${depositPct}%)</span>
            <span>${deposit.toFixed(2)} ${CURRENCY}</span>
          </div>
          <div class="br-pricing-row">
            <span>Pay on pickup</span>
            <span>${(grandTotal - deposit).toFixed(2)} ${CURRENCY}</span>
          </div>
        </div>
      `;
    }

    return html;
  }

  // Step 3: Customer details
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

  // Step 4: Success
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
          <div class="br-pricing-row br-total">
            <span>Total</span>
            <span>${r.totalPrice} ${r.currency}</span>
          </div>
          <div class="br-pricing-row br-deposit">
            <span>Deposit to pay</span>
            <span>${r.depositAmount} ${r.currency}</span>
          </div>
          <div class="br-pricing-row">
            <span>Pay on pickup</span>
            <span>${r.remainingAmount} ${r.currency}</span>
          </div>
        </div>
        ${r.pickupLocation ? `<p style="margin-top: 16px;"><strong>Pickup:</strong> ${esc(r.pickupLocation)}</p>` : ""}
        ${r.pickupInstructions ? `<p style="font-size: 13px;">${esc(r.pickupInstructions)}</p>` : ""}
        <p style="margin-top: 16px;">A confirmation email has been sent. Save your code: <strong>${esc(r.confirmationCode)}</strong></p>
        <button class="br-btn br-btn-primary" style="margin-top: 16px;" id="br-done">Done</button>
      </div>
    `;
  }

  function renderFooter() {
    const canNext =
      (currentStep === 1 && state.available === true && state.pricing) ||
      (currentStep === 2) ||
      (currentStep === 3 && state.customer.firstName && state.customer.lastName && state.customer.email && state.customer.phone);

    const nextLabel = currentStep === 3 ? "Confirm Reservation" : "Continue";

    return `
      <div class="br-footer">
        ${currentStep > 1 ? '<button class="br-btn br-btn-back" id="br-back">Back</button>' : '<div></div>'}
        <button class="br-btn br-btn-primary" id="br-next" ${canNext ? "" : "disabled"}>${nextLabel}</button>
      </div>
    `;
  }

  // ── Event Handling ─────────────────────────────────────

  function attachEvents() {
    // Close button
    const closeBtn = document.getElementById("br-close");
    if (closeBtn) closeBtn.addEventListener("click", closeModal);

    // Overlay click to close
    const overlay = document.getElementById("br-overlay");
    if (overlay) {
      overlay.addEventListener("click", (e) => {
        if (e.target === overlay) closeModal();
      });
    }

    // Next / Back
    const nextBtn = document.getElementById("br-next");
    if (nextBtn) nextBtn.addEventListener("click", handleNext);

    const backBtn = document.getElementById("br-back");
    if (backBtn) backBtn.addEventListener("click", handleBack);

    // Done button (success step)
    const doneBtn = document.getElementById("br-done");
    if (doneBtn) doneBtn.addEventListener("click", closeModal);

    // Step-specific events
    if (currentStep === 1) attachDateEvents();
    if (currentStep === 2) attachAddonEvents();
    if (currentStep === 3) attachCustomerEvents();
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
        // Auto-check availability when both dates are set
        if (state.startDate && state.endDate) {
          const start = new Date(state.startDate);
          const end = new Date(state.endDate);
          const hours = (end - start) / (1000 * 60 * 60);
          if (hours >= 4) {
            checkAvailabilityAndPricing();
          }
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
      "br-fname": "firstName",
      "br-lname": "lastName",
      "br-email": "email",
      "br-phone": "phone",
      "br-license": "licenseNumber",
      "br-idnum": "idNumber",
      "br-nationality": "nationality",
    };
    Object.entries(fields).forEach(([elemId, field]) => {
      const el = document.getElementById(elemId);
      if (el) {
        el.addEventListener("input", (e) => {
          state.customer[field] = e.target.value;
          const footer = document.querySelector(".br-footer");
          if (footer) {
            const canNext = state.customer.firstName && state.customer.lastName &&
                            state.customer.email && state.customer.phone;
            const nextBtn = document.getElementById("br-next");
            if (nextBtn) nextBtn.disabled = !canNext;
          }
        });
      }
    });
  }

  async function handleNext() {
    state.error = null;

    if (currentStep === 1) {
      // Validate dates
      if (!state.startDate || !state.endDate) {
        state.error = "Please select both pick-up and return dates.";
        render();
        return;
      }
      const start = new Date(state.startDate);
      const end = new Date(state.endDate);
      const hours = (end - start) / (1000 * 60 * 60);
      if (hours < 4) {
        state.error = "Minimum rental is 4 hours (half day).";
        render();
        return;
      }
      // If not yet checked, check now
      if (state.available === null) {
        await checkAvailabilityAndPricing();
        if (!state.available) return;
      }
      if (!state.available) {
        state.error = "This bike is not available for the selected dates.";
        render();
        return;
      }
      currentStep = 2;
      render();
      return;
    }

    if (currentStep === 2) {
      currentStep = 3;
      render();
      return;
    }

    if (currentStep === 3) {
      if (!state.customer.firstName || !state.customer.lastName ||
          !state.customer.email || !state.customer.phone) {
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
    // Reset state
    currentStep = 1;
    state = {
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
    container.dataset.open = "true";
    document.body.style.overflow = "hidden";
    render();
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

  window.BikeReservation = {
    open: openModal,
    close: closeModal,
  };

  // Auto-init inline mode
  if (CFG.inline) {
    document.addEventListener("DOMContentLoaded", () => {
      currentStep = 1;
      const container = getContainer();
      if (container) {
        container.dataset.open = "true";
        render();
      }
    });
  }
})();
