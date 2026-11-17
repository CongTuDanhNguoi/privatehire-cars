// Screen-reader announcements. Uses document.ariaNotify() where available, otherwise one shared
// live region per politeness level that is present from page load.

type Politeness = "polite" | "assertive";

declare global {
  interface Document {
    ariaNotify?: (message: string, options?: { priority?: "normal" | "high" }) => void;
  }
}

const regions = new Map<Politeness, HTMLElement>();

function region(politeness: Politeness): HTMLElement {
  let el = regions.get(politeness);
  if (!el) {
    el = document.createElement("div");
    el.className = "visually-hidden";
    el.setAttribute("aria-live", politeness);
    document.body.append(el);
    regions.set(politeness, el);
  }
  return el;
}

// Create the live regions early so screen readers register them before the first message.
export function initAnnouncer() {
  region("polite");
  region("assertive");
}

let timer: ReturnType<typeof setTimeout> | undefined;

export function announce(message: string, politeness: Politeness = "polite", delayMs = 0) {
  clearTimeout(timer);
  timer = setTimeout(() => {
    if (typeof document.ariaNotify === "function") {
      document.ariaNotify(message, { priority: politeness === "assertive" ? "high" : "normal" });
      return;
    }
    const el = region(politeness);
    el.textContent = "";
    // A tick later so the change is picked up as new content.
    requestAnimationFrame(() => {
      el.textContent = message;
    });
  }, delayMs);
}
