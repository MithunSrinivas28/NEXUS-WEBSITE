import { useState, useEffect, useRef } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from "recharts";

function generatePoint(prev, opts) {
  const jitter = (base, range) => +(base + (Math.random() * range - range / 2)).toFixed(2);
  return {
    t: new Date().toLocaleTimeString("en-US", { hour12: false, hour: "2-digit", minute: "2-digit", second: "2-digit" }),
    requests:  jitter((prev?.requests  || 120), 40),
    errorRate: jitter((prev?.errorRate || 2.3),  1.2),
    p95:       jitter((prev?.p95       || 245),  60),
    throughput:jitter((prev?.throughput|| 245),  50),
    kafkaLag:  jitter((prev?.kafkaLag  || 1240), 200),
  };
}

const INIT = Array.from({ length: 20 }, (_, i) => {
  const base = { requests: 120, errorRate: 2.3, p95: 245, throughput: 245, kafkaLag: 1240 };
  return {
    t: `00:0${Math.floor(i / 10)}:${String(i % 10 * 6).padStart(2, "0")}`,
    requests:   +(base.requests   + (Math.random() * 40  - 20)).toFixed(2),
    errorRate:  +(base.errorRate  + (Math.random() * 1.2 - 0.6)).toFixed(2),
    p95:        +(base.p95        + (Math.random() * 60  - 30)).toFixed(2),
    throughput: +(base.throughput + (Math.random() * 50  - 25)).toFixed(2),
    kafkaLag:   +(base.kafkaLag   + (Math.random() * 200 - 100)).toFixed(2),
  };
});

const CHART_CONFIG = [
  { key: "requests",   label: "HTTP REQUESTS",      unit: "",     color: "#1D6EFF", delta: "+12.5%", suffix: ""     },
  { key: "errorRate",  label: "ERROR RATE",          unit: "%",    color: "#FF4757", delta: "-1.2%",  suffix: "%"    },
  { key: "p95",        label: "RESPONSE TIME (P95)", unit: "ms",   color: "#FFB347", delta: "+8.7%",  suffix: "ms"   },
  { key: "throughput", label: "THROUGHPUT",          unit: "req/s",color: "#1D6EFF", delta: "+15.3%", suffix: " req/s" },
  { key: "kafkaLag",   label: "KAFKA LAG",           unit: "",     color: "#0FD788", delta: "-6.4%",  suffix: ""     },
];

const CustomTooltip = ({ active, payload, label }) => {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#0E1420", border: "1px solid var(--border)",
      padding: "6px 10px", borderRadius: 3,
      fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--text)"
    }}>
      <div style={{ color: "var(--muted)", marginBottom: 2 }}>{label}</div>
      <div>{payload[0].value}{payload[0].unit || ""}</div>
    </div>
  );
};

function SparkCard({ config, data, live }) {
  const latest = data[data.length - 1]?.[config.key] ?? 0;
  const prev   = data[data.length - 2]?.[config.key] ?? latest;
  const up     = latest >= prev;
  const deltaColor = config.key === "errorRate"
    ? (up ? "var(--red)" : "var(--green)")
    : (up ? "var(--green)" : "var(--red)");

  return (
    <div style={{
      border: "1px solid var(--border)", borderRadius: 4,
      padding: "14px 16px", background: "var(--surface)",
    }}>
      <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 8 }}>{config.label}</div>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: 10 }}>
        <span style={{ fontSize: 22, fontWeight: 700, fontFamily: "var(--font-mono)", color: "var(--text)" }}>
          {config.key === "requests" || config.key === "kafkaLag"
            ? Math.round(latest).toLocaleString()
            : latest.toFixed(1)
          }{config.suffix}
        </span>
        <span style={{ fontSize: 10, color: deltaColor, fontFamily: "var(--font-mono)" }}>{config.delta}</span>
      </div>
      <ResponsiveContainer width="100%" height={52}>
        <LineChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 2 }}>
          <Line
            type="monotone" dataKey={config.key}
            stroke={config.color} strokeWidth={1.4}
            dot={false} isAnimationActive={false}
          />
          <XAxis dataKey="t" hide />
          <YAxis hide domain={["auto", "auto"]} />
          <Tooltip content={<CustomTooltip />} />
        </LineChart>
      </ResponsiveContainer>
      <div style={{ fontSize: 9, color: "var(--muted)", marginTop: 6 }}>
        Last 5m {live && <span style={{ color: "var(--green)" }}>● live</span>}
      </div>
    </div>
  );
}

