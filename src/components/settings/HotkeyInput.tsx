import { useState, useRef } from "react";
import s from "./HotkeyInput.module.css";

interface Props {
  value:    string;
  onChange: (v: string) => void;
}

export default function HotkeyInput({ value, onChange }: Props) {
  const [recording, setRecording] = useState(false);
  const inputRef = useRef<HTMLDivElement>(null);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    e.preventDefault();
    e.stopPropagation();

    // Ignore modifier-only keydowns
    if (["Control","Shift","Alt","Meta"].includes(e.key)) return;

    const parts: string[] = [];
    if (e.ctrlKey)  parts.push("Ctrl");
    if (e.altKey)   parts.push("Alt");
    if (e.shiftKey) parts.push("Shift");
    if (e.metaKey)  parts.push("Meta");

    const key = e.key === " " ? "Space" : e.key.length === 1 ? e.key.toUpperCase() : e.key;
    parts.push(key);

    if (e.key === "Escape") {
      setRecording(false);
      return;
    }

    onChange(parts.join("+"));
    setRecording(false);
  };

  return (
    <div className={s.wrap}>
      {recording ? (
        <div
          ref={inputRef}
          className={s.recording}
          tabIndex={0}
          autoFocus
          onKeyDown={handleKeyDown}
          onBlur={() => setRecording(false)}>
          Press a key combo… (Esc to cancel)
        </div>
      ) : (
        <div className={s.display}>
          <kbd className={s.kbd}>{value || "—"}</kbd>
          <button className={s.editBtn} onClick={() => { setRecording(true); setTimeout(() => inputRef.current?.focus(), 50); }}>
            ✏ Edit
          </button>
          {value && (
            <button className={s.clearBtn} onClick={() => onChange("")} title="Clear">✕</button>
          )}
        </div>
      )}
    </div>
  );
}
