import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, selMindMap, selActiveProject } from "@/stores/useAppStore";
import { uid } from "@/utils/id";
import type { MapNode, MapEdge } from "@/types";

/* ─────────────────────────────────────────────────────────────────
   ReactFlow is imported dynamically so the app still works without
   it installed. If not installed, a placeholder is shown with the
   npm install command.
───────────────────────────────────────────────────────────────── */

let ReactFlow: any = null;
let Controls: any  = null;
let Background: any = null;
let useNodesState: any = null;
let useEdgesState: any = null;
let addEdge: any    = null;
let rfCss           = "";

try {
  const rf = (globalThis as any).require?.("reactflow") ?? null;
  ReactFlow      = rf.default ?? rf.ReactFlow;
  Controls       = rf.Controls;
  Background     = rf.Background;
  useNodesState  = rf.useNodesState;
  useEdgesState  = rf.useEdgesState;
  addEdge        = rf.addEdge;
  rfCss          = "reactflow/dist/style.css";
  if (rfCss) {
    // Dynamic CSS injection — only once
    if (!document.querySelector("#rf-style")) {
      const link = document.createElement("link");
      link.id   = "rf-style";
      link.rel  = "stylesheet";
      link.href = "https://cdn.jsdelivr.net/npm/reactflow@11.11.3/dist/style.css";
      document.head.appendChild(link);
    }
  }
} catch {
  // ReactFlow not installed yet — show placeholder
}

const _NODE_COLOURS: Record<string, string> = {
  root:     "#00ffff",
  idea:     "#0088ff",
  task:     "#00ff88",
  note:     "#ff8844",
  decision: "#ff00ff",
  risk:     "#ff3344",
};

