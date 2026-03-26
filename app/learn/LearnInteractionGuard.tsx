"use client";

import { useEffect } from "react";

function findProtectedRoot(): HTMLElement | null {
  return document.querySelector("[data-learn-protected='1']");
}

function isInsideProtected(target: EventTarget | null): boolean {
  const root = findProtectedRoot();
  if (!root || !(target instanceof Node)) return false;
  return root.contains(target);
}

function selectionInsideProtected(): boolean {
  const root = findProtectedRoot();
  const anchor = window.getSelection()?.anchorNode ?? null;
  if (!root || !anchor) return false;
  return root.contains(anchor);
}

export default function LearnInteractionGuard() {
  useEffect(() => {
    function blockIfInside(event: Event) {
      if (isInsideProtected(event.target) || selectionInsideProtected()) {
        event.preventDefault();
      }
    }

    function blockHotkeys(event: KeyboardEvent) {
      if (!(event.ctrlKey || event.metaKey)) return;
      const k = event.key.toLowerCase();
      if (k !== "c" && k !== "p") return;
      if (isInsideProtected(event.target) || selectionInsideProtected()) {
        event.preventDefault();
      }
    }

    document.addEventListener("copy", blockIfInside);
    document.addEventListener("cut", blockIfInside);
    document.addEventListener("selectstart", blockIfInside);
    document.addEventListener("contextmenu", blockIfInside);
    document.addEventListener("keydown", blockHotkeys);

    return () => {
      document.removeEventListener("copy", blockIfInside);
      document.removeEventListener("cut", blockIfInside);
      document.removeEventListener("selectstart", blockIfInside);
      document.removeEventListener("contextmenu", blockIfInside);
      document.removeEventListener("keydown", blockHotkeys);
    };
  }, []);

  return null;
}
