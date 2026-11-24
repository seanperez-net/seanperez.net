/**
 * Generates `src/tokens/components/loading-indicator.css`: the M3 Expressive loading indicator's
 * seven shapes as CSS `clip-path: polygon()` keyframes.
 *
 *   node packages/ui/scripts/loading-indicator-shapes.mjs
 *
 * Source (read 2026-11-23): androidx `compose/material3/.../MaterialShapes.kt` (the vertices,
 * repetition and per-corner rounding of SoftBurst, Cookie9Sided, Pentagon, Pill, Sunny,
 * Cookie4Sided, Oval) and `LoadingIndicator.kt` (`IndeterminateIndicatorPolygons` in that order,
 * `MorphIntervalMillis` 650, `GlobalRotationDurationMillis` 4666, a quarter turn per morph).
 *
 * APPROXIMATION (NOT PROOFED against Compose's geometry): every corner is a circular fillet of
 * the given radius (Compose's `CornerRounding.smoothing` is ignored), and each outline is
 * resampled at N equal angles from the centre so that any two shapes morph point by point. CSS
 * can interpolate two `polygon()`s only when they have the same number of points.
 */
import { writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const N = 72; // points per outline
const C = { x: 0.5, y: 0.5 };
const rad = (d) => (d / 180) * Math.PI;

// MaterialShapes.doRepeat
function doRepeat(points, reps, center, mirroring) {
  const out = [];
  if (mirroring) {
    const angles = points.map((p) => (Math.atan2(p.y - center.y, p.x - center.x) * 180) / Math.PI);
    const dist = points.map((p) => Math.hypot(p.x - center.x, p.y - center.y));
    const actual = reps * 2;
    const section = 360 / actual;
    for (let it = 0; it < actual; it++) {
      for (let index = 0; index < points.length; index++) {
        const i = it % 2 === 0 ? index : points.length - 1 - index;
        if (i > 0 || it % 2 === 0) {
          const a = rad(
            section * it + (it % 2 === 0 ? angles[i] : section - angles[i] + 2 * angles[0]),
          );
          out.push({ x: Math.cos(a) * dist[i] + center.x, y: Math.sin(a) * dist[i] + center.y, r: points[i].r });
        }
      }
    }
  } else {
    const np = points.length;
    for (let it = 0; it < np * reps; it++) {
      const p = points[it % np];
      const a = rad((Math.floor(it / np) * 360) / reps);
      const dx = p.x - center.x;
      const dy = p.y - center.y;
      out.push({
        x: dx * Math.cos(a) - dy * Math.sin(a) + center.x,
        y: dx * Math.sin(a) + dy * Math.cos(a) + center.y,
        r: p.r,
      });
    }
  }
  return out;
}

// RoundedPolygon.star(numVerticesPerRadius, innerRadius, rounding) around (0,0), radius 1.
function star(n, inner, r, rotateDeg = 0) {
  const out = [];
  for (let i = 0; i < n * 2; i++) {
    const a = rad((i * 180) / n + rotateDeg);
    const radius = i % 2 === 0 ? 1 : inner;
    out.push({ x: Math.cos(a) * radius, y: Math.sin(a) * radius, r });
  }
  return out;
}

/** The outline as a dense polyline, each corner replaced by a circular fillet. */
function outline(vertices) {
  const pts = [];
  const n = vertices.length;
  for (let i = 0; i < n; i++) {
    const p = vertices[i];
    const a = vertices[(i - 1 + n) % n];
    const b = vertices[(i + 1) % n];
    const ua = { x: a.x - p.x, y: a.y - p.y };
    const ub = { x: b.x - p.x, y: b.y - p.y };
    const la = Math.hypot(ua.x, ua.y);
    const lb = Math.hypot(ub.x, ub.y);
    ua.x /= la; ua.y /= la; ub.x /= lb; ub.y /= lb;
    const cos = Math.max(-1, Math.min(1, ua.x * ub.x + ua.y * ub.y));
    const theta = Math.acos(cos);
    if (!p.r || theta < 1e-3 || Math.PI - theta < 1e-3) {
      pts.push({ x: p.x, y: p.y });
      continue;
    }
    // Tangent distance, clamped to half of each edge (as Compose does before it smooths).
    let d = p.r / Math.tan(theta / 2);
    d = Math.min(d, la / 2, lb / 2);
    const radius = d * Math.tan(theta / 2);
    const t1 = { x: p.x + ua.x * d, y: p.y + ua.y * d };
    const t2 = { x: p.x + ub.x * d, y: p.y + ub.y * d };
    const bis = { x: ua.x + ub.x, y: ua.y + ub.y };
    const bl = Math.hypot(bis.x, bis.y);
    const cd = Math.hypot(d, radius);
    const c = { x: p.x + (bis.x / bl) * cd, y: p.y + (bis.y / bl) * cd };
    let s = Math.atan2(t1.y - c.y, t1.x - c.x);
    let e = Math.atan2(t2.y - c.y, t2.x - c.x);
    let sweep = e - s;
    while (sweep > Math.PI) sweep -= 2 * Math.PI;
    while (sweep < -Math.PI) sweep += 2 * Math.PI;
    for (let k = 0; k <= 12; k++) {
      const ang = s + (sweep * k) / 12;
      pts.push({ x: c.x + Math.cos(ang) * radius, y: c.y + Math.sin(ang) * radius });
    }
  }
  return pts;
}

/** Centre the outline on its bounding box (Compose's `normalized()` fits the box to 0..1). */
function centred(pts) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const cx = (Math.min(...xs) + Math.max(...xs)) / 2;
  const cy = (Math.min(...ys) + Math.max(...ys)) / 2;
  const scale = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys));
  return pts.map((p) => ({ x: (p.x - cx) / scale, y: (p.y - cy) / scale }));
}

