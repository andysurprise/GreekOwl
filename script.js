// script.js
let optionData = {};
let chartUnder, chartTime, chartVol;

// ----- Helpers: Black–Scholes Greeks -----
function normalCDF(x) {
  let t = 1 / (1 + 0.2316419 * Math.abs(x));
  let d = 0.3989423 * Math.exp(-x * x / 2);
  let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
  return x > 0 ? 1 - prob : prob;
}
function normalPDF(x) {
  return Math.exp(-0.5 * x * x) / Math.sqrt(2 * Math.PI);
}
function calcGreeks(S, K, T, r, v, isCall) {
  const d1 = (Math.log(S / K) + (r + 0.5 * v * v) * T) / (v * Math.sqrt(T));
  const d2 = d1 - v * Math.sqrt(T);
  const delta = isCall ? normalCDF(d1) : normalCDF(d1) - 1;
  const gamma = normalPDF(d1) / (S * v * Math.sqrt(T));
  let theta = -(S * normalPDF(d1) * v) / (2 * Math.sqrt(T));
  theta += isCall
    ? -r * K * Math.exp(-r * T) * normalCDF(d2)
    : r * K * Math.exp(-r * T) * normalCDF(-d2);
  const vega = S * normalPDF(d1) * Math.sqrt(T);
  return { delta, gamma, theta: theta / 365, vega };
}

// ----- Fetching with CORS Proxy -----
async function fetchWithProxy(url) {
  // Using public CORS proxy to bypass Yahoo Finance restrictions
  const proxy = "https://api.allorigins.win/raw?url=";
  const finalUrl = proxy + encodeURIComponent(url);

  const response = await fetch(finalUrl);
  const data = await response.json();
  return data;
}

// ----- Load ticker + expirations -----
async function loadTicker() {
  const ticker = tickerInput.value.trim().toUpperCase();
  errorMsg.textContent = "";

  if (!ticker) return;

  try {
    // Yahoo options endpoint (proxied)
    const data = await fetchWithProxy(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}`
    );

    const result = data.optionChain.result[0];
    const quote = result.quote;
    optionData.underlying = quote.regularMarketPrice;
    optionData.expiries = result.expirationDates;

    priceDisplay.textContent = `Price: $${optionData.underlying.toFixed(2)}`;

    expirySelect.innerHTML = "";
    optionData.expiries.forEach((ts) => {
      const opt = document.createElement("option");
      opt.value = ts;
      opt.textContent = new Date(ts * 1000).toLocaleDateString();
      expirySelect.appendChild(opt);
    });

    // Load the first expiry
    loadExpiry();
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Failed to fetch data — try again later";
  }
}

async function loadExpiry() {
  const ticker = tickerInput.value.trim().toUpperCase();
  const date = expirySelect.value;
  if (!ticker || !date) return;

  try {
    // Fetch options chain for selected expiry
    const data = await fetchWithProxy(
      `https://query1.finance.yahoo.com/v7/finance/options/${ticker}?date=${date}`
    );

    const opt = data.optionChain.result[0].options[0];
    optionData.calls = opt.calls;
    optionData.puts = opt.puts;
    optionData.expiry = date;

    renderTable();
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Failed to load expiry data";
  }
}

// ----- Build Options Ladder -----
function renderTable() {
  const tbody = document.querySelector("#optionsTable tbody");
  tbody.innerHTML = "";

  const spot = optionData.underlying;
  const calls = optionData.calls;
  const puts = optionData.puts;

  if (!calls || !puts) return;

  let atmIndex = calls.findIndex((c) => c.strike >= spot);
  atmIndex = atmIndex < 0 ? 0 : atmIndex;
  const start = Math.max(0, atmIndex - 5);
  const end = Math.min(calls.length, atmIndex + 6);

  for (let i = start; i < end; i++) {
    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${calls[i].strike.toFixed(2)}</td>
      <td data-type="call" data-strike="${calls[i].strike.toFixed(2)}">${calls[i].bid.toFixed(2)}</td>
      <td data-type="call" data-strike="${calls[i].strike.toFixed(2)}">${calls[i].ask.toFixed(2)}</td>
      <td data-type="put" data-strike="${puts[i].strike.toFixed(2)}">${puts[i].bid.toFixed(2)}</td>
      <td data-type="put" data-strike="${puts[i].strike.toFixed(2)}">${puts[i].ask.toFixed(2)}</td>
    `;
    row.querySelectorAll("td[data-type]").forEach((cell) => {
      cell.addEventListener("click", () =>
        drawGreeks(cell.dataset.type, Number(cell.dataset.strike))
      );
    });
    tbody.appendChild(row);
  }
}

// ----- Draw the Greek Charts -----
function drawGreeks(type, strike) {
  const isCall = type === "call";
  const S0 = optionData.underlying;
  const r = 0.01; // risk-free rate assumption
  const vol = 0.2; // placeholder IV

  const T =
    (optionData.expiry - Date.now() / 1000) / (365 * 24 * 3600);
  if (T <= 0) return;

  const prices = [],
    deltaArr = [],
    gammaArr = [],
    thetaArr = [],
    vegaArr = [];

  for (let i = -10; i <= 10; i++) {
    const S = S0 * (1 + i / 50);
    const g = calcGreeks(S, strike, T, r, vol, isCall);
    prices.push(S.toFixed(2));
    deltaArr.push(g.delta);
    gammaArr.push(g.gamma);
    thetaArr.push(g.theta);
    vegaArr.push(g.vega);
  }

  renderChart(chartUnder, "chartUnder", prices, deltaArr, gammaArr, thetaArr, vegaArr);
  chartPanel.style.display = "block";
}

// ----- Chart Rendering -----
function renderChart(existing, id, labels, d, g, t, v) {
  if (existing) existing.destroy();
  const ctx = document.getElementById(id);
  return new Chart(ctx, {
    type: "line",
    data: {
      labels,
      datasets: [
        { label: "Delta", data: d, borderColor: "#ff9800" },
        { label: "Gamma", data: g, borderColor: "#a832a5" },
        { label: "Theta", data: t, borderColor: "#33ff99" },
        { label: "Vega", data: v, borderColor: "#3399ff" },
      ],
    },
    options: {
      plugins: { legend: { labels: { color: "#fff" } } },
      scales: {
        x: { ticks: { color: "#fff" } },
        y: { ticks: { color: "#fff" } },
      },
    },
  });
}

// ----- Event Listeners -----
loadBtn.addEventListener("click", loadTicker);
expirySelect.addEventListener("change", loadExpiry);
