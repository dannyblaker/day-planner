"use client";

/** Match the exported image to whatever theme is on screen. */
const bg = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue("--background")
    .trim() || "#0a0e16";

function download(dataUrl: string, filename: string) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  a.click();
}

export async function exportPNG(node: HTMLElement, name: string) {
  const { toPng } = await import("html-to-image");
  const url = await toPng(node, { backgroundColor: bg(), pixelRatio: 2 });
  download(url, `${name}.png`);
}

export async function exportPDF(node: HTMLElement, name: string) {
  const { toPng } = await import("html-to-image");
  const url = await toPng(node, { backgroundColor: bg(), pixelRatio: 2 });
  const img = new Image();
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = reject;
    img.src = url;
  });
  const { jsPDF } = await import("jspdf");
  const w = img.width / 2;
  const h = img.height / 2;
  const pdf = new jsPDF({
    orientation: h >= w ? "portrait" : "landscape",
    unit: "px",
    format: [w, h],
  });
  pdf.addImage(url, "PNG", 0, 0, w, h);
  pdf.save(`${name}.pdf`);
}
