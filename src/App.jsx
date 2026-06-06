import { useState, useEffect } from "react";
import Overview from "./panels/Overview";
import RateLimiter from "./panels/RateLimiter";
import JWTAuth from "./panels/JWTAuth";
import LoadBalancer from "./panels/LoadBalancer";
import CircuitBreaker from "./panels/CircuitBreaker";
import CacheProxy from "./panels/CacheProxy";
import KafkaStream from "./panels/KafkaStream";
import Metrics from "./panels/Metrics";

const NAV = [
  { id: "overview",       label: "API Gateway / Load Balancer", sub: "Distributes incoming traffic across services" },
  { id: "ratelimiter",    label: "Rate Limiter",                sub: "Limits the number of requests per client" },
  { id: "jwt",            label: "Authentication (JWT)",        sub: "Validates user identity and generates tokens" },
  { id: "circuitbreaker", label: "Circuit Breaker",             sub: "Prevents cascading failures across services" },
  { id: "kafka",          label: "Kafka Event Bus",             sub: "Handles asynchronous events and messaging" },
  { id: "cache",          label: "Cache Proxy",                 sub: "Intelligent Redis proxy with RESP protocol" },
  { id: "metrics",        label: "Observability",               sub: "Prometheus metrics and live graphs" },
];

const PANEL = {
  overview:       <Overview />,
  ratelimiter:    <RateLimiter />,
  jwt:            <JWTAuth />,
  circuitbreaker: <CircuitBreaker />,
  kafka:          <KafkaStream />,
  cache:          <CacheProxy />,
  metrics:        <Metrics />,
};

const STATUS_DOTS = {
  overview: "green", ratelimiter: "green", jwt: "green",
  circuitbreaker: "red", kafka: "green", cache: "green", metrics: "green",
};

