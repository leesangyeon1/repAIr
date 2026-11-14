import type { Command } from "./command-parser";

/**
 * Hand gesture logic for the webcam controller. Pure functions only: the camera, the MediaPipe
 * worker and the graph live elsewhere, so everything here is unit-testable with landmark fixtures.
 */

/** A hand landmark with x and y in the same units (x already scaled by the frame's aspect ratio). */
export type HandPoint = { x: number; y: number };

export type HandPose =
  | "ok"
  | "cross"
  | "pinch"
  | "point"
  | "fist"
  | "open_palm"
  | "thumb_up"
  | "thumb_down"
  | "victory"
  | "none";

/**
 * standby: the camera is on but only the OK sign (enter) is recognised, so hands moving while
 * talking never trigger anything. active: every gesture works; crossing two index fingers (X) exits.
 */
export type GestureMode = "standby" | "active";

// MediaPipe hand landmark indices.
const WRIST = 0;
const THUMB_MCP = 2;
const THUMB_IP = 3;
const THUMB_TIP = 4;
const INDEX_MCP = 5;
const INDEX_PIP = 6;
const INDEX_TIP = 8;
const MIDDLE_MCP = 9;
const PINKY_MCP = 17;
/** [pip, tip] for the index, middle, ring and pinky fingers. */
const FINGERS = [
  [6, 8],
  [10, 12],
  [14, 16],
  [18, 20],
] as const;

type FingerState = "extended" | "curled" | "between";

const dist = (a: HandPoint, b: HandPoint): number => Math.hypot(a.x - b.x, a.y - b.y);

const fingerState = (p: HandPoint[], pip: number, tip: number): FingerState => {
  const ratio = dist(p[WRIST], p[tip]) / dist(p[WRIST], p[pip]);
  return ratio > 1.1 ? "extended" : ratio < 0.85 ? "curled" : "between";
};

/**
 * Classify one hand. Thresholds are ratios of distances on the hand itself, so they do not depend
 * on how far the hand is from the camera or how it is rotated in the image plane.
 */
export function classifyPose(p: HandPoint[]): HandPose {
  if (p.length < 21) return "none";
  const palm = dist(p[WRIST], p[MIDDLE_MCP]);
  if (palm < 1e-4) return "none";

  const [index, middle, ring, pinky]: FingerState[] = FINGERS.map(([pip, tip]) => fingerState(p, pip, tip));

  // Thumb and index tips touch while the thumb is away from the index knuckle (a fist tucks it there).
  // With the other three fingers straight that is the OK sign (O); otherwise it is a pinch.
  if (dist(p[THUMB_TIP], p[INDEX_TIP]) < 0.3 * palm && dist(p[THUMB_TIP], p[INDEX_MCP]) > 0.3 * palm) {
    return middle === "extended" && ring === "extended" && pinky === "extended" ? "ok" : "pinch";
  }

  if (index === "curled" && middle === "curled" && ring === "curled" && pinky === "curled") {
    const thumbOut = dist(p[THUMB_TIP], p[PINKY_MCP]) > 0.95 * dist(p[THUMB_IP], p[PINKY_MCP]);
    if (!thumbOut) return "fist";
    const dx = p[THUMB_TIP].x - p[THUMB_MCP].x;
    const dy = p[THUMB_TIP].y - p[THUMB_MCP].y; // image y grows downwards
    if (-dy > 0.5 * Math.abs(dx)) return "thumb_up";
    if (dy > 0.5 * Math.abs(dx)) return "thumb_down";
    return "none";
  }
  if (index === "extended" && middle === "curled" && ring === "curled" && pinky === "curled") return "point";
  if (index === "extended" && middle === "extended" && ring === "curled" && pinky === "curled") return "victory";
  if (index === "extended" && middle === "extended" && ring === "extended" && pinky === "extended") return "open_palm";
  return "none";
}

const side = (a: HandPoint, b: HandPoint, c: HandPoint): number => (b.x - a.x) * (c.y - a.y) - (b.y - a.y) * (c.x - a.x);

