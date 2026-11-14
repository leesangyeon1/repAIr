"use client";

import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { Command } from "@/lib/command-parser";
import {
  classifyPose,
  createGestureTracker,
  createOneEuroFilter,
  isCrossSign,
  type GestureMode,
  type HandPoint,
  type HandPose,
} from "@/lib/hand-gestures";
import type { TrackerMessage, WorkerRequest } from "@/lib/hand-tracker.worker";

type Handlers = {
  onCommand: (command: Command) => void;
  onOrbit: (dx: number, dy: number) => void;
  onPan: (dx: number, dy: number) => void;
  onZoom: (factor: number) => void;
  /** Node near a point of the graph view (0..1 coordinates), or null. */
  pick: (x: number, y: number) => string | null;
  onModeChange: (mode: GestureMode) => void;
};

export type HandGestures = {
  /** False when the browser has no camera API (or the page is not served over HTTPS). */
  supported: boolean;
  /** Camera open and hand tracking running. */
  active: boolean;
  /** Camera or model still loading. */
  starting: boolean;
  error: string | null;
  delegate: "GPU" | "CPU" | null;
  /** standby until the OK sign is held; active until the X sign is held. */
  mode: GestureMode;
  pose: HandPose;
  handVisible: boolean;
  /** Attach to the <video> used as the mirrored self-view. */
  videoRef: RefObject<HTMLVideoElement | null>;
  /** Attach to an element positioned inside the graph view; it follows the pointing finger. */
  cursorRef: RefObject<HTMLDivElement | null>;
  /** Attach to a bar; its width shows how long the current gesture has been held. */
  progressRef: RefObject<HTMLDivElement | null>;
  start: () => void;
  stop: () => void;
};

/** Hands rarely reach the edges of the camera frame, so the middle 70% covers the whole graph view. */
const reach = (v: number): number => Math.min(1, Math.max(0, (v - 0.15) / 0.7));
/** In standby only the OK sign matters, so a few frames a second is enough. */
const STANDBY_FRAME_MS = 120;
/** Time constant for easing camera motion between hand-tracking results. */
const MOTION_EASE_MS = 90;

const hide = (el: HTMLElement | null) => {
  if (el) el.style.display = "none";
};

const palmOf = (hand: HandPoint[]): HandPoint => ({ x: 1 - (hand[0].x + hand[9].x) / 2, y: (hand[0].y + hand[9].y) / 2 });

function cameraError(err: unknown): string {
  const name = err instanceof Error ? err.name : "";
  if (name === "NotAllowedError") return "Camera access was blocked. Allow it in the browser's site settings.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found.";
  if (name === "NotReadableError") return "The camera is being used by another app.";
  return "Could not start the camera.";
}

/**
 * Webcam hand gestures. The camera starts in standby when the page loads (the browser asks for
 * permission once), so an OK sign alone enters gesture mode; stop() turns the camera off.
 * The MediaPipe model (~22 MB) is cached by the browser after the first load.
 * Frames are processed one at a time in a Web Worker, so slow devices drop frames instead of lagging.
 */
