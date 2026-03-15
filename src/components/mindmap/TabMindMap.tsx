import { useCallback, useMemo, useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, selMindMap, selActiveProject } from "@/stores/useAppStore";
import { uid } from "@/utils/id";
import type { MapNode, MapEdge } from "@/types";
import ReactFlow, { Controls, Background, useNodesState, useEdgesState, addEdge } from "reactflow";
import "reactflow/dist/style.css";

const _NODE_COLOURS: Record<string, string> = {
  root: "#00ffff",
  idea: "#0088ff",
  task: "#00ff88",
  note: "#ff8844",
  decision: "#ff00ff",
  risk: "#ff3344",
};

export default function TabMindMap() {
  const { t } = useTranslation();
  const project = useAppStore(selActiveProject);
  const mindMap = useAppStore(selMindMap);
  const updateMap = useAppStore((s) => s.updateMindMap);

  return <MindMapCanvas project={project} mindMap={mindMap} updateMap={updateMap} />;
}

function MindMapCanvas({ project, mindMap, updateMap }: {
  project: ReturnType<typeof selActiveProject>;
  mindMap: ReturnType<typeof selMindMap>;
  updateMap: (projectId: string, patch: any) => void;
}) {
  const { t } = useTranslation();
  const [addNodeOpen, setAddNodeOpen] = useState(false);
  const [addNodeText, setAddNodeText] = useState("");

  // Convert internal nodes → ReactFlow nodes
  const initialRFNodes = useMemo(() => (mindMap?.nodes ?? []).map((n) => ({
    id: n.id,
    position: { x: n.x, y: n.y },
    data: { label: n.text, type: n.type, colour: n.colour },
    style: {
      background: n.colour + "18",
      border: `1px solid ${n.colour}`,
      color: n.colour,
      fontFamily: "var(--font-mono)",
      fontSize: 12,
      borderRadius: 0,
      padding: "8px 14px",
      boxShadow: `0 0 12px ${n.colour}22`,
    },
  })), [mindMap]);

  const initialRFEdges = useMemo(() => (mindMap?.edges ?? []).map((e) => ({
    id: e.id,
    source: e.fromId,
    target: e.toId,
    label: e.label ?? undefined,
    style: { stroke: "rgba(0,255,255,.35)", strokeWidth: 1.5 },
    labelStyle: { fill: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: 10 },
    animated: false,
  })), [mindMap]);

  const [rfNodes, setRFNodes, onNodesChange] = useNodesState(initialRFNodes);
  const [rfEdges, setRFEdges, onEdgesChange] = useEdgesState(initialRFEdges);

  const onNodesChangeRF = useCallback((changes: any[]) => {
    onNodesChange(changes);
    if (!project || !mindMap) return;

    // Convert RF nodes back to our schema any time they move, resize, or delete
    setTimeout(() => {
      setRFNodes((currentNodes) => {
        const updatedNodes = currentNodes.map(n => ({
          id: n.id,
          text: n.data.label,
          x: n.position.x,
          y: n.position.y,
          type: n.data.type || "idea",
          colour: n.data.colour || "#0088ff",
          parentId: null,
        }));
        updateMap(project.id, { nodes: updatedNodes });
        return currentNodes;
      });
    }, 0);
  }, [project, mindMap, updateMap, onNodesChange, setRFNodes]);

  const onEdgesChangeRF = useCallback((changes: any[]) => {
    onEdgesChange(changes);
    if (!project || !mindMap) return;

    setTimeout(() => {
      setRFEdges((currentEdges) => {
        const updatedEdges = currentEdges.map(e => ({
          id: e.id,
          fromId: e.source,
          toId: e.target,
          label: e.label || null,
        }));
        updateMap(project.id, { edges: updatedEdges });
        return currentEdges;
      });
    }, 0);
  }, [project, mindMap, updateMap, onEdgesChange, setRFEdges]);

  const onConnect = useCallback((params: any) => {
    if (!project || !mindMap) return;
    const newEdge: MapEdge = {
      id: uid(),
      fromId: params.source,
      toId: params.target,
      label: null,
    };
    setRFEdges((eds: any[]) => addEdge(params, eds));
    updateMap(project.id, { edges: [...mindMap.edges, newEdge] });
  }, [project, mindMap, updateMap, setRFEdges]);

  const addNode = (text: string) => {
    if (!project || !mindMap || !text.trim()) return;
    const newNode: MapNode = {
      id: uid(),
      text,
      x: 200 + Math.random() * 400,
      y: 200 + Math.random() * 200,
      type: "idea",
      colour: "#0088ff",
      parentId: null,
    };
    updateMap(project.id, { nodes: [...mindMap.nodes, newNode] });
    setRFNodes((ns: any[]) => [...ns, {
      id: newNode.id,
      position: { x: newNode.x, y: newNode.y },
      data: { label: newNode.text },
      style: { background: "#0088ff18", border: "1px solid #0088ff", color: "#0088ff", fontFamily: "var(--font-mono)", fontSize: 12, borderRadius: 0, padding: "8px 14px" },
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
          <div style={{ display: "flex", gap: "4px", alignItems: "center" }}>
            <input className="input" style={{ width: "140px", fontSize: "var(--fs-xs)" }}
              placeholder={t("mindmap.addNode")} value={addNodeText} autoFocus
              onChange={e => setAddNodeText(e.target.value)}
              onKeyDown={e => {
                if (e.key === "Enter") { addNode(addNodeText); setAddNodeText(""); setAddNodeOpen(false); }
                if (e.key === "Escape") { setAddNodeText(""); setAddNodeOpen(false); }
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
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
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
        onNodesChange={onNodesChangeRF}
        onEdgesChange={onEdgesChangeRF}
        onConnect={onConnect}
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
