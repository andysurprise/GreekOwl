const proxy = "https://greekowl-proxy.glance-muckier-7k.workers.dev";
const checklist = document.getElementById("checklist");
const context = document.getElementById("context");
const tickerContext = document.getElementById("tickerContext");

// Validation configuration
const VALIDATION_RULES = {
  DTE_MIN: 20,
  DTE_MAX: 50,
  DELTA_MIN: 0.3,
  DELTA_MAX: 0.4
};

// Auto-load ticker context when ticker field changes
let tickerLoadTimeout;
document.getElementById("ticker").addEventListener("input", (e) => {
  const ticker = e.target.value.trim().toUpperCase();
  
  // Clear any pending timeout
  clearTimeout(tickerLoadTimeout);
  
  if (ticker.length === 0) {
    tickerContext.textContent = "Enter a ticker to load market context.";
    return;
  }
  
  // Debounce: wait 500ms after user stops typing
  tickerLoadTimeout = setTimeout(() => {
    if (ticker.length > 0) {
      loadTickerContext(ticker);
    }
  }, 500);
});

document.getElementById("validate").onclick = async () => {
  checklist.innerHTML = "";
  context.textContent = "";
  
  try {
    const ticker = document.getElementById("ticker").value.trim().toUpperCase();
    const expiryInput = document.getElementById("expiry").value;
    const deltaInput = document.getElementById("delta").value;
    const premiumInput = document.getElementById("premium").value;
    const strikeInput = document.getElementById("strike").value;
    
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
    const strike = parseFloat(strikeInput);
    
    if (isNaN(delta)) {
      addCheck(false, "Delta invalid", "Please enter a valid delta value (e.g., 0.35).");
      return;
    }
    
    if (isNaN(premium)) {
      addCheck(false, "Premium invalid", "Please enter a valid premium value.");
      return;
    }
    
    if (isNaN(strike)) {
      addCheck(false, "Strike invalid", "Please enter a valid strike price.");
      return;
    }
    
    const now = new Date();
    now.setHours(0, 0, 0, 0);
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
    
    addCheck(
      dte > 0,
      `Expiration is ${dte} days away`,
      "Expiration must be in the future. Past expirations are invalid."
    );
    
    // Calculate returns
    if (!isNaN(strike) && strike > 0) {
      const returnPercent = ((premium / strike) * 100).toFixed(2);
      const annualizedReturn = ((premium / strike) * (365 / dte) * 100).toFixed(2);
      
      addCheck(
        true,
        `Return if unchanged: ${returnPercent}% (${annualizedReturn}% annualized)`,
        `This shows your potential return if the stock stays flat. Based on $${premium} premium ÷ $${strike} strike over ${dte} days.`
      );
    }
    
    // Get the actual stock price from the loaded data
    const stockPriceMatch = tickerContext.textContent.match(/Last close: \$([0-9.]+)/);
    const stockPrice = stockPriceMatch ? parseFloat(stockPriceMatch[1]) : strike;
    
    // Draw the payoff diagram
    setTimeout(() => {
      createPayoffDiagram(stockPrice, strike, premium);
    }, 100);
    
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
    document.querySelectorAll('#checklist li').forEach(item => item.classList.remove('active'));
    li.classList.add('active');
  };
  checklist.appendChild(li);
}

