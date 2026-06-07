"use client";

import { useEffect } from "react";

export default function AlertProvider() {
  useEffect(() => {
    const oldAlert = window.alert;

    window.alert = function (message?: unknown) {
      console.log("Alert:", message);

      /* =========================
         ROOT
      ========================= */
      const overlay = document.createElement("div");
      overlay.style.position = "fixed";
      overlay.style.inset = "0";
      overlay.style.background = "rgba(0,0,0,0.4)";
      overlay.style.display = "flex";
      overlay.style.alignItems = "center";
      overlay.style.justifyContent = "center";
      overlay.style.zIndex = "9999";

      /* =========================
         MODAL
      ========================= */
      const modal = document.createElement("div");
      modal.style.background = "#fff";
      modal.style.padding = "20px";
      modal.style.borderRadius = "14px";
      modal.style.textAlign = "center";
      modal.style.maxWidth = "320px";
      modal.style.width = "85%";
      modal.style.boxShadow = "0 10px 25px rgba(0,0,0,0.2)";

      /* =========================
         TEXT
      ========================= */
      const text = document.createElement("p");
      text.textContent =
        typeof message === "string" ? message : "Something went wrong";
      text.style.marginBottom = "16px";
      text.style.color = "#333";
      text.style.fontSize = "15px";

      /* =========================
         BUTTON
      ========================= */
      const button = document.createElement("button");
      button.textContent = "OK";
      button.style.background = "#f97316";
      button.style.color = "#fff";
      button.style.padding = "10px 18px";
      button.style.borderRadius = "10px";
      button.style.border = "none";
      button.style.fontWeight = "600";
      button.style.cursor = "pointer";

      /* =========================
         CLOSE FUNCTION (SAFE)
      ========================= */
      const close = () => {
        // tránh remove nhiều lần gây lỗi
        if (overlay.parentNode) {
          overlay.parentNode.removeChild(overlay);
        }
      };

      /* =========================
         EVENTS
      ========================= */
      button.onclick = close;

      overlay.onclick = (e: MouseEvent) => {
        if (e.target === overlay) {
          close();
        }
      };

      /* =========================
         BUILD DOM
      ========================= */
      modal.appendChild(text);
      modal.appendChild(button);
      overlay.appendChild(modal);
      document.body.appendChild(overlay);
    };

    return () => {
      window.alert = oldAlert;
    };
  }, []);

  return null;
}
