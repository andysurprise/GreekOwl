// ===============================
// GreekOwl — Polygon Per-Expiry Engine
// ===============================
const API_KEY = "Ce7nCyUCeVo3TCmPNmycD99VG6gcMYCJ";

let ticker = "";
let expiries = [];
let contracts = [];

// DOM element references - will be initialized after DOM loads
let tickerInput;
let loadBtn;
let expirySelect;
let ladderBody;

// ---------- INITIALIZE AFTER DOM LOADS ----------
document.addEventListener('DOMContentLoaded', () => {
  tickerInput = document.getElementById("tickerInput");
  loadBtn = document.getElementById("loadBtn");
  expirySelect = document.getElementById("expirySelect");
  ladderBody = document.getElementById("optionsBody");
  
  // ---------- HARD BIND LOAD ----------
  loadBtn.addEventListener("click", () => {
    ticker = tickerInput.value.trim().toUpperCase();
    if (!ticker) return alert("Enter a ticker");
    console.log("Loading ticker:", ticker);
    fetchExpirations();
  });
});

// ---------- FETCH EXPIRATIONS ----------
async function fetchExpirations() {
  expirySelect.innerHTML = "";
  ladderBody.innerHTML = "";
  
  const url =
    `https://api.polygon.io/v3/reference/options/contracts?` +
    `underlying_ticker=${ticker}&limit=20&apiKey=${API_KEY}`;
  
  console.log("Fetching expiries…");
  
  try {
    const res = await fetch(url);
    const json = await res.json();
    
    if (!json.results) {
      console.error("No expiries returned", json);
      alert("No options data available");
      return;
    }
    
    expiries = [...new Set(json.results.map(r => r.expiration_date))];
    
    expiries.forEach(d => {
      const opt = document.createElement("option");
      opt.value = d;
      opt.textContent = d;
      expirySelect.appendChild(opt);
    });
    
    expirySelect.onchange = fetchContractsForExpiry;
    fetchContractsForExpiry();
  } catch (error) {
    console.error("Error fetching expirations:", error);
    alert("Failed to fetch options data");
  }
}

// ---------- FETCH CONTRACTS FOR ONE EXPIRY ----------
async function fetchContractsForExpiry() {
  const expiry = expirySelect.value;
  ladderBody.innerHTML = "";
  
  const url =
    `https://api.polygon.io/v3/reference/options/contracts?` +
    `underlying_ticker=${ticker}` +
    `&expiration_date=${expiry}` +
    `&limit=50&apiKey=${API_KEY}`;
  
  console.log("Fetching contracts for", expiry);
  
  try {
    const res = await fetch(url);
    const json = await res.json();
    
    if (!json.results) {
      console.error("No contracts", json);
      return;
    }
    
    contracts = json.results;
    buildLadder();
  } catch (error) {
    console.error("Error fetching contracts:", error);
  }
}

// ---------- BUILD OPTIONS LADDER ----------
function buildLadder() {
  const byStrike = {};
  
  contracts.forEach(c => {
    const k = c.strike_price;
    byStrike[k] ??= {};
    byStrike[k][c.contract_type] = c;
  });
  
  Object.keys(byStrike)
    .sort((a, b) => a - b)
    .forEach(strike => {
      const row = document.createElement("tr");
      const call = byStrike[strike].call;
      const put = byStrike[strike].put;
      
      row.innerHTML = `
        <td>${strike}</td>
        <td>${call?.bid ?? "-"}</td>
        <td>${call?.ask ?? "-"}</td>
        <td>${put?.bid ?? "-"}</td>
        <td>${put?.ask ?? "-"}</td>
      `;
      
      ladderBody.appendChild(row);
    });
  
  console.log("Ladder rendered");
}