export function useHandGestures(handlers: Handlers): HandGestures {
  const [supported, setSupported] = useState(false);
  const [active, setActive] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [delegate, setDelegate] = useState<"GPU" | "CPU" | null>(null);
  const [mode, setMode] = useState<GestureMode>("standby");
  const [pose, setPose] = useState<HandPose>("none");
  const [handVisible, setHandVisible] = useState(false);

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cursorRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);
  const handlersRef = useRef(handlers);
  /** Bumped by every start and stop, so callbacks from an older session do nothing. */
  const sessionRef = useRef(0);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    handlersRef.current = handlers;
  });

  const stop = useCallback(() => {
    sessionRef.current++;
    cleanupRef.current?.();
    cleanupRef.current = null;
    hide(cursorRef.current);
    setActive(false);
    setStarting(false);
    setMode("standby");
    setPose("none");
    setHandVisible(false);
  }, []);

  useEffect(() => {
    setSupported(
      !!navigator.mediaDevices?.getUserMedia &&
        typeof Worker !== "undefined" &&
        typeof createImageBitmap === "function" &&
        "requestVideoFrameCallback" in HTMLVideoElement.prototype,
    );
    return stop;
  }, [stop]);

  const start = useCallback(async () => {
    const video = videoRef.current;
    if (!video || cleanupRef.current) return;
    const session = ++sessionRef.current;
    setError(null);
    setStarting(true);
    setMode("standby");

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: false,
      });
    } catch (err) {
      if (session === sessionRef.current) {
        setStarting(false);
        setError(cameraError(err));
      }
      return;
    }
    if (session !== sessionRef.current) {
      stream.getTracks().forEach((track) => track.stop());
      return;
    }

    const worker = new Worker(new URL("../lib/hand-tracker.worker.ts", import.meta.url));
    const send = (request: WorkerRequest, transfer: Transferable[] = []) => worker.postMessage(request, transfer);

    /* Camera motion is eased over display frames, so the graph moves smoothly between results. */
    type Motion = { orbitX: number; orbitY: number; panX: number; panY: number; zoom: number };
    const motion: Motion = { orbitX: 0, orbitY: 0, panX: 0, panY: 0, zoom: 0 };
    let motionFrame = 0;
    let motionLast = 0;
    const animate = (now: number) => {
      const dt = motionLast ? Math.min(64, now - motionLast) : 16;
      motionLast = now;
      const k = 1 - Math.exp(-dt / MOTION_EASE_MS);
      const step = Object.fromEntries(Object.entries(motion).map(([key, v]) => [key, v * k])) as Motion;
      (Object.keys(motion) as (keyof Motion)[]).forEach((key) => (motion[key] -= step[key]));
      if (Math.abs(step.orbitX) + Math.abs(step.orbitY) > 1e-5) handlersRef.current.onOrbit(step.orbitX, step.orbitY);
      if (Math.abs(step.panX) + Math.abs(step.panY) > 1e-5) handlersRef.current.onPan(step.panX, step.panY);
      if (Math.abs(step.zoom) > 1e-5) handlersRef.current.onZoom(Math.exp(step.zoom));
      const settled = Object.values(motion).every((v) => Math.abs(v) < 1e-4);
      motionFrame = settled ? 0 : requestAnimationFrame(animate);
      if (settled) motionLast = 0;
    };
    const queueMotion = (change: Partial<Motion>) => {
      (Object.keys(change) as (keyof Motion)[]).forEach((key) => (motion[key] += change[key] ?? 0));
      if (!motionFrame) motionFrame = requestAnimationFrame(animate);
    };

    cleanupRef.current = () => {
      cancelAnimationFrame(motionFrame);
      worker.terminate();
      stream.getTracks().forEach((track) => track.stop());
      video.srcObject = null;
    };

    // iOS Safari only plays a camera stream inline when the video is muted and marked playsInline.
    video.muted = true;
    video.playsInline = true;
    video.srcObject = stream;
    try {
      await video.play();
    } catch {
      if (session !== sessionRef.current) return;
      stop();
      setError("Could not start the camera preview.");
      return;
    }

    const tracker = createGestureTracker("standby");
    const pointerX = createOneEuroFilter();
    const pointerY = createOneEuroFilter();
    let lastPalm: HandPoint | null = null;
    let modelReady = false;
    let busy = false;
    let lastSent = 0;

    const setProgress = (value: number) => {
      if (progressRef.current) progressRef.current.style.width = `${Math.round(value * 100)}%`;
    };

    const onHands = (hands: HandPoint[][]) => {
      const t = performance.now();
      if (!hands.length) {
        tracker.reset();
        pointerX.reset();
        pointerY.reset();
        lastPalm = null;
        hide(cursorRef.current);
        setProgress(0);
        setPose("none");
        setHandVisible(false);
        return;
      }
      const aspect = video.videoWidth / video.videoHeight || 1;
      const scaled = hands.map((hand) => hand.map(({ x, y }) => ({ x: x * aspect, y })));
      // With two hands, follow the one closest to the hand used last, so rotation does not jump.
      let primary = 0;
      if (hands.length > 1 && lastPalm) {
        const from = lastPalm;
        const gap = (hand: HandPoint[]) => Math.hypot(palmOf(hand).x - from.x, palmOf(hand).y - from.y);
        primary = gap(hands[1]) < gap(hands[0]) ? 1 : 0;
      }
      const hand = hands[primary];
      const raw: HandPose =
        tracker.mode() === "active" && isCrossSign(scaled) ? "cross" : classifyPose(scaled[primary]);
      // The self-view is mirrored, so x is flipped to match what the user sees.
      const palm = palmOf(hand);
      lastPalm = palm;
      const pointer = { x: reach(pointerX.filter(1 - hand[8].x, t)), y: reach(pointerY.filter(hand[8].y, t)) };
      const pointing = tracker.mode() === "active" && (raw === "point" || tracker.pose() === "point");
      const hoverId = pointing ? handlersRef.current.pick(pointer.x, pointer.y) : null;

      for (const action of tracker.update({ pose: raw, palm, hoverId, t })) {
        if (action.type === "command") handlersRef.current.onCommand(action.command);
        else if (action.type === "orbit") queueMotion({ orbitX: action.dx, orbitY: action.dy });
        else if (action.type === "pan") queueMotion({ panX: action.dx, panY: action.dy });
        else if (action.type === "zoom") queueMotion({ zoom: Math.log(action.factor) });
        else {
          // A second hand is only needed for the X sign, which only matters in gesture mode.
          send({ type: "hands", numHands: action.mode === "active" ? 2 : 1 });
          setMode(action.mode);
          handlersRef.current.onModeChange(action.mode);
        }
      }

      const cursor = cursorRef.current;
      if (cursor && tracker.mode() === "active" && tracker.pose() === "point") {
        cursor.style.display = "block";
        cursor.style.left = `${pointer.x * 100}%`;
        cursor.style.top = `${pointer.y * 100}%`;
        cursor.style.setProperty("--dwell", String(tracker.dwellProgress(t)));
        cursor.dataset.hover = hoverId ? "true" : "false";
      } else hide(cursor);
      setProgress(tracker.holdProgress(t));
      setPose(tracker.pose());
      setHandVisible(true);
    };

    worker.onmessage = (event: MessageEvent<TrackerMessage>) => {
      if (session !== sessionRef.current) return;
      const message = event.data;
      if (message.type === "ready") {
        modelReady = true;
        setDelegate(message.delegate);
        setStarting(false);
        setActive(true);
      } else if (message.type === "error") {
        stop();
        setError(`Hand tracking stopped: ${message.message}`);
      } else {
        busy = false;
        onHands(message.hands);
      }
    };
    worker.onerror = () => {
      if (session !== sessionRef.current) return;
      stop();
      setError("Hand tracking could not load. Check the network connection and try again.");
    };

    const pump = (now: number) => {
      if (session !== sessionRef.current) return;
      const interval = tracker.mode() === "standby" ? STANDBY_FRAME_MS : 0;
      if (modelReady && !busy && video.videoWidth > 0 && now - lastSent >= interval) {
        busy = true;
        lastSent = now;
        createImageBitmap(video)
          .then((bitmap) => {
            if (session !== sessionRef.current) bitmap.close();
            else send({ type: "frame", bitmap, t: performance.now() }, [bitmap]);
          })
          .catch(() => {
            busy = false;
          });
      }
      video.requestVideoFrameCallback(pump);
    };
    video.requestVideoFrameCallback(pump);
  }, [stop]);

  // Standby from page load, so an OK sign alone (no button) enters gesture mode.
  useEffect(() => {
    if (supported) void start();
  }, [supported, start]);

  return {
    supported,
    active,
    starting,
    error,
    delegate,
    mode,
    pose,
    handVisible,
    videoRef,
    cursorRef,
    progressRef,
    start: () => void start(),
    stop,
  };
}
