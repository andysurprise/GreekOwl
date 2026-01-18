// script.js

const API_KEY = "Ce7nCyUCeVo3TCmPNmycD99VG6gcMYCJ";

const tickerInput = document.getElementById("tickerInput");
const loadBtn     = document.getElementById("loadBtn");
const expirySelect= document.getElementById("expirySelect");
const optionsBody = document.getElementById("optionsBody");
const priceDisplay= document.getElementById("priceDisplay");
const errorMsg    = document.getElementById("errorMsg");
let greeksChart;

loadBtn.addEventListener("click", loadTicker);

// --- Fetch and populate expiries ---
async function loadTicker() {
  const ticker = tickerInput.value.trim().toUpperCase();
  if (!ticker) return;

  errorMsg.textContent = "";
  priceDisplay.textContent = "";

  try {
    const quoteRes = await fetch(
      `https://api.polygon.io/v2/aggs/ticker/${ticker}/prev?apiKey=${API_KEY}`
    );
    const quoteJson = await quoteRes.json();
    if (quoteJson.results && quoteJson.results.length) {
      priceDisplay.textContent = `Spot: $${quoteJson.results[0].c.toFixed(2)}`;
    }

    const expRes = await fetch(
      `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}&limit=500&apiKey=${API_KEY}`
    );
    const expJson = await expRes.json();
    if (!expJson.results) {
      errorMsg.textContent = "No option contracts found";
      return;
    }

    const expiries = [...new Set(expJson.results.map(o => o.expiration_date))].sort();
    expirySelect.innerHTML = "";
    expiries.forEach(d => {
      const o = document.createElement("option");
      o.value = d;
      o.textContent = d;
      expirySelect.appendChild(o);
    });

    expirySelect.onchange = () => buildLadder(ticker, expirySelect.value);
    if (expiries.length) buildLadder(ticker, expiries[0]);
  } catch (err) {
    console.error(err);
    errorMsg.textContent = "Failed to load data";
  }
}

// --- Build ladder ---
async function buildLadder(ticker, expiry) {
  optionsBody.innerHTML = "";

  try {
    const res = await fetch(
      `https://api.polygon.io/v3/reference/options/contracts?underlying_ticker=${ticker}` +
      `&expiration_date=${expiry}&limit=500&apiKey=${API_KEY}`
    );
    const json = await res.json();
    const data = json.results || [];

    const byStrike = {};
    data.forEach(c => {
      const k = c.strike_price;
      byStrike[k] ??= { strike: k };
      byStrike[k][c.contract_type] = c;
    });

    const strikes = Object.keys(byStrike).sort((a,b) => a - b);
    strikes.forEach(k => {
      const { call, put } = byStrike[k];
      const row = document.createElement("tr");
      row.innerHTML = `
        <td>${k}</td>
        <td>-</td><td>-</td>
        <td>-</td><td>-</td>
      `;
      row.onclick = () => showGreeks(call, put, Number(k));
      optionsBody.appendChild(row);
    });

  } catch (err) {
    console.error(err);
  }
}

// --- Compute and show Greeks locally ---
function showGreeks(call, put, strike) {
  const S = parseFloat(priceDisplay.textContent.replace("Spot: $","")) || 0;
  const vol = 0.25; // synthetic
  const r = 0.01;
  const T = 30/365;

  function normalPDF(x) {
    return Math.exp(-0.5*x*x)/Math.sqrt(2*Math.PI);
  }
  function normalCDF(x) {
    return (1 + Math.erf(x/Math.sqrt(2))) / 2;
  }
  function bsGreeks(S,K,T,r,v,isCall) {
    const d1 = (Math.log(S/K)+(r+0.5*v*v)*T)/(v*Math.sqrt(T));
    const d2 = d1 - v*Math.sqrt(T);
    const delta = isCall ? normalCDF(d1) : normalCDF(d1)-1;
    const gamma = normalPDF(d1)/(S*v*Math.sqrt(T));
    const theta = 0;
    const vega  = S * normalPDF(d1) * Math.sqrt(T);
    return {delta,gamma,theta,vega};
  }

  const data = [
    bsGreeks(S,strike,T,r,vol,true),
    bsGreeks(S,strike,T,r,vol,false)
  ];

  if (greeksChart) greeksChart.destroy();
  greeksChart = new Chart(document.getElementById("greeksChart"), {
    type: "bar",
    data: {
      labels: ["Call Δ","Call Γ","Put Δ","Put Γ"],
      datasets: [{
        label: `${strike}`,
        data: [
          data[0].delta, data[0].gamma,
          data[1].delta, data[1].gamma
        ],
        backgroundColor: ["#4CAF50","#2196F3","#FF5722","#9C27B0"]
      }]
    }
  });
}
