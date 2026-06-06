import { useState, useRef } from "react";

const FAKE_HEADER = btoa(JSON.stringify({ alg: "RS256", typ: "JWT" })).replace(/=/g, "");
const FAKE_PAYLOAD = btoa(JSON.stringify({
  sub: "user_123", name: "Mithun Srinivas", role: "admin",
  iat: 1777322108, exp: 1777325708, iss: "nexus-gateway"
})).replace(/=/g, "");
const FAKE_SIG = "SflKxwRJSMeKKF2QT4fwpMeJf36POk6yJV_adQssw5c";
const TOKEN = `${FAKE_HEADER}.${FAKE_PAYLOAD}.${FAKE_SIG}`;

function LogLine({ entry }) {
  const isError = entry.level >= 50;
  const isWarn = entry.level === 40;
  const color = isError ? "var(--red)" : isWarn ? "var(--warn)" : "var(--green)";
  const label = isError ? "ERROR" : isWarn ? "WARN" : "INFO";
  const keys = Object.entries(entry).filter(([k]) => !["level", "msg", "hostname", "pid"].includes(k));
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

export default function JWTAuth() {
  const [token, setToken] = useState(null);
  const [logs, setLogs] = useState([]);
  const [decoded, setDecoded] = useState(false);
  const termRef = useRef(null);

  function scroll() {
    setTimeout(() => {
      if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
    }, 50);
  }

  function getToken() {
    const ts = Date.now();
    setLogs([
      { level: 30, time: ts, pid: 1, reqId: "req_auth_01", msg: "POST /auth/token", grantType: "client_credentials", clientId: "gateway-client" },
      { level: 30, time: ts + 12, pid: 1, reqId: "req_auth_01", msg: "Client credentials validated", clientId: "gateway-client", scope: "read:products write:orders" },
      { level: 30, time: ts + 18, pid: 1, reqId: "req_auth_01", msg: "RS256 token signed", userId: "user_123", role: "admin", expiresIn: 3600 },
      { level: 30, time: ts + 20, pid: 1, reqId: "req_auth_01", msg: "Token issued", statusCode: 200, responseTime: 20 },
    ]);
    setToken(TOKEN);
    setDecoded(false);
    scroll();
  }

  function hitWithToken() {
    if (!token) return;
    const ts = Date.now();
    const reqId = `nexus-${ts}-hqu2e`;
    setLogs(prev => [...prev,
      { level: 30, time: ts, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId, msg: "Incoming request", method: "GET", url: "/api/products" },
      { level: 30, time: ts + 2, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId, msg: "JWT validation successful", userId: "user_123", role: "admin" },
      { level: 30, time: ts + 5, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId, msg: "Rate limit check", limit: 100, remaining: 97, resetIn: 60 },
      { level: 30, time: ts + 8, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId, msg: "Forwarding request", upstream: "http://127.0.0.1:3001", algorithm: "round-robin" },
      { level: 30, time: ts + 202, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId, msg: "request completed", res: { statusCode: 200 }, responseTime: 202.23 },
    ]);
    scroll();
  }

  function hitWithout() {
    const ts = Date.now();
    const reqId = `nexus-${ts}-x4k9p`;
    setLogs(prev => [...prev,
      { level: 30, time: ts, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId, msg: "Incoming request", method: "GET", url: "/api/products" },
      { level: 50, time: ts + 1, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId, msg: "Missing Authorization header", statusCode: 401 },
    ]);
    scroll();
  }

  const parts = TOKEN.split(".");

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>AUTHENTICATION — JWT (RS256)</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Gateway uses RS256 asymmetric signing. Client authenticates with client_credentials grant,
          receives a signed JWT. Every subsequent request validates the token signature before proxying upstream.
        </div>
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
        <button onClick={getToken} style={{
          padding: "9px 20px", background: "var(--accent)", color: "#fff",
          border: "none", borderRadius: 4, fontSize: 12, fontWeight: 600,
          fontFamily: "var(--font-ui)", cursor: "pointer", letterSpacing: "0.05em"
        }}>POST /auth/token</button>
        <button onClick={hitWithToken} disabled={!token} style={{
          padding: "9px 20px",
          background: token ? "transparent" : "transparent",
          color: token ? "var(--green)" : "var(--muted)",
          border: `1px solid ${token ? "var(--green)" : "var(--border)"}`,
          borderRadius: 4, fontSize: 12, fontFamily: "var(--font-ui)", cursor: token ? "pointer" : "default"
        }}>GET /api/products — with token</button>
        <button onClick={hitWithout} style={{
          padding: "9px 20px", background: "transparent", color: "var(--red)",
          border: "1px solid var(--red)", borderRadius: 4, fontSize: 12,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>GET /api/products — no token → 401</button>
        <button onClick={() => { setLogs([]); setToken(null); setDecoded(false); }} style={{
          padding: "9px 16px", background: "transparent", color: "var(--muted)",
          border: "1px solid var(--border)", borderRadius: 4, fontSize: 12,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>Reset</button>
      </div>

      {/* Token display */}
      {token && (
        <div style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", padding: 16 }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
            <span style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em" }}>JWT TOKEN</span>
            <button onClick={() => setDecoded(d => !d)} style={{
              background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)",
              padding: "3px 10px", borderRadius: 3, fontSize: 10, fontFamily: "var(--font-ui)", cursor: "pointer"
            }}>{decoded ? "Show Raw" : "Decode"}</button>
          </div>

          {!decoded ? (
            <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, wordBreak: "break-all", lineHeight: 1.6 }}>
              <span style={{ color: "#FF7B72" }}>{parts[0]}</span>
              <span style={{ color: "var(--muted)" }}>.</span>
              <span style={{ color: "#79C0FF" }}>{parts[1]}</span>
              <span style={{ color: "var(--muted)" }}>.</span>
              <span style={{ color: "var(--green)" }}>{parts[2]}</span>
            </div>
          ) : (
            <div style={{ display: "flex", gap: 16 }}>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#FF7B72", letterSpacing: "0.1em", marginBottom: 6 }}>HEADER</div>
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text)", margin: 0, lineHeight: 1.6 }}>
                  {JSON.stringify({ alg: "RS256", typ: "JWT" }, null, 2)}
                </pre>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "#79C0FF", letterSpacing: "0.1em", marginBottom: 6 }}>PAYLOAD</div>
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text)", margin: 0, lineHeight: 1.6 }}>
                  {JSON.stringify({ sub: "user_123", name: "Mithun Srinivas", role: "admin", iat: 1777322108, exp: 1777325708, iss: "nexus-gateway" }, null, 2)}
                </pre>
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 9, color: "var(--green)", letterSpacing: "0.1em", marginBottom: 6 }}>SIGNATURE</div>
                <pre style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)", margin: 0, lineHeight: 1.6, wordBreak: "break-all" }}>
                  RS256( base64(header) + "." + base64(payload), privateKey )
                </pre>
              </div>
            </div>
          )}
        </div>
      )}

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
          borderRadius: "0 0 4px 4px", padding: 16, overflowY: "auto", minHeight: 160
        }}>
          {logs.length === 0
            ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                Start with POST /auth/token to get a JWT, then hit the protected route...
              </span>
            : logs.map((l, i) => <LogLine key={i} entry={l} />)
          }
          {logs.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{">"}_</span>}
        </div>
      </div>

    </div>
  );
}