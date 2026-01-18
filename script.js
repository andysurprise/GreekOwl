// ===============================
// GreekOwl - Options Chain Viewer
// ===============================

const API_KEY = "Ce7nCyUCeVo3TCmPNmycD99VG6gcMYCJ";

let ticker = "";
let stockPrice = null;
let expiries = [];
let contracts = [];

const elements = {
  tickerInput: document.getElementById("tickerInput"),
  loadBtn: document.getElementById("loadBtn"),
  expirySelect: document.getElementById("expirySelect"),
  optionsBody: document.getElementById("optionsBody"),
  stockPrice: document.getElementById("stockPrice"),
  dataStatus: document.getElementById("dataStatus")
};

// Event Listeners
elements.loadBtn.addEventListener("click", handleLoad);
elements.tickerInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") handleLoad();
});
elements.expirySelect.addEventListener("change", fetchContracts);

// Auto-uppercase input
elements.tickerInput.addEventListener("input", (e) => {
  e.target.value = e.target.value.toUpperCase();
});

async function handleLoad() {
  ticker = elements.tickerInput.value.trim().toUpperCase();
  if (!ticker) {
    alert("Enter a ticker");
    return;
  }

  elements.loadBtn.disabled = true;
  elements.loadBtn.textContent = "Loading...";
  
  try {
    await fetchStockPrice();
    await fetchExpirations();
  } catch (error) {
    console.error("Full error:", error);
    alert("Error loading data: " + error.message + "\n\nCheck console for details (F12)");
  } finally {
    elements.loadBtn.disabled = false;
    elements.loadBtn.textContent = "Load";
  }
}

async function fetchStockPrice() {
  try {
    const url = `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${API_KEY}`;
    console.log("Fetching stock price:", url);
    const res = await fetch(url);
    const data = await res.json();
    
    console.log("Stock price response:", data);
    
    if (data.results && data.results.length > 0) {
      stockPrice = data.results[0].c;
      elements.stockPrice.textContent = `${ticker}: $${stockPrice.toFixed(2)}`;
    } else if (data.status === "ERROR") {
      console.warn("Stock price API error:", data.error);
    }
  } catch (error) {
    console.warn("Could not fetch stock price:", error);
  }
}

async function fetchExpirations() {
  elements.optionsBody.innerHTML = '<tr><td colspan="7" class="loading">Loading expirations...</td></tr>';
  
  const url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&limit=250&apiKey=${API_KEY}`;
  console.log("Fetching expirations:", url);
  
  const res = await fetch(url);
  const data = await res.json();
  
  console.log("Expirations response:", data);

  if (res.status === 404 || data.status === "NOT_FOUND") {
    throw new Error(`${ticker} not found or has no options contracts available`);
  }

  if (data.status === "ERROR") {
    throw new Error(data.message || data.error || "API Error");
  }

  if (!data.results || data.results.length === 0) {
    throw new Error(`No options found for ${ticker}. Make sure the ticker is correct and has options.`);
  }

  expiries = [...new Set(data.results.map(r => r.expiration_date))].sort();
  
  elements.expirySelect.innerHTML = "";
  elements.expirySelect.disabled = false;
  
  expiries.forEach(date => {
    const opt = document.createElement("option");
    opt.value = date;
    opt.textContent = date;
    elements.expirySelect.appendChild(opt);
  });

  elements.dataStatus.textContent = `${expiries.length} expirations`;
  fetchContracts();
}

async function fetchContracts() {
  const expiry = elements.expirySelect.value;
  elements.optionsBody.innerHTML = '<tr><td colspan="7" class="loading">Loading options chain...</td></tr>';

  const url = `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&expiration_date=${expiry}&limit=1000&apiKey=${API_KEY}`;
  console.log("Fetching contracts:", url);
  
  const res = await fetch(url);
  const data = await res.json();
  
  console.log("Contracts response:", data);

  if (data.status === "ERROR") {
    alert("API Error: " + (data.error || "Unknown error"));
    elements.optionsBody.innerHTML = '<tr><td colspan="7" class="loading">Error loading data</td></tr>';
    return;
  }

  if (!data.results || data.results.length === 0) {
    elements.optionsBody.innerHTML = '<tr><td colspan="7" class="loading">No contracts found</td></tr>';
    return;
  }

  contracts = data.results;
  elements.dataStatus.textContent = `${contracts.length} contracts`;
  buildLadder();
}

function buildLadder() {
  const byStrike = {};
  
  contracts.forEach(c => {
    const k = c.strike_price;
    if (!byStrike[k]) byStrike[k] = {};
    byStrike[k][c.contract_type] = c;
  });

  const strikes = Object.keys(byStrike).map(Number).sort((a, b) => a - b);
  
  let atmStrike = null;
  if (stockPrice) {
    atmStrike = strikes.reduce((prev, curr) => 
      Math.abs(curr - stockPrice) < Math.abs(prev - stockPrice) ? curr : prev
    );
  }

  elements.optionsBody.innerHTML = "";

  strikes.forEach(strike => {
    const row = document.createElement("tr");
    const call = byStrike[strike].call;
    const put = byStrike[strike].put;
    
    if (atmStrike && Math.abs(strike - atmStrike) < 0.01) {
      row.classList.add("atm-strike");
    }

    row.innerHTML = `
      <td>${format(call?.details?.volume, 0)}</td>
      <td>${format(call?.bid)}</td>
      <td>${format(call?.ask)}</td>
      <td class="strike">$${strike.toFixed(2)}</td>
      <td>${format(put?.bid)}</td>
      <td>${format(put?.ask)}</td>
      <td>${format(put?.details?.volume, 0)}</td>
    `;
    
    elements.optionsBody.appendChild(row);
  });

  console.log(`Ladder built with ${strikes.length} strikes`);
}

function format(val, decimals = 2) {
  if (!val) return "-";
  return decimals === 0 ? val.toLocaleString() : `$${val.toFixed(decimals)}`;
}
