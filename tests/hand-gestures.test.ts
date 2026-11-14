import { describe, expect, it } from "vitest";
import {
  DWELL_MS,
  HOLD_MS,
  classifyPose,
  createGestureTracker,
  createOneEuroFilter,
  isCrossSign,
  type HandFrame,
  type HandPoint,
  type HandPose,
} from "@/lib/hand-gestures";
import fixtures from "./fixtures/hand-landmarks.json";
import signs from "./fixtures/hand-signs.json";

type FixtureName = "fist" | "pointing_up" | "pointing_up_rotated" | "thumb_up" | "thumb_up_rotated" | "victory";
const hand = (name: FixtureName): HandPoint[] => fixtures[name].map(({ x, y }) => ({ x, y }));

/** Straighten a finger along its knuckle-to-middle-joint direction. */
function extendFinger(p: HandPoint[], mcp: number): HandPoint[] {
  const out = p.map((q) => ({ ...q }));
  const [m, pip] = [out[mcp], out[mcp + 1]];
  const along = (k: number) => ({ x: pip.x + (pip.x - m.x) * k, y: pip.y + (pip.y - m.y) * k });
  out[mcp + 2] = along(0.8);
  out[mcp + 3] = along(1.5);
  return out;
}

describe("classifyPose on MediaPipe's own landmark fixtures", () => {
  it.each<[FixtureName, HandPose]>([
    ["fist", "fist"],
    ["pointing_up", "point"],
    ["pointing_up_rotated", "point"],
    ["thumb_up", "thumb_up"],
    ["thumb_up_rotated", "thumb_up"],
    ["victory", "victory"],
  ])("%s → %s", (name, pose) => {
    expect(classifyPose(hand(name))).toBe(pose);
  });

  it("is unaffected by mirroring, scale and distance from the camera", () => {
    for (const name of ["fist", "pointing_up", "victory"] as const) {
      const expected = classifyPose(hand(name));
      expect(classifyPose(hand(name).map(({ x, y }) => ({ x: 1 - x, y })))).toBe(expected);
      expect(classifyPose(hand(name).map(({ x, y }) => ({ x: 0.3 + x * 0.4, y: 0.2 + y * 0.4 })))).toBe(expected);
    }
  });

  it("reads a thumb pointing down as thumb_down", () => {
    expect(classifyPose(hand("thumb_up").map(({ x, y }) => ({ x, y: 1 - y })))).toBe("thumb_down");
  });

  it("reads thumb and index tips touching as a pinch, but not a fist", () => {
    const p = hand("pointing_up");
    p[4] = { x: p[8].x + 0.005, y: p[8].y + 0.005 };
    expect(classifyPose(p)).toBe("pinch");
    expect(classifyPose(hand("fist"))).not.toBe("pinch");
  });

  it("reads four straight fingers as an open palm", () => {
    expect(classifyPose(extendFinger(extendFinger(hand("victory"), 13), 17))).toBe("open_palm");
  });

  it("returns none for missing or degenerate landmarks", () => {
    expect(classifyPose([])).toBe("none");
    expect(classifyPose(Array.from({ length: 21 }, () => ({ x: 0.5, y: 0.5 })))).toBe("none");
  });
});

describe("mode signs on real photos", () => {
  it("reads the OK sign (O) as ok, not as a pinch", () => {
    expect(classifyPose(signs.ok_sign)).toBe("ok");
  });

  it("recognises two crossed index fingers as the X sign", () => {
    expect(isCrossSign(signs.two_hands_x)).toBe(true);
    const mirrored = signs.two_hands_x.map((h) => h.map(({ x, y }) => ({ x: 2 - x, y })));
    expect(isCrossSign(mirrored)).toBe(true);
  });

  it("does not treat two pointing hands that do not cross as X", () => {
    expect(isCrossSign(signs.two_hands_apart)).toBe(false);
  });

  it("needs two hands for X; crossed fingers on one hand stay a victory sign", () => {
    expect(isCrossSign([signs.fingers_crossed_one_hand])).toBe(false);
    expect(isCrossSign([hand("pointing_up"), hand("fist")])).toBe(false);
    expect(classifyPose(signs.fingers_crossed_one_hand)).toBe("victory");
  });
});

