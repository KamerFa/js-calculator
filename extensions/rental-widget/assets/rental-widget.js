(function () {
  "use strict";

  function init() {
    var widgets = document.querySelectorAll(".rental-widget");
    if (widgets.length === 0) return;
    widgets.forEach(initWidget);
  }

  // Ensure DOM is fully parsed before initializing
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  function initWidget(container) {
    // Skip if already initialized
    if (container.dataset.initialized) return;
    container.dataset.initialized = "true";

    var productId = container.dataset.productId;
    var shop = container.dataset.shop;
    var proxyUrl = container.dataset.proxyUrl;
    var inheritTheme = container.dataset.inheritTheme === "true";
    var primaryColor = container.dataset.primaryColor || "#000000";
    var borderRadius = container.dataset.borderRadius || "4px";

    if (!inheritTheme) {
      container.style.setProperty("--rw-primary", primaryColor);
      container.style.setProperty("--rw-border-radius", borderRadius);
    }

    if (!proxyUrl || !productId || !shop) {
      container.innerHTML = '<div class="rental-widget__error">Widget configuration error — missing data attributes.</div>';
      return;
    }

    // Timeout: if loading takes more than 10s, show error
    var loadingTimeout = setTimeout(function () {
      if (container.querySelector(".rental-widget__loading")) {
        container.innerHTML =
          '<div class="rental-widget__error">' +
          "Unable to load rental options. The app proxy may not be configured. " +
          "Please check your Shopify Partner Dashboard &rarr; App setup &rarr; App proxy." +
          "</div>";
      }
    }, 10000);

    // Fetch product rental config via app proxy
    var url = proxyUrl + "/product/" + productId + "?shop=" + encodeURIComponent(shop);
    fetch(url)
      .then(function (r) {
        if (!r.ok) {
          throw new Error("HTTP " + r.status + " from " + url);
        }
        var ct = (r.headers.get("content-type") || "");
        if (ct.indexOf("application/json") === -1) {
          throw new Error("Expected JSON but got " + ct + " — app proxy may not be configured.");
        }
        return r.json();
      })
      .then(function (data) {
        clearTimeout(loadingTimeout);

        if (!data.rentable) {
          container.setAttribute("data-rentable", "false");
          container.innerHTML = "";
          return;
        }

        // Apply settings overrides if available
        if (data.settings && !inheritTheme) {
          if (data.settings.widgetPrimaryColor) {
            container.style.setProperty("--rw-primary", data.settings.widgetPrimaryColor);
          }
          if (data.settings.widgetBorderRadius) {
            container.style.setProperty("--rw-border-radius", data.settings.widgetBorderRadius);
          }
        }

        container.setAttribute("data-rentable", "true");
        renderWidget(container, data.product, data.settings || {}, proxyUrl, shop);
      })
      .catch(function (err) {
        clearTimeout(loadingTimeout);
        console.error("Rental widget error:", err);
        container.innerHTML =
          '<div class="rental-widget__error">' +
          "Unable to load rental options. " +
          (err.message || "Please try refreshing the page.") +
          "</div>";
      });
  }

  function renderWidget(container, product, settings, proxyUrl, shop) {
    var rates = [];
    if (product.hourlyRate) rates.push('<span class="rental-widget__rate"><span class="rental-widget__rate-value">$' + parseFloat(product.hourlyRate).toFixed(2) + '</span><span class="rental-widget__rate-unit">/hour</span></span>');
    if (product.dailyRate) rates.push('<span class="rental-widget__rate"><span class="rental-widget__rate-value">$' + parseFloat(product.dailyRate).toFixed(2) + '</span><span class="rental-widget__rate-unit">/day</span></span>');
    if (product.weeklyRate) rates.push('<span class="rental-widget__rate"><span class="rental-widget__rate-value">$' + parseFloat(product.weeklyRate).toFixed(2) + '</span><span class="rental-widget__rate-unit">/week</span></span>');

    var minDate = new Date();
    minDate.setDate(minDate.getDate() + 1);
    var minDateStr = minDate.toISOString().split("T")[0];

    var html =
      '<div class="rental-widget__content">' +
        '<div class="rental-widget__header">' +
          '<h3 class="rental-widget__title">Rent This Item</h3>' +
        '</div>' +
        '<div class="rental-widget__rates">' + rates.join("") + '</div>' +
        '<div class="rental-widget__dates">' +
          '<div class="rental-widget__field">' +
            '<label class="rental-widget__label" for="rw-start-' + product.id + '">Start date</label>' +
            '<input class="rental-widget__input" type="date" id="rw-start-' + product.id + '" min="' + minDateStr + '" />' +
          '</div>' +
          '<div class="rental-widget__field">' +
            '<label class="rental-widget__label" for="rw-end-' + product.id + '">End date</label>' +
            '<input class="rental-widget__input" type="date" id="rw-end-' + product.id + '" min="' + minDateStr + '" />' +
          '</div>' +
        '</div>' +
        '<div class="rental-widget__field">' +
          '<label class="rental-widget__label">Quantity</label>' +
          '<div class="rental-widget__quantity">' +
            '<button type="button" class="rental-widget__qty-btn" data-action="dec">−</button>' +
            '<span class="rental-widget__qty-value" id="rw-qty-' + product.id + '">1</span>' +
            '<button type="button" class="rental-widget__qty-btn" data-action="inc">+</button>' +
          '</div>' +
        '</div>' +
        '<div id="rw-availability-' + product.id + '" class="rental-widget__availability"></div>' +
        '<div id="rw-summary-' + product.id + '" class="rental-widget__summary" style="display:none;"></div>' +
        '<div id="rw-error-' + product.id + '" class="rental-widget__error"></div>' +
        '<button type="button" class="rental-widget__button" id="rw-add-' + product.id + '" disabled>Select dates to rent</button>' +
      '</div>';

    container.innerHTML = html;

    // State
    var state = { startDate: "", endDate: "", quantity: 1, price: null, available: false, rentalProductId: product.id };

    var startInput = container.querySelector("#rw-start-" + product.id);
    var endInput = container.querySelector("#rw-end-" + product.id);
    var qtyDisplay = container.querySelector("#rw-qty-" + product.id);
    var availDiv = container.querySelector("#rw-availability-" + product.id);
    var summaryDiv = container.querySelector("#rw-summary-" + product.id);
    var errorDiv = container.querySelector("#rw-error-" + product.id);
    var addBtn = container.querySelector("#rw-add-" + product.id);

    // Quantity buttons
    container.querySelectorAll(".rental-widget__qty-btn").forEach(function (btn) {
      btn.addEventListener("click", function () {
        if (btn.dataset.action === "inc") {
          state.quantity = Math.min(state.quantity + 1, product.quantityTotal || 99);
        } else {
          state.quantity = Math.max(1, state.quantity - 1);
        }
        qtyDisplay.textContent = state.quantity;
        if (state.startDate && state.endDate) checkDates();
      });
    });

    // Date change handlers
    startInput.addEventListener("change", function () {
      state.startDate = startInput.value;
      if (state.startDate && endInput.value && new Date(endInput.value) <= new Date(state.startDate)) {
        endInput.value = "";
        state.endDate = "";
      }
      endInput.min = state.startDate;
      if (state.startDate && state.endDate) checkDates();
    });

    endInput.addEventListener("change", function () {
      state.endDate = endInput.value;
      if (state.startDate && state.endDate) checkDates();
    });

    // Add to cart
    addBtn.addEventListener("click", function () {
      if (!state.available || !state.price) return;
      addBtn.disabled = true;
      addBtn.textContent = "Adding…";

      fetch(proxyUrl + "/cart", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          rentalProductId: state.rentalProductId,
          startDate: state.startDate,
          endDate: state.endDate,
          quantity: state.quantity,
          shop: shop,
        }),
      })
        .then(function (r) {
          if (!r.ok) throw new Error("HTTP " + r.status);
          return r.json();
        })
        .then(function (data) {
          if (data.error) {
            errorDiv.textContent = data.error;
            addBtn.disabled = false;
            addBtn.textContent = "Add Rental to Cart";
            return;
          }

          // Add to Shopify cart via AJAX API
          var formData = {
            items: [
              {
                id: parseInt(data.variantId),
                quantity: data.quantity,
                properties: data.properties,
              },
            ],
          };

          return fetch("/cart/add.js", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(formData),
          });
        })
        .then(function (r) {
          if (r && r.ok) {
            addBtn.textContent = "Added to Cart!";
            setTimeout(function () {
              addBtn.disabled = false;
              addBtn.textContent = "Add Rental to Cart";
            }, 2000);
          }
        })
        .catch(function (err) {
          console.error("Add to cart error:", err);
          errorDiv.textContent = "Failed to add to cart. Please try again.";
          addBtn.disabled = false;
          addBtn.textContent = "Add Rental to Cart";
        });
    });

    function checkDates() {
      errorDiv.textContent = "";
      availDiv.textContent = "Checking availability…";
      availDiv.className = "rental-widget__availability";
      summaryDiv.style.display = "none";
      addBtn.disabled = true;
      addBtn.textContent = "Checking…";

      // Validate duration constraints
      var diffDays = Math.ceil(
        (new Date(state.endDate) - new Date(state.startDate)) / (1000 * 60 * 60 * 24)
      );

      if (product.durationUnit === "days") {
        if (diffDays < product.minDuration) {
          errorDiv.textContent = "Minimum rental duration is " + product.minDuration + " days.";
          availDiv.textContent = "";
          return;
        }
        if (diffDays > product.maxDuration) {
          errorDiv.textContent = "Maximum rental duration is " + product.maxDuration + " days.";
          availDiv.textContent = "";
          return;
        }
      }

      // Check availability and price in parallel
      Promise.all([
        fetch(proxyUrl + "/availability", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rentalProductId: state.rentalProductId,
            startDate: state.startDate,
            endDate: state.endDate,
            shop: shop,
          }),
        }).then(function (r) {
          if (!r.ok) throw new Error("Availability check failed: HTTP " + r.status);
          return r.json();
        }),
        fetch(proxyUrl + "/price", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            rentalProductId: state.rentalProductId,
            startDate: state.startDate,
            endDate: state.endDate,
          }),
        }).then(function (r) {
          if (!r.ok) throw new Error("Price check failed: HTTP " + r.status);
          return r.json();
        }),
      ])
        .then(function (results) {
          var avail = results[0];
          var pricing = results[1];

          state.available = avail.available && (avail.availableQty >= state.quantity);
          state.price = pricing;

          if (!avail.available) {
            availDiv.className = "rental-widget__availability rental-widget__availability--unavailable";
            availDiv.textContent = avail.reason || "Not available for selected dates.";
            addBtn.disabled = true;
            addBtn.textContent = "Unavailable";
            return;
          }

          if (avail.availableQty < state.quantity) {
            availDiv.className = "rental-widget__availability rental-widget__availability--unavailable";
            availDiv.textContent = "Only " + avail.availableQty + " available for these dates.";
            addBtn.disabled = true;
            addBtn.textContent = "Unavailable";
            return;
          }

          availDiv.className = "rental-widget__availability rental-widget__availability--available";
          availDiv.textContent = avail.availableQty + " of " + avail.totalQty + " available";

          var totalPrice = (pricing.price * state.quantity).toFixed(2);
          var totalDeposit = (pricing.deposit * state.quantity).toFixed(2);

          var summaryHtml =
            '<div class="rental-widget__summary-row">' +
              '<span class="rental-widget__summary-label">' + pricing.duration + " " + pricing.unit + " × " + state.quantity + '</span>' +
              '<span class="rental-widget__summary-value">$' + totalPrice + '</span>' +
            '</div>';

          if (pricing.deposit > 0) {
            summaryHtml +=
              '<div class="rental-widget__summary-row">' +
                '<span class="rental-widget__summary-label">Deposit</span>' +
                '<span class="rental-widget__summary-value">$' + totalDeposit + '</span>' +
              '</div>';
          }

          summaryHtml +=
            '<div class="rental-widget__summary-row rental-widget__summary-total">' +
              '<span>Total</span>' +
              '<span>$' + totalPrice + '</span>' +
            '</div>';

          summaryDiv.innerHTML = summaryHtml;
          summaryDiv.style.display = "flex";
          addBtn.disabled = false;
          addBtn.textContent = "Add Rental to Cart — $" + totalPrice;
        })
        .catch(function (err) {
          console.error("Date check error:", err);
          errorDiv.textContent = "Unable to check availability. Please try again.";
          addBtn.disabled = true;
          addBtn.textContent = "Select dates to rent";
        });
    }
  }
})();
