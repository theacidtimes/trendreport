"use client";

import { useEffect, useRef, useState } from "react";

// Sketches generativas tipo Processing: campos de caracteres cujo brilho é
// dirigido por campos animados. Uma é sorteada por login (rodízio). Canvas 2D
// puro (sem lib), respeita prefers-reduced-motion e pausa quando sai de vista.
// Ramps evitam o "K" pesado; o topo de densidade usa "F" (ecoa o Fabric).

type Sketch = {
  ramp: string[];
  speed: number;
  // Densidade em [0,1]. gx,gy em células; cols,rows = grade; t = tempo.
  field: (gx: number, gy: number, t: number, cols: number, rows: number) => number;
};

const SKETCHES: Sketch[] = [
  // 1. Warp — campo blobby e fluido (domain warping por senos).
  {
    ramp: [" ", " ", ".", ":", "+", "*", "o", "F", "#"],
    speed: 0.012,
    field(gx, gy, t) {
      const u = gx * 0.055;
      const v = gy * 0.055;
      const a = Math.sin(u + t) + Math.sin(v * 1.3 - t * 0.7);
      const b = Math.sin((u + v) * 0.8 + t * 0.5);
      const warp = Math.sin(u * 0.5 + a) + Math.cos(v * 0.5 + b);
      return 0.5 + 0.34 * Math.sin(a + b + warp);
    },
  },
  // 2. Weave — trama tecida que deriva; bandas cruzadas evocam "Fabric".
  {
    ramp: [" ", " ", ".", ":", "|", "/", "x", "F", "#"],
    speed: 0.01,
    field(gx, gy, t) {
      const u = gx * 0.09;
      const v = gy * 0.09;
      const warp = Math.sin(u + t * 0.6) * Math.cos(v - t * 0.4);
      const weave = Math.sin(u * 2 + warp) + Math.sin(v * 2 - warp);
      return 0.5 + 0.3 * Math.sin(weave * 1.4 + t * 0.3);
    },
  },
  // 3. Rings — interferência de duas ondas concêntricas em deriva lenta.
  {
    ramp: [" ", " ", ".", "·", "+", "x", "*", "F", "@"],
    speed: 0.014,
    field(gx, gy, t, cols, rows) {
      const cx1 = cols * (0.35 + 0.15 * Math.sin(t * 0.4));
      const cy1 = rows * (0.3 + 0.15 * Math.cos(t * 0.3));
      const cx2 = cols * (0.7 + 0.14 * Math.cos(t * 0.35));
      const cy2 = rows * (0.65 + 0.14 * Math.sin(t * 0.5));
      const d1 = Math.hypot(gx - cx1, gy - cy1);
      const d2 = Math.hypot(gx - cx2, gy - cy2);
      return 0.5 + 0.28 * (Math.sin(d1 * 0.42 - t * 2) + Math.sin(d2 * 0.46 - t * 1.6)) * 0.5;
    },
  },
];

export default function GenerativeBackdrop({
  tint = "#A063E8",
  highlight = "#FFFFFF",
  className = "",
}: {
  tint?: string;
  highlight?: string;
  className?: string;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  // Sorteio estável por montagem: cada visita ao login pega uma sketch.
  const [pick] = useState(() => Math.floor(Math.random() * SKETCHES.length));

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cv: HTMLCanvasElement = canvas;
    const ctx0 = cv.getContext("2d");
    if (!ctx0) return;
    const ctx: CanvasRenderingContext2D = ctx0;

    const sketch = SKETCHES[pick];
    const { ramp, field, speed } = sketch;
    const CELL = 15;
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    let cols = 0;
    let rows = 0;
    let raf = 0;
    let running = true;
    let t = 0;

    function resize() {
      const parent = cv.parentElement;
      if (!parent) return;
      const w = parent.clientWidth;
      const h = parent.clientHeight;
      const dpr = Math.min(window.devicePixelRatio || 1, 1.5);
      cv.width = Math.floor(w * dpr);
      cv.height = Math.floor(h * dpr);
      cv.style.width = `${w}px`;
      cv.style.height = `${h}px`;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.font = `${CELL}px ui-monospace, "SF Mono", Menlo, monospace`;
      ctx.textBaseline = "top";
      cols = Math.ceil(w / CELL);
      rows = Math.ceil(h / CELL);
    }

    function draw() {
      const w = cv.clientWidth;
      const h = cv.clientHeight;
      ctx.fillStyle = "#000";
      ctx.fillRect(0, 0, w, h);

      let currentHi = false;
      ctx.fillStyle = tint;
      for (let gy = 0; gy < rows; gy++) {
        for (let gx = 0; gx < cols; gx++) {
          const val = field(gx, gy, t, cols, rows);
          const idx = Math.max(0, Math.min(ramp.length - 1, Math.floor(val * ramp.length)));
          const ch = ramp[idx];
          if (ch === " ") continue;
          const hi = idx >= ramp.length - 2;
          if (hi !== currentHi) {
            currentHi = hi;
            ctx.fillStyle = hi ? highlight : tint;
          }
          ctx.fillText(ch, gx * CELL, gy * CELL);
        }
      }
    }

    function loop() {
      if (!running) return;
      t += speed;
      draw();
      raf = requestAnimationFrame(loop);
    }

    resize();
    const ro = new ResizeObserver(() => {
      resize();
      if (reduced || !running) draw();
    });
    if (cv.parentElement) ro.observe(cv.parentElement);

    function onVisibility() {
      if (document.hidden) {
        running = false;
        cancelAnimationFrame(raf);
      } else if (!reduced) {
        running = true;
        loop();
      }
    }
    document.addEventListener("visibilitychange", onVisibility);

    if (reduced) {
      draw();
    } else {
      loop();
    }

    return () => {
      running = false;
      cancelAnimationFrame(raf);
      ro.disconnect();
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [tint, highlight, pick]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block w-full h-full ${className}`}
    />
  );
}
