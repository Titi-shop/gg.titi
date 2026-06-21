"use client";
import { useEffect } from "react";
export default function AlertProvider() {
  useEffect(() => {
    const showTopNotification = (message: string): void => {
      const toast = document.createElement("div");
      toast.textContent = message;
      Object.assign(toast.style, {
        position: "fixed",
        top: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        background: "#16a34a",
        color: "#fff",
        padding: "12px 18px",
        borderRadius: "12px",
        fontSize: "14px",
        fontWeight: "600",
        zIndex: "99999",
        boxShadow: "0 10px 25px rgba(0,0,0,.15)",
        transition: "all .3s ease",
        maxWidth: "90vw",
        textAlign: "center",
      } satisfies Partial<CSSStyleDeclaration>);

      document.body.appendChild(toast);

      setTimeout(() => {
        toast.style.opacity = "0";

        setTimeout(() => {
          toast.remove();
        }, 300);
      }, 4000);
    };

    const handleGlobalAlert = (
      event: Event
    ): void => {
      const customEvent =
        event as CustomEvent<string>;

      if (!customEvent.detail) return;

      showTopNotification(
        customEvent.detail
      );
    };

    window.addEventListener(
      "global-alert",
      handleGlobalAlert
    );

    return () => {
      window.removeEventListener(
        "global-alert",
        handleGlobalAlert
      );
    };
  }, []);

  return null;
}