export default function App() {
  const [active, setActive]     = useState(null);
  const [uptime, setUptime]     = useState(0);

  useEffect(() => {
    const t = setInterval(() => setUptime(u => u + 1), 1000);
    return () => clearInterval(t);
  }, []);

  const fmt = s => {
    const h   = String(Math.floor(s / 3600)).padStart(2, "0");
    const m   = String(Math.floor((s % 3600) / 60)).padStart(2, "0");
    const sec = String(s % 60).padStart(2, "0");
    return `${h}:${m}:${sec}`;
  };

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh" }}>

      {/* Top bar */}
      <div style={{
        display: "flex", alignItems: "center", justifyContent: "space-between",
        padding: "0 24px", height: 52, borderBottom: "1px solid var(--border)",
        background: "var(--surface)", flexShrink: 0
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <svg width="22" height="22" viewBox="0 0 22 22" fill="none">
            <polygon points="11,2 20,7 20,15 11,20 2,15 2,7" stroke="var(--accent)" strokeWidth="1.5" fill="none"/>
            <circle cx="11" cy="11" r="3" fill="var(--accent)"/>
          </svg>
          <span style={{ fontWeight: 700, fontSize: 15, letterSpacing: "0.05em" }}>NEXUS</span>
          <span style={{ color: "var(--muted)", fontSize: 11, letterSpacing: "0.12em" }}>DISTRIBUTED SYSTEM SIMULATOR</span>
        </div>
        <div style={{ display: "flex", alignItems: "center", gap: 24 }}>
          <span style={{ color: "var(--muted)", fontSize: 12 }}>System Status</span>
          <span style={{ display: "flex", alignItems: "center", gap: 6, fontSize: 12, color: "var(--green)" }}>
            <span style={{ width: 7, height: 7, borderRadius: "50%", background: "var(--green)", display: "inline-block" }}/>
            Operational
          </span>
          <button onClick={() => setActive("overview")} style={{
            background: "var(--accent)", color: "#fff", border: "none",
            padding: "6px 16px", borderRadius: 4, fontSize: 12,
            fontFamily: "var(--font-ui)", cursor: "pointer", fontWeight: 600, letterSpacing: "0.05em"
          }}>▶ Start Simulation</button>
          <button style={{
            background: "transparent", color: "var(--muted)", border: "1px solid var(--border)",
            padding: "6px 14px", borderRadius: 4, fontSize: 12,
            fontFamily: "var(--font-ui)", cursor: "pointer"
          }} onClick={() => setActive(null)}>↺ Reset</button>
        </div>
      </div>

      {/* Body */}
      <div style={{ display: "flex", flex: 1, overflow: "hidden" }}>

        {/* Sidebar */}
        <div style={{
          width: 260, borderRight: "1px solid var(--border)",
          overflowY: "auto", flexShrink: 0, padding: "16px 0"
        }}>
          <div style={{ padding: "0 16px 12px", color: "var(--muted)", fontSize: 10, letterSpacing: "0.12em" }}>
            SYSTEM COMPONENTS
          </div>
          {NAV.map(n => (
            <div key={n.id} onClick={() => setActive(n.id)} style={{
              padding: "12px 16px", cursor: "pointer",
              borderLeft: active === n.id ? "2px solid var(--accent)" : "2px solid transparent",
              background: active === n.id ? "rgba(29,110,255,0.06)" : "transparent",
              display: "flex", alignItems: "center", justifyContent: "space-between",
              transition: "background 0.15s"
            }}>
              <div>
                <div style={{
                  fontSize: 11, fontWeight: 600, letterSpacing: "0.08em", marginBottom: 3,
                  color: active === n.id ? "var(--text)" : "var(--muted)"
                }}>{n.label.toUpperCase()}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.4 }}>{n.sub}</div>
              </div>
              <span style={{
                width: 8, height: 8, borderRadius: "50%", flexShrink: 0,
                background: STATUS_DOTS[n.id] === "green" ? "var(--green)" : "var(--red)"
              }}/>
            </div>
          ))}
        </div>

        {/* Main panel */}
        <div style={{ flex: 1, overflow: "auto" }}>
          {active === null ? <IntroCard onStart={() => setActive("overview")} /> : PANEL[active]}
        </div>

      </div>

      {/* Status bar */}
      <div style={{
        height: 32, borderTop: "1px solid var(--border)", background: "var(--surface)",
        display: "flex", alignItems: "center", padding: "0 24px",
        gap: 28, fontSize: 11, color: "var(--muted)", flexShrink: 0
      }}>
        <span>System Uptime: <span style={{ color: "var(--text)" }}>{fmt(uptime)}</span></span>
        <span>Services: <span style={{ color: "var(--green)" }}>7/7 Healthy</span></span>
        <span>● <span style={{ color: "var(--green)" }}>Kafka: Connected</span></span>
        <span>● <span style={{ color: "var(--green)" }}>Prometheus: Collecting</span></span>
        <span>● <span style={{ color: "var(--green)" }}>Jaeger: Tracing</span></span>
        <span style={{ marginLeft: "auto" }}>Nexus Simulator v1.0.0</span>
      </div>

    </div>
  );
}

