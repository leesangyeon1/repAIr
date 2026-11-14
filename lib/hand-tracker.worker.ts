import { FilesetResolver, HandLandmarker } from "@mediapipe/tasks-vision";

/**
 * Runs MediaPipe hand landmark detection off the main thread, so the 3D graph keeps rendering
 * smoothly. Loaded by hooks/useHandGestures.ts as a classic worker (MediaPipe's loader uses
 * importScripts). One frame is processed at a time; the hook waits for each result before
 * sending the next frame.
 */

// Keep the WASM version in step with @mediapipe/tasks-vision in package.json.
const WASM_BASE = "https://cdn.jsdelivr.net/npm/@mediapipe/tasks-vision@1.2.3/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task";

export type TrackerMessage =
  | { type: "ready"; delegate: "GPU" | "CPU" }
  | { type: "error"; message: string }
  | { type: "result"; hands: { x: number; y: number }[][]; ms: number };

/**
 * Tracking a second hand costs extra palm detection on every frame, so the hook asks for two
 * hands only when it needs them (the two-hand X sign in gesture mode).
 */
export type WorkerRequest = { type: "frame"; bitmap: ImageBitmap; t: number } | { type: "hands"; numHands: 1 | 2 };

const scope = self as unknown as {
  postMessage: (message: TrackerMessage) => void;
  onmessage: ((event: MessageEvent<WorkerRequest>) => void) | null;
};

async function create(delegate: "GPU" | "CPU"): Promise<HandLandmarker> {
  const fileset = await FilesetResolver.forVisionTasks(WASM_BASE);
  return HandLandmarker.createFromOptions(fileset, {
    baseOptions: { modelAssetPath: MODEL_URL, delegate },
    // The GPU delegate needs a WebGL2 context; inside a worker that comes from an OffscreenCanvas.
    canvas: delegate === "GPU" ? new OffscreenCanvas(1, 1) : undefined,
    runningMode: "VIDEO",
    numHands: 1,
  });
}

const ready: Promise<HandLandmarker | null> = (async () => {
  try {
    const landmarker = await create("GPU");
    scope.postMessage({ type: "ready", delegate: "GPU" });
    return landmarker;
  } catch {
    // Some browsers have no WebGL2 in workers; the CPU path is slower but still works.
    try {
      const landmarker = await create("CPU");
      scope.postMessage({ type: "ready", delegate: "CPU" });
      return landmarker;
    } catch (err) {
      scope.postMessage({ type: "error", message: err instanceof Error ? err.message : "Hand tracking failed to load." });
      return null;
    }
  }
})();

async function handle(request: WorkerRequest): Promise<void> {
  const landmarker = await ready;
  if (request.type === "hands") {
    await landmarker?.setOptions({ numHands: request.numHands });
    return;
  }
  const { bitmap, t } = request;
  try {
    if (!landmarker) return;
    const started = performance.now();
    const result = landmarker.detectForVideo(bitmap, t);
    scope.postMessage({
      type: "result",
      hands: result.landmarks.map((hand) => hand.map(({ x, y }) => ({ x, y }))),
      ms: performance.now() - started,
    });
  } catch (err) {
    scope.postMessage({ type: "error", message: err instanceof Error ? err.message : "Hand tracking failed." });
  } finally {
    bitmap.close();
  }
}

// Requests run strictly in order, so an option change never overlaps a detection.
let queue = Promise.resolve();
scope.onmessage = (event) => {
  queue = queue.then(() => handle(event.data));
};