async function loadTickerContext(ticker) {
  if (!ticker) {
    tickerContext.textContent = "Enter a ticker to load market context.";
    return;
  }

  tickerContext.innerHTML = `<div class="loading">⏳ Loading market data for ${ticker}...</div>`;
  
  try {
    const url = `${proxy}?symbol=${ticker}`;
    console.log("Fetching:", url);
    
    const res = await fetch(url);
    
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${res.statusText}`);
    }
    
    const data = await res.json();
    
    console.log("Response:", data);
    
    if (data.error) {
      tickerContext.innerHTML = `
        <span class="error">
          ⚠️ ${data.error}<br>
          <small>Check console for details</small>
        </span>
      `;
      return;
    }
    
    const price = data.price != null ? data.price.toFixed(2) : "Unavailable";
    
    tickerContext.innerHTML = `
      <div class="ticker-info">
        <h3>${ticker}</h3>
        <div class="ticker-details">
          <div class="detail-row">
            <span class="label">Last close:</span>
            <span class="value">$${price}</span>
          </div>
        </div>
      </div>
    `;
    
  } catch (error) {
    console.error("Error fetching ticker data:", error);
    tickerContext.innerHTML = `
      <span class="error">
        ⚠️ Network error loading ${ticker}<br>
        <small>${error.message}</small>
      </span>
    `;
  }
}

// Reset button handler
document.getElementById('reset')?.addEventListener('click', () => {
  checklist.innerHTML = '';
  context.textContent = 'Select a checklist item to see why it matters.';
  tickerContext.textContent = 'Enter a ticker to load market context.';
  
  // Clear the canvas
  const canvas = document.getElementById('payoffChart');
  if (canvas) {
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
  }
});

// Payoff Diagram Function
function createPayoffDiagram(stockPrice, strike, premium, shares = 100) {
  const canvas = document.getElementById('payoffChart');
  if (!canvas) {
    console.error('Canvas element not found');
    return;
  }
  
  // Wait for container to have dimensions
  const container = canvas.parentElement;
  if (!container.offsetWidth || !container.offsetHeight) {
    console.warn('Container has no dimensions, retrying...');
    setTimeout(() => createPayoffDiagram(stockPrice, strike, premium, shares), 100);
    return;
  }
  
  const ctx = canvas.getContext('2d');
  
  // Use container dimensions
  const containerWidth = container.offsetWidth;
  const containerHeight = container.offsetHeight;
  
  const width = canvas.width = containerWidth * 2; // High DPI
  const height = canvas.height = containerHeight * 2;
  ctx.scale(2, 2);
  
  const w = containerWidth;
  const h = containerHeight;
  
  const breakeven = stockPrice - premium;
  const maxProfit = (strike - stockPrice + premium) * shares;
  const priceRange = stockPrice * 0.4;
  const minPrice = Math.max(0, stockPrice - priceRange);
  const maxPrice = stockPrice + priceRange;
  
  const colors = {
    bg: '#0f172a',
    grid: '#1e293b',
    axis: '#334155',
    profit: '#4ade80',
    loss: '#f87171',
    breakeven: '#facc15',
    current: '#3b82f6',
    strike: '#8b5cf6',
    text: '#e5e7eb',
    textDim: '#9ca3af'
  };
  
  ctx.fillStyle = colors.bg;
  ctx.fillRect(0, 0, w, h);
  
  const padding = { top: 40, right: 40, bottom: 50, left: 60 };
  const chartWidth = w - padding.left - padding.right;
  const chartHeight = h - padding.top - padding.bottom;
  
  const xScale = (price) => padding.left + ((price - minPrice) / (maxPrice - minPrice)) * chartWidth;
  const yScale = (profit) => {
    const maxProfitDisplay = Math.max(Math.abs(maxProfit), priceRange * shares * 0.3);
    return padding.top + chartHeight - ((profit + maxProfitDisplay) / (maxProfitDisplay * 2)) * chartHeight;
  };
  
  // Grid
  ctx.strokeStyle = colors.grid;
  ctx.lineWidth = 1;
  for (let i = 0; i <= 4; i++) {
    const y = padding.top + (chartHeight / 4) * i;
    ctx.beginPath();
    ctx.moveTo(padding.left, y);
    ctx.lineTo(w - padding.right, y);
    ctx.stroke();
  }
  
  // Axes
  ctx.strokeStyle = colors.axis;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(padding.left, padding.top);
  ctx.lineTo(padding.left, h - padding.bottom);
  ctx.lineTo(w - padding.right, h - padding.bottom);
  ctx.stroke();
  
  // Zero line
  ctx.strokeStyle = colors.breakeven;
  ctx.lineWidth = 1;
  ctx.setLineDash([5, 5]);
  const zeroY = yScale(0);
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  ctx.lineTo(w - padding.right, zeroY);
  ctx.stroke();
  ctx.setLineDash([]);
  
  const calculatePayoff = (priceAtExpiry) => {
    const stockPL = (priceAtExpiry - stockPrice) * shares;
    const optionPL = priceAtExpiry > strike ? -(priceAtExpiry - strike) * shares : 0;
    return stockPL + optionPL + (premium * shares);
  };
  
  // Payoff line
  ctx.lineWidth = 3;
  const steps = 100;
  
  for (let i = 0; i <= steps; i++) {
    const price = minPrice + (maxPrice - minPrice) * (i / steps);
    const profit = calculatePayoff(price);
    const x = xScale(price);
    const y = yScale(profit);
    
    ctx.strokeStyle = profit >= 0 ? colors.profit : colors.loss;
    
    if (i === 0) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    } else {
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  }
  
  // Shading
  ctx.globalAlpha = 0.1;
  
  // Profit zone
  ctx.fillStyle = colors.profit;
  ctx.beginPath();
  ctx.moveTo(xScale(breakeven), zeroY);
  for (let i = 0; i <= steps; i++) {
    const price = minPrice + (maxPrice - minPrice) * (i / steps);
    if (price >= breakeven) {
      const profit = calculatePayoff(price);
      if (profit > 0) ctx.lineTo(xScale(price), yScale(profit));
    }
  }
  ctx.lineTo(xScale(maxPrice), zeroY);
  ctx.closePath();
  ctx.fill();
  
  // Loss zone
  ctx.fillStyle = colors.loss;
  ctx.beginPath();
  ctx.moveTo(padding.left, zeroY);
  for (let i = 0; i <= steps; i++) {
    const price = minPrice + (maxPrice - minPrice) * (i / steps);
    if (price <= breakeven) {
      const profit = calculatePayoff(price);
      if (profit < 0) ctx.lineTo(xScale(price), yScale(profit));
    }
  }
  ctx.lineTo(xScale(breakeven), zeroY);
  ctx.closePath();
  ctx.fill();
  
  ctx.globalAlpha = 1.0;
  
  // Price lines
  ctx.setLineDash([10, 5]);
  
  // Current
  ctx.strokeStyle = colors.current;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(xScale(stockPrice), padding.top);
  ctx.lineTo(xScale(stockPrice), h - padding.bottom);
  ctx.stroke();
  
  // Strike
  ctx.strokeStyle = colors.strike;
  ctx.beginPath();
  ctx.moveTo(xScale(strike), padding.top);
  ctx.lineTo(xScale(strike), h - padding.bottom);
  ctx.stroke();
  
  // Breakeven
  ctx.strokeStyle = colors.breakeven;
  ctx.beginPath();
  ctx.moveTo(xScale(breakeven), padding.top);
  ctx.lineTo(xScale(breakeven), h - padding.bottom);
  ctx.stroke();
  
  ctx.setLineDash([]);
  
  // Labels
  ctx.font = '12px system-ui';
  ctx.textAlign = 'center';
  
  ctx.fillStyle = colors.current;
  ctx.fillText('Current', xScale(stockPrice), padding.top - 10);
  ctx.fillText(`$${stockPrice.toFixed(2)}`, xScale(stockPrice), padding.top - 25);
  
  ctx.fillStyle = colors.strike;
  ctx.fillText('Strike', xScale(strike), padding.top - 10);
  ctx.fillText(`$${strike.toFixed(2)}`, xScale(strike), padding.top - 25);
  
  ctx.fillStyle = colors.breakeven;
  ctx.fillText('Breakeven', xScale(breakeven), h - padding.bottom + 15);
  ctx.fillText(`$${breakeven.toFixed(2)}`, xScale(breakeven), h - padding.bottom + 30);
  
  const maxProfitY = yScale(maxProfit);
  ctx.fillStyle = colors.profit;
  ctx.fillText(`Max Profit: $${maxProfit.toFixed(2)}`, w - padding.right - 100, maxProfitY - 10);
  
  ctx.beginPath();
  ctx.arc(xScale(strike), maxProfitY, 5, 0, Math.PI * 2);
  ctx.fill();
  
  // Y-axis labels
  ctx.textAlign = 'right';
  ctx.fillStyle = colors.textDim;
  ctx.font = '11px system-ui';
  
  for (let i = 0; i <= 4; i++) {
    const maxProfitDisplay = Math.max(Math.abs(maxProfit), priceRange * shares * 0.3);
    const value = maxProfitDisplay - (maxProfitDisplay * 2 * i / 4);
    const y = padding.top + (chartHeight / 4) * i;
    ctx.fillText(`$${value.toFixed(0)}`, padding.left - 10, y + 4);
  }
  
  // X-axis labels
  ctx.textAlign = 'center';
  for (let i = 0; i <= 5; i++) {
    const price = minPrice + (maxPrice - minPrice) * (i / 5);
    const x = padding.left + (chartWidth * i / 5);
    ctx.fillText(`$${price.toFixed(0)}`, x, h - padding.bottom + 20);
  }
  
  // Title
  ctx.textAlign = 'left';
  ctx.fillStyle = colors.text;
  ctx.font = 'bold 16px system-ui';
  ctx.fillText('Profit/Loss at Expiration', padding.left, 25);
  
  // Legend
  const legendY = 45;
  ctx.font = '11px system-ui';
  
  ctx.fillStyle = colors.current;
  ctx.fillRect(padding.left, legendY - 8, 15, 3);
  ctx.fillStyle = colors.textDim;
  ctx.fillText('Current', padding.left + 20, legendY);
  
  ctx.fillStyle = colors.strike;
  ctx.fillRect(padding.left + 90, legendY - 8, 15, 3);
  ctx.fillStyle = colors.textDim;
  ctx.fillText('Strike', padding.left + 110, legendY);
  
  ctx.fillStyle = colors.breakeven;
  ctx.fillRect(padding.left + 160, legendY - 8, 15, 3);
  ctx.fillStyle = colors.textDim;
  ctx.fillText('Breakeven', padding.left + 180, legendY);
}
