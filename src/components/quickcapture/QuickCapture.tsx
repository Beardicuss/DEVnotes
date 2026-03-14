import { useState, useEffect } from "react";
import { useTranslation } from "react-i18next";
import { useAppStore } from "@/stores/useAppStore";
import type { QuickCaptureType } from "@/types";
import s from "./QuickCapture.module.css";

export default function QuickCapture() {
  const { t }    = useTranslation();
  const open     = useAppStore((st) => st.quickCaptureOpen);
  const close    = useAppStore((st) => st.closeQuickCapture);
  const capture  = useAppStore((st) => st.quickCapture);
  const [text, setText]   = useState("");
  const [type, setType]   = useState<QuickCaptureType>("task");
  useEffect(() => {
    if (open) setText("");
  }, [open]);

  if (!open) return null;

  const handleSubmit = () => {
    if (!text.trim()) return;
    capture(text.trim(), type);
    setText("");
  };

  return (
    <div className={s.overlay} onClick={close}>
      <div className={`glass ${s.popup}`} onClick={(e) => e.stopPropagation()}>
        <div className={s.header}>
          <span className={s.label}>QUICK CAPTURE</span>
          <div className={s.typeSwitcher}>
            {(["task", "note", "todo"] as QuickCaptureType[]).map((tp) => (
              <button
                key={tp}
                className={`${s.typeBtn} ${type === tp ? s.typeActive : ""}`}
                onClick={() => setType(tp)}
              >
                {t(`quickcapture.as${tp.charAt(0).toUpperCase() + tp.slice(1)}` as any)}
              </button>
            ))}
          </div>
        </div>
        <input
          autoFocus
          className={`input ${s.input}`}
          placeholder={t("quickcapture.placeholder")}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter")  handleSubmit();
            if (e.key === "Escape") close();
          }}
        />
        <div className={s.hint}>Enter · save &nbsp; Escape · cancel</div>
      </div>
    </div>
  );
}
