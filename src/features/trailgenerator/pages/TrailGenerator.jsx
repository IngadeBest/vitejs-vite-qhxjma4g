import React, { useState, useRef, useCallback } from "react";
import obstakelsData from "@/data/obstakels.json";
import jsPDF from "jspdf";

// ── Constanten ────────────────────────────────────────────────────────────────

const ARENA_W = 760;
const ARENA_H = 500;

const TRAIL_LEVELS = [
  { code: "we0",  label: "WE0",      key: "WE0"  },
  { code: "we1",  label: "WE1",      key: "WE1"  },
  { code: "we2p", label: "WE2/WE2+", key: "WE2+" },
];

// ── Geometrie helpers ─────────────────────────────────────────────────────────

function rotatePt(x, y, deg) {
  const r = (deg * Math.PI) / 180;
  return { x: x * Math.cos(r) - y * Math.sin(r), y: x * Math.sin(r) + y * Math.cos(r) };
}

function clamp(v, lo, hi) { return Math.max(lo, Math.min(hi, v)); }

// ── Obstakel-vormen ───────────────────────────────────────────────────────────
// Elke vorm is gecentreerd op (0,0). Standaard oriëntatie: links → rechts.
// entry/exit: offset van het middelpunt (voor routing-lijnen).

const SHAPES = {

  slalom: {
    w: 190, h: 46,
    entry: { x: -95, y: 0 },
    exit:  { x:  95, y: 0 },
    render(col) {
      const xs = [-70, -35, 0, 35, 70];
      return (
        <>
          <polyline
            points={xs.map((x, i) => `${x},${i % 2 === 0 ? -15 : 15}`).join(" ")}
            fill="none" stroke={col} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.45}
          />
          <line x1={-95} y1={0} x2={-70} y2={0} stroke={col} strokeWidth={1.5} />
          <line x1={70}  y1={0} x2={95}  y2={0} stroke={col} strokeWidth={1.5} />
          {xs.map((x, i) => <circle key={i} cx={x} cy={0} r={6} fill={col} />)}
        </>
      );
    },
  },

  parallelslalom: {
    w: 190, h: 62,
    entry: { x: -95, y: 0 },
    exit:  { x:  95, y: 0 },
    render(col) {
      const xs = [-70, -35, 0, 35, 70];
      return (
        <>
          <line x1={-95} y1={0} x2={-70} y2={0} stroke={col} strokeWidth={1.5} />
          <line x1={70}  y1={0} x2={95}  y2={0} stroke={col} strokeWidth={1.5} />
          {xs.map((x, i) => (
            <React.Fragment key={i}>
              <circle cx={x} cy={-22} r={5} fill={col} />
              <circle cx={x} cy={ 22} r={5} fill={col} />
            </React.Fragment>
          ))}
        </>
      );
    },
  },

  brug: {
    w: 130, h: 30,
    entry: { x: -65, y: 0 },
    exit:  { x:  65, y: 0 },
    render(col) {
      const planks = [-50, -30, -10, 10, 30, 50];
      return (
        <>
          <rect x={-65} y={-13} width={130} height={26} fill="#d97706" rx={3} />
          {planks.map((x) => (
            <line key={x} x1={x} y1={-13} x2={x} y2={13} stroke="#92400e" strokeWidth={1.5} />
          ))}
          <line x1={-65} y1={-13} x2={65} y2={-13} stroke="#92400e" strokeWidth={2} />
          <line x1={-65} y1={ 13} x2={65} y2={ 13} stroke="#92400e" strokeWidth={2} />
        </>
      );
    },
  },

  poort: {
    w: 72, h: 32,
    entry: { x: -36, y: 0 },
    exit:  { x:  36, y: 0 },
    render(col) {
      return (
        <>
          <rect x={-36} y={-14} width={9} height={28} fill={col} rx={2} />
          <rect x={ 27} y={-14} width={9} height={28} fill={col} rx={2} />
          <line x1={-26} y1={0} x2={26} y2={0} stroke={col} strokeWidth={1} strokeDasharray="4,3" opacity={0.4} />
        </>
      );
    },
  },

  acht: {
    w: 60, h: 140,
    entry: { x: 0, y: -70 },
    exit:  { x: 0, y:  70 },
    render(col) {
      return (
        <>
          <ellipse cx={0} cy={-35} rx={24} ry={24} fill="none" stroke={col} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.5} />
          <ellipse cx={0} cy={ 35} rx={24} ry={24} fill="none" stroke={col} strokeWidth={1.5} strokeDasharray="5,3" opacity={0.5} />
          <circle  cx={0} cy={-35} r={10} fill={col} />
          <circle  cx={0} cy={ 35} r={10} fill={col} />
          <circle cx={0} cy={0} r={3} fill={col} opacity={0.5} />
        </>
      );
    },
  },

  vaten3: {
    w: 90, h: 90,
    entry: { x:  0, y: -45 },
    exit:  { x:  0, y:  45 },
    render(col) {
      return (
        <>
          <polygon points="0,-36 -28,20 28,20" fill="none" stroke={col} strokeWidth={1} strokeDasharray="5,3" opacity={0.35} />
          <circle cx={  0} cy={-26} r={11} fill={col} />
          <circle cx={-24} cy={ 18} r={11} fill={col} />
          <circle cx={ 24} cy={ 18} r={11} fill={col} />
        </>
      );
    },
  },

  roundpen: {
    w: 110, h: 110,
    entry: { x: -55, y:  8 },
    exit:  { x: -55, y: -8 },
    render(col) {
      return (
        <>
          <circle cx={0} cy={0} r={50} fill="none" stroke={col} strokeWidth={3.5} />
          <line x1={-50} y1={-10} x2={-50} y2={10} stroke="#fff" strokeWidth={5} />
          <line x1={-55} y1={-7}  x2={-55} y2={ 7} stroke={col} strokeWidth={1.5} strokeDasharray="3,2" />
        </>
      );
    },
  },

  gang: {
    w: 130, h: 30,
    entry: { x: -65, y: 0 },
    exit:  { x:  65, y: 0 },
    render(col) {
      return (
        <>
          <rect x={-65} y={-13} width={130} height={26} fill="none" stroke={col} strokeWidth={2} rx={4} />
          <line x1={-65} y1={0} x2={65} y2={0} stroke={col} strokeWidth={1} strokeDasharray="6,4" opacity={0.4} />
          <circle cx={0} cy={0} r={6} fill={col} />
          <line x1={0} y1={-6} x2={0} y2={-13} stroke={col} strokeWidth={2} />
        </>
      );
    },
  },

  lgang: {
    w: 90, h: 90,
    entry: { x: -45, y: -22 },
    exit:  { x:  22, y:  45 },
    render(col) {
      return (
        <>
          <rect x={-45} y={-35} width={72} height={28} fill="none" stroke={col} strokeWidth={2} rx={3} />
          <rect x={  0} y={-35} width={28} height={80} fill="none" stroke={col} strokeWidth={2} rx={3} />
          <circle cx={-20} cy={-21} r={5} fill={col} />
        </>
      );
    },
  },

  sprong: {
    w: 100, h: 32,
    entry: { x: -50, y: 0 },
    exit:  { x:  50, y: 0 },
    render(col) {
      return (
        <>
          <rect x={-50} y={-14} width={8}  height={28} fill={col} rx={2} />
          <rect x={ 42} y={-14} width={8}  height={28} fill={col} rx={2} />
          <rect x={-42} y={ -5} width={84} height={8}  fill={col} rx={2} />
        </>
      );
    },
  },

  water: {
    w: 130, h: 65,
    entry: { x: -65, y: 0 },
    exit:  { x:  65, y: 0 },
    render(col) {
      return (
        <>
          <rect x={-65} y={-30} width={130} height={60} fill="#bae6fd" rx={6} />
          <rect x={-65} y={-30} width={130} height={60} fill="none" stroke={col} strokeWidth={2} rx={6} />
          {[-8, 8].map((y) => (
            <path key={y}
              d={`M-50,${y} Q-30,${y - 7} -10,${y} Q10,${y + 7} 30,${y} Q50,${y - 7} 50,${y}`}
              fill="none" stroke={col} strokeWidth={1.2} opacity={0.55}
            />
          ))}
        </>
      );
    },
  },

  zijwaarts: {
    w: 150, h: 26,
    entry: { x: 0, y: -13 },
    exit:  { x: 0, y:  13 },
    render(col) {
      return (
        <>
          <rect x={-75} y={-10} width={150} height={20} fill="#fde68a" rx={3} />
          <rect x={-75} y={-10} width={150} height={20} fill="none" stroke={col} strokeWidth={2} rx={3} />
          <text x={0} y={5} textAnchor="middle" fontSize={11} fill={col} fontFamily="helvetica,arial,sans-serif">← →</text>
        </>
      );
    },
  },

  garrocha: {
    w: 34, h: 88,
    entry: { x: 0, y: -44 },
    exit:  { x: 0, y:  44 },
    render(col) {
      return (
        <>
          <rect x={-4} y={-38} width={8} height={58} fill={col} rx={2} />
          <rect x={-11} y={20} width={22} height={16} fill={col} rx={3} />
          <circle cx={0} cy={-38} r={9} fill="none" stroke={col} strokeWidth={2.5} />
        </>
      );
    },
  },

  generic: {
    w: 70, h: 50,
    entry: { x: -35, y: 0 },
    exit:  { x:  35, y: 0 },
    render(col) {
      return <rect x={-35} y={-23} width={70} height={46} fill="#f1f5f9" stroke={col} strokeWidth={2} rx={6} />;
    },
  },
};