/** The outline's distance from the centre along N equal angles (ray against each segment). */
function radial(pts) {
  const out = [];
  for (let k = 0; k < N; k++) {
    const a = (k / N) * 2 * Math.PI - Math.PI / 2;
    const dx = Math.cos(a);
    const dy = Math.sin(a);
    let best = 0;
    for (let i = 0; i < pts.length; i++) {
      const p = pts[i];
      const q = pts[(i + 1) % pts.length];
      const ex = q.x - p.x;
      const ey = q.y - p.y;
      const den = dx * ey - dy * ex;
      if (Math.abs(den) < 1e-12) continue;
      const t = (p.x * ey - p.y * ex) / den;
      const u = (p.x * dy - p.y * dx) / den;
      if (t > 0 && u >= 0 && u <= 1) best = Math.max(best, t);
    }
    out.push({ a, r: best });
  }
  return out;
}

const P = (x, y, r = 0) => ({ x, y, r });
const shapes = {
  softBurst: doRepeat([P(0.193, 0.277, 0.053), P(0.176, 0.055, 0.053)], 10, C, false),
  cookie9: star(9, 0.8, 0.5, -90),
  pentagon: doRepeat([P(0.5, -0.009, 0.172), P(1.03, 0.365, 0.164), P(0.828, 0.97, 0.169)], 1, C, true),
  pill: doRepeat([P(0.961, 0.039, 0.426), P(1.001, 0.428), P(1.0, 0.609, 1.0)], 2, C, true),
  sunny: star(8, 0.8, 0.15),
  cookie4: doRepeat([P(1.237, 1.236, 0.258), P(0.5, 0.918, 0.233)], 4, C, false),
  // RoundedPolygon.circle() scaled (1, 0.64) and turned -45 degrees: an ellipse.
  oval: Array.from({ length: 180 }, (_, i) => {
    const t = (i / 180) * 2 * Math.PI;
    const x = Math.cos(t);
    const y = Math.sin(t) * 0.64;
    const a = rad(-45);
    return P(x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a));
  }),
};

const sampled = Object.entries(shapes).map(([name, v]) => [name, radial(centred(outline(v)))]);
// One scale for all, so the widest shape at any rotation stays inside the box
// (Compose's `calculateScaleFactor`).
const maxR = Math.max(...sampled.flatMap(([, s]) => s.map((p) => p.r)));
const poly = (s) =>
  s
    .map(({ a, r }) => {
      const rr = (r / maxR) * 50;
      return `${(50 + Math.cos(a) * rr).toFixed(2)}% ${(50 + Math.sin(a) * rr).toFixed(2)}%`;
    })
    .join(",");

const count = sampled.length;
const frames = sampled
  .map(([name, s], i) => `  /* ${name} */\n  ${((i / count) * 100).toFixed(3)}% { clip-path: polygon(${poly(s)}); }`)
  .concat(`  100% { clip-path: polygon(${poly(sampled[0][1])}); }`)
  .join("\n");

// A quarter turn per morph (Compose `morphRotationTargetAngle`); 28 morphs = 7 full turns, so the
// loop closes without a jump.
const turns = Array.from({ length: 29 }, (_, i) => `  ${((i / 28) * 100).toFixed(3)}% { rotate: ${i * 90}deg; }`).join("\n");

const css = `/*
 * GENERATED by packages/ui/scripts/loading-indicator-shapes.mjs: do not edit by hand.
 * The M3 Expressive loading indicator (LoadingIndicator in components/loading-indicator):
 * seven Material shapes morphed in turn every 650ms, a quarter turn per morph, and a full turn
 * every 4666ms on top (androidx Compose LoadingIndicator.kt). The shapes are APPROXIMATED
 * (circular fillets, ${N} points resampled by angle): NOT PROOFED against Compose's geometry.
 */
@keyframes loading-indicator-morph {
${frames}
}

@keyframes loading-indicator-step {
${turns}
}

@keyframes loading-indicator-spin {
  to { rotate: 360deg; }
}
`;

const here = dirname(fileURLToPath(import.meta.url));
writeFileSync(resolve(here, "../src/tokens/components/loading-indicator.css"), css);
console.log("wrote loading-indicator.css", css.length, "bytes");
