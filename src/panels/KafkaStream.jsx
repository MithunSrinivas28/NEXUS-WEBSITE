import { useState, useRef, useEffect } from "react";

const TOPICS = ["gateway-events", "cache-events", "consumer-actions"];

const TOPIC_COLOR = {
  "gateway-events":    "var(--accent)",
  "cache-events":      "var(--warn)",
  "consumer-actions":  "var(--green)",
};

const EVENT_TEMPLATES = {
  "gateway-events": [
    { msg: "Request received",         method: "GET",  url: "/api/products", ip: "203.0.113.42" },
    { msg: "Request received",         method: "POST", url: "/api/orders",   ip: "198.51.100.7" },
    { msg: "Rate limit approaching",   ip: "203.0.113.42", remaining: 3, limit: 10 },
    { msg: "Rate limit exceeded",      ip: "203.0.113.42", remaining: 0, statusCode: 429 },
    { msg: "JWT validation failed",    error: "TokenExpiredError", statusCode: 401 },
    { msg: "Circuit breaker opened",   upstream: "http://127.0.0.1:3002", failures: 3 },
    { msg: "Request completed",        statusCode: 200, responseTime: 202, upstream: "http://127.0.0.1:3001" },
  ],
  "cache-events": [
    { msg: "Cache MISS",               key: "product:1", ttl: 60 },
    { msg: "Cache HIT",                key: "product:1", ttl: 58, hitCount: 3 },
    { msg: "Singleflight dedup",       key: "product:2", dedupedTo: 1, callers: 5 },
    { msg: "Hot key detected",         key: "product:1", hitCount: 5, ttlExtended: 120 },
    { msg: "Tag invalidation",         tag: "products",  deletedKeys: 2 },
    { msg: "Cache HIT",                key: "user:123",  ttl: 120, hitCount: 1 },
  ],
  "consumer-actions": [
    { msg: "IP block triggered",       ip: "203.0.113.42", reason: "rate_limit_exceeded", duration: "1h" },
    { msg: "Anomaly detected",         ip: "198.51.100.7", requestCount: 450, window: "60s" },
    { msg: "Alert dispatched",         type: "circuit_breaker_open", upstream: "http://127.0.0.1:3002" },
    { msg: "IP block lifted",          ip: "203.0.113.42", reason: "ttl_expired" },
    { msg: "Latency spike logged",     upstream: "http://127.0.0.1:3001", p95: "890ms", threshold: "500ms" },
    { msg: "Consumer lag warning",     topic: "gateway-events", lag: 1240, partition: 0 },
  ],
};

function randomFrom(arr) { return arr[Math.floor(Math.random() * arr.length)]; }
function randomTopic()   { return TOPICS[Math.floor(Math.random() * TOPICS.length)]; }

function buildEvent(topic) {
  const template = randomFrom(EVENT_TEMPLATES[topic]);
  return {
    level: template.msg.includes("exceeded") || template.msg.includes("failed") || template.msg.includes("opened") ? 50
         : template.msg.includes("approaching") || template.msg.includes("spike") || template.msg.includes("lag") || template.msg.includes("Anomaly") ? 40
         : 30,
    time: Date.now(),
    pid: 1,
    hostname: "nexus-consumer",
    topic,
    partition: Math.floor(Math.random() * 3),
    offset: Math.floor(Math.random() * 9000) + 1000,
    ...template,
  };
}