// ── Shape-type matcher ────────────────────────────────────────────────────────

function shapeType(name) {
  const n = name.toLowerCase();
  if (n.includes("parallelslalom"))                            return "parallelslalom";
  if (n.includes("slalom"))                                    return "slalom";
  if (n.includes("brug"))                                      return "brug";
  if (n.includes("poort"))                                     return "poort";
  if (n.includes("acht om"))                                   return "acht";
  if (/\bvaten\b/.test(n) && !n.includes("acht"))             return "vaten3";
  if (n.includes("round pen"))                                 return "roundpen";
  if (n.includes("l-gang"))                                    return "lgang";
  if (n.includes("gang"))                                      return "gang";
  if (n.includes("sprong") || n.includes("afsprong"))         return "sprong";
  if (n.includes("water"))                                     return "water";
  if (n.includes("zijwaarts"))                                 return "zijwaarts";
  if (n.includes("garrocha") || n.includes("ringsteken"))     return "garrocha";
  return "generic";
}

function getShape(name) { return SHAPES[shapeType(name)] ?? SHAPES.generic; }

const TYPE_COLORS = {
  slalom: "#2563eb", parallelslalom: "#7c3aed", brug: "#92400e",
  poort: "#059669", acht: "#dc2626", vaten3: "#d97706",
  roundpen: "#0891b2", gang: "#475569", lgang: "#475569",
  sprong: "#9333ea", water: "#0284c7", zijwaarts: "#b45309",
  garrocha: "#be185d", generic: "#64748b",
};
function obsColor(name) { return TYPE_COLORS[shapeType(name)] ?? "#64748b"; }

