import { useState, useRef } from "react";

const CACHE = {};
const HIT_COUNTS = {};

function jitter(base) { return +(base + (Math.random() * 8 - 4)).toFixed(2); }

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

const PRESETS = ["product:1", "product:2", "user:123", "order:789"];

export default function CacheProxy() {
  const [key, setKey] = useState("product:1");
  const [logs, setLogs] = useState([]);
  const [stats, setStats] = useState({ hits: 0, misses: 0, keys: 0 });
  const [singleflightResult, setSingleflightResult] = useState(null);
  const termRef = useRef(null);

  function push(entries) {
    setLogs(prev => [...prev, ...entries]);
    setTimeout(() => {
      if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
    }, 50);
  }

  function doGet() {
    if (!key.trim()) return;
    const k = key.trim();
    const reqId = `nexus-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
    const ts = Date.now();
    HIT_COUNTS[k] = (HIT_COUNTS[k] || 0) + 1;
    const isHot = HIT_COUNTS[k] >= 5;

    if (CACHE[k]) {
      // Cache hit
      const rt = jitter(2);
      push([
        { level: 30, time: ts, pid: 1, reqId, msg: "RESP command received", command: "GET", key: k },
        { level: 30, time: ts + 1, pid: 1, reqId, msg: "Cache HIT", key: k, ttl: CACHE[k].ttl, hitCount: HIT_COUNTS[k] },
        ...(isHot ? [{ level: 40, time: ts + 2, pid: 1, reqId, msg: `[hotkey] ${k} is hot (${HIT_COUNTS[k]} hits) — TTL extended by 120s`, key: k, newTtl: CACHE[k].ttl + 120 }] : []),
        { level: 30, time: ts + rt, pid: 1, reqId, msg: "Response from cache", key: k, responseTime: rt, source: "cache" },
      ]);
      if (isHot) CACHE[k].ttl += 120;
      setStats(s => ({ ...s, hits: s.hits + 1 }));
    } else {
      // Cache miss
      const rt = jitter(45);
      const val = k.startsWith("product") ? { id: 1, name: "Laptop", price: 999 } : k.startsWith("user") ? { id: 123, name: "Mithun" } : { id: 789, status: "SUCCESS" };
      CACHE[k] = { value: val, ttl: 60 };
      push([
        { level: 30, time: ts, pid: 1, reqId, msg: "RESP command received", command: "GET", key: k },
        { level: 30, time: ts + 1, pid: 1, reqId, msg: "Cache MISS", key: k },
        { level: 30, time: ts + 2, pid: 1, reqId, msg: "Forwarding to Redis", host: "127.0.0.1", port: 6379 },
        { level: 30, time: ts + rt, pid: 1, reqId, msg: "Redis response received", key: k, value: JSON.stringify(val), ttl: 60 },
        { level: 30, time: ts + rt + 1, pid: 1, reqId, msg: "Value cached", key: k, ttl: 60, responseTime: rt, source: "redis" },
      ]);
      setStats(s => ({ ...s, misses: s.misses + 1, keys: Object.keys(CACHE).length }));
    }
  }

  function doInvalidate() {
    if (!key.trim()) return;
    const k = key.trim();
    const reqId = `nexus-${Date.now()}-inv`;
    const ts = Date.now();
    const tag = k.split(":")[0] + "s"; // product:1 → products
    const deleted = Object.keys(CACHE).filter(ck => ck.startsWith(k.split(":")[0]));
    deleted.forEach(dk => { delete CACHE[dk]; delete HIT_COUNTS[dk]; });
    push([
      { level: 30, time: ts, pid: 1, reqId, msg: "Tag invalidation triggered", tag, scriptType: "Lua" },
      { level: 30, time: ts + 5, pid: 1, reqId, msg: `[invalidation] tag:${tag} — deleted ${deleted.length} keys`, keys: deleted },
      { level: 30, time: ts + 6, pid: 1, reqId, msg: "Cache cleared", deletedCount: deleted.length },
    ]);
    setStats(s => ({ ...s, keys: Object.keys(CACHE).length }));
  }

  async function doSingleflight() {
    setSingleflightResult(null);
    const k = key.trim() || "product:1";
    const reqId = `nexus-${Date.now()}-sf`;
    const ts = Date.now();
    const entries = [];

    // 5 concurrent requests — only 1 Redis call
    for (let i = 0; i < 5; i++) {
      entries.push({ level: 30, time: ts + i, pid: 1, reqId: `${reqId}_${i}`, msg: "Concurrent GET received", key: k, requestIndex: i + 1 });
    }
    entries.push({ level: 40, time: ts + 5, pid: 1, reqId, msg: "Singleflight: deduplicating 5 concurrent requests", key: k, dedupedTo: 1 });
    entries.push({ level: 30, time: ts + 6, pid: 1, reqId, msg: "Single Redis call dispatched", key: k, host: "127.0.0.1", port: 6379 });
    entries.push({ level: 30, time: ts + 44, pid: 1, reqId, msg: "Redis response received", key: k, responseTime: 44 });
    for (let i = 0; i < 5; i++) {
      entries.push({ level: 30, time: ts + 45 + i, pid: 1, reqId: `${reqId}_${i}`, msg: "Response shared with waiting caller", key: k, callerIndex: i + 1 });
    }

    push(entries);
    CACHE[k] = { value: { id: 1, name: "Laptop", price: 999 }, ttl: 60 };
    setStats(s => ({ ...s, misses: s.misses + 1, keys: Object.keys(CACHE).length }));
    setSingleflightResult({ calls: 5, redisHits: 1, saved: 4 });
  }

  function reset() {
    Object.keys(CACHE).forEach(k => delete CACHE[k]);
    Object.keys(HIT_COUNTS).forEach(k => delete HIT_COUNTS[k]);
    setLogs([]);
    setStats({ hits: 0, misses: 0, keys: 0 });
    setSingleflightResult(null);
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>CACHE PROXY</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          Hand-rolled TCP proxy that speaks raw RESP protocol. YAML policy engine controls TTLs per key pattern.
          Singleflight deduplicates concurrent requests — 5 callers trigger 1 Redis call.
          Hot keys (5+ hits) get automatic TTL extension via Lua script.
        </div>
      </div>

      {/* Stats */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "CACHE HITS",   value: stats.hits,   color: "var(--green)" },
          { label: "CACHE MISSES", value: stats.misses, color: "var(--warn)" },
          { label: "CACHED KEYS",  value: stats.keys,   color: "var(--accent)" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, border: "1px solid var(--border)", borderRadius: 4,
            padding: "12px 16px", background: "var(--surface)"
          }}>
            <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 6 }}>{s.label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", color: s.color }}>{s.value}</div>
          </div>
        ))}
      </div>

      {/* Key input + presets */}
      <div>
        <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 8 }}>CACHE KEY</div>
        <div style={{ display: "flex", gap: 8, marginBottom: 8 }}>
          <input
            value={key}
            onChange={e => setKey(e.target.value)}
            onKeyDown={e => e.key === "Enter" && doGet()}
            placeholder="e.g. product:1"
            style={{
              flex: 1, padding: "8px 12px", background: "var(--surface)",
              border: "1px solid var(--border)", borderRadius: 4,
              color: "var(--text)", fontFamily: "var(--font-mono)", fontSize: 12,
              outline: "none"
            }}
          />
        </div>
        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
          {PRESETS.map(p => (
            <button key={p} onClick={() => setKey(p)} style={{
              padding: "3px 10px", background: "transparent",
              color: key === p ? "var(--accent)" : "var(--muted)",
              border: `1px solid ${key === p ? "var(--accent)" : "var(--border)"}`,
              borderRadius: 3, fontSize: 10, fontFamily: "var(--font-mono)", cursor: "pointer"
            }}>{p}</button>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={doGet} style={{
          padding: "8px 18px", background: "var(--accent)", color: "#fff",
          border: "none", borderRadius: 4, fontSize: 11, fontWeight: 600,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>GET {key || "key"}</button>
        <button onClick={doSingleflight} style={{
          padding: "8px 18px", background: "transparent", color: "var(--warn)",
          border: "1px solid var(--warn)", borderRadius: 4, fontSize: 11,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>Singleflight × 5</button>
        <button onClick={doInvalidate} style={{
          padding: "8px 18px", background: "transparent", color: "var(--red)",
          border: "1px solid var(--red)", borderRadius: 4, fontSize: 11,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>Invalidate Tag</button>
        <button onClick={reset} style={{
          padding: "8px 14px", background: "transparent", color: "var(--muted)",
          border: "1px solid var(--border)", borderRadius: 4, fontSize: 11,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>Reset</button>
      </div>

      {/* Singleflight result */}
      {singleflightResult && (
        <div style={{
          padding: "10px 16px", border: "1px solid var(--warn)", borderRadius: 4,
          background: "rgba(255,179,71,0.06)", fontFamily: "var(--font-mono)", fontSize: 11
        }}>
          <span style={{ color: "var(--warn)" }}>Singleflight: </span>
          <span style={{ color: "var(--text)" }}>{singleflightResult.calls} callers → </span>
          <span style={{ color: "var(--green)" }}>{singleflightResult.redisHits} Redis call</span>
          <span style={{ color: "var(--muted)" }}> — {singleflightResult.saved} duplicate requests eliminated</span>
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
                GET a key twice to see cache miss → hit. Hit 5 times to trigger hot key TTL extension...
              </span>
            : logs.map((l, i) => <LogLine key={i} entry={l} />)
          }
          {logs.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>{">"}_</span>}
        </div>
      </div>

    </div>
  );
}