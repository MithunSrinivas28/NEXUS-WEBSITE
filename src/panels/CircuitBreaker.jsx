import { useState, useRef, useEffect } from "react";

const U = { 3001: "http://127.0.0.1:3001", 3002: "http://127.0.0.1:3002" };

function LogLine({ entry }) {
  const color = entry.level >= 50 ? "var(--red)" : entry.level === 40 ? "var(--warn)" : "var(--green)";
  const label = entry.level >= 50 ? "ERROR" : entry.level === 40 ? "WARN" : "INFO";
  const keys = Object.entries(entry).filter(([k]) => !["level", "hostname", "pid"].includes(k));
  return (
    <div style={{ marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.7 }}>
      <span style={{ color: "var(--muted)" }}>{"{"}"level":</span>
      <span style={{ color }}>{entry.level}</span>
      {keys.map(([k, v]) => (
        <span key={k}>
          <span style={{ color: "var(--muted)" }}>,</span>
          <span style={{ color: "#6CA8FF" }}>"{k}"</span>
          <span style={{ color: "var(--muted)" }}>:</span>
          <span style={{ color: "var(--text)" }}>{typeof v === "string" ? `"${v}"` : JSON.stringify(v)}</span>
        </span>
      ))}
      <span style={{ color: "var(--muted)" }}>{"}"}</span>
      <span style={{ marginLeft: 8, color, fontSize: 10 }}>{label}</span>
    </div>
  );
}

const SC = s => s === "CLOSED" ? "var(--green)" : s === "OPEN" ? "var(--red)" : "var(--warn)";

