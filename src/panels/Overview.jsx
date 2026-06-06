import { useState, useRef } from "react";

function LogLine({ entry }) {
  const color = entry.level >= 50 ? "#FF4757" : entry.level === 40 ? "#FFB347" : "#0FD788";
  const label = entry.level >= 50 ? "ERROR" : entry.level === 40 ? "WARN" : "INFO";
  const keys = Object.entries(entry).filter(([k]) => !["level", "hostname", "pid"].includes(k));
  return (
    <div style={{ marginBottom: 4, fontFamily: "var(--font-mono)", fontSize: 11, lineHeight: 1.7 }}>
      <span style={{ color: "#4A6A8A" }}>{"{"}"level":</span>
      <span style={{ color }}>{entry.level}</span>
      {keys.map(([k, v]) => (
        <span key={k}>
          <span style={{ color: "#4A6A8A" }}>,</span>
          <span style={{ color: "#6CA8FF" }}>"{k}"</span>
          <span style={{ color: "#4A6A8A" }}>:</span>
          <span style={{ color: "#E2EAF4" }}>{typeof v === "string" ? `"${v}"` : JSON.stringify(v)}</span>
        </span>
      ))}
      <span style={{ color: "#4A6A8A" }}>{"}"}</span>
      <span style={{ marginLeft: 8, color, fontSize: 10 }}>{label}</span>
    </div>
  );
}

const N = {
  client: { x: 10, y: 116, w: 72, h: 44 },
  lb: { x: 108, y: 116, w: 90, h: 44 },
  rate: { x: 226, y: 116, w: 90, h: 44 },
  auth: { x: 344, y: 116, w: 90, h: 44 },
  cache: { x: 460, y: 100, w: 108, h: 72 },
  redis: { x: 610, y: 36, w: 82, h: 40 },
  mock1: { x: 610, y: 104, w: 82, h: 40 },
  mock2: { x: 610, y: 158, w: 82, h: 40 },
  kafka: { x: 610, y: 212, w: 82, h: 40 },
  consumer: { x: 728, y: 212, w: 82, h: 40 },
};

const cx = n => n.x + n.w / 2;
const cy = n => n.y + n.h / 2;

const STEPS = [
  { active: ["client"], dot: [cx(N.client), cy(N.client)], log: { level: 30, time: 0, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId: "req_01", msg: "Incoming request", method: "GET", url: "/api/products", ip: "203.0.113.42" } },
  { active: ["lb"], dot: [cx(N.lb), cy(N.lb)], log: { level: 30, time: 1, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId: "req_01", msg: "Load balancer pick", upstream: "http://127.0.0.1:3001", algorithm: "round-robin", activeConnections: 0 } },
  { active: ["rate"], dot: [cx(N.rate), cy(N.rate)], log: { level: 30, time: 2, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId: "req_01", msg: "Rate limit check", limit: 10, remaining: 9, resetIn: 60 } },
  { active: ["auth"], dot: [cx(N.auth), cy(N.auth)], log: { level: 30, time: 3, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId: "req_01", msg: "JWT validation successful", userId: "user_123", role: "admin" } },
  { active: ["cache"], dot: [cx(N.cache), cy(N.cache)], log: { level: 30, time: 4, pid: 1, hostname: "nexus-cache-proxy", msg: "RESP command received", command: "GET", key: "product:1" } },
  { active: ["cache", "redis"], dot: [cx(N.redis), cy(N.redis)], log: { level: 30, time: 5, pid: 1, hostname: "nexus-cache-proxy", msg: "Cache MISS — forwarding to Redis", key: "product:1" } },
  { active: ["cache"], dot: [cx(N.cache), cy(N.cache)], log: { level: 30, time: 6, pid: 1, hostname: "nexus-cache-proxy", msg: "Redis response received", key: "product:1", ttl: 60, responseTime: 44 } },
  { active: ["cache", "mock1"], dot: [cx(N.mock1), cy(N.mock1)], log: { level: 30, time: 7, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId: "req_01", msg: "Forwarding to upstream", upstream: "http://127.0.0.1:3001" } },
  { active: ["mock1"], dot: [cx(N.mock1), cy(N.mock1)], log: { level: 30, time: 8, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId: "req_01", msg: "request completed", res: { statusCode: 200 }, responseTime: 202.23 } },
  { active: ["kafka"], dot: [cx(N.kafka), cy(N.kafka)], log: { level: 30, time: 9, pid: 3112, hostname: "DESKTOP-TAP0GB7", reqId: "req_01", msg: "Event published", topic: "gateway.request.completed", partition: 0, offset: 142 } },
  { active: ["consumer"], dot: [cx(N.consumer), cy(N.consumer)], log: { level: 30, time: 10, pid: 1, hostname: "nexus-consumer", msg: "Consumer received event", topic: "gateway.request.completed", latencyMs: "202.23" } },
];

