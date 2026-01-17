// script.js
let optionData = {};
let chartUnder, chartTime, chartVol;

// --- Math helpers (Black–Scholes) ---
function normalCDF(x) {
  let t = 1 / (1 + 0.2316419 * Math.abs(x));
  let d = 0.3989423 * Math.exp(-x * x / 2);
  let prob = d * t *
    (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
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

// --- Data Fetching ---
async function loadTicker() {
  const ticker = tickerInput.value.trim().toUpperCase();
  errorMsg.textContent = '';
  if (!ticker) return;

  try {
    const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/options/${ticker}`);
    if (!res.ok) throw new Error('Invalid ticker');

    const json = await res.json();
    const result = json.optionChain.result[0];

    optionData.underlying = result.quote.regularMarketPrice;
    optionData.expiries = result.expirationDates;

    priceDisplay.textContent = `Price: $${optionData.underlying.toFixed(2)}`;

    expirySelect.innerHTML = '';
    optionData.expiries.forEach(ts => {
      const opt = document.createElement('option');
      opt.value = ts;
      opt.textContent = new Date(ts * 1000).toLocaleDateString();
      expirySelect.appendChild(opt);
    });

    loadExpiry();
  } catch (e) {
    errorMsg.textContent = e.message;
  }
}

async function loadExpiry() {
  const ticker = tickerInput.value.trim().toUpperCase();
  const date = expirySelect.value;

  const res = await fetch(`https://query1.finance.yahoo.com/v7/finance/options/${ticker}?date=${date}`);
  const json = await res.json();
  const opt = json.optionChain.result[0].options[0];

  optionData.calls = opt.calls;
  optionData.puts = opt.puts;
  optionData.expiry = date;

  renderTable();
}

// --- UI ---
function renderTable() {
  const tbody = document.querySelector('#optionsTable tbody');
  tbody.innerHTML = '';

  const spot = optionData.underlying;
  const calls = optionData.calls;
  const puts = optionData.puts;

  let atm = calls.findIndex(c => c.strike >= spot);
  atm = Math.max(5, atm);

  for (let i = atm - 5; i <= atm + 5; i++) {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>${calls[i].strike}</td>
      <td data-type="call" data-strike="${calls[i].strike}">${calls[i].bid}</td>
      <td data-type="call" data-strike="${calls[i].strike}">${calls[i].ask}</td>
      <td data-type="put" data-strike="${puts[i].strike}">${puts[i].bid}</td>
      <td data-type="put" data-strike="${puts[i].strike}">${puts[i].ask}</td>
    `;
    row.querySelectorAll('td[data-type]').forEach(td => {
      td.addEventListener('click', () => drawGreeks(td.dataset.type, Number(td.dataset.strike)));
    });
    tbody.appendChild(row);
  }
}

// --- Charts ---
function drawGreeks(type, strike) {
  const isCall = type === 'call';
  const S0 = optionData.underlying;
  const r = 0.01;
  const vol = 0.2;

  const T = (optionData.expiry - Date.now() / 1000) / (365 * 24 * 3600);
  if (T <= 0) return;

  const prices = [], delta = [], gamma = [], theta = [], vega = [];

  for (let i = -10; i <= 10; i++) {
    const S = S0 * (1 + i / 50);
    const g = calcGreeks(S, strike, T, r, vol, isCall);
    prices.push(S.toFixed(2));
    delta.push(g.delta);
    gamma.push(g.gamma);
    theta.push(g.theta);
    vega.push(g.vega);
  }

  renderChart(chartUnder, 'chartUnder', prices, delta, gamma, theta, vega);
  chartPanel.style.display = 'block';
}

function renderChart(existing, id, labels, d, g, t, v) {
  if (existing) existing.destroy();
  const ctx = document.getElementById(id);
  const chart = new Chart(ctx, {
    type: 'line',
    data: {
      labels,
      datasets: [
        { label: 'Delta', data: d },
        { label: 'Gamma', data: g },
        { label: 'Theta', data: t },
        { label: 'Vega', data: v }
      ]
    },
    options: {
      plugins: { legend: { labels: { color: '#fff' } } },
      scales: {
        x: { ticks: { color: '#fff' } },
        y: { ticks: { color: '#fff' } }
      }
    }
  });

  if (id === 'chartUnder') chartUnder = chart;
}

// --- Events ---
loadBtn.addEventListener('click', loadTicker);
expirySelect.addEventListener('change', loadExpiry);
