import type { MachineStatus, NodeProgramInfo, NodeReport } from "./map-nodes";
import {
  along,
  bearing,
  distance,
  greatCircle,
  polyline,
  turn,
} from "./map-nodes-geo";
import type { Polyline } from "./map-nodes-geo";
import type { LngLat, TravelMode } from "./map-url";

/**
 * PROGRAMS for the dummy nodes (owner, 2026-11-24: "nodes that can be programed individually
 * like how node red ... for now they can be programed to take a certain route"). New, not in
 * e-store. A fresh agent reviewed the seam before it was written; its advice is followed:
 *
 * - The SOURCE owns time (`map-nodes-dummy.ts`, one timer): it calls `step(now, dt)` on every
 *   program. A program never starts a timer of its own, so pausing and stopping is one place.
 * - A program never fetches: anything from outside (a road route) comes through `ctx`, where the
 *   queue and the cache live (`map-nodes-routes.ts`).
 * - `start()` may begin async work; until it lands, `step()` keeps the node going on its fallback
 *   and says so in `info.status`.
 * - A program is a detail of the DUMMY. Something external (a Node-RED / FlowFuse flow, a
 *   WebSocket, manual control) is not a program: it is another `NodeSource`, or it replaces one
 *   node's reports inside a merged source (`map-nodes.ts`). Programs are never put in Qwik state;
 *   only their JSON `info` travels in each report.
 */

export type ProgramContext = {
  /** A road route through `stops` (cached, queued >= 1.1 s apart), or null when there is none. */
  route(stops: LngLat[], mode: TravelMode): Promise<LngLat[] | null>;
};

export type NodeProgram = {
  /** What the detail card shows ("Road loop: 4 stops by OSRM"). */
  info: NodeProgramInfo;
  /** The node's first report fields, before any tick (a machine's idle status). */
  initial?: Partial<NodeReport>;
  start?(ctx: ProgramContext): void;
  /** One tick: what changed in the node's report. `dt` is seconds since the last tick. */
  step(now: number, dt: number): Partial<NodeReport>;
};

const round1 = (n: number) => Math.round(n * 10) / 10;

/** Battery that runs down by `perSecond` and is swapped (100%) below `swapAt`. */
function battery(start: number, perSecond: number, swapAt = 0) {
  let level = start;
  return (dt: number) => {
    level -= perSecond * dt;
    if (level < swapAt) level = swapAt > 0 ? 100 : 0;
    return round1(Math.max(0, level));
  };
}

/**
 * A node that stays put and reports every `every` seconds: a gateway (mains power, heartbeat),
 * a LoRa sensor (class A uplink with a fresh RSSI / SNR), a Wi-Fi node.
 */
export function fixedProgram(options: {
  every: number;
  /** Signal range [min, max] dBm; with `snr`, LoRa SNR range [min, max] dB. */
  rssi?: [number, number];
  snr?: [number, number];
  /** Start level and drain per second; omitted: mains power. */
  battery?: [number, number];
}): NodeProgram {
  const { every, rssi, snr } = options;
  const drain = options.battery
    ? battery(options.battery[0], options.battery[1])
    : null;
  let since = every;
  let level: number | null = options.battery?.[0] ?? null;
  const pick = ([lo, hi]: [number, number]) => lo + Math.random() * (hi - lo);
  return {
    info: { label: `Fixed: reports every ${every} s`, status: "running" },
    step(now, dt) {
      if (drain) level = drain(dt);
      since += dt;
      if (since < every) return {};
      since = 0;
      return {
        ts: now,
        battery: level,
        ...(rssi ? { rssi: Math.round(pick(rssi)) } : {}),
        ...(snr ? { snr: round1(pick(snr)) } : {}),
      };
    },
  };
}

/**
 * Drives along a line at a speed that wanders between `speed` [min, max] m/s, slowing for turns
 * (the heading 30 m ahead) and easing toward its target (at most 2 m/s change per second). Loops
 * when the line is closed, else turns back at the ends.
 */