/**
 * The X sign: two hands with straight index fingers whose index fingers (knuckle to tip) cross.
 * Crossing fingers on one hand is not used: MediaPipe does not reliably report which finger is on top.
 */
export function isCrossSign(hands: HandPoint[][]): boolean {
  if (hands.length < 2 || hands[0].length < 21 || hands[1].length < 21) return false;
  const [a, b] = hands;
  if (fingerState(a, INDEX_PIP, INDEX_TIP) !== "extended" || fingerState(b, INDEX_PIP, INDEX_TIP) !== "extended") return false;
  return (
    side(a[INDEX_MCP], a[INDEX_TIP], b[INDEX_MCP]) * side(a[INDEX_MCP], a[INDEX_TIP], b[INDEX_TIP]) < 0 &&
    side(b[INDEX_MCP], b[INDEX_TIP], a[INDEX_MCP]) * side(b[INDEX_MCP], b[INDEX_TIP], a[INDEX_TIP]) < 0
  );
}

export const POSE_LABEL: Record<HandPose, string> = {
  ok: "OK sign",
  cross: "X · hold to exit gesture mode",
  pinch: "Pinch · move up/down to zoom",
  point: "Point · hold on a node to select",
  fist: "Fist · move to rotate",
  open_palm: "Open palm · move to pan",
  thumb_up: "Thumbs up · expand selected",
  thumb_down: "Thumbs down · go back",
  victory: "Victory · show related",
  none: "Show your hand to the camera",
};

/** Poses that fire one command after being held (active mode only). */
const HOLD_COMMANDS: Partial<Record<HandPose, Command>> = {
  thumb_up: { type: "expand" },
  thumb_down: { type: "go_back" },
  victory: { type: "show_related" },
};

/** Every held gesture (commands, OK to enter, X to exit) uses the same hold time. */
export const HOLD_MS = 500;
export const DWELL_MS = 800;
/** Consecutive frames a new pose must be seen before it takes effect (filters flicker). */
const STABLE_FRAMES = 2;
/** Radians of camera orbit per full frame width of hand movement. */
const ORBIT_GAIN = 5;
/** Zoom exponent per full frame height of hand movement (up = closer). */
const ZOOM_GAIN = 4;
/** View widths/heights panned per full frame of hand movement. */
const PAN_GAIN = 1.5;
const DEAD_ZONE = 0.002;
const SMOOTHING = 0.5;

export type HandFrame = {
  pose: HandPose;
  /** Palm centre in mirrored frame coordinates, 0..1. */
  palm: HandPoint;
  /** Node under the pointing finger, resolved by the caller; null when not pointing at one. */
  hoverId: string | null;
  /** Milliseconds. */
  t: number;
};

export type GestureAction =
  | { type: "command"; command: Command }
  | { type: "orbit"; dx: number; dy: number }
  /** Fractions of the view; positive = drag the graph right/down. */
  | { type: "pan"; dx: number; dy: number }
  | { type: "zoom"; factor: number }
  | { type: "mode"; mode: GestureMode };

export type GestureTracker = {
  update: (frame: HandFrame) => GestureAction[];
  /** Hand lost. The mode is kept. */
  reset: () => void;
  /** Pose currently in effect, after flicker filtering. */
  pose: () => HandPose;
  mode: () => GestureMode;
  /** 0..1 progress of the gesture being held (OK, X or a command), 0 when nothing is pending. */
  holdProgress: (t: number) => number;
  /** 0..1 progress of the pointing dwell on the hovered node. */
  dwellProgress: (t: number) => number;
};

