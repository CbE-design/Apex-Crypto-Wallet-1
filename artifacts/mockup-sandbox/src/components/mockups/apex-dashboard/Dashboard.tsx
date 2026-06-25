
import { useState, useEffect } from "react";

const DOMAIN = "https://raw.githubusercontent.com/spothq/cryptocurrency-icons/master/128/color";
const CRYPTO_LOGOS: Record<string, string> = {
  BTC: `${DOMAIN}/btc.png`,
  ETH: `${DOMAIN}/eth.png`,
  SOL: `${DOMAIN}/sol.png`,
  BNB: `${DOMAIN}/bnb.png`,
  ADA: `${DOMAIN}/ada.png`,
  XRP: `${DOMAIN}/xrp.png`,
  LINK: `${DOMAIN}/link.png`,
  DOGE: `${DOMAIN}/doge.png`,
  USDT: `${DOMAIN}/usdt.png`,
};

const PORTFOLIO = [
  { symbol: "BTC", name: "Bitcoin", balance: 0.4821, value: 28540.12, change: 3.42, color: "#F7931A" },
  { symbol: "ETH", name: "Ethereum", balance: 4.2, value: 12340.80, change: -1.18, color: "#627EEA" },
  { symbol: "SOL", name: "Solana", balance: 120, value: 8920.0, change: 5.76, color: "#9945FF" },
  { symbol: "BNB", name: "BNB", balance: 14.5, value: 4305.50, change: 0.88, color: "#F0B90B" },
  { symbol: "ADA", name: "Cardano", balance: 5200, value: 2340.00, change: -0.55, color: "#0033AD" },
  { symbol: "XRP", name: "XRP", balance: 8000, value: 1620.00, change: 2.11, color: "#00AAE4" },
  { symbol: "LINK", name: "Chainlink", balance: 200, value: 2880.00, change: 4.33, color: "#2A5ADA" },
  { symbol: "DOGE", name: "Dogecoin", balance: 20000, value: 1600.00, change: -2.77, color: "#C2A633" },
];

const MARKET = [
  { symbol: "BTC", name: "Bitcoin", price: 59205, change: 3.42, mcap: "1.17T", vol: "38.2B" },
  { symbol: "ETH", name: "Ethereum", price: 2939.24, change: -1.18, mcap: "352B", vol: "18.1B" },
  { symbol: "SOL", name: "Solana", price: 74.33, change: 5.76, mcap: "33.5B", vol: "4.6B" },
  { symbol: "BNB", name: "BNB", price: 296.93, change: 0.88, mcap: "43.1B", vol: "1.1B" },
  { symbol: "XRP", name: "XRP", price: 0.2025, change: 2.11, mcap: "11.3B", vol: "880M" },
  { symbol: "ADA", name: "Cardano", price: 0.45, change: -0.55, mcap: "15.9B", vol: "520M" },
  { symbol: "DOGE", name: "Dogecoin", price: 0.08, change: -2.77, mcap: "11.4B", vol: "1.3B" },
  { symbol: "LINK", name: "Chainlink", price: 14.4, change: 4.33, mcap: "8.7B", vol: "620M" },
];

const TRANSACTIONS = [
  { type: "Buy", asset: "BTC", amount: "+0.0521 BTC", value: "R 56,820", time: "2m ago", status: "confirmed" },
  { type: "Swap", asset: "ETH→SOL", amount: "1.2 ETH → 48 SOL", value: "R 14,230", time: "1h ago", status: "confirmed" },
  { type: "Withdrawal", asset: "USDT", amount: "-500 USDT", value: "R 9,150", time: "3h ago", status: "confirmed" },
  { type: "Receive", asset: "BNB", amount: "+2.5 BNB", value: "R 3,412", time: "Yesterday", status: "confirmed" },
  { type: "Send", asset: "XRP", amount: "-1200 XRP", value: "R 1,098", time: "2d ago", status: "confirmed" },
  { type: "Buy", asset: "SOL", amount: "+22 SOL", value: "R 6,050", time: "3d ago", status: "pending" },
];

const DONUT_SEGMENTS = PORTFOLIO.slice(0, 5);
const TOTAL = PORTFOLIO.reduce((a, c) => a + c.value, 0);

