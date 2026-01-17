// script.js — Polygon FREE-tier compatible

const POLY_KEY = "Ce7nCyUCeVo3TCmPNmycD99VG6gcMYCJ";
const STRIKES_AROUND = 5;

let contracts = [];
let spotPrice = null;
let greeksChart = null;

// ---------- Helpers ----------

async function polyFetch(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Polygon error ${res.status}`);
  return res.json();
}

// ---------- Load Ticker ----------

async function loadTicker() {
  const ticker = tickerInput.value.trim().toUpperCase();
  errorMsg.textContent = "";
  optionsTableBody.innerHTML = "";
  chartPanel.style.display = "none";

  if (!ticker) return;

  try {
    // 1) Get spot price
    const quote = await polyFetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${POLY_KEY}`
    );
    spotPrice = quote.results[0].c;
    priceDisplay.textContent = `Price: $${spotPrice.toFixed(2)}`;

    // 2) Get option contracts
    const contractsResp = await polyFetch(
      `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&limit=1000&apiKey=${POLY_KEY}`
    );
    contracts = contractsResp.results;

    // 3) Populate expiries
    const expiries = [...new Set(contracts.map(c => c.expiration_date))].sort();
    expirySelect.innerHTML = "";
    expiries.forEach(exp => {
      const o = document.createElement("option");
      o.value = exp;
      o.textContent = exp;
      expirySelect.appendChild(o);
    });

    buildLadder(expiries[0]);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = err.message;
  }
}

// ---------- Build Options Ladder ----------

async function buildLadder(expiry) {
  optionsTableBody.innerHTML = "";

  const expContracts = contracts.filter(c => c.expiration_date === expiry);

  // Get strikes closest to spot
  const strikes = [...new Set(expContracts.map(c => c.strike_price))]
    .sort((a, b) => a - b);

  const nearestIndex = strikes.reduce(
    (best, s, i) =>
      Math.abs(s - spotPrice) < Math.abs(strikes[best] - spotPrice) ? i : best,
    0
  );

  const selectedStrikes = strikes.slice(
    Math.max(0, nearestIndex - STRIKES_AROUND),
    nearestIndex + STRIKES_AROUND + 1
  );

  for (const strike of selectedStrikes) {
    const call = expContracts.find(
      c => c.strike_price === strike && c.contract_type === "call"
    );
    const put = expContracts.find(
      c => c.strike_price === strike && c.contract_type === "put"
    );

    const callSnap = call
      ? await fetchSnapshot(call.ticker)
      : null;
    const putSnap = put
      ? await fetchSnapshot(put.ticker)
      : null;

    const row = document.createElement("tr");
    row.innerHTML = `
      <td>${strike.toFixed(2)}</td>
      <td class="clickable">${callSnap?.last_quote?.bid ?? "-"}</td>
      <td class="clickable">${callSnap?.last_quote?.ask ?? "-"}</td>
      <td class="clickable">${putSnap?.last_quote?.bid ?? "-"}</td>
      <td class="clickable">${putSnap?.last_quote?.ask ?? "-"}</td>
    `;

    row.querySelectorAll(".clickable").forEach((cell, idx) => {
      const snap = idx < 2 ? callSnap : putSnap;
      if (snap?.greeks) {
        cell.addEventListener("click", () =>
          renderGreeksChart(snap.greeks, strike)
        );
      }
    });

    optionsTableBody.appendChild(row);
  }
}

// ---------- Per-Contract Snapshot ----------

async function fetchSnapshot(optionTicker) {
  try {
    const snap = await polyFetch(
      `https://api.polygon.io/v3/snapshot/options/${optionTicker}?apiKey=${POLY_KEY}`
    );
    return snap.results;
  } catch {
    return null;
  }
}

// ---------- Greeks Chart ----------

function renderGreeksChart(greeks, strike) {
  chartPanel.style.display = "block";
  if (greeksChart) greeksChart.destroy();

  const ctx = document.getElementById("chartUnder");
  greeksChart = new Chart(ctx, {
    type: "bar",
    data: {
      labels: ["Delta", "Gamma", "Theta", "Vega", "Rho"],
      datasets: [{
        label: `Greeks @ ${strike}`,
        data: [
          greeks.delta,
          greeks.gamma,
          greeks.theta,
          greeks.vega,
          greeks.rho
        ]
      }]
    },
    options: {
      plugins: {
        legend: { labels: { color: "#fff" } }
      },
      scales: {
        x: { ticks: { color: "#fff" } },
        y: { ticks: { color: "#fff" } }
      }
    }
  });
}

// ---------- Events ----------

loadBtn.addEventListener("click", loadTicker);
expirySelect.addEventListener("change", () =>
  buildLadder(expirySelect.value)
);
