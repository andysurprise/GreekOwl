// script.js — Polygon Snapshot version

const POLY_KEY = "Ce7nCyUCeVo3TCmPNmycD99VG6gcMYCJ";
let snapshotData = {};
let chartUnder, chartTime, chartVol;

// Helper to fetch Polygon snapshot
async function fetchPolygonSnapshot(ticker) {
  const url = `https://api.polygon.io/v3/snapshot/options/${ticker}?apiKey=${POLY_KEY}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch data from Polygon");
  const data = await res.json();
  return data;
}

async function loadTicker() {
  const ticker = tickerInput.value.trim().toUpperCase();
  errorMsg.textContent = "";
  if (!ticker) return;

  try {
    const data = await fetchPolygonSnapshot(ticker);
    if (!data.snapshot) throw new Error("No snapshot returned");

    snapshotData.raw = data.snapshot;
    snapshotData.underlying = data.snapshot.underlying.last.quote;
    priceDisplay.textContent = `Price: $${snapshotData.underlying}`;

    // Extract unique expiries
    let expiries = [
      ...new Set(data.snapshot.options.map((opt) => opt.expiration_date)),
    ];
    expiries.sort();

    expirySelect.innerHTML = "";
    expiries.forEach((exp) => {
      const opt = document.createElement("option");
      opt.value = exp;
      opt.textContent = exp;
      expirySelect.appendChild(opt);
    });

    // Build table for first expiry
    buildTableForExpiry(expiries[0]);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = err.message;
  }
}

// Build ladder filtered locally
function buildTableForExpiry(exp) {
  const tableBody = document.querySelector("#optionsTable tbody");
  tableBody.innerHTML = "";

  const allOpts = snapshotData.raw.options;
  const spot = snapshotData.underlying;

  // Filter to this expiry
  const calls = allOpts.filter((o) => o.option_type === "call" && o.expiration_date === exp);
  const puts  = allOpts.filter((o) => o.option_type === "put"  && o.expiration_date === exp);

  // Sort by strike
  calls.sort((a, b) => a.strike_price - b.strike_price);
  puts.sort((a, b) => a.strike_price - b.strike_price);

  for (let i = 0; i < calls.length; i++) {
    const row = document.createElement("tr");
    const c = calls[i], p = puts[i];
    row.innerHTML = `
      <td>${c.strike_price.toFixed(2)}</td>
      <td data-type="call" data-strike="${c.strike_price}">${c.bid}</td>
      <td data-type="call" data-strike="${c.strike_price}">${c.ask}</td>
      <td data-type="put" data-strike="${p.strike_price}">${p.bid}</td>
      <td data-type="put" data-strike="${p.strike_price}">${p.ask}</td>
    `;
    row.querySelectorAll("td[data-type]").forEach((cell) => {
      cell.addEventListener("click", () =>
        drawGreeksForOption(exp, cell.dataset.type, Number(cell.dataset.strike))
      );
    });
    tableBody.appendChild(row);
  }
}

function drawGreeksForOption(exp, type, strike) {
  const allOpts = snapshotData.raw.options.filter(
    (o) => o.expiration_date === exp && o.strike_price === strike && o.option_type === type
  );

  if (allOpts.length === 0) return;
  const opt = allOpts[0];

  const prices = [], deltaArr = [], gammaArr = [], thetaArr = [], vegaArr = [];

  // Build Greek curves around underlying price
  const spot = snapshotData.underlying;
  for (let i = -10; i <= 10; i++) {
    const price = spot * (1 + i / 50);
    const matchingOpt = snapshotData.raw.options.find(
      (o) =>
        o.expiration_date === exp &&
        o.strike_price === strike &&
        o.option_type === type
    );
    if (!matchingOpt) continue;

    prices.push(price.toFixed(2));
    deltaArr.push(matchingOpt.delta);
    gammaArr.push(matchingOpt.gamma);
    thetaArr.push(matchingOpt.theta);
    vegaArr.push(matchingOpt.vega);
  }

  renderChart(chartUnder, "chartUnder", prices, deltaArr, gammaArr, thetaArr, vegaArr);
  chartPanel.style.display = "block";
}

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

// Listeners
loadBtn.addEventListener("click", loadTicker);
expirySelect.addEventListener("change", () =>
  buildTableForExpiry(expirySelect.value)
);
