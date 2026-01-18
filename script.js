// ===============================
// GreekOwl – Safe Terminal Edition
// ===============================

document.addEventListener("DOMContentLoaded", () => {

  // ---------- SAFE ELEMENT LOOKUPS ----------
  const commandInput = document.getElementById("commandInput");
  const volChartEl   = document.getElementById("volChart");
  const plChartEl    = document.getElementById("plChart");

  let volChart = null;
  let plChart = null;
  let selectedOption = null;

  // ---------- COMMAND BAR (OPTIONAL) ----------
  if (commandInput) {
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
        }, 600);
      }

      if (parts.length >= 4) {
        const type = parts[2] === "C" ? "call" : "put";
        const strike = Number(parts[3]);

        setTimeout(() => {
          const row = ladder.find(r => r.strike === strike);
          if (row && row[type]) {
            showGreeks(row[type], strike);
          }
        }, 1200);
      }
    });
  }

  // ---------- VOLATILITY SMILE ----------
  function renderVolSmile() {
    if (!volChartEl || !ladder.length) return;
    if (volChart) volChart.destroy();

    volChart = new Chart(volChartEl, {
      type: "line",
      data: {
        labels: ladder.map(r => r.strike),
        datasets: [
          {
            label: "Call IV",
            data: ladder.map(r => r.call?.implied_volatility ?? null),
            borderWidth: 2
          },
          {
            label: "Put IV",
            data: ladder.map(r => r.put?.implied_volatility ?? null),
            borderWidth: 2
          }
        ]
      },
      options: {
        plugins: { legend: { labels: { color: "#fff" }}},
        scales: {
          x: { ticks: { color: "#aaa" }},
          y: { ticks: { color: "#aaa" }}
        }
      }
    });
  }

  // ---------- PAYOFF DIAGRAM ----------
  function renderPayoff(option, strike) {
    if (!plChartEl || !option?.last_quote) return;
    if (plChart) plChart.destroy();

    const premium = option.last_quote.ask ?? option.last_quote.bid ?? 0;
    const isCall = option.contract_type === "call";

    const prices = [];
    const pnl = [];

    for (let i = -20; i <= 20; i++) {
      const px = spot * (1 + i / 20);
      prices.push(px.toFixed(2));

      const intrinsic = isCall
        ? Math.max(px - strike, 0)
        : Math.max(strike - px, 0);

      pnl.push((intrinsic - premium).toFixed(2));
    }

    plChart = new Chart(plChartEl, {
      type: "line",
      data: {
        labels: prices,
        datasets: [{ label: "P/L at Expiry", data: pnl, borderWidth: 2 }]
      },
      options: {
        plugins: { legend: { labels: { color: "#fff" }}},
        scales: {
          x: { ticks: { color: "#aaa" }},
          y: { ticks: { color: "#aaa" }}
        }
      }
    });
  }

  // ---------- EXTEND showGreeks SAFELY ----------
  const originalShowGreeks = window.showGreeks;
  window.showGreeks = (opt, strike) => {
    selectedOption = opt;
    originalShowGreeks(opt, strike);
    renderPayoff(opt, strike);
  };

  // ---------- HOOK AFTER LADDER LOAD ----------
  const originalBuildLadder = window.buildLadder;
  window.buildLadder = async () => {
    await originalBuildLadder();
    renderVolSmile();
  };

});
