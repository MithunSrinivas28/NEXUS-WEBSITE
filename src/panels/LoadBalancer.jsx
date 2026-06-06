import { useState, useRef } from "react";

const UPSTREAMS = ["http://127.0.0.1:3001", "http://127.0.0.1:3002"];
const WEIGHTS = { "http://127.0.0.1:3001": 2, "http://127.0.0.1:3002": 1 };

function jitter(base) { return +(base + (Math.random() * 20 - 10)).toFixed(2); }
function weightedRR(i) { return i % 3 === 2 ? UPSTREAMS[1] : UPSTREAMS[0]; }
function leastConn(conns) { return conns[UPSTREAMS[0]] <= conns[UPSTREAMS[1]] ? UPSTREAMS[0] : UPSTREAMS[1]; }

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

export default function LoadBalancer() {
  const [algo, setAlgo] = useState("round-robin");
  const [counts, setCounts] = useState({ "http://127.0.0.1:3001": 0, "http://127.0.0.1:3002": 0 });
  const [conns, setConns] = useState({ "http://127.0.0.1:3001": 0, "http://127.0.0.1:3002": 0 });
  const [logs, setLogs] = useState([]);
  const [firing, setFiring] = useState(false);
  const termRef = useRef(null);

  function reset() {
    setCounts({ "http://127.0.0.1:3001": 0, "http://127.0.0.1:3002": 0 });
    setConns({ "http://127.0.0.1:3001": 0, "http://127.0.0.1:3002": 0 });
    setLogs([]);
  }

  async function fire10() {
    if (firing) return;
    setFiring(true);
    const newCounts = { "http://127.0.0.1:3001": 0, "http://127.0.0.1:3002": 0 };
    const newConns  = { "http://127.0.0.1:3001": 0, "http://127.0.0.1:3002": 0 };
    setCounts({ ...newCounts });
    setConns({ ...newConns });
    setLogs([]);

    for (let i = 0; i < 10; i++) {
      const upstream =
        algo === "round-robin"        ? UPSTREAMS[i % 2] :
        algo === "least-connections"  ? leastConn(newConns) :
        weightedRR(i);

      const reqId = `nexus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
      const rt = jitter(202);
      newCounts[upstream]++;
      newConns[upstream]++;

      const pair = [
        { level: 30, time: Date.now(), pid: 3112, reqId, msg: "Forwarding request", upstream, algorithm: algo, activeConnections: newConns[upstream] },
        { level: 30, time: Date.now() + rt, pid: 3112, reqId, msg: "request completed", res: { statusCode: 200 }, responseTime: rt },
      ];

      newConns[upstream] = Math.max(0, newConns[upstream] - 1);

      // single setState per tick — no overwrite
      setLogs(prev => [...prev, ...pair]);
      setCounts({ ...newCounts });
      setConns({ ...newConns });

      if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
      await new Promise(r => setTimeout(r, 140));
    }
    setFiring(false);
  }

  const total = counts[UPSTREAMS[0]] + counts[UPSTREAMS[1]];

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>
      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>LOAD BALANCER</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Three algorithms implemented. Round-robin cycles upstreams sequentially.
          Least-connections routes to the upstream with fewest active requests.
          Weighted round-robin uses GCD — 3001 gets 2x traffic.
        </div>
      </div>

      <div style={{ display: "flex", gap: 8 }}>
        {["round-robin", "least-connections", "weighted-rr"].map(a => (
          <button key={a} onClick={() => { setAlgo(a); reset(); }} style={{
            padding: "7px 16px",
            background: algo === a ? "var(--accent)" : "transparent",
            color: algo === a ? "#fff" : "var(--muted)",
            border: `1px solid ${algo === a ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 4, fontSize: 11, fontFamily: "var(--font-ui)",
            cursor: "pointer", fontWeight: algo === a ? 600 : 400
          }}>{a}</button>
        ))}
      </div>

      <div style={{ display: "flex", gap: 16 }}>
        {UPSTREAMS.map(u => {
          const port = u.includes("3001") ? "3001" : "3002";
          const count = counts[u];
          const pct = total > 0 ? Math.round((count / total) * 100) : 0;
          return (
            <div key={u} style={{ flex: 1, border: "1px solid var(--border)", borderRadius: 4, padding: 16, background: "var(--surface)" }}>
              <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
                <span style={{ fontSize: 11, fontWeight: 600, fontFamily: "var(--font-mono)" }}>:{port}</span>
                <span style={{ fontSize: 10, color: "var(--muted)" }}>
                  {algo === "weighted-rr" ? `weight: ${WEIGHTS[u]}` : `active: ${conns[u]}`}
                </span>
              </div>
              <div style={{ fontSize: 28, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--accent)", marginBottom: 8 }}>
                {count}<span style={{ fontSize: 12, color: "var(--muted)", fontWeight: 400 }}> reqs</span>
              </div>
              <div style={{ background: "var(--bg)", borderRadius: 2, height: 4, overflow: "hidden" }}>
                <div style={{ width: `${pct}%`, height: "100%", background: "var(--accent)", transition: "width 0.3s" }} />
              </div>
              <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 6 }}>{pct}% of traffic</div>
            </div>
          );
        })}
      </div>

      <div style={{ display: "flex", gap: 10 }}>
        <button onClick={fire10} disabled={firing} style={{
          padding: "9px 24px",
          background: firing ? "transparent" : "var(--accent)",
          color: firing ? "var(--muted)" : "#fff",
          border: "1px solid var(--border)", borderRadius: 4,
          fontSize: 12, fontWeight: 600, fontFamily: "var(--font-ui)",
          cursor: firing ? "default" : "pointer"
        }}>{firing ? "Firing..." : "Fire 10 Requests"}</button>
        <button onClick={reset} style={{
          padding: "9px 16px", background: "transparent", color: "var(--muted)",
          border: "1px solid var(--border)", borderRadius: 4,
          fontSize: 12, fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>Reset</button>
      </div>

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
                Select an algorithm and fire 10 requests...
              </span>
            : logs.map((l, i) => <LogLine key={i} entry={l} />)
          }
          {logs.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{">"}_</span>}
        </div>
      </div>
    </div>
  );
}