export default function Overview() {
  const [step, setStep] = useState(-1);
  const [logs, setLogs] = useState([]);
  const [running, setRunning] = useState(false);
  const [dotPos, setDotPos] = useState([cx(N.client), cy(N.client)]);
  const termRef = useRef(null);
  const timersRef = useRef([]);

  function clearTimers() { timersRef.current.forEach(clearTimeout); timersRef.current = []; }

  function startSim() {
    if (running) return;
    clearTimers();
    setRunning(true);
    setStep(-1);
    setLogs([]);
    setDotPos([cx(N.client), cy(N.client)]);

    STEPS.forEach((s, i) => {
      const t = setTimeout(() => {
        setStep(i);
        setDotPos(s.dot);
        setLogs(prev => {
          const next = [...prev, { ...s.log, time: Date.now() }];
          setTimeout(() => { if (termRef.current) termRef.current.scrollTop = termRef.current.scrollHeight; }, 50);
          return next;
        });
        if (i === STEPS.length - 1) setTimeout(() => setRunning(false), 600);
      }, i * 720);
      timersRef.current.push(t);
    });
  }

  function reset() {
    clearTimers();
    setRunning(false);
    setStep(-1);
    setLogs([]);
    setDotPos([cx(N.client), cy(N.client)]);
  }

  const active = step >= 0 ? STEPS[step].active : [];
  const isOn = id => active.includes(id);

  function nodeStroke(id) {
    if (id === "cache") return "#1D6EFF";
    return isOn(id) ? "#1D6EFF" : "#1A2740";
  }
  function nodeFill(id) {
    if (id === "cache") return isOn(id) ? "rgba(29,110,255,0.10)" : "rgba(29,110,255,0.04)";
    return isOn(id) ? "rgba(29,110,255,0.08)" : "#0E1420";
  }
  function textFill(id) {
    if (id === "cache") return "#1D6EFF";
    return isOn(id) ? "#E2EAF4" : "#4A6A8A";
  }

  return (
    <div style={{ padding: 24, display: "flex", flexDirection: "column", gap: 18, height: "100%" }}>

      {/* Endpoint */}
      <div>
        <div style={{ fontSize: 10, color: "#4A6A8A", letterSpacing: "0.1em", marginBottom: 8 }}>CACHE PROXY ENDPOINT</div>
        <div style={{ display: "flex", gap: 8 }}>
          <div style={{ flex: 1, padding: "8px 14px", border: "1px solid #1A2740", background: "#0E1420", borderRadius: 4, fontFamily: "var(--font-mono)", fontSize: 12, color: "#4A6A8A" }}>
            tcp://127.0.0.1:6380  →  redis://127.0.0.1:6379
          </div>
          <button onClick={() => navigator.clipboard?.writeText("redis-cli -p 6380")} style={{ padding: "8px 16px", border: "1px solid #1A2740", background: "#0E1420", color: "#E2EAF4", borderRadius: 4, cursor: "pointer", fontSize: 12, fontFamily: "var(--font-ui)" }}>
            Copy ⧉
          </button>
        </div>
      </div>

      {/* Legend */}
      <div style={{ display: "flex", gap: 20, fontSize: 10, color: "#4A6A8A" }}>
        <span style={{ letterSpacing: "0.1em" }}>LIVE TOPOLOGY</span>
        <span style={{ color: "#1D6EFF" }}>—— HTTP / RESP</span>
        <span>- - Async Event</span>
      </div>

      {/* SVG Topology */}
      <svg width="100%" viewBox="0 0 820 272" style={{ overflow: "visible", flexShrink: 0 }}>
        <defs>
          <marker id="arr-b" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#1D6EFF" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
          <marker id="arr-m" viewBox="0 0 10 10" refX="8" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
            <path d="M2 1L8 5L2 9" fill="none" stroke="#1A2740" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </marker>
        </defs>

        {/* ── Arrows ── */}
        <line x1={82} y1={138} x2={107} y2={138} stroke="#1D6EFF" strokeWidth={1.2} markerEnd="url(#arr-b)" />
        <line x1={198} y1={138} x2={225} y2={138} stroke="#1D6EFF" strokeWidth={1.2} markerEnd="url(#arr-b)" />
        <line x1={316} y1={138} x2={343} y2={138} stroke="#1D6EFF" strokeWidth={1.2} markerEnd="url(#arr-b)" />
        <line x1={434} y1={138} x2={459} y2={138} stroke="#1D6EFF" strokeWidth={1.2} markerEnd="url(#arr-b)" />
        {/* cache → redis */}
        <path d="M568,110 L590,110 L590,56 L608,56" fill="none" stroke="#1D6EFF" strokeWidth={1.2} markerEnd="url(#arr-b)" />
        {/* cache → mock1 */}
        <line x1={568} y1={124} x2={608} y2={124} stroke="#1D6EFF" strokeWidth={1.2} markerEnd="url(#arr-b)" />
        {/* cache → mock2 */}
        <path d="M568,150 L590,150 L590,178 L608,178" fill="none" stroke="#1A2740" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#arr-m)" />
        {/* cache → kafka */}
        <path d="M514,172 L514,232 L608,232" fill="none" stroke="#1A2740" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#arr-m)" />
        {/* kafka → consumer */}
        <line x1={692} y1={232} x2={726} y2={232} stroke="#1A2740" strokeWidth={1.2} strokeDasharray="4 3" markerEnd="url(#arr-m)" />

        {/* ── Nodes ── */}

        {/* CLIENT */}
        <rect x={N.client.x} y={N.client.y} width={N.client.w} height={N.client.h} rx={3} fill={nodeFill("client")} stroke={nodeStroke("client")} strokeWidth={isOn("client") ? 1.5 : 1} />
        <text x={cx(N.client)} y={cy(N.client)} textAnchor="middle" dominantBaseline="central" fill={textFill("client")} fontSize={9} fontFamily="Syne" fontWeight={700} letterSpacing={1}>CLIENT</text>

        {/* LOAD BALANCER */}
        <rect x={N.lb.x} y={N.lb.y} width={N.lb.w} height={N.lb.h} rx={3} fill={nodeFill("lb")} stroke={nodeStroke("lb")} strokeWidth={isOn("lb") ? 1.5 : 1} />
        <text x={cx(N.lb)} y={cy(N.lb) - 7} textAnchor="middle" dominantBaseline="central" fill={textFill("lb")} fontSize={9} fontFamily="Syne" fontWeight={700} letterSpacing={1}>LOAD</text>
        <text x={cx(N.lb)} y={cy(N.lb) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("lb")} fontSize={8} fontFamily="Syne">BALANCER</text>

        {/* RATE LIMITER */}
        <rect x={N.rate.x} y={N.rate.y} width={N.rate.w} height={N.rate.h} rx={3} fill={nodeFill("rate")} stroke={nodeStroke("rate")} strokeWidth={isOn("rate") ? 1.5 : 1} />
        <text x={cx(N.rate)} y={cy(N.rate) - 7} textAnchor="middle" dominantBaseline="central" fill={textFill("rate")} fontSize={9} fontFamily="Syne" fontWeight={700} letterSpacing={1}>RATE</text>
        <text x={cx(N.rate)} y={cy(N.rate) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("rate")} fontSize={8} fontFamily="Syne">LIMITER</text>

        {/* AUTH */}
        <rect x={N.auth.x} y={N.auth.y} width={N.auth.w} height={N.auth.h} rx={3} fill={nodeFill("auth")} stroke={nodeStroke("auth")} strokeWidth={isOn("auth") ? 1.5 : 1} />
        <text x={cx(N.auth)} y={cy(N.auth) - 7} textAnchor="middle" dominantBaseline="central" fill={textFill("auth")} fontSize={9} fontFamily="Syne" fontWeight={700} letterSpacing={1}>AUTH</text>
        <text x={cx(N.auth)} y={cy(N.auth) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("auth")} fontSize={8} fontFamily="Syne">(JWT)</text>

        {/* CACHE PROXY — star node */}
        <rect x={N.cache.x} y={N.cache.y} width={N.cache.w} height={N.cache.h} rx={3} fill={nodeFill("cache")} stroke="#1D6EFF" strokeWidth={isOn("cache") ? 2 : 1} />
        <text x={cx(N.cache)} y={N.cache.y + 16} textAnchor="middle" fill="#1D6EFF" fontSize={9} fontFamily="Syne" fontWeight={700} letterSpacing={1}>CACHE PROXY</text>
        <text x={cx(N.cache)} y={N.cache.y + 30} textAnchor="middle" fill={isOn("cache") ? "#6CA8FF" : "#2A4870"} fontSize={7} fontFamily="JetBrains Mono">RESP · Singleflight</text>
        <text x={cx(N.cache)} y={N.cache.y + 42} textAnchor="middle" fill={isOn("cache") ? "#6CA8FF" : "#2A4870"} fontSize={7} fontFamily="JetBrains Mono">Hot Key · Lua Invalidation</text>
        <text x={cx(N.cache)} y={N.cache.y + 56} textAnchor="middle" fill={isOn("cache") ? "#6CA8FF" : "#2A4870"} fontSize={7} fontFamily="JetBrains Mono">:6380 → :6379</text>

        {/* REDIS */}
        <rect x={N.redis.x} y={N.redis.y} width={N.redis.w} height={N.redis.h} rx={3} fill={nodeFill("redis")} stroke={nodeStroke("redis")} strokeWidth={isOn("redis") ? 1.5 : 1} />
        <text x={cx(N.redis)} y={cy(N.redis) - 6} textAnchor="middle" dominantBaseline="central" fill={textFill("redis")} fontSize={9} fontFamily="Syne" fontWeight={700} letterSpacing={1}>REDIS</text>
        <text x={cx(N.redis)} y={cy(N.redis) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("redis")} fontSize={8} fontFamily="Syne">:6379</text>

        {/* MOCK :3001 */}
        <rect x={N.mock1.x} y={N.mock1.y} width={N.mock1.w} height={N.mock1.h} rx={3} fill={nodeFill("mock1")} stroke={nodeStroke("mock1")} strokeWidth={isOn("mock1") ? 1.5 : 1} />
        <text x={cx(N.mock1)} y={cy(N.mock1) - 6} textAnchor="middle" dominantBaseline="central" fill={textFill("mock1")} fontSize={8} fontFamily="Syne" fontWeight={700} letterSpacing={1}>MOCK SVC</text>
        <text x={cx(N.mock1)} y={cy(N.mock1) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("mock1")} fontSize={8} fontFamily="Syne">:3001</text>

        {/* MOCK :3002 */}
        <rect x={N.mock2.x} y={N.mock2.y} width={N.mock2.w} height={N.mock2.h} rx={3} fill={nodeFill("mock2")} stroke={nodeStroke("mock2")} strokeWidth={isOn("mock2") ? 1.5 : 1} />
        <text x={cx(N.mock2)} y={cy(N.mock2) - 6} textAnchor="middle" dominantBaseline="central" fill={textFill("mock2")} fontSize={8} fontFamily="Syne" fontWeight={700} letterSpacing={1}>MOCK SVC</text>
        <text x={cx(N.mock2)} y={cy(N.mock2) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("mock2")} fontSize={8} fontFamily="Syne">:3002</text>

        {/* KAFKA */}
        <rect x={N.kafka.x} y={N.kafka.y} width={N.kafka.w} height={N.kafka.h} rx={3} fill={nodeFill("kafka")} stroke={nodeStroke("kafka")} strokeWidth={isOn("kafka") ? 1.5 : 1} />
        <text x={cx(N.kafka)} y={cy(N.kafka) - 6} textAnchor="middle" dominantBaseline="central" fill={textFill("kafka")} fontSize={9} fontFamily="Syne" fontWeight={700} letterSpacing={1}>KAFKA</text>
        <text x={cx(N.kafka)} y={cy(N.kafka) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("kafka")} fontSize={8} fontFamily="Syne">:9092</text>

        {/* CONSUMER */}
        <rect x={N.consumer.x} y={N.consumer.y} width={N.consumer.w} height={N.consumer.h} rx={3} fill={nodeFill("consumer")} stroke={nodeStroke("consumer")} strokeWidth={isOn("consumer") ? 1.5 : 1} />
        <text x={cx(N.consumer)} y={cy(N.consumer) - 6} textAnchor="middle" dominantBaseline="central" fill={textFill("consumer")} fontSize={8} fontFamily="Syne" fontWeight={700} letterSpacing={1}>CONSUMER</text>
        <text x={cx(N.consumer)} y={cy(N.consumer) + 7} textAnchor="middle" dominantBaseline="central" fill={textFill("consumer")} fontSize={8} fontFamily="Syne">service</text>

        {/* ── Animated dot ── */}
        <circle
          r={5}
          fill="#1D6EFF"
          style={{
            transform: `translate(${dotPos[0]}px, ${dotPos[1]}px)`,
            transition: step >= 0 ? "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)" : "none",
            opacity: step >= 0 ? 1 : 0,
          }}
        />
        {/* Pulse ring on active node */}
        {step >= 0 && (
          <circle
            r={9}
            fill="none"
            stroke="#1D6EFF"
            strokeWidth={1}
            style={{
              transform: `translate(${dotPos[0]}px, ${dotPos[1]}px)`,
              transition: "transform 0.55s cubic-bezier(0.4, 0, 0.2, 1)",
              opacity: 0.4,
            }}
          />
        )}
      </svg>

      {/* Terminal */}
      <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "8px 14px", background: "#0a0f18", border: "1px solid #1A2740", borderBottom: "none", borderRadius: "4px 4px 0 0" }}>
          <span style={{ fontSize: 10, letterSpacing: "0.1em", color: "#4A6A8A" }}>SIMULATION TERMINAL</span>
          <div style={{ display: "flex", gap: 8 }}>
            <button onClick={startSim} disabled={running} style={{ background: running ? "transparent" : "#1D6EFF", color: running ? "#4A6A8A" : "#fff", border: "1px solid #1A2740", padding: "4px 12px", borderRadius: 3, fontSize: 11, fontFamily: "var(--font-ui)", cursor: running ? "default" : "pointer" }}>
              {running ? "Running..." : "▶ Run"}
            </button>
            <button onClick={reset} style={{ background: "transparent", color: "#4A6A8A", border: "1px solid #1A2740", padding: "4px 10px", borderRadius: 3, fontSize: 11, fontFamily: "var(--font-ui)", cursor: "pointer" }}>Clear</button>
          </div>
        </div>
        <div ref={termRef} style={{ flex: 1, background: "#0a0f18", border: "1px solid #1A2740", borderRadius: "0 0 4px 4px", padding: 16, overflowY: "auto", minHeight: 160 }}>
          {logs.length === 0
            ? <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#4A6A8A" }}>Press ▶ Run to simulate a full request through the system...</span>
            : logs.map((l, i) => <LogLine key={i} entry={l} />)
          }
          {logs.length > 0 && <span style={{ fontFamily: "var(--font-mono)", fontSize: 11, color: "#4A6A8A" }}>{">"}_</span>}
        </div>
      </div>

    </div>
  );
}