const frame = (pose: HandPose, t: number, palm: HandPoint = { x: 0.5, y: 0.5 }, hoverId: string | null = null): HandFrame => ({
  pose,
  palm,
  hoverId,
  t,
});

describe("gesture mode (OK to enter, X to exit)", () => {
  it("starts in standby and ignores every gesture except OK", () => {
    const tracker = createGestureTracker();
    expect(tracker.mode()).toBe("standby");
    const actions = [0, 30, 60, 600, 900].flatMap((t) => [
      ...tracker.update(frame("open_palm", t)),
      ...tracker.update(frame("fist", t + 5, { x: t / 1000, y: 0.5 })),
    ]);
    expect(actions).toEqual([]);
    expect(tracker.mode()).toBe("standby");
  });

  it("enters gesture mode once after holding OK, then accepts gestures", () => {
    const tracker = createGestureTracker();
    expect([0, 30, HOLD_MS / 2].flatMap((t) => tracker.update(frame("ok", t)))).toEqual([]);
    expect(tracker.holdProgress(30 + HOLD_MS / 2)).toBeCloseTo(0.5, 1);
    expect(tracker.update(frame("ok", 40 + HOLD_MS))).toEqual([{ type: "mode", mode: "active" }]);
    expect(tracker.update(frame("ok", 80 + HOLD_MS))).toEqual([]);
    expect(tracker.holdProgress(80 + HOLD_MS)).toBe(0);
    const fired = [1000, 1030, 1600].flatMap((t) => tracker.update(frame("thumb_up", t)));
    expect(fired).toEqual([{ type: "command", command: { type: "expand" } }]);
  });

  it("exits to standby after holding X, and stays there while X is still shown", () => {
    const tracker = createGestureTracker("active");
    [0, 30].forEach((t) => tracker.update(frame("cross", t)));
    expect(tracker.update(frame("cross", 40 + HOLD_MS))).toEqual([{ type: "mode", mode: "standby" }]);
    expect(tracker.update(frame("cross", 80 + HOLD_MS))).toEqual([]);
    expect([1000, 1030, 1600].flatMap((t) => tracker.update(frame("thumb_up", t)))).toEqual([]);
    expect(tracker.mode()).toBe("standby");
  });

  it("keeps the mode when the hand leaves the frame", () => {
    const tracker = createGestureTracker("active");
    tracker.reset();
    expect(tracker.mode()).toBe("active");
  });
});

