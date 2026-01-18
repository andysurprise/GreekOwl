// GreekOwl — Terminal Mode Upgrade

// ---- Existing globals assumed ----
// ladder[], contracts[], spot, currentExpiry, etc.

let selectedOption = null;
let volChart = null;
let plChart = null;

// ---------- Command Bar ----------

commandInput.addEventListener("keydown", e => {
  if (e.key !== "Enter") return;

  const parts = commandInput.value.trim().toUpperCase().split(/\s+/);
  commandInput.value = "";

  if (parts.length >= 1) {
    tickerInput.value = parts[0];
    loadTicker();
  }

  if (parts.length >= 2) {
    setTimeout(() => {
      expirySelect.value = parts[1];
      currentExpiry = parts[1];
      buildLadder();
    }, 500);
  }

  if (parts.length >= 4) {
    const type = parts[2] === "C" ? "call" : "put";
    const strike = Number(parts[3]);
    setTimeout(() => {
      const row = ladder.find(r => r.strike === strike);
      if (row) showGreeks(row[type], strike);
    }, 1200);
  }
});

// ---------- Volatility Smile ----------

function renderVolSmile() {
  if (!ladder.length) return;
  if (volChart) volChart.destroy();

  const strikes = ladder.map(r => r.strike);
  const callIV = ladder.map(r => r.call?.implied_volatility ?? null);
  const putIV  = ladder.map(r => r.put?.implied_volatility ?? null);

  volChart = new Chart(volChartEl, {
    type: "line",
    data: {
      labels: strikes,
      datasets: [
        { label: "Call IV", data: callIV, borderWidth: 2 },
        { label: "Put IV", data: putIV, borderWidth: 2 }
      ]
    },
    options: {
      plugins:{ legend:{ labels:{ color:"#fff" }}},
      scales:{
        x:{ ticks:{ color:"#aaa" }},
        y:{ ticks:{ color:"#aaa" }}
      }
    }
  });
}

// Call this after ladder loads
// renderVolSmile();

// ---------- Payoff Simulator ----------

function renderPayoff(option, strike) {
  if (!option?.last_quote) return;
  if (plChart) plChart.destroy();

  const premium = option.last_quote.ask ?? option.last_quote.bid ?? 0;
  const isCall = option.contract_type === "call";

  const prices = [];
  const pnl = [];

  for (let i=-20;i<=20;i++) {
    const px = spot*(1+i/20);
    prices.push(px.toFixed(2));

    let intrinsic = isCall
      ? Math.max(px - strike, 0)
      : Math.max(strike - px, 0);

    pnl.push((intrinsic - premium).toFixed(2));
  }

  plChart = new Chart(plChartEl, {
    type:"line",
    data:{
      labels:prices,
      datasets:[{ label:"P/L", data:pnl, borderWidth:2 }]
    },
    options:{
      plugins:{ legend:{ labels:{ color:"#fff" }}},
      scales:{
        x:{ ticks:{ color:"#aaa" }},
        y:{ ticks:{ color:"#aaa" }}
      }
    }
  });
}

// Extend showGreeks
const _showGreeks = showGreeks;
showGreeks = (opt, strike) => {
  selectedOption = opt;
  _showGreeks(opt, strike);
  renderPayoff(opt, strike);
  persistState(strike);
};

// ---------- Persistence ----------

function persistState(strike) {
  localStorage.setItem("greekowl", JSON.stringify({
    ticker: tickerInput.value,
    expiry: currentExpiry,
    strike
  }));
}

function restoreState() {
  const s = JSON.parse(localStorage.getItem("greekowl") || "{}");
  if (!s.ticker) return;

  tickerInput.value = s.ticker;
  loadTicker();

  setTimeout(() => {
    expirySelect.value = s.expiry;
    currentExpiry = s.expiry;
    buildLadder().then(() => {
      const row = ladder.find(r => r.strike === s.strike);
      if (row) showGreeks(row.call || row.put, row.strike);
    });
  }, 800);
}

restoreState();