// ── Connector-punt in arena-coördinaten ───────────────────────────────────────

function connectorPt(obs, which) {
  const shape = getShape(obs.name);
  const off   = which === "entry" ? shape.entry : shape.exit;
  const r     = rotatePt(off.x, off.y, obs.angle ?? 0);
  return { x: obs.x + r.x, y: obs.y + r.y };
}

// ── SVG → PNG data-url ────────────────────────────────────────────────────────

async function svgToDataUrl(svgEl) {
  const clone = svgEl.cloneNode(true);
  clone.setAttribute("width",  ARENA_W);
  clone.setAttribute("height", ARENA_H);
  const blob = new Blob([new XMLSerializer().serializeToString(clone)], {
    type: "image/svg+xml;charset=utf-8",
  });
  return new Promise((resolve) => {
    const canvas = document.createElement("canvas");
    canvas.width  = ARENA_W * 2;
    canvas.height = ARENA_H * 2;
    const img = new Image();
    img.onload = () => {
      canvas.getContext("2d").drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL("image/png"));
    };
    img.src = URL.createObjectURL(blob);
  });
}

// ── Pijlpunt langs een lijn ───────────────────────────────────────────────────

function ArrowHead({ x1, y1, x2, y2, col }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len < 1) return null;
  const mx = (x1 + x2) / 2, my = (y1 + y2) / 2;
  const ux = dx / len, uy = dy / len;
  const sz = 7;
  return (
    <polygon
      points={`${mx + ux * sz},${my + uy * sz} ${mx - ux * sz - uy * sz},${my - uy * sz + ux * sz} ${mx - ux * sz + uy * sz},${my - uy * sz - ux * sz}`}
      fill={col}
      opacity={0.7}
    />
  );
}