function CryptoLogo({ symbol, size = 28 }: { symbol: string; size?: number }) {
  const [err, setErr] = useState(false);
  const url = CRYPTO_LOGOS[symbol];
  if (!url || err) {
    return (
      <div style={{ width: size, height: size, borderRadius: "50%", background: "#1e2d4a", display: "flex", alignItems: "center", justifyContent: "center", fontSize: size * 0.38, fontWeight: 700, color: "#3B8EF3", fontFamily: "'Space Grotesk', sans-serif" }}>
        {symbol[0]}
      </div>
    );
  }
  return <img src={url} alt={symbol} width={size} height={size} style={{ borderRadius: "50%", objectFit: "cover" }} onError={() => setErr(true)} />;
}

function DonutChart({ segments, total }: { segments: typeof DONUT_SEGMENTS; total: number }) {
  const cx = 90, cy = 90, r = 68, stroke = 22;
  const circ = 2 * Math.PI * r;
  let offset = 0;
  const slices = segments.map((s) => {
    const pct = s.value / total;
    const dash = pct * circ;
    const gap = circ - dash;
    const slice = { ...s, dash, gap, offset };
    offset += dash;
    return slice;
  });
  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#0d1829" strokeWidth={stroke + 4} />
      {slices.map((s) => (
        <circle key={s.symbol} cx={cx} cy={cy} r={r} fill="none" stroke={s.color}
          strokeWidth={stroke} strokeDasharray={`${s.dash} ${s.gap}`} strokeDashoffset={circ / 4 - s.offset}
          strokeLinecap="round" style={{ opacity: 0.92 }} />
      ))}
      <defs>
        <linearGradient id="networth-grad" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#16C780" />
          <stop offset="100%" stopColor="#3B8EF3" />
        </linearGradient>
      </defs>
      <text x={cx} y={cy - 10} textAnchor="middle" fill="url(#networth-grad)" fontSize={12} fontWeight={700} fontFamily="'Space Grotesk', sans-serif">NET WORTH</text>
      <text x={cx} y={cy + 10} textAnchor="middle" fill="#fff" fontSize={17} fontWeight={700} fontFamily="'Space Grotesk', sans-serif">
        {`R ${(total / 1000).toFixed(0)}K`}
      </text>
      <text x={cx} y={cy + 26} textAnchor="middle" fill="#16C780" fontSize={10} fontFamily="'Space Grotesk', sans-serif">↑ 4.2% today</text>
    </svg>
  );
}

function MiniSparkline({ positive }: { positive: boolean }) {
  const pts = positive
    ? [[0, 24], [8, 18], [16, 20], [24, 10], [32, 14], [40, 6], [48, 8], [56, 2]]
    : [[0, 4], [8, 8], [16, 6], [24, 14], [32, 10], [40, 18], [48, 16], [56, 22]];
  const path = pts.map((p, i) => `${i === 0 ? "M" : "L"}${p[0]},${p[1]}`).join(" ");
  const color = positive ? "#16C780" : "#EF4444";
  return (
    <svg width={56} height={26} viewBox="0 0 56 26">
      <path d={path} fill="none" stroke={color} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" opacity={0.8} />
    </svg>
  );
}

const NAV_ITEMS = [
  { icon: "⬛", label: "Dashboard", active: true },
  { icon: "💼", label: "Wallets", active: false },
  { icon: "↔", label: "Swap", active: false },
  { icon: "📤", label: "Send", active: false },
  { icon: "🏦", label: "Withdraw", active: false },
  { icon: "🤖", label: "AI", active: false },
];

