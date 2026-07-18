"use client";

import { useEffect, useRef } from "react";

// Sketch generativa tipo Processing: um campo de caracteres cujo brilho é
// dirigido por um campo de ruído animado (domain warping por senos). É a
// primeira das sketches que vão rodiziar no login. Canvas 2D puro (sem lib),
// respeita prefers-reduced-motion, e pausa quando a aba/painel sai de vista.

const RAMP = [" ", " ", "·", ":", "+", "×", "k", "K", "#"];

// Campo blobby e fluido em [0,1]. x,y em unidades de célula; t = tempo.
function field(x: number, y: number, t: number): number {
  const u = x * 0.055;
  const v = y * 0.055;
  const a = Math.sin(u + t) + Math.sin(v * 1.3 - t * 0.7);
  const b = Math.sin((u + v) * 0.8 + t * 0.5);
  const warp = Math.sin(u * 0.5 + a) + Math.cos(v * 0.5 + b);
  return 0.5 + 0.34 * Math.sin(a + b + warp);
}

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

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const cv: HTMLCanvasElement = canvas;
    const ctx0 = cv.getContext("2d");
    if (!ctx0) return;
    const ctx: CanvasRenderingContext2D = ctx0;

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
          const val = field(gx, gy, t);
          const idx = Math.max(0, Math.min(RAMP.length - 1, Math.floor(val * RAMP.length)));
          const ch = RAMP[idx];
          if (ch === " ") continue;
          const hi = idx >= RAMP.length - 2;
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
      t += 0.012;
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
  }, [tint, highlight]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className={`block w-full h-full ${className}`}
    />
  );
}