function IntroCard({ onStart }) {
  return (
    <div style={{
      height: "100%", display: "flex", alignItems: "center", justifyContent: "center",
      padding: 48
    }}>
      <div style={{ maxWidth: 720, width: "100%" }}>

        {/* Tag */}
        <div style={{
          display: "inline-flex", alignItems: "center", gap: 8,
          border: "1px solid var(--accent)", borderRadius: 3,
          padding: "4px 12px", marginBottom: 28,
          fontSize: 10, color: "var(--accent)", letterSpacing: "0.12em", fontWeight: 600
        }}>
          <span style={{ width: 6, height: 6, borderRadius: "50%", background: "var(--accent)" }}/>
          TCP-BASED REDIS PROXY · BUILT FROM FIRST PRINCIPLES
        </div>

        {/* Title */}
        <div style={{ fontSize: 32, fontWeight: 700, lineHeight: 1.2, marginBottom: 8, letterSpacing: "-0.01em" }}>
          Nexus
        </div>
        <div style={{ fontSize: 16, color: "var(--muted)", marginBottom: 32, fontWeight: 400 }}>
          Adaptive Redis Proxy for High-Traffic Resilience
        </div>

        {/* Problem statement */}
        <div style={{
          border: "1px solid var(--border)", borderRadius: 4,
          padding: 24, background: "var(--surface)", marginBottom: 28
        }}>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 14 }}>THE PROBLEM</div>
          <div style={{ fontSize: 13, color: "var(--text)", lineHeight: 1.8, marginBottom: 16 }}>
            Every major e-commerce platform has the same failure story. Traffic spikes.
            90% of requests hammer the same 20 cache keys. One key expires mid-spike and
            <span style={{ color: "var(--red)", fontWeight: 600 }}> 12,000 requests hit the database simultaneously</span>.
            The database falls over. The sale page goes blank.
          </div>
          <div style={{
            fontSize: 12, color: "var(--warn)", fontFamily: "var(--font-mono)",
            borderLeft: "2px solid var(--warn)", paddingLeft: 12
          }}>
            This is not a scaling problem. This is a cache intelligence problem.
          </div>
        </div>

        {/* What Nexus does */}
        <div style={{ marginBottom: 32 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 14 }}>WHAT NEXUS DOES</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { label: "Singleflight Deduplication", desc: "Collapses thousands of concurrent cache misses into a single database call" },
              { label: "Hot Key Detection",          desc: "Detects keys under heavy load and extends TTL automatically at the right moment" },
              { label: "Atomic Tag Invalidation",    desc: "Invalidates related keys atomically via Lua scripts — no partial states" },
              { label: "Transparent Proxy",          desc: "Sits between your app and Redis. No code changes required. Speaks raw RESP" },
              { label: "Event-Driven Automation",    desc: "Kafka events trigger IP blocking, alerts, and anomaly detection automatically" },
              { label: "Full Observability",         desc: "OpenTelemetry traces, Prometheus metrics, Pino structured logs — all correlated" },
            ].map(f => (
              <div key={f.label} style={{
                border: "1px solid var(--border)", borderRadius: 4,
                padding: "12px 14px", background: "var(--surface)"
              }}>
                <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text)", marginBottom: 4 }}>{f.label}</div>
                <div style={{ fontSize: 10, color: "var(--muted)", lineHeight: 1.5 }}>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Stack */}
        <div style={{ marginBottom: 36 }}>
          <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 12 }}>BUILT WITH</div>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {["Node.js", "Fastify", "ioredis", "kafkajs", "opossum", "OpenTelemetry", "Prometheus", "Grafana", "Redis Lua", "RESP Protocol"].map(t => (
              <span key={t} style={{
                padding: "4px 10px", border: "1px solid var(--border)",
                borderRadius: 3, fontSize: 10, color: "var(--muted)",
                fontFamily: "var(--font-mono)"
              }}>{t}</span>
            ))}
          </div>
        </div>

        {/* CTA */}
        <div style={{ display: "flex", gap: 12, alignItems: "center" }}>
          <button onClick={onStart} style={{
            padding: "11px 28px", background: "var(--accent)", color: "#fff",
            border: "none", borderRadius: 4, fontSize: 13, fontWeight: 600,
            fontFamily: "var(--font-ui)", cursor: "pointer", letterSpacing: "0.04em"
          }}>▶ Start Simulation</button>
          <a href="https://github.com/MithunSrinivas28/NEXUS" target="_blank" rel="noreferrer" style={{
            padding: "11px 24px", background: "transparent", color: "var(--muted)",
            border: "1px solid var(--border)", borderRadius: 4, fontSize: 13,
            fontFamily: "var(--font-ui)", cursor: "pointer", textDecoration: "none"
          }}>View on GitHub →</a>
        </div>

      </div>
    </div>
  );
}