export default function CircuitBreaker() {
  const [states, setStates] = useState({ 3001: "CLOSED", 3002: "CLOSED" });
  const [failures, setFailures] = useState({ 3001: 0, 3002: 0 });
  const [logs, setLogs] = useState([]);
  const [countdown, setCountdown] = useState(null);
  const termRef = useRef(null);
  const timerRef = useRef(null);
  const statesRef = useRef(states);

  useEffect(() => { statesRef.current = states; }, [states]);
  useEffect(() => () => clearInterval(timerRef.current), []);

  function push(newEntries) {
    setLogs(prev => [...prev, ...newEntries]);
    setTimeout(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, 50);
  }

  function sendRequest(port) {
    const upstream = U[port];
    const reqId = `nexus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const st = statesRef.current[port];

    if (st === "OPEN") {
      push([
        { level: 40, time: Date.now(), pid: 3112, reqId, msg: "Request blocked by circuit breaker", upstream, state: "OPEN" },
        { level: 50, time: Date.now(), pid: 3112, reqId, msg: "Fast-fail response", statusCode: 503, error: "Circuit breaker is OPEN" },
      ]);
      return;
    }

    if (st === "HALF-OPEN") {
      push([
        { level: 40, time: Date.now(), pid: 3112, reqId, msg: `[CB] HALF-OPEN — ${upstream} testing recovery` },
        { level: 30, time: Date.now() + 180, pid: 3112, reqId, msg: "Probe succeeded — circuit closed", upstream, attempt: 2 },
        { level: 30, time: Date.now() + 202, pid: 3112, reqId, msg: "Request succeeded after retry", upstream, attempt: 2 },
      ]);
      setStates(prev => ({ ...prev, [port]: "CLOSED" }));
      statesRef.current = { ...statesRef.current, [port]: "CLOSED" };
      setFailures(prev => ({ ...prev, [port]: 0 }));
      setCountdown(null);
      clearInterval(timerRef.current);
      return;
    }

    // CLOSED
    push([
      { level: 30, time: Date.now(), pid: 3112, reqId, msg: "Forwarding request", upstream, algorithm: "round-robin" },
      { level: 30, time: Date.now() + 202, pid: 3112, reqId, msg: "request completed", res: { statusCode: 200 }, responseTime: +(202 + Math.random() * 20 - 10).toFixed(2) },
    ]);
  }

  function killUpstream(port) {
    const upstream = U[port];
    const reqId = `nexus-${Date.now()}-kill`;
    push([
      { level: 50, time: Date.now(),       pid: 3112, reqId: reqId + "_0", msg: "Upstream connection failed", upstream, error: "ECONNREFUSED", attempt: 1 },
      { level: 50, time: Date.now() + 100, pid: 3112, reqId: reqId + "_1", msg: "Upstream connection failed", upstream, error: "ECONNREFUSED", attempt: 2 },
      { level: 50, time: Date.now() + 200, pid: 3112, reqId: reqId + "_2", msg: "Upstream connection failed", upstream, error: "ECONNREFUSED", attempt: 3 },
      { level: 50, time: Date.now() + 300, pid: 3112, reqId,               msg: "Circuit breaker opened",    upstream, failures: 3, threshold: 3 },
      { level: 40, time: Date.now() + 310, pid: 3112, reqId,               msg: "All requests will fast-fail for 10s", upstream, resetTimeout: 10000 },
    ]);
    setStates(prev => ({ ...prev, [port]: "OPEN" }));
    statesRef.current = { ...statesRef.current, [port]: "OPEN" };
    setFailures(prev => ({ ...prev, [port]: 3 }));
    setCountdown(10);
    clearInterval(timerRef.current);
    timerRef.current = setInterval(() => {
      setCountdown(c => {
        if (c <= 1) {
          clearInterval(timerRef.current);
          setStates(prev => ({ ...prev, [port]: "HALF-OPEN" }));
          statesRef.current = { ...statesRef.current, [port]: "HALF-OPEN" };
          push([{ level: 40, time: Date.now(), pid: 3112, reqId: `nexus-${Date.now()}-probe`, msg: `[CB] HALF-OPEN — ${upstream} testing recovery` }]);
          return null;
        }
        return c - 1;
      });
    }, 1000);
  }

  function reset() {
    setStates({ 3001: "CLOSED", 3002: "CLOSED" });
    statesRef.current = { 3001: "CLOSED", 3002: "CLOSED" };
    setFailures({ 3001: 0, 3002: 0 });
    setLogs([]);
    setCountdown(null);
    clearInterval(timerRef.current);
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>CIRCUIT BREAKER</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Opossum-based per-upstream breaker. After 3 consecutive failures the breaker opens —
          all requests fast-fail with 503 for 10 seconds. Then enters HALF-OPEN, sends one probe.
          On success it closes. On failure it re-opens.
        </div>
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {[3001, 3002].map(port => {
          const st = states[port];
          const sc = SC(st);
          return (
            <div key={port} style={{
              flex: 1, border: `1px solid ${st === "CLOSED" ? "var(--border)" : sc}`,
              borderRadius: 4, padding: 16, background: "var(--surface)", transition: "border 0.3s"
            }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: 12, fontWeight: 600 }}>:{port}</span>
                <span style={{ fontSize: 10, fontWeight: 700, color: sc, border: `1px solid ${sc}`, padding: "2px 8px", borderRadius: 3 }}>{st}</span>
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginBottom: 10 }}>
                Failures: <span style={{ color: failures[port] > 0 ? "var(--red)" : "var(--text)", fontFamily: "var(--font-mono)" }}>{failures[port]}/3</span>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 5, marginBottom: 14, fontSize: 9, fontFamily: "var(--font-mono)" }}>
                {["CLOSED", "OPEN", "HALF-OPEN"].map((s, i) => (
                  <span key={s} style={{ display: "flex", alignItems: "center", gap: 5 }}>
                    <span style={{
                      padding: "2px 5px", borderRadius: 2,
                      background: st === s ? sc : "transparent",
                      color: st === s ? "#000" : "var(--muted)",
                      border: `1px solid ${st === s ? sc : "var(--border)"}`,
                      transition: "all 0.3s"
                    }}>{s}</span>
                    {i < 2 && <span style={{ color: "var(--muted)" }}>→</span>}
                  </span>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <button onClick={() => sendRequest(port)} style={{
                  flex: 1, padding: "7px 0", background: "transparent", color: "var(--text)",
                  border: "1px solid var(--border)", borderRadius: 3, fontSize: 10,
                  fontFamily: "var(--font-ui)", cursor: "pointer"
                }}>Send Request</button>
                <button onClick={() => killUpstream(port)} disabled={st !== "CLOSED"} style={{
                  flex: 1, padding: "7px 0", background: "transparent",
                  color: st === "CLOSED" ? "var(--red)" : "var(--muted)",
                  border: `1px solid ${st === "CLOSED" ? "var(--red)" : "var(--border)"}`,
                  borderRadius: 3, fontSize: 10, fontFamily: "var(--font-ui)",
                  cursor: st === "CLOSED" ? "pointer" : "default"
                }}>Kill Upstream</button>
              </div>
            </div>
          );
        })}
      </div>

      {countdown !== null && (
        <div style={{
          padding: "10px 16px", border: "1px solid var(--warn)", borderRadius: 4,
          background: "rgba(255,179,71,0.06)", fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--warn)"
        }}>⏱ Circuit open — probing in {countdown}s...</div>
      )}

      <button onClick={reset} style={{
        alignSelf: "flex-start", padding: "8px 18px", background: "transparent",
        color: "var(--muted)", border: "1px solid var(--border)",
        borderRadius: 4, fontSize: 12, fontFamily: "var(--font-ui)", cursor: "pointer"
      }}>Reset All</button>

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
          borderRadius: "0 0 4px 4px", padding: 16, overflowY: "auto", minHeight: 160
        }}>
          {logs.length === 0
            ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                Send a request first, then kill an upstream to watch the breaker trip...
              </span>
            : logs.map((l, i) => <LogLine key={i} entry={l} />)
          }
          {logs.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{">"}_</span>}
        </div>
      </div>
    </div>
  );
}