export function Dashboard() {
  const [time, setTime] = useState(new Date());
  useEffect(() => { const t = setInterval(() => setTime(new Date()), 1000); return () => clearInterval(t); }, []);

  return (
    <div style={{ fontFamily: "'Space Grotesk', 'Inter', sans-serif", background: "#060C18", minHeight: "100vh", display: "flex", overflow: "hidden", position: "relative" }}>

      {/* Google Font */}
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;400;500;600;700&display=swap');`}</style>

      {/* All-seeing eye watermark */}
      <div style={{ position: "fixed", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", pointerEvents: "none", zIndex: 0 }}>
        <svg viewBox="0 0 400 280" style={{ width: "62vw", maxWidth: 700, opacity: 0.045 }} fill="none" xmlns="http://www.w3.org/2000/svg">
          <ellipse cx="200" cy="140" rx="198" ry="130" stroke="white" strokeWidth="2.5" />
          <path d="M2 140 Q100 10 200 140 Q300 270 398 140" stroke="white" strokeWidth="2" fill="none" />
          <path d="M2 140 Q100 270 200 140 Q300 10 398 140" stroke="white" strokeWidth="2" fill="none" />
          <circle cx="200" cy="140" r="52" stroke="white" strokeWidth="2.5" />
          <circle cx="200" cy="140" r="26" fill="white" opacity="0.8" />
          <circle cx="214" cy="130" r="9" fill="#060C18" opacity="0.6" />
          <circle cx="200" cy="140" r="8" fill="#060C18" />
          {[0,30,60,90,120,150,180,210,240,270,300,330].map((deg, i) => {
            const rad = (deg * Math.PI) / 180;
            const x1 = 200 + 58 * Math.cos(rad);
            const y1 = 140 + 58 * Math.sin(rad);
            const x2 = 200 + 72 * Math.cos(rad);
            const y2 = 140 + 72 * Math.sin(rad);
            return <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} stroke="white" strokeWidth="1.5" />;
          })}
          <text x="200" y="230" textAnchor="middle" fill="white" fontSize="14" fontFamily="serif" letterSpacing="6">APEX WALLET</text>
        </svg>
      </div>

      {/* Ambient glow orbs */}
      <div style={{ position: "fixed", top: "-15%", left: "-10%", width: 600, height: 600, borderRadius: "50%", background: "radial-gradient(circle, rgba(59,142,243,0.08) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />
      <div style={{ position: "fixed", bottom: "-20%", right: "-5%", width: 500, height: 500, borderRadius: "50%", background: "radial-gradient(circle, rgba(22,199,128,0.07) 0%, transparent 70%)", pointerEvents: "none", zIndex: 0 }} />

      {/* Sidebar */}
      <aside style={{ width: 220, flexShrink: 0, background: "rgba(10,17,32,0.85)", backdropFilter: "blur(18px)", borderRight: "1px solid rgba(255,255,255,0.06)", display: "flex", flexDirection: "column", zIndex: 10, position: "relative" }}>
        {/* Logo */}
        <div style={{ padding: "22px 20px 16px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#3B8EF3,#16C780)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 16 }}>👁</div>
            <div>
              <div style={{ color: "#fff", fontWeight: 700, fontSize: 15, letterSpacing: 0.3 }}>Apex Wallet</div>
              <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>Institutional</div>
            </div>
          </div>
        </div>

        {/* Nav */}
        <nav style={{ flex: 1, padding: "12px 10px" }}>
          {NAV_ITEMS.map((item) => (
            <div key={item.label} style={{
              display: "flex", alignItems: "center", gap: 11, padding: "10px 12px", borderRadius: 10, marginBottom: 2,
              background: item.active ? "linear-gradient(90deg,rgba(59,142,243,0.18),rgba(22,199,128,0.07))" : "transparent",
              borderLeft: item.active ? "2px solid #3B8EF3" : "2px solid transparent",
              cursor: "pointer", transition: "all 0.2s",
            }}>
              <span style={{ fontSize: 15, opacity: item.active ? 1 : 0.45 }}>{item.icon}</span>
              <span style={{ color: item.active ? "#fff" : "rgba(255,255,255,0.4)", fontSize: 13.5, fontWeight: item.active ? 600 : 400 }}>{item.label}</span>
              {item.label === "AI" && <span style={{ marginLeft: "auto", background: "linear-gradient(90deg,#3B8EF3,#16C780)", borderRadius: 4, padding: "1px 6px", fontSize: 9, color: "#fff", fontWeight: 700 }}>AI</span>}
            </div>
          ))}
        </nav>

        {/* Wallet address */}
        <div style={{ padding: "14px 16px", borderTop: "1px solid rgba(255,255,255,0.06)" }}>
          <div style={{ background: "rgba(255,255,255,0.04)", borderRadius: 10, padding: "10px 12px" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 4 }}>
              <div style={{ width: 8, height: 8, borderRadius: "50%", background: "#16C780", boxShadow: "0 0 6px #16C780" }} />
              <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10, letterSpacing: 0.8, textTransform: "uppercase" }}>Connected</span>
            </div>
            <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 11, fontFamily: "monospace" }}>0x9858...819f</div>
          </div>
          <div style={{ marginTop: 10, display: "grid", gridTemplateColumns: "1fr 1fr", gap: 4 }}>
            <a style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textDecoration: "none", cursor: "pointer" }}>⚙ Settings</a>
            <a style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, textDecoration: "none", cursor: "pointer" }}>📋 Legal</a>
          </div>
        </div>
      </aside>

      {/* Main */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden", zIndex: 10, position: "relative" }}>

        {/* Header */}
        <header style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px 28px", borderBottom: "1px solid rgba(255,255,255,0.05)", background: "rgba(6,12,24,0.7)", backdropFilter: "blur(12px)" }}>
          <div>
            <div style={{ color: "#fff", fontWeight: 700, fontSize: 20, letterSpacing: -0.3 }}>Dashboard</div>
            <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>
              {time.toLocaleString("en-ZA", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}
            </div>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            {/* Currency badge */}
            <div style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", borderRadius: 8, padding: "6px 12px", display: "flex", alignItems: "center", gap: 6, cursor: "pointer" }}>
              <span style={{ fontSize: 14 }}>🇿🇦</span>
              <span style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>ZAR</span>
              <span style={{ color: "rgba(255,255,255,0.3)", fontSize: 12 }}>▾</span>
            </div>
            {/* Notification */}
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)", display: "flex", alignItems: "center", justifyContent: "center", cursor: "pointer", position: "relative" }}>
              <span style={{ fontSize: 16 }}>🔔</span>
              <div style={{ position: "absolute", top: 6, right: 7, width: 7, height: 7, borderRadius: "50%", background: "#EF4444", border: "1.5px solid #060C18" }} />
            </div>
            {/* Avatar */}
            <div style={{ width: 36, height: 36, borderRadius: 10, background: "linear-gradient(135deg,#3B8EF3,#16C780)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontWeight: 700, fontSize: 14, cursor: "pointer" }}>A</div>
          </div>
        </header>

        {/* Scroll area */}
        <div style={{ flex: 1, overflowY: "auto", padding: "22px 28px", display: "flex", flexDirection: "column", gap: 20 }}>

          {/* KPI strip */}
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14 }}>
            {[
              { label: "Total Portfolio", value: `R ${(TOTAL / 1000).toFixed(1)}K`, sub: "+4.2% today", icon: "💰", positive: true },
              { label: "24h P&L", value: "+R 2,481", sub: "+2.8% vs yesterday", icon: "📈", positive: true },
              { label: "Active Assets", value: "8", sub: "Across all chains", icon: "🔗", positive: null },
              { label: "BTC Dominance", value: "44.7%", sub: "-0.3% shift", icon: "₿", positive: false },
            ].map((kpi) => (
              <div key={kpi.label} style={{
                background: "rgba(12,20,40,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16,
                padding: "16px 18px", backdropFilter: "blur(12px)", position: "relative", overflow: "hidden"
              }}>
                <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: kpi.positive === true ? "linear-gradient(90deg,#3B8EF3,#16C780)" : kpi.positive === false ? "linear-gradient(90deg,#EF4444,#F97316)" : "linear-gradient(90deg,#8B5CF6,#3B8EF3)" }} />
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                  <span style={{ color: "rgba(255,255,255,0.4)", fontSize: 12 }}>{kpi.label}</span>
                  <span style={{ fontSize: 18 }}>{kpi.icon}</span>
                </div>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 22, letterSpacing: -0.5, marginBottom: 4 }}>{kpi.value}</div>
                <div style={{ color: kpi.positive === true ? "#16C780" : kpi.positive === false ? "#EF4444" : "rgba(255,255,255,0.35)", fontSize: 11 }}>{kpi.sub}</div>
              </div>
            ))}
          </div>

          {/* Main grid */}
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 20 }}>

            {/* Portfolio overview */}
            <div style={{ background: "rgba(12,20,40,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Portfolio Overview</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Live balances</div>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 6, background: "rgba(22,199,128,0.1)", border: "1px solid rgba(22,199,128,0.2)", borderRadius: 8, padding: "4px 10px" }}>
                  <div style={{ width: 6, height: 6, borderRadius: "50%", background: "#16C780", animation: "pulse 1.5s infinite" }} />
                  <span style={{ color: "#16C780", fontSize: 11, fontWeight: 600 }}>LIVE</span>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 20 }}>
                <DonutChart segments={DONUT_SEGMENTS} total={TOTAL} />
                <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
                  {PORTFOLIO.slice(0, 6).map((a) => (
                    <div key={a.symbol} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <CryptoLogo symbol={a.symbol} size={22} />
                        <span style={{ color: "rgba(255,255,255,0.7)", fontSize: 12, fontWeight: 500 }}>{a.symbol}</span>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#fff", fontSize: 12, fontWeight: 600 }}>R {a.value.toLocaleString()}</div>
                        <div style={{ color: a.change >= 0 ? "#16C780" : "#EF4444", fontSize: 10 }}>{a.change >= 0 ? "+" : ""}{a.change}%</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Market overview */}
            <div style={{ background: "rgba(12,20,40,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div>
                  <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Market</div>
                  <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 12 }}>Updated just now</div>
                </div>
                <button style={{ background: "linear-gradient(90deg,#3B8EF3,#16C780)", border: "none", borderRadius: 8, padding: "6px 14px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>All Assets</button>
              </div>
              {/* Header row */}
              <div style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.9fr 56px", gap: 8, padding: "4px 0 8px", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
                {["Asset", "Price", "24h", ""].map(h => <div key={h} style={{ color: "rgba(255,255,255,0.3)", fontSize: 10, letterSpacing: 1, textTransform: "uppercase" }}>{h}</div>)}
              </div>
              {MARKET.map((coin) => (
                <div key={coin.symbol} style={{ display: "grid", gridTemplateColumns: "2fr 1.2fr 0.9fr 56px", gap: 8, alignItems: "center", padding: "9px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                    <CryptoLogo symbol={coin.symbol} size={26} />
                    <div>
                      <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{coin.symbol}</div>
                      <div style={{ color: "rgba(255,255,255,0.3)", fontSize: 10 }}>{coin.name}</div>
                    </div>
                  </div>
                  <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>${coin.price.toLocaleString()}</div>
                  <div style={{ color: coin.change >= 0 ? "#16C780" : "#EF4444", fontSize: 13, fontWeight: 600 }}>
                    {coin.change >= 0 ? "+" : ""}{coin.change}%
                  </div>
                  <MiniSparkline positive={coin.change >= 0} />
                </div>
              ))}
            </div>
          </div>

          {/* Bottom row */}
          <div style={{ display: "grid", gridTemplateColumns: "1.4fr 0.6fr", gap: 20 }}>

            {/* Transaction history */}
            <div style={{ background: "rgba(12,20,40,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Recent Transactions</div>
                <span style={{ color: "#3B8EF3", fontSize: 12, cursor: "pointer" }}>View all →</span>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                {TRANSACTIONS.map((tx, i) => {
                  const typeColor: Record<string, string> = { Buy: "#16C780", Sell: "#EF4444", Swap: "#8B5CF6", Withdrawal: "#F97316", Receive: "#16C780", Send: "#F97316" };
                  return (
                    <div key={i} style={{ display: "grid", gridTemplateColumns: "24px 1fr 1fr auto", gap: 12, alignItems: "center", padding: "10px 0", borderBottom: "1px solid rgba(255,255,255,0.04)" }}>
                      <div style={{ width: 24, height: 24, borderRadius: "50%", background: `${typeColor[tx.type]}22`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 11 }}>
                        {tx.type === "Buy" ? "↓" : tx.type === "Sell" ? "↑" : tx.type === "Swap" ? "↔" : tx.type === "Withdrawal" ? "⬆" : tx.type === "Receive" ? "↙" : "↗"}
                      </div>
                      <div>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 500 }}>{tx.type} {tx.asset}</div>
                        <div style={{ color: "rgba(255,255,255,0.35)", fontSize: 11 }}>{tx.time}</div>
                      </div>
                      <div style={{ color: "rgba(255,255,255,0.6)", fontSize: 12 }}>{tx.amount}</div>
                      <div style={{ textAlign: "right" }}>
                        <div style={{ color: "#fff", fontSize: 13, fontWeight: 600 }}>{tx.value}</div>
                        <div style={{ display: "inline-block", background: tx.status === "confirmed" ? "rgba(22,199,128,0.12)" : "rgba(249,115,22,0.12)", borderRadius: 4, padding: "1px 6px" }}>
                          <span style={{ color: tx.status === "confirmed" ? "#16C780" : "#F97316", fontSize: 10, fontWeight: 600 }}>{tx.status}</span>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Price Alerts */}
            <div style={{ background: "rgba(12,20,40,0.8)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 18, padding: "20px", backdropFilter: "blur(12px)", display: "flex", flexDirection: "column" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
                <div style={{ color: "#fff", fontWeight: 700, fontSize: 16 }}>Price Alerts</div>
                <button style={{ background: "linear-gradient(90deg,#3B8EF3,#16C780)", border: "none", borderRadius: 8, padding: "5px 12px", color: "#fff", fontSize: 12, fontWeight: 600, cursor: "pointer" }}>+ Add</button>
              </div>
              {[
                { symbol: "BTC", label: "Bitcoin above", target: "$65,000", current: "$59,205", pct: 91, triggered: false },
                { symbol: "ETH", label: "Ethereum below", target: "$2,800", current: "$2,939", pct: 105, triggered: true },
                { symbol: "SOL", label: "Solana above", target: "$80", current: "$74.33", pct: 93, triggered: false },
              ].map((alert) => (
                <div key={alert.symbol} style={{ background: "rgba(255,255,255,0.03)", border: `1px solid ${alert.triggered ? "rgba(22,199,128,0.25)" : "rgba(255,255,255,0.06)"}`, borderRadius: 12, padding: "12px", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
                    <CryptoLogo symbol={alert.symbol} size={22} />
                    <div style={{ flex: 1 }}>
                      <div style={{ color: "rgba(255,255,255,0.5)", fontSize: 11 }}>{alert.label}</div>
                      <div style={{ color: "#fff", fontWeight: 700, fontSize: 15 }}>{alert.target}</div>
                    </div>
                    {alert.triggered && <span style={{ background: "rgba(22,199,128,0.15)", border: "1px solid rgba(22,199,128,0.3)", borderRadius: 6, padding: "2px 8px", color: "#16C780", fontSize: 10, fontWeight: 700 }}>TRIGGERED</span>}
                  </div>
                  <div style={{ height: 4, background: "rgba(255,255,255,0.08)", borderRadius: 4, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${Math.min(alert.pct, 100)}%`, background: alert.triggered ? "#16C780" : "linear-gradient(90deg,#3B8EF3,#8B5CF6)", borderRadius: 4, transition: "width 0.5s" }} />
                  </div>
                  <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4 }}>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>Now {alert.current}</span>
                    <span style={{ color: "rgba(255,255,255,0.35)", fontSize: 10 }}>{alert.pct}%</span>
                  </div>
                </div>
              ))}

              {/* Quick action buttons */}
              <div style={{ marginTop: "auto", paddingTop: 14, borderTop: "1px solid rgba(255,255,255,0.06)", display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8 }}>
                {[
                  { label: "↔ Swap", grad: "linear-gradient(135deg,#3B8EF3,#8B5CF6)" },
                  { label: "↑ Send", grad: "linear-gradient(135deg,#16C780,#3B8EF3)" },
                  { label: "↓ Receive", grad: "linear-gradient(135deg,#F59E0B,#EF4444)" },
                  { label: "💳 Cash Out", grad: "linear-gradient(135deg,#8B5CF6,#EC4899)" },
                ].map((btn) => (
                  <button key={btn.label} style={{ background: btn.grad, border: "none", borderRadius: 10, padding: "10px", color: "#fff", fontWeight: 700, fontSize: 12, cursor: "pointer", fontFamily: "'Space Grotesk', sans-serif" }}>
                    {btn.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse { 0%,100% { opacity:1; } 50% { opacity:0.4; } }
        ::-webkit-scrollbar { width: 4px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 4px; }
      `}</style>
    </div>
  );
}
