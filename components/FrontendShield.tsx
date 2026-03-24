"use client";

import { useEffect } from "react";

function isEditableTarget(target: EventTarget | null) {
  if (!(target instanceof HTMLElement)) return false;
  const tag = target.tagName.toLowerCase();
  return tag === "input" || tag === "textarea" || target.isContentEditable;
}

export default function FrontendShield() {
  useEffect(() => {
    function handleContextMenu(event: MouseEvent) {
      if (!isEditableTarget(event.target)) {
        event.preventDefault();
      }
    }

    function handleKeyDown(event: KeyboardEvent) {
      const key = event.key?.toLowerCase?.() || "";
      if (!key) return;
      const blockedInspect = event.ctrlKey && event.shiftKey && key === "i";
      const blockedF12 = key === "f12";
      const blockedCopy = event.ctrlKey && key === "c" && !isEditableTarget(event.target);
      const blockedPrint = event.ctrlKey && key === "p";

      if (blockedInspect || blockedF12 || blockedCopy || blockedPrint) {
        event.preventDefault();
      }
    }

    window.addEventListener("contextmenu", handleContextMenu);
    window.addEventListener("keydown", handleKeyDown);

    return () => {
      window.removeEventListener("contextmenu", handleContextMenu);
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, []);

  return null;
}