export default function TabMindMap() {
  const { t } = useTranslation();
  const project   = useAppStore(selActiveProject);
  const mindMap   = useAppStore(selMindMap);
  const updateMap = useAppStore((s) => s.updateMindMap);

  // ── Placeholder if ReactFlow not installed ──
  if (!ReactFlow) {
    return (
      <div style={{
        flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
        flexDirection: "column", gap: 20, color: "var(--text-dim)", height: "100%",
      }}>
        <div style={{ fontFamily: "var(--font-display)", fontSize: 20, color: "var(--cyan)", letterSpacing: 4 }}>
          MIND MAP
        </div>
        <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)", textAlign: "center", lineHeight: 2 }}>
          <p>Install <code style={{ color: "var(--cyan)", background: "rgba(0,255,255,.08)", padding: "2px 8px" }}>reactflow</code> to enable the interactive mind map.</p>
          <p style={{ marginTop: 12 }}>
            <code style={{ color: "var(--green)", background: "rgba(0,255,136,.06)", padding: "4px 12px", display: "inline-block" }}>
              npm install reactflow
            </code>
          </p>
        </div>
        {/* Static preview of current data */}
        {mindMap && mindMap.nodes.length > 0 && (
          <div style={{ marginTop: 24, maxWidth: 400 }}>
            <div style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xxs)", color: "var(--text-dim)", letterSpacing: "2px", marginBottom: 10 }}>
              CURRENT NODES ({mindMap.nodes.length})
            </div>
            {mindMap.nodes.map((n) => (
              <div key={n.id} style={{
                display: "flex", alignItems: "center", gap: 10, padding: "6px 0",
                borderBottom: "1px solid var(--border-dim)",
              }}>
                <span style={{ width: 8, height: 8, borderRadius: "50%", background: n.colour, flexShrink: 0, display: "inline-block" }} />
                <span style={{ fontSize: "var(--fs-sm)", flex: 1 }}>{n.text}</span>
                <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xxs)", color: "var(--text-dim)" }}>{n.type}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // ── Full ReactFlow implementation ──
  return <MindMapCanvas project={project} mindMap={mindMap} updateMap={updateMap} />;
}

function MindMapCanvas({ project, mindMap, updateMap }: {
  project:   ReturnType<typeof selActiveProject>;
  mindMap:   ReturnType<typeof selMindMap>;
  updateMap: (projectId: string, patch: any) => void;
}) {
  const { t } = useTranslation();
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeText, setAddNodeText] = useState("");

  // Convert internal nodes → ReactFlow nodes
  const initialRFNodes = useMemo(() => (mindMap?.nodes ?? []).map((n) => ({
    id:       n.id,
    position: { x: n.x, y: n.y },
    data:     { label: n.text, type: n.type, colour: n.colour },
    style: {
      background:    n.colour + "18",
      border:        `1px solid ${n.colour}`,
      color:         n.colour,
      fontFamily:    "var(--font-mono)",
      fontSize:      12,
      borderRadius:  0,
      padding:       "8px 14px",
      boxShadow:     `0 0 12px ${n.colour}22`,
    },
  })), [mindMap]);

  const initialRFEdges = useMemo(() => (mindMap?.edges ?? []).map((e) => ({
    id:            e.id,
    source:        e.fromId,
    target:        e.toId,
    label:         e.label ?? undefined,
    style:         { stroke: "rgba(0,255,255,.35)", strokeWidth: 1.5 },
    labelStyle:    { fill: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10 },
    animated:      false,
  })), [mindMap]);

  const [rfNodes, setRFNodes, onNodesChange] = useNodesState(initialRFNodes);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState(initialRFEdges);

  // Persist node position changes back to store
  const onNodeDragStop = useCallback((_: any, node: any) => {
    if (!project || !mindMap) return;
    updateMap(project.id, {
      nodes: mindMap.nodes.map((n) =>
        n.id === node.id ? { ...n, x: node.position.x, y: node.position.y } : n
      ),
    });
  }, [project, mindMap, updateMap]);

  const onConnect = useCallback((params: any) => {
    if (!project || !mindMap) return;
    const newEdge: MapEdge = {
      id:     uid(),
      fromId: params.source,
      toId:   params.target,
      label:  null,
    };
    setRFEdges((eds: any[]) => addEdge(params, eds));
    updateMap(project.id, { edges: [...mindMap.edges, newEdge] });
  }, [project, mindMap, updateMap, setRFEdges]);

  const addNode = (text: string) => {
    if (!project || !mindMap || !text.trim()) return;
    const newNode: MapNode = {
      id:       uid(),
      text,
      x:        200 + Math.random() * 400,
      y:        200 + Math.random() * 200,
      type:     "idea",
      colour:   "#0088ff",
      parentId: null,
    };
    updateMap(project.id, { nodes: [...mindMap.nodes, newNode] });
    setRFNodes((ns: any[]) => [...ns, {
      id:       newNode.id,
      position: { x: newNode.x, y: newNode.y },
      data:     { label: newNode.text },
      style:    { background: "#0088ff18", border: "1px solid #0088ff", color: "#0088ff", fontFamily: "var(--font-mono)", fontSize: 12, borderRadius: 0, padding: "8px 14px" },
    }]);
  };

  if (!project) return null;

  return (
    <div style={{ position: "relative", flex: 1, height: "100%" }}>
      {/* Toolbar */}
      <div style={{
        position: "absolute", top: 12, left: 12, zIndex: 5,
        display: "flex", gap: 8,
      }}>
        {addNodeOpen ? (
          <div style={{display:"flex",gap:"4px",alignItems:"center"}}>
            <input className="input" style={{width:"140px",fontSize:"var(--fs-xs)"}}
              placeholder={t("mindmap.addNode")} value={addNodeText} autoFocus
              onChange={e => setAddNodeText(e.target.value)}
              onKeyDown={e => {
                if (e.key==="Enter") { addNode(addNodeText); setAddNodeText(""); setAddNodeOpen(false); }
                if (e.key==="Escape") { setAddNodeText(""); setAddNodeOpen(false); }
              }} />
            <button className="btn btn-primary"
              onClick={() => { addNode(addNodeText); setAddNodeText(""); setAddNodeOpen(false); }}>✓</button>
            <button className="btn" onClick={() => { setAddNodeText(""); setAddNodeOpen(false); }}>✕</button>
          </div>
        ) : (
          <button className="btn" onClick={() => setAddNodeOpen(true)}>
            + {t("mindmap.addNode")}
          </button>
        )}
        <button className="btn" onClick={() => {
          if (!project || !mindMap) return;
          const svg = document.querySelector(".react-flow__renderer") as SVGElement;
          if (!svg) return;
          const data = new XMLSerializer().serializeToString(svg);
          const blob = new Blob([data], { type: "image/svg+xml" });
          const url  = URL.createObjectURL(blob);
          const a    = document.createElement("a");
          a.href     = url;
          a.download = `${project.name}-mindmap.svg`;
          a.click();
          URL.revokeObjectURL(url);
        }}>
          ↓ {t("mindmap.export")}
        </button>
      </div>

      <ReactFlow
        nodes={rfNodes}
        edges={rfEdges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        onConnect={onConnect}
        onNodeDragStop={onNodeDragStop}
        fitView
        style={{ background: "var(--bg-root)" }}
        defaultViewport={mindMap?.viewport ?? { x: 0, y: 0, zoom: 1 }}
        onMoveEnd={(_: any, vp: any) => {
          if (project && mindMap) updateMap(project.id, { viewport: vp });
        }}
      >
        <Controls style={{ background: "var(--bg-card)", border: "1px solid var(--border)" }} />
        <Background color="rgba(0,255,255,0.04)" gap={44} />
      </ReactFlow>
    </div>
  );
}