function EventLine({ entry }) {
  const color = entry.level >= 50 ? "var(--red)" : entry.level === 40 ? "var(--warn)" : "var(--green)";
  const label = entry.level >= 50 ? "ERROR" : entry.level === 40 ? "WARN" : "INFO";
  const tc = TOPIC_COLOR[entry.topic] || "var(--muted)";
  const keys = Object.entries(entry).filter(([k]) => !["level", "hostname", "pid", "topic"].includes(k));
  return (
    <div style={{ marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.7 }}>
      <span style={{ color: tc, marginRight: 6, fontSize: 9, fontWeight: 700 }}>[{entry.topic}]</span>
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

export default function KafkaStream() {
  const [events, setEvents] = useState([]);
  const [running, setRunning] = useState(false);
  const [filter, setFilter] = useState("all");
  const [counts, setCounts] = useState({ "gateway-events": 0, "cache-events": 0, "consumer-actions": 0 });
  const termRef = useRef(null);
  const intervalRef = useRef(null);

  function scroll() {
    setTimeout(() => {
      if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight;
    }, 50);
  }

  function startStream() {
    if (running) {
      clearInterval(intervalRef.current);
      setRunning(false);
      return;
    }
    setRunning(true);
    intervalRef.current = setInterval(() => {
      const topic = randomTopic();
      const event = buildEvent(topic);
      setEvents(prev => [...prev.slice(-120), event]);
      setCounts(prev => ({ ...prev, [topic]: prev[topic] + 1 }));
      scroll();
    }, 600);
  }

  function emitOne(topic) {
    const event = buildEvent(topic);
    setEvents(prev => [...prev.slice(-120), event]);
    setCounts(prev => ({ ...prev, [topic]: prev[topic] + 1 }));
    scroll();
  }

  function reset() {
    clearInterval(intervalRef.current);
    setRunning(false);
    setEvents([]);
    setCounts({ "gateway-events": 0, "cache-events": 0, "consumer-actions": 0 });
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  const filtered = filter === "all" ? events : events.filter(e => e.topic === filter);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%" }}>

      <div>
        <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>KAFKA EVENT BUS</div>
        <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
          kafkajs producer emits events from gateway and cache proxy into three topics.
          A separate consumer service subscribes, handles IP blocking, anomaly detection, and alerting.
          Events are partitioned for ordering guarantees per IP.
        </div>
      </div>

      {/* Topic counters */}
      <div style={{ display: "flex", gap: 12 }}>
        {TOPICS.map(t => (
          <div key={t} style={{
            flex: 1, border: `1px solid ${TOPIC_COLOR[t]}22`,
            borderRadius: 4, padding: "12px 16px", background: "var(--surface)"
          }}>
            <div style={{ fontSize: 9, color: TOPIC_COLOR[t], letterSpacing: "0.1em", marginBottom: 6 }}>{t.toUpperCase()}</div>
            <div style={{ fontSize: 26, fontWeight: 700, fontFamily: "var(--font-mono)", color: TOPIC_COLOR[t] }}>
              {counts[t]}
            </div>
            <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 4 }}>events</div>
          </div>
        ))}
      </div>

      {/* Controls */}
      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        <button onClick={startStream} style={{
          padding: "8px 20px",
          background: running ? "transparent" : "var(--accent)",
          color: running ? "var(--red)" : "#fff",
          border: `1px solid ${running ? "var(--red)" : "var(--accent)"}`,
          borderRadius: 4, fontSize: 11, fontWeight: 600,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>{running ? "⏹ Stop Stream" : "▶ Start Stream"}</button>
        {TOPICS.map(t => (
          <button key={t} onClick={() => emitOne(t)} style={{
            padding: "8px 14px", background: "transparent",
            color: TOPIC_COLOR[t],
            border: `1px solid ${TOPIC_COLOR[t]}`,
            borderRadius: 4, fontSize: 10,
            fontFamily: "var(--font-ui)", cursor: "pointer"
          }}>+ {t.split("-")[0]}</button>
        ))}
        <button onClick={reset} style={{
          padding: "8px 14px", background: "transparent", color: "var(--muted)",
          border: "1px solid var(--border)", borderRadius: 4, fontSize: 11,
          fontFamily: "var(--font-ui)", cursor: "pointer"
        }}>Reset</button>
      </div>

      {/* Filter */}
      <div style={{ display: "flex", gap: 6 }}>
        {["all", ...TOPICS].map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{
            padding: "4px 12px",
            background: filter === f ? "rgba(29,110,255,0.12)" : "transparent",
            color: filter === f ? "var(--text)" : "var(--muted)",
            border: `1px solid ${filter === f ? "var(--accent)" : "var(--border)"}`,
            borderRadius: 3, fontSize: 10, fontFamily: "var(--font-ui)", cursor: "pointer"
          }}>{f}</button>
        ))}
      </div>

      {/* Terminal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{
          display: "flex", justifyContent: "space-between", alignItems: "center",
          padding: "8px 14px", background: "#0a0f18",
          border: "1px solid var(--border)", borderBottom: "none", borderRadius: "4px 4px 0 0"
        }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "var(--muted)" }}>
            CONSUMER TERMINAL
            {running && <span style={{ marginLeft: 8, color: "var(--green)" }}>● LIVE</span>}
          </span>
          <button onClick={() => setEvents([])} style={{
            background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
            padding: "3px 10px", borderRadius: 3, fontSize: 11, fontFamily: "var(--font-ui)", cursor: "pointer"
          }}>Clear</button>
        </div>
        <div ref={termRef} style={{
          flex: 1, background: "#0a0f18", border: "1px solid var(--border)",
          borderRadius: "0 0 4px 4px", padding: 16, overflowY: "auto", minHeight: 200
        }}>
          {filtered.length === 0
            ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--muted)" }}>
                Press ▶ Start Stream for live events, or emit individual topic events manually...
              </span>
            : filtered.map((e, i) => <EventLine key={i} entry={e} />)
          }
          {filtered.length > 0 && (
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: running ? "var(--green)" : "var(--muted)" }}>
              {running ? "● consuming..." : "> _"}
            </span>
          )}
        </div>
      </div>

    </div>
  );
}