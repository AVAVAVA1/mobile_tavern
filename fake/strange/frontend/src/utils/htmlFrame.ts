// HTML 沙箱 iframe 自适应高度：iframe 内通过 postMessage 上报内容高度，父窗口据此撑高。

const MAX_FRAME_HEIGHT = 10000;

function applyHeight(frame: HTMLIFrameElement, height: number): void {
  const h = Math.max(0, Math.min(Math.round(height), MAX_FRAME_HEIGHT));
  frame.style.height = `${h}px`;
}

/** 安装全局 message 监听（在 main.ts 调用一次）。 */
export function installHtmlFrameAutoResize(): void {
  window.addEventListener("message", (event) => {
    const data = event.data;
    if (!data || typeof data !== "object" || data.type !== "html-frame-resize") return;
    const source = event.source;
    if (!source) return;
    const frames = document.querySelectorAll<HTMLIFrameElement>("iframe.html-frame");
    frames.forEach((frame) => {
      if (frame.contentWindow === source) {
        applyHeight(frame, Number(data.height) || 0);
      }
    });
  });
}