export default function Metrics() {
  const [data, setData] = useState(INIT);
  const [live, setLive] = useState(false);
  const intervalRef = useRef(null);

  function toggleLive() {
    if (live) {
      clearInterval(intervalRef.current);
      setLive(false);
    } else {
      setLive(true);
      intervalRef.current = setInterval(() => {
        setData(prev => {
          const next = generatePoint(prev[prev.length - 1]);
          return [...prev.slice(-60), next];
        });
      }, 1500);
    }
  }

  useEffect(() => () => clearInterval(intervalRef.current), []);

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 20, height: "100%", overflowY: "auto" }}>

      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
        <div>
          <div style={{ fontSize: 13, fontWeight: 700, letterSpacing: "0.08em", marginBottom: 4 }}>OBSERVABILITY</div>
          <div style={{ fontSize: 11, color: "var(--muted)", lineHeight: 1.6 }}>
            Prometheus scrapes <span style={{ fontFamily: "var(--font-mono)", color: "var(--text)" }}>localhost:3000/metrics</span> every 15s.
            OpenTelemetry traces ship to Jaeger. Pino logs structured JSON to stdout.
          </div>
        </div>
        <button onClick={toggleLive} style={{
          padding: "8px 18px",
          background: live ? "transparent" : "var(--accent)",
          color: live ? "var(--red)" : "#fff",
          border: `1px solid ${live ? "var(--red)" : "var(--accent)"}`,
          borderRadius: 4, fontSize: 11, fontWeight: 600,
          fontFamily: "var(--font-ui)", cursor: "pointer", flexShrink: 0
        }}>{live ? "⏹ Stop" : "▶ Live"}</button>
      </div>

      {/* Prometheus target status */}
      <div style={{
        border: "1px solid var(--border)", borderRadius: 4,
        padding: "12px 16px", background: "var(--surface)",
        display: "flex", gap: 32, flexWrap: "wrap"
      }}>
        <div>
          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 4 }}>PROMETHEUS TARGET</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>
            http://host.docker.internal:3000/metrics
          </div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 4 }}>STATE</div>
          <span style={{
            fontSize: 10, fontWeight: 700, color: "var(--green)",
            border: "1px solid var(--green)", padding: "2px 8px", borderRadius: 3
          }}>UP</span>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 4 }}>JOB</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>nexus-gateway</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 4 }}>SCRAPE DURATION</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>50.110ms</div>
        </div>
        <div>
          <div style={{ fontSize: 9, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 4 }}>LAST SCRAPE</div>
          <div style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>11.255s ago</div>
        </div>
      </div>

      {/* Metric cards grid */}
      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
        gap: 12
      }}>
        {CHART_CONFIG.map(c => (
          <SparkCard key={c.key} config={c} data={data} live={live} />
        ))}
      </div>

      {/* Jaeger traces */}
      <div style={{ border: "1px solid var(--border)", borderRadius: 4, background: "var(--surface)", padding: 16 }}>
        <div style={{ fontSize: 10, color: "var(--muted)", letterSpacing: "0.1em", marginBottom: 12 }}>RECENT TRACES — JAEGER</div>
        {[
          { service: "nexus-gateway", op: "GET /api/products", traceId: "f492c28", duration: "7.22ms",  spans: 1, ago: "1m ago",  color: "var(--accent)" },
          { service: "nexus-gateway", op: "POST /api/orders",  traceId: "a1b3c4d", duration: "202.3ms", spans: 3, ago: "3m ago",  color: "var(--accent)" },
          { service: "nexus-gateway", op: "GET /health",       traceId: "0b0d72e", duration: "17.58ms", spans: 1, ago: "5m ago",  color: "var(--warn)"   },
        ].map(t => (
          <div key={t.traceId} style={{
            display: "flex", alignItems: "center", justifyContent: "space-between",
            padding: "8px 0", borderBottom: "1px solid var(--border)"
          }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{
                width: 10, height: 10, borderRadius: 2,
                background: t.color, flexShrink: 0
              }} />
              <div>
                <div style={{ fontSize: 11, color: "var(--text)", fontFamily: "var(--font-mono)" }}>
                  {t.service}: {t.op}
                  <span style={{ color: "var(--muted)", marginLeft: 8 }}>{t.traceId}</span>
                </div>
                <div style={{ fontSize: 10, color: "var(--muted)", marginTop: 2 }}>
                  {t.spans} span{t.spans > 1 ? "s" : ""} · {t.ago}
                </div>
              </div>
            </div>
            <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "var(--text)" }}>{t.duration}</span>
          </div>
        ))}
      </div>

      {/* Observability stack links */}
      <div style={{ display: "flex", gap: 12 }}>
        {[
          { label: "Prometheus Metrics", port: 9090, color: "var(--warn)" },
          { label: "Grafana Dashboard",  port: 3004, color: "var(--accent)" },
          { label: "Jaeger Traces",      port: 16686, color: "var(--green)" },
        ].map(s => (
          <div key={s.label} style={{
            flex: 1, border: `1px solid var(--border)`, borderRadius: 4,
            padding: "12px 16px", background: "var(--surface)",
            display: "flex", justifyContent: "space-between", alignItems: "center"
          }}>
            <div>
              <div style={{ fontSize: 10, color: s.color, fontWeight: 600, marginBottom: 4 }}>{s.label}</div>
              <div style={{ fontFamily: "var(--font-mono)", fontSize: 10, color: "var(--muted)" }}>localhost:{s.port}</div>
            </div>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "var(--green)" }} />
          </div>
        ))}
      </div>

    </div>
  );
}