function driver(speedRange: [number, number]) {
  const [min, max] = speedRange;
  let line: Polyline | null = null;
  let d = 0;
  let dir = 1;
  let speed = min;
  let target = min;
  let closed = false;
  return {
    setLine(points: LngLat[], keepFraction = true) {
      const next = polyline(points);
      if (line && keepFraction && line.length > 0)
        d = (d / line.length) * next.length;
      line = next;
      const first = points[0];
      const last = points[points.length - 1];
      closed = !!first && !!last && distance(first, last) < 30;
    },
    step(dt: number) {
      if (!line || line.length === 0) return null;
      if (Math.random() < 0.05) target = min + Math.random() * (max - min);
      const here = along(line, d);
      const ahead = along(line, Math.min(line.length, d + dir * 30));
      const bend = Math.abs(turn(here.heading, ahead.heading));
      const cap = bend > 60 ? 4 : bend > 30 ? 7 : max;
      const want = Math.min(target, cap);
      speed += Math.max(-2 * dt, Math.min(2 * dt, want - speed));
      d += dir * speed * dt;
      if (closed) d = ((d % line.length) + line.length) % line.length;
      else if (d >= line.length || d <= 0) {
        dir = -dir;
        d = Math.min(line.length, Math.max(0, d));
      }
      const at = along(line, d);
      return {
        lngLat: at.p,
        heading: round1(dir > 0 ? at.heading : (at.heading + 180) % 360),
        speed: round1(speed),
      };
    },
  };
}

/**
 * A loop through `stops` on REAL roads: one OSRM route for the whole loop, asked for once through
 * `ctx.route` (cached), driven at a plausible speed. Until it lands, and if it never does, the
 * node drives `fallback` (the same route, bundled in the repo).
 */
export function roadLoop(options: {
  stops: LngLat[];
  mode: TravelMode;
  fallback: LngLat[];
  speed: [number, number];
  battery: [number, number];
}): NodeProgram {
  const { stops, mode, fallback } = options;
  const drive = driver(options.speed);
  const drain = battery(options.battery[0], options.battery[1], 15);
  drive.setLine(fallback, false);
  const label = `Road loop: ${stops.length - 1} stops by OSRM (${mode})`;
  const info: NodeProgramInfo = { label, status: "loading" };
  return {
    info,
    start(ctx) {
      void ctx.route(stops, mode).then((line) => {
        if (line && line.length > 1) {
          drive.setLine(line);
          info.status = "running";
        } else {
          info.label = `${label}, bundled copy`;
          info.status = "fallback";
        }
      });
    },
    step(now, dt) {
      const moved = drive.step(dt);
      return moved
        ? { ...moved, battery: drain(dt), ts: now, program: { ...info } }
        : {};
    },
  };
}

/** A fixed path (a boat's water loop): driven like a road loop, nothing fetched. */
export function pathLoop(options: {
  path: LngLat[];
  label: string;
  speed: [number, number];
  battery: [number, number];
}): NodeProgram {
  const drive = driver(options.speed);
  const drain = battery(options.battery[0], options.battery[1], 15);
  drive.setLine(options.path, false);
  const info: NodeProgramInfo = { label: options.label, status: "running" };
  return {
    info,
    step(now, dt) {
      const moved = drive.step(dt);
      return moved ? { ...moved, battery: drain(dt), ts: now } : {};
    },
  };
}

/**
 * An aerial loop: from `base` through the waypoints and back, in straight great-circle legs over
 * anything (no roads, no water rule), climbing to `cruise` metres at `climb` m/s after take-off
 * and descending the same way before landing; `wait` seconds on the ground at base (battery
 * swapped there below 30%), then again.
 */