export function createGestureTracker(initialMode: GestureMode = "standby"): GestureTracker {
  let mode = initialMode;
  let active: HandPose = "none";
  let candidate: HandPose = "none";
  let candidateCount = 0;
  let since = 0;
  let fired = false;
  let anchor: HandPoint | null = null;
  let dwellId: string | null = null;
  let dwellSince = 0;
  let dwellFired = false;

  const reset = () => {
    active = "none";
    candidate = "none";
    candidateCount = 0;
    fired = false;
    anchor = null;
    dwellId = null;
    dwellFired = false;
  };

  /** The pose whose hold is being timed right now, if any. */
  const holding = (): boolean =>
    mode === "standby" ? active === "ok" : active === "cross" || HOLD_COMMANDS[active] !== undefined;

  const update = ({ pose, palm, hoverId, t }: HandFrame): GestureAction[] => {
    if (pose === candidate) candidateCount++;
    else {
      candidate = pose;
      candidateCount = 1;
    }
    if (candidate !== active && candidateCount >= STABLE_FRAMES) {
      active = candidate;
      since = t;
      fired = false;
      anchor = null;
    }

    const held = holding() && !fired && t - since >= HOLD_MS;

    if (mode === "standby") {
      if (!held) return [];
      fired = true;
      mode = "active";
      return [{ type: "mode", mode }];
    }

    if (held && active === "cross") {
      fired = true;
      mode = "standby";
      anchor = null;
      dwellId = null;
      return [{ type: "mode", mode }];
    }

    const actions: GestureAction[] = [];

    // Moving hand poses: fist rotates, open palm pans, pinch zooms.
    if (active === "fist" || active === "open_palm" || active === "pinch") {
      const smoothed = anchor
        ? { x: anchor.x + (palm.x - anchor.x) * SMOOTHING, y: anchor.y + (palm.y - anchor.y) * SMOOTHING }
        : palm;
      if (anchor) {
        const dx = smoothed.x - anchor.x;
        const dy = smoothed.y - anchor.y;
        const moved = Math.hypot(dx, dy) > DEAD_ZONE;
        if (active === "fist" && moved) {
          actions.push({ type: "orbit", dx: dx * ORBIT_GAIN, dy: dy * ORBIT_GAIN });
        } else if (active === "open_palm" && moved) {
          actions.push({ type: "pan", dx: dx * PAN_GAIN, dy: dy * PAN_GAIN });
        } else if (active === "pinch" && Math.abs(dy) > DEAD_ZONE) {
          actions.push({ type: "zoom", factor: Math.exp(dy * ZOOM_GAIN) });
        }
      }
      anchor = smoothed;
    }

    const hold = HOLD_COMMANDS[active];
    if (hold && held) {
      fired = true;
      actions.push({ type: "command", command: hold });
    }

    const pointedId = active === "point" ? hoverId : null;
    if (pointedId !== dwellId) {
      dwellId = pointedId;
      dwellSince = t;
      dwellFired = false;
    } else if (dwellId && !dwellFired && t - dwellSince >= DWELL_MS) {
      dwellFired = true;
      actions.push({ type: "command", command: { type: "focus", nodeId: dwellId } });
    }

    return actions;
  };

  return {
    update,
    reset,
    pose: () => active,
    mode: () => mode,
    holdProgress: (t) => (holding() && !fired ? Math.min(1, (t - since) / HOLD_MS) : 0),
    dwellProgress: (t) => (mode === "active" && dwellId && !dwellFired ? Math.min(1, (t - dwellSince) / DWELL_MS) : 0),
  };
}

/**
 * One Euro filter (Casiez et al., CHI 2012): heavy smoothing while the hand is still, little lag
 * while it moves. Used for the pointing cursor so it does not jitter over a node during a dwell.
 */
export function createOneEuroFilter(minCutoff = 1.5, beta = 8, dCutoff = 1) {
  let last: { t: number; x: number; dx: number } | null = null;
  const alpha = (cutoff: number, dt: number) => 1 / (1 + 1 / (2 * Math.PI * cutoff * dt));
  return {
    /** t in milliseconds. */
    filter(x: number, t: number): number {
      if (!last || t <= last.t) {
        last = { t, x, dx: 0 };
        return x;
      }
      const dt = (t - last.t) / 1000;
      const dx = last.dx + alpha(dCutoff, dt) * ((x - last.x) / dt - last.dx);
      const filtered = last.x + alpha(minCutoff + beta * Math.abs(dx), dt) * (x - last.x);
      last = { t, x: filtered, dx };
      return filtered;
    },
    reset() {
      last = null;
    },
  };
}
