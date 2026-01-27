const proxy = "https://greekowl-proxy.glance-muckier-7k.workers.dev";
const checklist = document.getElementById("checklist");
const context = document.getElementById("context");
const tickerContext = document.getElementById("tickerContext");

// Validation configuration (easily adjustable)
const VALIDATION_RULES = {
  DTE_MIN: 20,
  DTE_MAX: 50,
  DELTA_MIN: 0.3,
  DELTA_MAX: 0.4
};

document.getElementById("validate").onclick = async () => {
  checklist.innerHTML = "";
  context.textContent = "";
  
  try {
    // Get and validate inputs
    const ticker = document.getElementById("ticker").value.trim().toUpperCase();
    const expiryInput = document.getElementById("expiry").value;
    const deltaInput = document.getElementById("delta").value;
    const premiumInput = document.getElementById("premium").value;
    
    // Basic validation
    if (!ticker) {
      addCheck(false, "Ticker required", "Please enter a valid ticker symbol.");
      return;
    }
    
    if (!expiryInput) {
      addCheck(false, "Expiration date required", "Please select an expiration date.");
      return;
    }
    
    const expiry = new Date(expiryInput);
    const delta = parseFloat(deltaInput);
    const premium = parseFloat(premiumInput);
    const strike = parseFloat(document.getElementById("strike")?.value);
    
    // Check for invalid numbers
    if (isNaN(delta)) {
      addCheck(false, "Delta invalid", "Please enter a valid delta value (e.g., 0.35).");
      return;
    }
    
    if (isNaN(premium)) {
      addCheck(false, "Premium invalid", "Please enter a valid premium value.");
      return;
    }
    
    // Calculate DTE
    const now = new Date();
    now.setHours(0, 0, 0, 0); // Normalize to start of day
    const dte = Math.round((expiry - now) / 86400000);
    
    // Run validation checks
    addCheck(
      dte >= VALIDATION_RULES.DTE_MIN && dte <= VALIDATION_RULES.DTE_MAX,
      `Days to expiration: ${dte}`,
      `Covered calls target ${VALIDATION_RULES.DTE_MIN}–${VALIDATION_RULES.DTE_MAX} DTE to balance theta decay vs assignment risk. Too short increases assignment risk; too long reduces premium capture.`
    );
    
    addCheck(
      delta >= VALIDATION_RULES.DELTA_MIN && delta <= VALIDATION_RULES.DELTA_MAX,
      `Delta: ${delta.toFixed(2)}`,
      `Delta approximates assignment probability. ${VALIDATION_RULES.DELTA_MIN}–${VALIDATION_RULES.DELTA_MAX} balances premium yield and safety. Higher delta = higher assignment risk but better premium.`
    );
    
    addCheck(
      premium > 0,
      `Premium: $${premium.toFixed(2)} per share`,
      "Premium is required to define profit targets and risk controls. Higher premium provides better downside protection."
    );
    
    // Additional helpful checks
    addCheck(
      dte > 0,
      `Expiration is ${dte} days away`,
      "Expiration must be in the future. Past expirations are invalid."
    );
    
    // Calculate annualized return if strike is available
    if (!isNaN(strike) && strike > 0) {
      const returnPercent = ((premium / strike) * 100).toFixed(2);
      const annualizedReturn = ((premium / strike) * (365 / dte) * 100).toFixed(2);
      
      addCheck(
        true,
        `Return if unchanged: ${returnPercent}% (${annualizedReturn}% annualized)`,
        `This shows your potential return if the stock stays flat. Based on ${premium} premium ÷ ${strike} strike over ${dte} days.`
      );
    }
    
    // Load market context
    await loadTickerContext(ticker);
    
  } catch (error) {
    console.error("Validation error:", error);
    addCheck(false, "Error processing inputs", `An error occurred: ${error.message}`);
  }
};

function addCheck(pass, text, explanation) {
  const li = document.createElement("li");
  li.className = pass ? "pass" : "fail";
  li.textContent = text;
  li.onclick = () => {
    context.textContent = explanation;
    // Add visual feedback
    document.querySelectorAll('#checklist li').forEach(item => item.classList.remove('active'));
    li.classList.add('active');
  };
  checklist.appendChild(li);
}

async function loadTickerContext(ticker) {
  tickerContext.textContent = "Loading market data…";
  
  try {
    // ✅ Fixed: Proper template literal syntax
    const res = await fetch(`${proxy}?symbol=${ticker}`);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    if (data.error) {
      tickerContext.innerHTML = `<span class="error">${data.error}</span>`;
      return;
    }
    
    const price = data.price ?? "Unavailable";
    const hi = data.high30 ?? "—";
    const lo = data.low30 ?? "—";
    
    let range = "—";
    let volatilityNote = "";
    if (data.high30 && data.low30 && data.price) {
      const rangePercent = ((hi - lo) / data.price) * 100;
      range = rangePercent.toFixed(1) + "%";
      
      // Add volatility context
      if (rangePercent > 20) {
        volatilityNote = " (High volatility - higher premiums but more risk)";
      } else if (rangePercent < 5) {
        volatilityNote = " (Low volatility - lower premiums but more stable)";
      }
    }
    
    const div = data.dividend
      ? `$${data.dividend.cash_amount} ex-div ${data.dividend.ex_dividend_date}`
      : "No recent dividend";
    
    tickerContext.innerHTML = `
      <strong>${ticker}</strong><br><br>
      Last close: <strong>$${price}</strong><br>
      30-day high / low: $${hi} / $${lo}<br>
      30-day range: ${range}${volatilityNote}<br>
      Dividend: ${div}
    `;
    
  } catch (error) {
    console.error("Error fetching ticker data:", error);
    tickerContext.innerHTML = `
      <span class="error">
        Unable to load market data for ${ticker}.<br>
        ${error.message}
      </span>
    `;
  }
}

// Optional: Add debouncing for real-time validation
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}

// Optional: Add auto-validation on input change
const autoValidate = debounce(() => {
  const validateBtn = document.getElementById("validate");
  if (validateBtn) validateBtn.click();
}, 500);

// Add listeners for auto-validation (optional)
['ticker', 'expiry', 'delta', 'premium', 'strike'].forEach(id => {
  const element = document.getElementById(id);
  if (element) {
    element.addEventListener('input', autoValidate);
  }
});