export function airLoop(options: {
  base: LngLat;
  waypoints: LngLat[];
  cruise: number;
  speed: number;
  climb: number;
  wait: number;
  battery: [number, number];
}): NodeProgram {
  const { base, cruise, speed, climb, wait } = options;
  const points = [base, ...options.waypoints, base];
  const legs = polyline(points);
  // Horizontal distance covered while climbing to cruise (and while descending from it).
  const ramp = (cruise / climb) * speed;
  let level = options.battery[0];
  let s = 0;
  let grounded = wait;
  let heading = bearing(points[0], points[1]);
  const info: NodeProgramInfo = {
    label: `Air loop: ${options.waypoints.length} waypoints at ${cruise} m, great-circle legs`,
    status: "running",
  };
  return {
    info,
    step(now, dt) {
      if (grounded > 0) {
        grounded -= dt;
        if (level < 30) level = 100;
        return {
          lngLat: base,
          altitude: 0,
          speed: 0,
          heading,
          ts: now,
          battery: round1(level),
        };
      }
      s += speed * dt;
      level = Math.max(0, level - options.battery[1] * dt);
      if (s >= legs.length) {
        s = 0;
        grounded = wait;
        return {
          lngLat: base,
          altitude: 0,
          speed: 0,
          heading,
          ts: now,
          battery: round1(level),
        };
      }
      // Which leg, and how far along it, on the great circle.
      let i = 1;
      while (i < legs.at.length - 1 && legs.at[i] < s) i++;
      const a = points[i - 1];
      const b = points[i];
      const f = (s - legs.at[i - 1]) / (legs.at[i] - legs.at[i - 1] || 1);
      const p = greatCircle(a, b, f);
      heading = round1(bearing(p, b));
      const altitude = Math.round(
        cruise * Math.min(1, s / ramp, (legs.length - s) / ramp),
      );
      return {
        lngLat: p,
        altitude,
        speed,
        heading,
        ts: now,
        battery: round1(level),
      };
    },
  };
}

/**
 * Machines (owner, 2026-11-24: printers, 3D printers, CNC): they stay put, on mains power, and
 * run JOBS: idle, a job that runs to the end, idle again, the next job from `jobs` (in turn).
 * Each tick reports the status (`MachineStatus`); the timings are short so the demo shows a
 * whole cycle in a few minutes. The shapes follow the protocols (IPP, OctoPrint / Moonraker,
 * GRBL); nothing here talks to a real machine.
 */
function cycle<T>(jobs: T[]) {
  let i = -1;
  return () => jobs[(i = (i + 1) % jobs.length)];
}

/** Moves `value` toward `target` by at most `rate * dt`. */
const toward = (value: number, target: number, rate: number, dt: number) =>
  value + Math.max(-rate * dt, Math.min(rate * dt, target - value));

/** A network printer (IPP): idle, then a job of a few pages at `pageSeconds` each. */
export function printerProgram(options: {
  jobs: string[];
  idle: number;
  pageSeconds: number;
  toner: number;
}): NodeProgram {
  const next = cycle(options.jobs);
  let toner = options.toner;
  let job: string | null = null;
  let pages: [number, number] | null = null;
  let t = 0;
  const status = (): MachineStatus => ({
    type: "printer",
    state: job ? "processing" : "idle",
    job,
    pages,
    toner: round1(toner),
  });
  return {
    info: {
      label: `Print queue: ${options.jobs.length} jobs in turn (IPP-style status)`,
      status: "running",
    },
    initial: { status: status() },
    step(now, dt) {
      t += dt;
      if (!job && t >= options.idle) {
        t = 0;
        job = next();
        pages = [0, 3 + Math.floor(Math.random() * 10)];
      } else if (job && pages && t >= options.pageSeconds) {
        t = 0;
        pages = [pages[0] + 1, pages[1]];
        toner -= 0.4;
        if (toner < 5) toner = 100;
        if (pages[0] >= pages[1]) {
          job = null;
          pages = null;
        }
      }
      return { ts: now, status: status() };
    },
  };
}

/**
 * A 3D printer (OctoPrint / Moonraker style): idle, heating the nozzle and bed to the job's
 * targets, printing for `printSeconds`, finished (cooling) for `finishedSeconds`, idle.
 */
