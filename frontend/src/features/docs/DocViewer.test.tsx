import { describe, expect, it } from "vitest";

import { stripUnsafeLinks } from "./DocViewer";

describe("stripUnsafeLinks", () => {
  it("javascript:/data: havolalarni olib tashlaydi, oddiy havolalarni qoldiradi", () => {
    const root = document.createElement("div");
    root.innerHTML = `
      <a id="js" href="javascript:alert(1)">x</a>
      <a id="js2" href=" JaVaScRiPt:alert(1)">x</a>
      <a id="data" href="data:text/html,<script>alert(1)</script>">x</a>
      <a id="web" href="https://example.uz/tz">x</a>
      <a id="mail" href="mailto:it@example.uz">x</a>
      <a id="anchor" href="#bob-2">x</a>`;

    stripUnsafeLinks(root);

    const href = (id: string) => root.querySelector(`#${id}`)!.getAttribute("href");
    expect(href("js")).toBeNull();
    expect(href("js2")).toBeNull();
    expect(href("data")).toBeNull();
    expect(href("web")).toBe("https://example.uz/tz");
    expect(href("mail")).toBe("mailto:it@example.uz");
    expect(href("anchor")).toBe("#bob-2");
  });
});
