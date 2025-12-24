import { ipcRenderer } from "electron";

window.addEventListener("DOMContentLoaded", () => {
    const btn = document.getElementById("applyChanges");
    if (!btn) return;

    btn.addEventListener("click", () => {
        ipcRenderer.send("apply-config", {
            message: "User clicked apply"
        });
    });
});