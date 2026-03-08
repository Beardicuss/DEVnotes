import { useState } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore, selTodoLists, selActiveProject } from "@/stores/useAppStore";

export default function TabTodos() {
  const { t }      = useTranslation();
  const project    = useAppStore(selActiveProject);
  const lists      = useAppStore(selTodoLists);
  const addList    = useAppStore((s) => s.addTodoList);
  const addItem    = useAppStore((s) => s.addTodoItem);
  const toggleItem = useAppStore((s) => s.toggleTodoItem);
  const deleteItem = useAppStore((s) => s.deleteTodoItem);
  const clearDone  = useAppStore((s) => s.clearDoneTodos);

  const [activeListId, setActiveListId] = useState<string | null>(null);
  const [newItemText, setNewItemText]   = useState("");

  if (!project) return null;

  const list = lists.find((l) => l.id === activeListId) ?? lists[0] ?? null;

  const handleAddItem = () => {
    if (!newItemText.trim() || !list) return;
    addItem(list.id, newItemText.trim());
    setNewItemText("");
  };

  return (
    <div style={{ display: "flex", height: "100%", overflow: "hidden" }}>

      {/* ── List picker ──────────────────────────────── */}
      <div style={{
        width: 200, minWidth: 200, borderRight: "1px solid var(--border)",
        padding: 16, display: "flex", flexDirection: "column", gap: 4, overflowY: "auto",
      }}>
        <span style={{
          fontFamily: "var(--font-mono)", fontSize: "var(--fs-xxs)",
          color: "var(--text-dim)", letterSpacing: "3px", marginBottom: 8, textTransform: "uppercase",
        }}>
          {t("todos.title")}
        </span>

        {lists.map((l) => (
          <button
            key={l.id}
            onClick={() => setActiveListId(l.id)}
            style={{
              textAlign: "left", padding: "8px 12px",
              background: list?.id === l.id ? "var(--bg-selected)" : "transparent",
              border: "none",
              borderLeft: `2px solid ${list?.id === l.id ? "var(--cyan)" : "transparent"}`,
              color: list?.id === l.id ? "var(--cyan)" : "var(--text-dim)",
              fontFamily: "var(--font-mono)", fontSize: "var(--fs-xs)", cursor: "pointer",
              transition: "all var(--t-fast)",
            }}>
            {l.name}
            <span style={{ float: "right", color: "var(--text-dim)" }}>
              {l.items.filter((i) => !i.done).length}
            </span>
          </button>
        ))}

        <AddListInline onAdd={addList} label={`+ ${t("todos.newList")}`} />
      </div>

      {/* ── Items ────────────────────────────────────── */}
      {list ? (
        <div style={{ flex: 1, display: "flex", flexDirection: "column", overflow: "hidden" }}>
          {/* Header */}
          <div style={{
            padding: "12px 20px", borderBottom: "1px solid var(--border-dim)",
            display: "flex", justifyContent: "space-between", alignItems: "center", flexShrink: 0,
          }}>
            <span style={{ fontFamily: "var(--font-ui)", fontWeight: 700, fontSize: "var(--fs-lg)" }}>
              {list.name}
            </span>
            <span style={{
              fontFamily: "var(--font-mono)", fontSize: "var(--fs-xxs)",
              color: "var(--text-dim)",
            }}>
              {list.items.filter((i) => i.done).length}/{list.items.length} done
            </span>
            <button className="btn btn-ghost" onClick={() => clearDone(list.id)}>
              {t("todos.clearDone")}
            </button>
          </div>

          {/* Items list */}
          <div style={{ flex: 1, overflowY: "auto", padding: "4px 0" }}>
            {list.items
              .slice()
              .sort((a, b) => a.order - b.order)
              .map((item) => (
                <div key={item.id} style={{
                  display: "flex", alignItems: "center", gap: 10,
                  padding: "9px 20px", borderBottom: "1px solid var(--border-dim)",
                  opacity: item.done ? 0.5 : 1, transition: "opacity var(--t-fast)",
                }}>
                  <input
                    type="checkbox"
                    checked={item.done}
                    onChange={() => toggleItem(list.id, item.id)}
                    style={{ accentColor: "var(--cyan)", width: 15, height: 15, flexShrink: 0, cursor: "pointer" }}
                  />
                  <span style={{
                    flex: 1, fontSize: "var(--fs-sm)",
                    textDecoration: item.done ? "line-through" : "none",
                    color: item.done ? "var(--text-muted)" : "var(--text)",
                  }}>
                    {item.text}
                  </span>
                  {item.dueDate && (
                    <span style={{ fontFamily: "var(--font-mono)", fontSize: "var(--fs-xxs)", color: "var(--yellow)" }}>
                      {item.dueDate}
                    </span>
                  )}
                  <button
                    className="btn-icon"
                    onClick={() => deleteItem(list.id, item.id)}
                    style={{ color: "var(--text-dim)", opacity: 0.5 }}
                    title="Delete">
                    ✕
                  </button>
                </div>
              ))}

            {list.items.length === 0 && (
              <p style={{
                color: "var(--text-dim)", fontSize: "var(--fs-sm)",
                padding: "32px 20px", fontFamily: "var(--font-mono)",
              }}>
                {t("todos.empty")}
              </p>
            )}
          </div>

          {/* Add item */}
          <div style={{
            padding: "12px 20px", borderTop: "1px solid var(--border-dim)",
            display: "flex", gap: 8, flexShrink: 0,
          }}>
            <input
              className="input"
              style={{ flex: 1 }}
              placeholder={t("todos.newItem")}
              value={newItemText}
              onChange={(e) => setNewItemText(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleAddItem()}
            />
            <button className="btn btn-primary" onClick={handleAddItem}>
              {t("common.add")}
            </button>
          </div>
        </div>
      ) : (
        <div style={{
          flex: 1, display: "flex", alignItems: "center", justifyContent: "center",
          color: "var(--text-dim)", fontFamily: "var(--font-mono)", fontSize: "var(--fs-sm)",
        }}>
          Create a list to get started
        </div>
      )}
    </div>
  );
}

function AddListInline({ onAdd, label }: { onAdd: (name: string) => void; label: string }) {
  const [open, setOpen] = useState(false);
  const [val, setVal]   = useState("");
  if (!open) return (
    <button className="btn" style={{marginTop:12,width:"100%"}} onClick={() => setOpen(true)}>
      {label}
    </button>
  );
  return (
    <div style={{marginTop:12,display:"flex",flexDirection:"column",gap:"4px"}}>
      <input
        className="input" style={{fontSize:"var(--fs-xs)"}} placeholder="List name…"
        value={val} autoFocus onChange={e => setVal(e.target.value)}
        onKeyDown={e => {
          if (e.key==="Enter" && val.trim()) { onAdd(val.trim()); setVal(""); setOpen(false); }
          if (e.key==="Escape") { setVal(""); setOpen(false); }
        }}
      />
      <div style={{display:"flex",gap:"4px"}}>
        <button className="btn btn-primary" style={{flex:1}}
          onClick={() => { if(val.trim()){ onAdd(val.trim()); setVal(""); setOpen(false); } }}>✓ Add</button>
        <button className="btn" onClick={() => { setVal(""); setOpen(false); }}>✕</button>
      </div>
    </div>
  );
}