// ── Hoofd-component ───────────────────────────────────────────────────────────

export default function TrailGenerator() {
  const [level, setLevel]     = useState("we0");
  const [byLevel, setByLevel] = useState({ we0: [], we1: [], we2p: [] });
  const [selected, setSelected] = useState(null);
  const [meta, setMeta] = useState({
    wedstrijd: "", locatie: "",
    datum: new Date().toISOString().split("T")[0],
    piste: "",
  });

  const svgRef  = useRef(null);
  const nextId  = useRef(1);
  const ptrDrag = useRef(null);
  const paletteItem = useRef(null);

  const placed    = byLevel[level];
  const setPlaced = useCallback(
    (fn) =>
      setByLevel((p) => ({ ...p, [level]: typeof fn === "function" ? fn(p[level]) : fn })),
    [level]
  );

  const obstacles = obstakelsData[TRAIL_LEVELS.find((l) => l.code === level)?.key] ?? [];

  // ── SVG-coördinaat uit pointer/drag-event ──────────────────────────────────

  const svgPt = useCallback((e) => {
    if (!svgRef.current) return null;
    const rect = svgRef.current.getBoundingClientRect();
    return {
      x: clamp((e.clientX - rect.left)  * (ARENA_W / rect.width),  0, ARENA_W),
      y: clamp((e.clientY - rect.top)   * (ARENA_H / rect.height), 0, ARENA_H),
    };
  }, []);

  // ── Drag vanuit palette ────────────────────────────────────────────────────

  const onPaletteDragStart = (e, name) => {
    paletteItem.current = name;
    e.dataTransfer.effectAllowed = "copy";
  };

  const onArenaDragOver  = (e) => { e.preventDefault(); e.dataTransfer.dropEffect = "copy"; };

  const onArenaDrop = (e) => {
    e.preventDefault();
    const name = paletteItem.current;
    if (!name) return;
    const pt = svgPt(e);
    if (!pt) return;
    setPlaced((p) => [...p, { id: nextId.current++, name, x: pt.x, y: pt.y, angle: 0 }]);
    setSelected(null);
    paletteItem.current = null;
  };

  // ── Pointer-drag binnen arena ──────────────────────────────────────────────

  const onObsPtrDown = (e, id) => {
    e.stopPropagation();
    setSelected(id);
    const pt = svgPt(e);
    const obs = placed.find((o) => o.id === id);
    if (!pt || !obs) return;
    ptrDrag.current = { id, startX: pt.x, startY: pt.y, origX: obs.x, origY: obs.y };
    svgRef.current?.setPointerCapture(e.pointerId);
  };

  const onSvgPtrMove = (e) => {
    if (!ptrDrag.current) return;
    const pt = svgPt(e);
    if (!pt) return;
    const { id, startX, startY, origX, origY } = ptrDrag.current;
    const shape = getShape(placed.find((o) => o.id === id)?.name ?? "");
    const hw = shape.w / 2, hh = shape.h / 2;
    setPlaced((p) =>
      p.map((o) =>
        o.id === id
          ? {
              ...o,
              x: clamp(origX + pt.x - startX, hw, ARENA_W - hw),
              y: clamp(origY + pt.y - startY, hh, ARENA_H - hh),
            }
          : o
      )
    );
  };

  const onSvgPtrUp = () => { ptrDrag.current = null; };

  // ── Acties ─────────────────────────────────────────────────────────────────

  const removeObs = (id) => {
    setPlaced((p) => p.filter((o) => o.id !== id));
    if (selected === id) setSelected(null);
  };

  const rotateObs = (id, delta) => {
    setPlaced((p) =>
      p.map((o) => o.id === id ? { ...o, angle: ((o.angle ?? 0) + delta + 360) % 360 } : o)
    );
  };

  const moveObs = (id, direction) => {
    const step = 5;
    const dx = direction === "left" ? -step : direction === "right" ? step : 0;
    const dy = direction === "up"   ? -step : direction === "down"  ? step : 0;
    setPlaced((p) => p.map((o) => o.id === id ? { ...o, x: o.x + dx, y: o.y + dy } : o));
  };

  // ── Export PNG ─────────────────────────────────────────────────────────────

  const exportPng = useCallback(async () => {
    if (!svgRef.current || !placed.length) return;
    const url = await svgToDataUrl(svgRef.current);
    const a = document.createElement("a");
    a.href = url; a.download = `parcours_${level}.png`; a.click();
  }, [level, placed]);

  // ── Export PDF ─────────────────────────────────────────────────────────────

  const exportPdf = useCallback(async () => {
    if (!svgRef.current || !placed.length) return;
    const png = await svgToDataUrl(svgRef.current);
    const levelLabel = TRAIL_LEVELS.find((l) => l.code === level)?.label ?? level;

    const doc = new jsPDF({ unit: "pt", format: "A4", orientation: "landscape" });
    const pW = doc.internal.pageSize.getWidth();
    const pH = doc.internal.pageSize.getHeight();
    const mg = 32;

    doc.setFillColor(16, 39, 84);
    doc.rect(0, 0, pW, 58, "F");
    doc.setTextColor(255, 255, 255);
    doc.setFont("helvetica", "bold");   doc.setFontSize(18);
    doc.text(meta.wedstrijd || "Trailparcours", mg, 36);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    const sub = [meta.locatie, meta.datum, meta.piste].filter(Boolean).join("  |  ");
    if (sub) doc.text(sub, mg, 50);
    doc.setTextColor(0, 0, 0);

    doc.setFont("helvetica", "bold"); doc.setFontSize(14);
    doc.text(levelLabel, mg, 76);

    const imgY = 86, imgW = (pW - mg * 2) * 0.63, imgH = pH - imgY - mg;
    doc.addImage(png, "PNG", mg, imgY, imgW, imgH);

    const lx = mg + imgW + 18, lw = pW - lx - mg;
    doc.setFont("helvetica", "bold"); doc.setFontSize(11);
    doc.text("Obstakels", lx, imgY + 2);
    doc.setFont("helvetica", "normal"); doc.setFontSize(10);
    let y = imgY + 18;
    placed.forEach((obs, idx) => {
      const txt = `${idx + 1}.  ${obs.name}`;
      const wrapped = doc.splitTextToSize(txt, lw);
      if (y + wrapped.length * 13 > pH - mg) { doc.addPage(); y = mg + 13; }
      doc.text(wrapped, lx, y);
      y += wrapped.length * 13 + 2;
    });

    const safe = (s) => String(s || "").replace(/[^a-zA-Z0-9_-]+/g, "_").replace(/_+/g, "_").replace(/^_|_$/g, "");
    doc.save(`parcours_${safe(meta.wedstrijd || "wedstrijd")}_${level}.pdf`);
  }, [level, placed, meta]);

  // ── Geselecteerd obstakel ──────────────────────────────────────────────────

  const selObs = placed.find((o) => o.id === selected);
  const levelObj = TRAIL_LEVELS.find((l) => l.code === level);

  // ── Render ─────────────────────────────────────────────────────────────────

  return (
    <div style={{ maxWidth: 1280, margin: "24px auto", padding: "0 16px" }}>
      <h2 style={{ color: "#102754", marginBottom: 2 }}>Trailparcours Generator</h2>
      <p style={{ color: "#64748b", fontSize: 13, marginBottom: 14 }}>
        Sleep obstakels naar de arena. Elk obstakel heeft een ingang (groen ●) en uitgang (oranje ●) —
        de routelijn volgt die volgorde. Draai obstakels met de rotatieknoppen.
      </p>

      {/* Meta */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))", gap: 8, marginBottom: 14 }}>
        {[
          { k: "wedstrijd", p: "Wedstrijdnaam" },
          { k: "locatie",   p: "Locatie"       },
          { k: "piste",     p: "Piste / baan"  },
        ].map(({ k, p }) => (
          <input key={k} placeholder={p} value={meta[k]}
            onChange={(e) => setMeta((m) => ({ ...m, [k]: e.target.value }))}
            style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
          />
        ))}
        <input type="date" value={meta.datum}
          onChange={(e) => setMeta((m) => ({ ...m, datum: e.target.value }))}
          style={{ padding: "6px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
        />
      </div>

      {/* Niveau-tabs */}
      <div style={{ display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap", alignItems: "center" }}>
        {TRAIL_LEVELS.map((l) => (
          <button key={l.code} onClick={() => { setLevel(l.code); setSelected(null); }}
            style={{
              padding: "6px 18px", borderRadius: 8, border: "none",
              background: level === l.code ? "#102754" : "#e2e8f0",
              color: level === l.code ? "#fff" : "#102754",
              fontWeight: 700, cursor: "pointer", fontSize: 13,
            }}
          >{l.label}</button>
        ))}
        <button onClick={() => { setPlaced([]); setSelected(null); }}
          style={{ marginLeft: "auto", padding: "6px 14px", background: "#fee2e2", color: "#dc2626", border: "none", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 12 }}
        >Wis {levelObj?.label}</button>
      </div>

      {/* Hoofd-layout */}
      <div style={{ display: "flex", gap: 14, alignItems: "flex-start" }}>

        {/* Palette */}
        <div style={{ width: 200, flexShrink: 0, background: "#f8faff", border: "1px solid #dbe3ef", borderRadius: 10, padding: 10 }}>
          <div style={{ fontWeight: 700, color: "#102754", marginBottom: 8, fontSize: 12 }}>
            Obstakels — {levelObj?.label}
          </div>
          <div style={{ maxHeight: 440, overflowY: "auto", display: "flex", flexDirection: "column", gap: 3 }}>
            {obstacles.map((name) => (
              <div key={name} draggable onDragStart={(e) => onPaletteDragStart(e, name)}
                style={{
                  padding: "5px 9px",
                  background: "#eef2ff",
                  borderLeft: `3px solid ${obsColor(name)}`,
                  borderRadius: 5,
                  cursor: "grab", fontSize: 11, userSelect: "none", lineHeight: 1.4,
                }}
              >{name}</div>
            ))}
          </div>

          {/* Volgordelijst */}
          {placed.length > 0 && (
            <div style={{ marginTop: 12, borderTop: "1px solid #dbe3ef", paddingTop: 10 }}>
              <div style={{ fontWeight: 700, color: "#102754", marginBottom: 5, fontSize: 11 }}>Volgorde ({placed.length})</div>
              {placed.map((obs, idx) => (
                <div key={obs.id}
                  onClick={() => setSelected(obs.id)}
                  style={{
                    display: "flex", alignItems: "center", gap: 5, marginBottom: 2, fontSize: 10,
                    background: selected === obs.id ? "#e0e7ff" : "transparent",
                    borderRadius: 4, padding: "2px 3px", cursor: "pointer",
                  }}
                >
                  <span style={{
                    background: obsColor(obs.name), color: "#fff", borderRadius: "50%",
                    width: 15, height: 15, display: "inline-flex", alignItems: "center",
                    justifyContent: "center", fontWeight: 700, fontSize: 9, flexShrink: 0,
                  }}>{idx + 1}</span>
                  <span style={{ flex: 1, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{obs.name}</span>
                  <button onClick={(e) => { e.stopPropagation(); removeObs(obs.id); }}
                    style={{ border: "none", background: "none", color: "#dc2626", cursor: "pointer", fontSize: 13, padding: 0, flexShrink: 0 }}
                    title="Verwijder">×</button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Arena + toolbar */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Toolbar geselecteerd obstakel */}
          <div style={{
            minHeight: 40, marginBottom: 8, padding: "6px 12px",
            background: selObs ? "#f0f4ff" : "#f8fafc",
            border: "1px solid #dbe3ef", borderRadius: 8,
            display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap",
          }}>
            {selObs ? (
              <>
                <span style={{ fontWeight: 700, color: "#102754", fontSize: 13 }}>
                  {placed.findIndex((o) => o.id === selObs.id) + 1}. {selObs.name}
                </span>
                <span style={{ color: "#64748b", fontSize: 11 }}>Draaien:</span>
                {[-90, -45, 45, 90].map((d) => (
                  <button key={d} onClick={() => rotateObs(selObs.id, d)}
                    style={{ padding: "3px 10px", borderRadius: 6, border: "1px solid #c7d2fe", background: "#fff", cursor: "pointer", fontSize: 12 }}>
                    {d > 0 ? `+${d}°` : `${d}°`}
                  </button>
                ))}
                <span style={{ color: "#64748b", fontSize: 11, marginLeft: 4 }}>Verplaatsen:</span>
                {[["↑","up"],["↓","down"],["←","left"],["→","right"]].map(([sym, dir]) => (
                  <button key={dir} onClick={() => moveObs(selObs.id, dir)}
                    style={{ padding: "3px 8px", borderRadius: 6, border: "1px solid #c7d2fe", background: "#fff", cursor: "pointer", fontSize: 13 }}>
                    {sym}
                  </button>
                ))}
                <span style={{ color: "#94a3b8", fontSize: 10, marginLeft: 4 }}>
                  {Math.round(selObs.angle ?? 0)}°
                </span>
                <button onClick={() => removeObs(selObs.id)}
                  style={{ marginLeft: "auto", padding: "3px 10px", borderRadius: 6, border: "none", background: "#fee2e2", color: "#dc2626", cursor: "pointer", fontSize: 12, fontWeight: 600 }}>
                  Verwijder
                </button>
              </>
            ) : (
              <span style={{ color: "#94a3b8", fontSize: 12 }}>Klik op een obstakel om het te selecteren en te draaien</span>
            )}
          </div>

          {/* SVG Arena */}
          <svg
            ref={svgRef}
            width="100%"
            viewBox={`0 0 ${ARENA_W} ${ARENA_H}`}
            style={{
              border: "2px solid #2b6cb0", borderRadius: 12,
              background: "#e8f5e9", display: "block",
              touchAction: "none", cursor: "default",
            }}
            onDragOver={onArenaDragOver}
            onDrop={onArenaDrop}
            onPointerMove={onSvgPtrMove}
            onPointerUp={onSvgPtrUp}
            onClick={() => setSelected(null)}
          >
            {/* Arenarand */}
            <rect x={14} y={14} width={ARENA_W - 28} height={ARENA_H - 28}
              fill="none" stroke="#81c784" strokeWidth={2} strokeDasharray="12,6" rx={12} />

            {/* Routelijnen: exit(n) → entry(n+1) */}
            {placed.length > 1 && placed.map((obs, idx) => {
              if (idx === 0) return null;
              const from = connectorPt(placed[idx - 1], "exit");
              const to   = connectorPt(obs, "entry");
              return (
                <g key={`route-${obs.id}`}>
                  <line x1={from.x} y1={from.y} x2={to.x} y2={to.y}
                    stroke="#1565c0" strokeWidth={2} strokeDasharray="8,4" opacity={0.6} />
                  <ArrowHead x1={from.x} y1={from.y} x2={to.x} y2={to.y} col="#1565c0" />
                </g>
              );
            })}

            {/* Obstakels */}
            {placed.map((obs, idx) => {
              const shape = getShape(obs.name);
              const col   = obsColor(obs.name);
              const isSel = selected === obs.id;
              return (
                <g key={obs.id}
                  transform={`translate(${obs.x},${obs.y}) rotate(${obs.angle ?? 0})`}
                  onPointerDown={(e) => { e.stopPropagation(); onObsPtrDown(e, obs.id); }}
                  onDoubleClick={(e) => { e.stopPropagation(); removeObs(obs.id); }}
                  style={{ cursor: "move" }}
                  onClick={(e) => e.stopPropagation()}
                >
                  {isSel && (
                    <rect
                      x={-shape.w / 2 - 8} y={-shape.h / 2 - 8}
                      width={shape.w + 16} height={shape.h + 16}
                      fill="none" stroke="#3b82f6" strokeWidth={2}
                      strokeDasharray="5,3" rx={8} opacity={0.8}
                    />
                  )}
                  {shape.render(col, obs.name)}
                  {/* Nummer */}
                  <circle cx={-shape.w / 2 + 11} cy={-shape.h / 2 + 11} r={10} fill={col} />
                  <text
                    x={-shape.w / 2 + 11} y={-shape.h / 2 + 15}
                    textAnchor="middle" fill="white" fontSize={10} fontWeight="bold"
                    fontFamily="helvetica,arial,sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >{idx + 1}</text>
                  {/* Naam-label */}
                  <text
                    x={0} y={shape.h / 2 + 13}
                    textAnchor="middle" fill="#1e293b" fontSize={9}
                    fontFamily="helvetica,arial,sans-serif"
                    style={{ pointerEvents: "none", userSelect: "none" }}
                  >
                    {obs.name.length > 22 ? obs.name.slice(0, 21) + "…" : obs.name}
                  </text>
                </g>
              );
            })}

            {/* Entry (groen) en exit (oranje) connectors in arena-coördinaten */}
            {placed.map((obs) => {
              const entry = connectorPt(obs, "entry");
              const exit_ = connectorPt(obs, "exit");
              return (
                <g key={`conn-${obs.id}`} style={{ pointerEvents: "none" }}>
                  <circle cx={entry.x} cy={entry.y} r={4} fill="#16a34a" opacity={0.85} />
                  <circle cx={exit_.x} cy={exit_.y} r={4} fill="#ea580c" opacity={0.85} />
                </g>
              );
            })}

            {placed.length === 0 && (
              <text x={ARENA_W / 2} y={ARENA_H / 2} textAnchor="middle"
                fill="#a5d6a7" fontSize={15} fontFamily="helvetica,arial,sans-serif">
                Sleep obstakels vanuit de lijst naar de arena
              </text>
            )}
          </svg>

          {/* Legenda */}
          <div style={{ display: "flex", gap: 16, marginTop: 6, fontSize: 11, color: "#64748b", flexWrap: "wrap" }}>
            <span><span style={{ color: "#16a34a", fontWeight: 700 }}>●</span> Ingang obstakel</span>
            <span><span style={{ color: "#ea580c", fontWeight: 700 }}>●</span> Uitgang obstakel</span>
            <span style={{ opacity: 0.7 }}>Dubbelklik om te verwijderen · Sleep om te verplaatsen</span>
          </div>
        </div>
      </div>

      {/* Export-knoppen */}
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap", alignItems: "center" }}>
        <button onClick={exportPng} disabled={!placed.length}
          style={{ padding: "8px 20px", background: "#2b6cb0", color: "#fff", border: "none", borderRadius: 8, cursor: placed.length ? "pointer" : "not-allowed", opacity: placed.length ? 1 : 0.45, fontWeight: 700, fontSize: 13 }}>
          Download afbeelding (PNG)
        </button>
        <button onClick={exportPdf} disabled={!placed.length}
          style={{ padding: "8px 20px", background: "#102754", color: "#fff", border: "none", borderRadius: 8, cursor: placed.length ? "pointer" : "not-allowed", opacity: placed.length ? 1 : 0.45, fontWeight: 700, fontSize: 13 }}>
          Exporteer PDF
        </button>
        <a href="#/protocollen"
          style={{ padding: "8px 20px", background: "#f0f4ff", color: "#2b6cb0", border: "1px solid #c7d2fe", borderRadius: 8, textDecoration: "none", fontWeight: 700, fontSize: 13, display: "inline-flex", alignItems: "center" }}>
          Naar Protocol Generator →
        </a>
      </div>
    </div>
  );
}
