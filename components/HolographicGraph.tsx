"use client";

import ForceGraph3D, { type ConfigOptions, type ForceGraph3DInstance } from "3d-force-graph";
import { useEffect, useImperativeHandle, useRef, useState, type RefObject } from "react";
import * as THREE from "three";
import type { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { NODE_STYLE, RELATION_LABEL } from "@/lib/graph-data";
import type { KnowledgeLink, KnowledgeNode, NodeType, Relation } from "@/lib/types";

/**
 * Client-only WebGL scene. This module is loaded through next/dynamic with ssr: false, so
 * nothing here runs during server rendering.
 */

export type GraphHandle = {
  focusNode: (id: string) => void;
  /** durationMs 0 moves the camera immediately (continuous hand-gesture zoom). */
  zoom: (factor: number, durationMs?: number) => void;
  resetView: () => void;
  /** Rotate the camera around its target, in radians (positive dx/dy = drag right/down). */
  orbit: (dx: number, dy: number) => void;
  /** Slide the view, in fractions of its size (positive dx/dy = drag the graph right/down). */
  pan: (dx: number, dy: number) => void;
  /** Visible node closest to a point of the view (0..1 coordinates), within a small radius. */
  pickAt: (x: number, y: number) => string | null;
};

type Props = {
  /** Camera API. Passed as a prop because next/dynamic wrappers do not forward refs. */
  handleRef: RefObject<GraphHandle | null>;
  nodes: KnowledgeNode[];
  links: KnowledgeLink[];
  selectedId: string | null;
  highlightIds: string[];
  /** null = everything visible. */
  visibleIds: string[] | null;
  autoRotate: boolean;
  lowPower: boolean;
  onSelect: (id: string | null) => void;
  onExpand: (id: string) => void;
};

type GNode = {
  id: string;
  name: string;
  type: NodeType;
  dynamic: boolean;
  x?: number;
  y?: number;
  z?: number;
};
type GLink = { source: string | GNode; target: string | GNode; relation: Relation };

type NodeVisual = {
  group: THREE.Group;
  core: THREE.MeshBasicMaterial;
  halo: THREE.MeshBasicMaterial;
  shell?: THREE.MeshBasicMaterial;
  label: THREE.Sprite;
  labelMaterial: THREE.SpriteMaterial;
  bornAt: number;
  alwaysLabel: boolean;
};

type ViewState = {
  selectedId: string | null;
  active: Set<string>;
  dimming: boolean;
  visible: Set<string> | null;
};

// The package's default export is typed for generic nodes; narrow it to this graph's node/link shapes.
const GraphCtor = ForceGraph3D as unknown as new (
  element: HTMLElement,
  config?: ConfigOptions,
) => ForceGraph3DInstance<GNode, GLink>;

const endId = (end: string | GNode): string => (typeof end === "string" ? end : end.id);

const escapeHtml = (text: string): string =>
  text.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

function webglAvailable(): boolean {
  try {
    const canvas = document.createElement("canvas");
    return !!(canvas.getContext("webgl2") || canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function makeLabel(text: string, color: string, height: number): { sprite: THREE.Sprite; material: THREE.SpriteMaterial } {
  const fontSize = 44;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  const shown = text.length > 34 ? `${text.slice(0, 33)}…` : text;
  const font = `600 ${fontSize}px ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
  let width = 256;
  if (ctx) {
    ctx.font = font;
    width = Math.ceil(ctx.measureText(shown).width) + 24;
  }
  canvas.width = width;
  canvas.height = fontSize + 20;
  if (ctx) {
    ctx.font = font;
    ctx.textBaseline = "middle";
    ctx.textAlign = "center";
    ctx.shadowColor = "rgba(2,4,12,0.95)";
    ctx.shadowBlur = 8;
    ctx.fillStyle = color;
    ctx.fillText(shown, width / 2, canvas.height / 2);
  }
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.SpriteMaterial({ map: texture, transparent: true, depthWrite: false, opacity: 0.85 });
  const sprite = new THREE.Sprite(material);
  sprite.scale.set((width / canvas.height) * height, height, 1);
  return { sprite, material };
}

export default function HolographicGraph({
  handleRef,
  nodes,
  links,
  selectedId,
  highlightIds,
  visibleIds,
  autoRotate,
  lowPower,
  onSelect,
  onExpand,
}: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const graphRef = useRef<ForceGraph3DInstance<GNode, GLink> | null>(null);
  const nodeMap = useRef(new Map<string, GNode>());
  const visuals = useRef(new Map<string, NodeVisual>());
  const view = useRef<ViewState>({ selectedId: null, active: new Set(), dimming: false, visible: null });
  const settled = useRef(false);
  const callbacks = useRef({ onSelect, onExpand });
  const [failed, setFailed] = useState<string | null>(null);

  useEffect(() => {
    callbacks.current = { onSelect, onExpand };
  }, [onSelect, onExpand]);

  /* ---------- Scene setup and teardown ---------- */
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    if (!webglAvailable()) {
      setFailed("WebGL is not available in this browser.");
      return;
    }

    let graph: ForceGraph3DInstance<GNode, GLink>;
    try {
      graph = new GraphCtor(el, {
        controlType: "orbit",
        rendererConfig: { antialias: !lowPower, alpha: false, powerPreference: "high-performance" },
      });
    } catch {
      setFailed("The 3D renderer could not start on this device.");
      return;
    }
    graphRef.current = graph;
    settled.current = false;
    const nodeStore = nodeMap.current;
    const visualStore = visuals.current;
    const disposables: { dispose: () => void }[] = [];
    const sphere = new THREE.SphereGeometry(1, lowPower ? 14 : 28, lowPower ? 12 : 24);
    const shellGeometry = new THREE.IcosahedronGeometry(1, 1);
    disposables.push(sphere, shellGeometry);

    const buildNode = (node: GNode): THREE.Object3D => {
      const style = NODE_STYLE[node.type];
      const radius = style.radius;
      const group = new THREE.Group();

      const core = new THREE.MeshBasicMaterial({ color: style.color, transparent: true, opacity: 0.9 });
      const coreMesh = new THREE.Mesh(sphere, core);
      coreMesh.scale.setScalar(radius);
      group.add(coreMesh);

      const halo = new THREE.MeshBasicMaterial({
        color: style.color,
        transparent: true,
        opacity: 0.13,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      });
      const haloMesh = new THREE.Mesh(sphere, halo);
      haloMesh.scale.setScalar(radius * 1.9);
      haloMesh.name = "halo";
      group.add(haloMesh);

      let shell: THREE.MeshBasicMaterial | undefined;
      if (node.type === "machine" || node.type === "system" || node.dynamic) {
        shell = new THREE.MeshBasicMaterial({
          color: node.dynamic ? "#f472b6" : style.color,
          wireframe: true,
          transparent: true,
          opacity: 0.28,
          depthWrite: false,
        });
        const shellMesh = new THREE.Mesh(shellGeometry, shell);
        shellMesh.scale.setScalar(radius * 1.45);
        shellMesh.name = "shell";
        group.add(shellMesh);
      }

      const labelHeight = node.type === "machine" ? 11 : node.type === "system" ? 9 : 7;
      const { sprite, material } = makeLabel(node.name, node.type === "component" ? "#e6fbff" : style.color, labelHeight);
      sprite.position.set(0, -(radius * 1.5 + labelHeight * 0.75 + 1.5), 0);
      group.add(sprite);

      const alwaysLabel = node.type === "machine" || node.type === "system" || node.type === "component";
      group.scale.setScalar(0.001);
      visualStore.set(node.id, {
        group,
        core,
        halo,
        shell,
        label: sprite,
        labelMaterial: material,
        bornAt: performance.now(),
        alwaysLabel,
      });
      return group;
    };

    const linkActive = (l: GLink): boolean => {
      const v = view.current;
      const s = endId(l.source);
      const t = endId(l.target);
      if (v.selectedId && (s === v.selectedId || t === v.selectedId)) return true;
      return v.dimming && v.active.has(s) && v.active.has(t);
    };

    let lastClick = { id: "", at: 0 };

    graph
      .backgroundColor("#02040c")
      .showNavInfo(false)
      .enableNodeDrag(false)
      .nodeRelSize(4)
      .nodeVal((n) => NODE_STYLE[n.type].radius)
      .nodeLabel((n) => {
        const style = NODE_STYLE[n.type];
        return `<div class="holo-tip"><span style="color:${style.color}">${style.label}${n.dynamic ? " · live source" : ""}</span><strong>${escapeHtml(n.name)}</strong></div>`;
      })
      .nodeThreeObject(buildNode)
      .nodeVisibility((n) => !view.current.visible || view.current.visible.has(n.id))
      .linkVisibility((l) => {
        const visible = view.current.visible;
        return !visible || (visible.has(endId(l.source)) && visible.has(endId(l.target)));
      })
      .linkLabel((l) => `<div class="holo-tip"><span>${RELATION_LABEL[l.relation]}</span></div>`)
      .linkOpacity(1)
      .linkColor((l) => {
        const pink = l.relation === "MAY_CAUSE" || l.relation === "DOCUMENTED_IN";
        const rgb = pink ? "244,114,182" : "34,211,238";
        if (linkActive(l)) return `rgba(${rgb},0.95)`;
        return `rgba(${rgb},${view.current.dimming ? 0.05 : 0.26})`;
      })
      .linkWidth((l) => (linkActive(l) ? 0.45 : 0))
      .linkDirectionalParticles((l) => (linkActive(l) ? (lowPower ? 2 : 4) : 0))
      .linkDirectionalParticleWidth(1.5)
      .linkDirectionalParticleSpeed(0.007)
      .linkDirectionalParticleColor((l) =>
        l.relation === "MAY_CAUSE" || l.relation === "DOCUMENTED_IN" ? "#f9a8d4" : "#a5f3fc",
      )
      .onNodeClick((node) => {
        const now = performance.now();
        const isDouble = lastClick.id === node.id && now - lastClick.at < 380;
        lastClick = { id: node.id, at: now };
        if (isDouble) callbacks.current.onExpand(node.id);
        else callbacks.current.onSelect(node.id);
      })
      .onBackgroundClick(() => callbacks.current.onSelect(null))
      .warmupTicks(lowPower ? 30 : 60)
      .cooldownTicks(160)
      .onEngineStop(() => {
        // Fit only once, after the layout has settled, so positions are finite and stable.
        if (settled.current) return;
        settled.current = true;
        if (!view.current.selectedId) graph.zoomToFit(900, 70);
      })
      .cameraPosition({ x: 0, y: 30, z: 540 });

    const charge = graph.d3Force("charge") as { strength?: (v: number) => unknown } | undefined;
    charge?.strength?.(-190);
    const linkForce = graph.d3Force("link") as { distance?: (fn: (l: GLink) => number) => unknown } | undefined;
    linkForce?.distance?.((l) =>
      l.relation === "HAS_SYSTEM" ? 95 : l.relation === "HAS_COMPONENT" ? 62 : l.relation === "CONNECTED_TO" ? 70 : 46,
    );

    // Starfield.
    const starCount = lowPower ? 350 : 1400;
    const positions = new Float32Array(starCount * 3);
    for (let i = 0; i < starCount; i++) {
      const r = 900 + Math.random() * 1400;
      const theta = Math.random() * Math.PI * 2;
      const phi = Math.acos(2 * Math.random() - 1);
      positions[i * 3] = r * Math.sin(phi) * Math.cos(theta);
      positions[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
      positions[i * 3 + 2] = r * Math.cos(phi);
    }
    const starGeometry = new THREE.BufferGeometry();
    starGeometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({
      color: "#8fb8ff",
      size: 2.2,
      sizeAttenuation: true,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
    });
    const stars = new THREE.Points(starGeometry, starMaterial);
    graph.scene().add(stars);
    disposables.push(starGeometry, starMaterial);

    // Bloom is an enhancement only: if it cannot be created the scene still renders.
    let bloom: UnrealBloomPass | null = null;
    if (!lowPower) {
      try {
        bloom = new UnrealBloomPass(new THREE.Vector2(el.clientWidth || 800, el.clientHeight || 600), 0.55, 0.5, 0.3);
        graph.postProcessingComposer().addPass(bloom);
      } catch {
        bloom = null;
      }
    }

    const resize = () => {
      const w = el.clientWidth;
      const h = el.clientHeight;
      if (w > 0 && h > 0) graph.width(w).height(h);
    };
    resize();
    const observer = new ResizeObserver(resize);
    observer.observe(el);

    const lostHandler = (e: Event) => {
      e.preventDefault();
      setFailed("The graphics context was lost. Reload to restore the 3D view.");
    };
    const canvas = graph.renderer().domElement;
    canvas.addEventListener("webglcontextlost", lostHandler);

    // Lightweight animation loop: emergence, selection pulse, slow star drift.
    let frame = 0;
    const tick = (time: number) => {
      const v = view.current;
      visualStore.forEach((visual, id) => {
        const age = (time - visual.bornAt) / 650;
        const grow = age >= 1 ? 1 : 1 - Math.pow(1 - Math.max(age, 0), 3);
        const pulse = id === v.selectedId ? 1 + Math.sin(time / 260) * 0.07 : 1;
        visual.group.scale.setScalar(Math.max(grow, 0.001) * pulse);
        const shell = visual.group.getObjectByName("shell");
        if (shell) shell.rotation.y = time / 4200;
      });
      stars.rotation.y = time / 240000;
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      canvas.removeEventListener("webglcontextlost", lostHandler);
      try {
        graph.pauseAnimation();
        if (bloom) {
          graph.postProcessingComposer().removePass(bloom);
          bloom.dispose();
        }
        graph.scene().remove(stars);
        visualStore.forEach((visual) => {
          visual.core.dispose();
          visual.halo.dispose();
          visual.shell?.dispose();
          visual.labelMaterial.map?.dispose();
          visual.labelMaterial.dispose();
        });
        disposables.forEach((d) => d.dispose());
        graph._destructor();
        graph.renderer().dispose();
      } catch {
        /* teardown is best-effort */
      }
      visualStore.clear();
      nodeStore.clear();
      graphRef.current = null;
      el.replaceChildren();
    };
  }, [lowPower]);

  /* ---------- Data sync: keep existing node objects so the layout is preserved ---------- */
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const store = nodeMap.current;
    const ids = new Set(nodes.map((n) => n.id));

    for (const id of [...store.keys()]) {
      if (ids.has(id)) continue;
      store.delete(id);
      const visual = visuals.current.get(id);
      if (visual) {
        visual.core.dispose();
        visual.halo.dispose();
        visual.shell?.dispose();
        visual.labelMaterial.map?.dispose();
        visual.labelMaterial.dispose();
        visuals.current.delete(id);
      }
    }

    for (const n of nodes) {
      if (store.has(n.id)) continue;
      const gnode: GNode = { id: n.id, name: n.name, type: n.type, dynamic: n.metadata?.dynamic === true };
      // New nodes emerge next to the node they attach to.
      const anchorLink = links.find(
        (l) => (l.source === n.id && store.has(l.target)) || (l.target === n.id && store.has(l.source)),
      );
      const anchor = anchorLink ? store.get(anchorLink.source === n.id ? anchorLink.target : anchorLink.source) : undefined;
      if (anchor && Number.isFinite(anchor.x) && Number.isFinite(anchor.y) && Number.isFinite(anchor.z)) {
        gnode.x = (anchor.x as number) + (Math.random() - 0.5) * 24;
        gnode.y = (anchor.y as number) + (Math.random() - 0.5) * 24;
        gnode.z = (anchor.z as number) + (Math.random() - 0.5) * 24;
      }
      store.set(n.id, gnode);
    }

    graph.graphData({
      nodes: nodes.map((n) => store.get(n.id) as GNode),
      links: links.map((l) => ({ source: l.source, target: l.target, relation: l.relation })),
    });
  }, [nodes, links, lowPower]);

  /* ---------- Selection, highlight, dimming, filtering ---------- */
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const active = new Set<string>(highlightIds);
    if (selectedId) {
      active.add(selectedId);
      for (const l of links) {
        if (l.source === selectedId) active.add(l.target);
        else if (l.target === selectedId) active.add(l.source);
      }
    }
    const dimming = active.size > 0;
    view.current = { selectedId, active, dimming, visible: visibleIds ? new Set(visibleIds) : null };

    // Visuals are created lazily by the renderer, so apply once now and once after the next frame.
    const apply = () => {
      visuals.current.forEach((visual, id) => {
        const isActive = active.has(id);
        const dim = dimming && !isActive;
        const isSelected = id === selectedId;
        visual.core.opacity = dim ? 0.14 : 0.9;
        visual.halo.opacity = dim ? 0.02 : isSelected ? 0.34 : isActive && dimming ? 0.22 : 0.13;
        if (visual.shell) visual.shell.opacity = dim ? 0.04 : 0.3;
        visual.label.visible = dim ? false : visual.alwaysLabel || (dimming && isActive);
        visual.labelMaterial.opacity = isSelected ? 1 : 0.85;
      });
    };
    apply();
    const raf = requestAnimationFrame(apply);
    const timer = window.setTimeout(apply, 250);

    graph
      .nodeVisibility(graph.nodeVisibility())
      .linkVisibility(graph.linkVisibility())
      .linkColor(graph.linkColor())
      .linkWidth(graph.linkWidth())
      .linkDirectionalParticles(graph.linkDirectionalParticles());

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(timer);
    };
  }, [selectedId, highlightIds, visibleIds, nodes, links, lowPower]);

  /* ---------- Auto-rotation ---------- */
  useEffect(() => {
    const graph = graphRef.current;
    if (!graph) return;
    const controls = graph.controls() as OrbitControls;
    controls.autoRotate = autoRotate;
    controls.autoRotateSpeed = 0.9;
  }, [autoRotate, lowPower]);

  /* ---------- Imperative camera API ---------- */
  useImperativeHandle(
    handleRef,
    () => ({
      focusNode(id: string) {
        let attempts = 0;
        const go = () => {
          const graph = graphRef.current;
          if (!graph) return;
          const node = nodeMap.current.get(id);
          const ready = node && [node.x, node.y, node.z].every((v) => typeof v === "number" && Number.isFinite(v));
          if (!node || !ready) {
            if (attempts++ < 12) window.setTimeout(go, 150);
            return;
          }
          const target = new THREE.Vector3(node.x, node.y, node.z);
          // Approach along the current viewing direction. This stays finite for a node at the
          // origin, unlike scaling the node's own position vector.
          const direction = graph.camera().position.clone().sub(target);
          if (direction.lengthSq() < 1e-6) direction.set(0, 0, 1);
          direction.normalize();
          const distance = 190 + NODE_STYLE[node.type].radius * 9;
          const position = target.clone().add(direction.multiplyScalar(distance));
          graph.cameraPosition(
            { x: position.x, y: position.y, z: position.z },
            { x: target.x, y: target.y, z: target.z },
            1100,
          );
        };
        go();
      },
      zoom(factor: number, durationMs = 450) {
        const graph = graphRef.current;
        if (!graph) return;
        const controls = graph.controls() as OrbitControls;
        const target = controls.target.clone();
        const offset = graph.camera().position.clone().sub(target);
        let length = offset.length();
        if (!Number.isFinite(length) || length < 1e-3) {
          offset.set(0, 0, 1);
          length = 300;
        }
        const next = Math.min(2600, Math.max(45, length * factor));
        const position = target.clone().add(offset.normalize().multiplyScalar(next));
        graph.cameraPosition(
          { x: position.x, y: position.y, z: position.z },
          { x: target.x, y: target.y, z: target.z },
          durationMs,
        );
      },
      resetView() {
        const graph = graphRef.current;
        if (!graph) return;
        graph.zoomToFit(900, 70, (n) => !view.current.visible || view.current.visible.has(n.id));
      },
      orbit(dx: number, dy: number) {
        const graph = graphRef.current;
        if (!graph) return;
        const target = (graph.controls() as OrbitControls).target.clone();
        const offset = graph.camera().position.clone().sub(target);
        if (!Number.isFinite(offset.lengthSq()) || offset.lengthSq() < 1e-6) return;
        // Same sense as dragging with the mouse in OrbitControls.
        const spherical = new THREE.Spherical().setFromVector3(offset);
        spherical.theta -= dx;
        spherical.phi = Math.min(Math.PI - 0.1, Math.max(0.1, spherical.phi - dy));
        const position = target.clone().add(offset.setFromSpherical(spherical));
        graph.cameraPosition({ x: position.x, y: position.y, z: position.z }, { x: target.x, y: target.y, z: target.z });
      },
      pan(dx: number, dy: number) {
        const graph = graphRef.current;
        const el = containerRef.current;
        if (!graph || !el) return;
        const camera = graph.camera() as THREE.PerspectiveCamera;
        const target = (graph.controls() as OrbitControls).target.clone();
        // Size of the visible plane through the target, so the graph tracks the hand 1:1 at any zoom.
        const viewHeight = 2 * camera.position.distanceTo(target) * Math.tan((camera.fov * Math.PI) / 360);
        const viewWidth = viewHeight * (el.clientWidth / Math.max(1, el.clientHeight));
        const right = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(camera.matrix, 1);
        const shift = right.multiplyScalar(-dx * viewWidth).add(up.multiplyScalar(dy * viewHeight));
        if (!Number.isFinite(shift.lengthSq())) return;
        const position = camera.position.clone().add(shift);
        target.add(shift);
        graph.cameraPosition({ x: position.x, y: position.y, z: position.z }, { x: target.x, y: target.y, z: target.z });
      },
      pickAt(x: number, y: number) {
        const graph = graphRef.current;
        const el = containerRef.current;
        if (!graph || !el) return null;
        const px = x * el.clientWidth;
        const py = y * el.clientHeight;
        let best: string | null = null;
        let bestDistance = 56;
        nodeMap.current.forEach((node) => {
          if (view.current.visible && !view.current.visible.has(node.id)) return;
          const { x: nx, y: ny, z: nz } = node;
          if (typeof nx !== "number" || typeof ny !== "number" || typeof nz !== "number") return;
          const screen = graph.graph2ScreenCoords(nx, ny, nz);
          const distance = Math.hypot(screen.x - px, screen.y - py);
          if (distance < bestDistance) {
            bestDistance = distance;
            best = node.id;
          }
        });
        return best;
      },
    }),
    [],
  );

  if (failed) {
    return (
      <div className="flex h-full w-full items-center justify-center p-8 text-center">
        <div className="glass max-w-md rounded-2xl p-6">
          <p className="text-sm font-semibold text-cyan-200">3D view unavailable</p>
          <p className="mt-2 text-sm text-slate-300">{failed}</p>
          <p className="mt-2 text-xs text-slate-400">
            Search, voice commands and the knowledge panel still work. Use the command bar to look up a component.
          </p>
        </div>
      </div>
    );
  }

  return <div ref={containerRef} className="h-full w-full" aria-label="3D knowledge graph" role="img" />;
}
