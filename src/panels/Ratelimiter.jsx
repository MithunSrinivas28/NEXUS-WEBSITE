import { useState, useEffect, useRef } from "react";

const LIMIT = 10;
const REFILL_RATE = 2;

function buildLog(remaining, reqId, blocked) {
  const base = {
    level: blocked ? 50 : 30,
    time: Date.now(),
    pid: 1,
    hostname: "nexus-sim",
    reqId,
    msg: blocked ? "Rate limit exceeded" : "Rate limit check passed",
    method: "GET",
    url: "/api/products",
    limit: LIMIT,
    remaining: blocked ? 0 : remaining,
    resetIn: 60,
  };
  if (blocked) base.statusCode = 429;
  else base.statusCode = 200;
  return base;
}

function LogLine({ entry }) {
  const isError = entry.level >= 50;
  const isWarn = entry.level === 40;
  const color = isError ? "var(--red)" : isWarn ? "var(--warn)" : "var(--green)";
  const label = isError ? "ERROR" : isWarn ? "WARN" : "INFO";
  const keys = Object.entries(entry).filter(([k]) => !["level","msg","hostname","pid"].includes(k));

  return (
    <div style={{ marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.7 }}>
      <span style={{ color: "var(--muted)" }}>{"{"}</span>
      <span style={{ color: "var(--muted)" }}>"level":</span>
      <span style={{ color }}>{entry.level}</span>
      {keys.map(([k, v]) => (
        <span key={k}>
          <span style={{ color: "var(--muted)" }}>,</span>
          <span style={{ color: "#6CA8FF" }}>"{k}"</span>
          <span style={{ color: "var(--muted)" }}>:</span>
          <span style={{ color: "var(--text)" }}>{typeof v === "string" ? `"${v}"` : v}</span>
        </span>
      ))}
      <span style={{ color: "var(--muted)" }}>{"}"}</span>
      <span style={{ marginLeft: 8, color, fontSize: 10 }}>{label}</span>
    </div>
  );
}

export default function RateLimiter() {
  const [tokens, setTokens] = useState(LIMIT);
  const [logs, setLogs] = useState([]);
  const [reqCount, setReqCount] = useState(0);
  const termRef = useRef(null);
  const tokensRef = useRef(LIMIT);

  useEffect(() => {
    const t = setInterval(() => {
      tokensRef.current = Math.min(LIMIT, tokensRef.current + REFILL_RATE);
      setTokens(tokensRef.current);
    }, 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
  }, [logs]);

  function sendRequest() {
    const count = reqCount + 1;
    setReqCount(count);
    const reqId = `req_${String(count).padStart(2, "0")}`;
    const blocked = tokensRef.current <= 0;

    if (!blocked) {
      tokensRef.current = Math.max(0, tokensRef.current - 1);
      setTokens(tokensRef.current);
    }

    setLogs(prev => [...prev, buildLog(tokensRef.current, reqId, blocked)]);
  }

  function reset() {
    tokensRef.current = LIMIT;
    setTokens(LIMIT);
    setLogs([]);
    setReqCount(0);
  }

  const pct = (tokens / LIMIT) * 100;
  const barColor = pct > 50 ? "var(--green)" : pct > 20 ? "var(--warn)" : "var(--red)";

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>

      {/* Header */}
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>RATE LIMITER</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Token bucket algorithm. Capacity: {LIMIT} tokens. Refill: {REFILL_RATE}/sec.
          Each request consumes 1 token. At 0 tokens, requests return HTTP 429.
        </div>
      </div>

      {/* Token bucket visual + controls */}
      <div style={{ display: "flex", gap: 24, alignItems: "flex-start" }}>

        {/* Bucket */}
        <div style={{
          border: "1px solid var(--border)", borderRadius: 4,
          padding: 20, background: "var(--surface)", minWidth: 200
        }}>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 12 }}>TOKEN BUCKET</div>
          <div style={{ fontSize: 36, fontWeight: 700, fontFamily: "var(--font-mono)", color: barColor, marginBottom: 8 }}>
            {tokens}<span style={{ fontSize: 16, color: "var(--muted)", fontWeight: 400 }}>/{LIMIT}</span>
          </div>
          <div style={{ background: "var(--bg)", borderRadius: 2, height: 6, overflow: "hidden", marginBottom: 12 }}>
            <div style={{
              width: `${pct}%`, height: "100%", background: barColor,
              transition: "width 0.3s, background 0.3s"
            }} />
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>
            Refilling at <span style={{ color: "var(--text)" }}>{REFILL_RATE} tokens/sec</span>
          </div>
        </div>

        {/* Controls */}
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <button onClick={sendRequest} style={{
            padding: "10px 24px", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600,
            fontFamily: "var(--font-ui)", cursor: "pointer", letterSpacing: "0.05em"
          }}>
            Send Request
          </button>
          <button onClick={reset} style={{
            padding: "10px 24px", background: "transparent", color: "var(--muted)",
            border: "1px solid var(--border)", borderRadius: 4, fontSize: 12,
            fontFamily: "var(--font-ui)", cursor: "pointer"
          }}>
            Reset
          </button>
          <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 4 }}>
            Total requests: <span style={{ color: "var(--text)", fontFamily: "var(--font-mono)" }}>{reqCount}</span>
          </div>
          <div style={{ fontSize: 10, color: "var(--muted)" }}>
            Blocked: <span style={{ color: "var(--red)", fontFamily: "var(--font-mono)" }}>
              {logs.filter(l => l.level >= 50).length}
            </span>
          </div>
        </div>
      </div>

      {/* Terminal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px", background: "#0a0f18",
          border: "1px solid var(--border)", borderBottom: "none", borderRadius: "4px 4px 0 0"
        }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--muted)" }}>TERMINAL OUTPUT</span>
          <button onClick={() => setLogs([])} style={{
            background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
            padding: "3px 10px", borderRadius: 3, fontSize: 11, fontFamily: "var(--font-ui)", cursor: "pointer"
          }}>Clear</button>
        </div>
        <div ref={termRef} style={{
          flex: 1, background: "#0a0f18", border: "1px solid var(--border)",
          borderRadius: "0 0 4px 4px", padding: 16, overflowY: "auto", minHeight: 200
        }}>
          {logs.length === 0
            ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                Press "Send Request" to simulate traffic. Keep clicking until you hit the limit...
              </span>
            : logs.map((l, i) => <LogLine key={i} entry={l} />)
          }
          {logs.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{">"}_</span>}
        </div>
      </div>

    </div>
  );
}