export function printer3dProgram(options: {
  jobs: string[];
  idle: number;
  printSeconds: number;
  finishedSeconds: number;
  nozzle: number;
  bed: number;
}): NodeProgram {
  const next = cycle(options.jobs);
  const ambient = 26;
  let state: "idle" | "heating" | "printing" | "finished" = "idle";
  let job: string | null = null;
  let nozzle = ambient;
  let bed = ambient;
  let t = 0;
  const targets = (): [number, number] =>
    state === "heating" || state === "printing"
      ? [options.nozzle, options.bed]
      : [0, 0];
  const status = (): MachineStatus => {
    const [nt, bt] = targets();
    return {
      type: "printer3d",
      state,
      job,
      progress:
        state === "printing"
          ? round1((t / options.printSeconds) * 100)
          : state === "finished"
            ? 100
            : 0,
      nozzle: [round1(nozzle), nt],
      bed: [round1(bed), bt],
      secondsLeft:
        state === "printing" ? Math.round(options.printSeconds - t) : null,
    };
  };
  return {
    info: {
      label: `Print jobs: ${options.jobs.length} files in turn (OctoPrint-style status)`,
      status: "running",
    },
    initial: { status: status() },
    step(now, dt) {
      t += dt;
      const [nt, bt] = targets();
      // Heaters: fast nozzle, slow bed; cooling toward the room when off.
      nozzle = toward(nozzle, nt || ambient, nt ? 8 : 3, dt);
      bed = toward(bed, bt || ambient, bt ? 1.5 : 0.6, dt);
      if (state === "printing") {
        nozzle += (Math.random() - 0.5) * 0.6;
        bed += (Math.random() - 0.5) * 0.2;
      }
      if (state === "idle" && t >= options.idle) {
        state = "heating";
        job = next();
        t = 0;
      } else if (
        state === "heating" &&
        Math.abs(nozzle - options.nozzle) < 2 &&
        Math.abs(bed - options.bed) < 1
      ) {
        state = "printing";
        t = 0;
      } else if (state === "printing" && t >= options.printSeconds) {
        state = "finished";
        t = 0;
      } else if (state === "finished" && t >= options.finishedSeconds) {
        state = "idle";
        job = null;
        t = 0;
      }
      return { ts: now, status: status() };
    },
  };
}

/**
 * A CNC machine (GRBL style): Idle, a job that runs for `runSeconds` with the spindle on, one
 * feed Hold of `holdSeconds` halfway (the spindle keeps turning, as in GRBL's feed hold), Idle.
 */
export function cncProgram(options: {
  jobs: string[];
  idle: number;
  runSeconds: number;
  holdSeconds: number;
  spindle: number;
}): NodeProgram {
  const next = cycle(options.jobs);
  let state: "Idle" | "Run" | "Hold" = "Idle";
  let job: string | null = null;
  let done = 0;
  let held = false;
  let t = 0;
  const status = (): MachineStatus => ({
    type: "cnc",
    state,
    job,
    progress: job ? round1((done / options.runSeconds) * 100) : 0,
    spindle: state === "Idle" ? 0 : options.spindle,
    secondsLeft: job ? Math.round(options.runSeconds - done) : null,
  });
  return {
    info: {
      label: `G-code jobs: ${options.jobs.length} files in turn (GRBL-style status)`,
      status: "running",
    },
    initial: { status: status() },
    step(now, dt) {
      t += dt;
      if (state === "Idle" && t >= options.idle) {
        state = "Run";
        job = next();
        done = 0;
        held = false;
        t = 0;
      } else if (state === "Run") {
        done = Math.min(options.runSeconds, done + dt);
        if (!held && done >= options.runSeconds / 2) {
          state = "Hold";
          held = true;
          t = 0;
        } else if (done >= options.runSeconds) {
          state = "Idle";
          job = null;
          t = 0;
        }
      } else if (state === "Hold" && t >= options.holdSeconds) {
        state = "Run";
        t = 0;
      }
      return { ts: now, status: status() };
    },
  };
}