describe("createGestureTracker in gesture mode", () => {
  it("fires a held pose's command once, after the hold time", () => {
    const tracker = createGestureTracker("active");
    const fired = [0, 30, 60, HOLD_MS - 10, HOLD_MS + 40, HOLD_MS + 200].flatMap((t) => tracker.update(frame("thumb_down", t)));
    expect(fired).toEqual([{ type: "command", command: { type: "go_back" } }]);
  });

  it("pans while an open palm moves, and never fires a command for it", () => {
    const tracker = createGestureTracker("active");
    tracker.update(frame("open_palm", 0));
    tracker.update(frame("open_palm", 30));
    const [right] = tracker.update(frame("open_palm", 60, { x: 0.6, y: 0.5 }));
    const [down] = tracker.update(frame("open_palm", 90, { x: 0.6, y: 0.7 }));
    expect(right).toMatchObject({ type: "pan" });
    expect(right.type === "pan" && right.dx).toBeGreaterThan(0);
    expect(down.type === "pan" && down.dy).toBeGreaterThan(0);
    const held = tracker.update(frame("open_palm", 90 + HOLD_MS * 2, { x: 0.6, y: 0.7 }));
    expect(held.filter((a) => a.type === "command")).toEqual([]);
  });

  it("ignores a single-frame flicker", () => {
    const tracker = createGestureTracker("active");
    tracker.update(frame("fist", 0));
    tracker.update(frame("fist", 30));
    tracker.update(frame("victory", 60));
    expect(tracker.pose()).toBe("fist");
    tracker.update(frame("victory", 90));
    expect(tracker.pose()).toBe("victory");
  });

  it("orbits while a fist moves, in the direction of the hand", () => {
    const tracker = createGestureTracker("active");
    tracker.update(frame("fist", 0));
    tracker.update(frame("fist", 30));
    const [action] = tracker.update(frame("fist", 60, { x: 0.6, y: 0.5 }));
    expect(action.type).toBe("orbit");
    if (action.type === "orbit") {
      expect(action.dx).toBeGreaterThan(0);
      expect(action.dy).toBe(0);
    }
  });

  it("zooms in when a pinch moves up and out when it moves down", () => {
    const tracker = createGestureTracker("active");
    tracker.update(frame("pinch", 0));
    tracker.update(frame("pinch", 30));
    const [up] = tracker.update(frame("pinch", 60, { x: 0.5, y: 0.4 }));
    const [down] = tracker.update(frame("pinch", 90, { x: 0.5, y: 0.7 }));
    expect(up.type === "zoom" && up.factor).toBeLessThan(1);
    expect(down.type === "zoom" && down.factor).toBeGreaterThan(1);
  });

  it("does not move the camera for poses other than fist and pinch", () => {
    const tracker = createGestureTracker("active");
    const actions = [0, 30, 60, 90].flatMap((t) => tracker.update(frame("point", t, { x: t / 100, y: 0.5 })));
    expect(actions).toEqual([]);
  });

  it("selects a node after pointing at it for the dwell time", () => {
    const tracker = createGestureTracker("active");
    tracker.update(frame("point", 0, undefined, "cooling_pump"));
    tracker.update(frame("point", 30, undefined, "cooling_pump"));
    expect(tracker.update(frame("point", 30 + DWELL_MS - 10, undefined, "cooling_pump"))).toEqual([]);
    expect(tracker.dwellProgress(30 + DWELL_MS / 2)).toBeCloseTo(0.5, 1);
    expect(tracker.update(frame("point", 40 + DWELL_MS, undefined, "cooling_pump"))).toEqual([
      { type: "command", command: { type: "focus", nodeId: "cooling_pump" } },
    ]);
    expect(tracker.update(frame("point", 80 + DWELL_MS, undefined, "cooling_pump"))).toEqual([]);
  });

  it("restarts the dwell when the pointer moves to another node", () => {
    const tracker = createGestureTracker("active");
    tracker.update(frame("point", 0, undefined, "radiator"));
    tracker.update(frame("point", 30, undefined, "radiator"));
    tracker.update(frame("point", 30 + DWELL_MS / 2, undefined, "cooling_fan"));
    expect(tracker.update(frame("point", 40 + DWELL_MS, undefined, "cooling_fan"))).toEqual([]);
  });

  it("forgets the pose on reset", () => {
    const tracker = createGestureTracker("active");
    tracker.update(frame("fist", 0));
    tracker.update(frame("fist", 30));
    tracker.reset();
    expect(tracker.pose()).toBe("none");
  });
});

describe("createOneEuroFilter", () => {
  it("passes a still value through unchanged", () => {
    const f = createOneEuroFilter();
    for (let t = 0; t < 1000; t += 50) expect(f.filter(0.4, t)).toBeCloseTo(0.4, 6);
  });

  it("damps jitter around a still point", () => {
    const f = createOneEuroFilter();
    const raw: number[] = [];
    const out: number[] = [];
    for (let i = 0; i < 60; i++) {
      const v = 0.5 + (i % 2 ? 0.01 : -0.01);
      raw.push(v);
      out.push(f.filter(v, i * 50));
    }
    const spread = (a: number[]) => Math.max(...a.slice(20)) - Math.min(...a.slice(20));
    expect(spread(out)).toBeLessThan(spread(raw) / 2);
  });

  it("follows a fast movement closely", () => {
    const f = createOneEuroFilter();
    let last = 0;
    for (let i = 0; i <= 20; i++) last = f.filter(i * 0.04, i * 50);
    expect(last).toBeGreaterThan(0.7);
  });
});
