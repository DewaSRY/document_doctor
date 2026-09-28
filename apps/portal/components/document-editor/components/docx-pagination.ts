import { Extension } from "@tiptap/core";
import type { Node as ProseMirrorNode } from "@tiptap/pm/model";
import { Plugin, PluginKey } from "@tiptap/pm/state";
import { Decoration, DecorationSet, type EditorView } from "@tiptap/pm/view";

import type { DocxParagraphStyle } from "../type";
import type { DocxSetup } from "./docx-content";
import { paragraphStyleOf, type DocxStyles } from "./docx-style";

/**
 * Pagination of a Word document, like a word processor's: the body flows in
 * one column the width of the page's text area, and where a block no longer
 * fits (or a page break asks for it) a gap is inserted that ends the page and
 * starts the next below its top margin. The sheets themselves, and copies of
 * headers and footers, are drawn behind the text by DocxCanvas.
 *
 * Measuring runs after the DOM is updated; its results are applied only as
 * decorations, so it never changes the document or the undo history.
 */

export interface PageBox {
  /** In CSS px, from the top of the first page. */
  top: number;
  width: number;
  height: number;
  section: number;
  header: string | null;
  footer: string | null;
}

/** A copy of a header or footer, drawn on a page other than the one it is edited on. */
export interface RegionCopy {
  id: string;
  page: number;
  top: number;
  left: number;
  width: number;
  html: string;
}

export interface PaginationSnapshot {
  pages: PageBox[];
  copies: RegionCopy[];
  /** Total height and width of the sheets, in px. */
  height: number;
  width: number;
}

const EMPTY: PaginationSnapshot = {
  pages: [],
  copies: [],
  height: 0,
  width: 0,
};

/** Shares the pages with React and lets it ask for a new layout (zoom, print). */
export class PaginationStore {
  private snapshot = EMPTY;
  private listeners = new Set<() => void>();
  private relayout: (() => void) | null = null;
  /** CSS px per point. */
  zoom = 4 / 3;
  /** Space between sheets, in px. */
  gap = 20;

  get = () => this.snapshot;

  set(snapshot: PaginationSnapshot) {
    this.snapshot = snapshot;
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  /** Lay the pages out again at another zoom or gap. */
  configure(zoom: number, gap: number) {
    this.zoom = zoom;
    this.gap = gap;
    this.relayout?.();
  }

  connect(relayout: (() => void) | null) {
    this.relayout = relayout;
  }
}

export const paginationKey = new PluginKey<DecorationSet>("docxPagination");

interface Options {
  setup: DocxSetup;
  store: PaginationStore;
  docx: DocxStyles;
}

export const DocxPagination = Extension.create<Options>({
  name: "docxPagination",

  addOptions() {
    return {
      setup: null as unknown as DocxSetup,
      store: null as unknown as PaginationStore,
      docx: null as unknown as DocxStyles,
    };
  },

  addProseMirrorPlugins() {
    const options = this.options;
    return [
      new Plugin<DecorationSet>({
        key: paginationKey,
        state: {
          init: () => DecorationSet.empty,
          apply: (tr, set) => {
            const next = tr.getMeta(paginationKey) as DecorationSet | undefined;
            return next ?? set.map(tr.mapping, tr.doc);
          },
        },
        props: {
          decorations: (state) => paginationKey.getState(state),
        },
        view: (view) => new PaginationView(view, options),
      }),
    ];
  },
});

interface Measured {
  signature: string;
  decorations: Decoration[];
  snapshot: PaginationSnapshot;
}

class PaginationView {
  private frame = 0;
  private signature = "";
  private tabSignature = "";
  private snapshotKey = "";
  private heights = new WeakMap<
    ProseMirrorNode,
    { zoom: number; height: number }
  >();

  constructor(
    private view: EditorView,
    private options: Options,
  ) {
    options.store.connect(() => {
      this.heights = new WeakMap();
      this.schedule();
    });
    // Web fonts and images change the size of the text once they load.
    document.fonts?.addEventListener("loadingdone", this.onResourceLoad);
    view.dom.addEventListener("load", this.onResourceLoad, true);
    this.schedule();
  }

  update(view: EditorView, previous: { doc: ProseMirrorNode }) {
    this.view = view;
    if (view.state.doc !== previous.doc) this.schedule();
  }

  destroy() {
    cancelAnimationFrame(this.frame);
    this.options.store.connect(null);
    document.fonts?.removeEventListener("loadingdone", this.onResourceLoad);
    this.view.dom.removeEventListener("load", this.onResourceLoad, true);
  }

  private onResourceLoad = () => {
    this.heights = new WeakMap();
    this.schedule();
  };

  private schedule() {
    if (this.frame) return;
    this.frame = requestAnimationFrame(() => {
      this.frame = 0;
      if (this.view.isDestroyed) return;
      this.measure();
    });
  }

  private measure() {
    const { view } = this;
    const { store } = this.options;
    const zoom = store.zoom;

    // Tab widths first: they change where text wraps, and so the heights.
    const tabs = this.measureTabs(zoom);
    // By order, not position: typing moves paragraphs without changing their tabs.
    const tabSignature = tabs
      .map(([, style], index) => `${index}:${style}`)
      .join("|");
    const tabDecorations = tabs.map(([pos, style, size]) =>
      Decoration.node(pos, pos + size, { style }, { kind: "tabs" }),
    );
    if (tabSignature !== this.tabSignature) {
      this.tabSignature = tabSignature;
      // Apply the tabs (keeping the pages as they are), then measure the pages
      // once the text has reflowed.
      const current = paginationKey.getState(view.state) ?? DecorationSet.empty;
      const pageDecorations = current.find(
        undefined,
        undefined,
        (spec) => spec.kind === "page",
      );
      this.apply([...tabDecorations, ...pageDecorations]);
      this.heights = new WeakMap();
      this.schedule();
      return;
    }

    const measured = this.paginate(zoom, tabDecorations);
    if (measured.signature !== this.signature) {
      this.signature = measured.signature;
      this.apply(measured.decorations);
    }
    const snapshotKey = JSON.stringify(measured.snapshot);
    if (snapshotKey !== this.snapshotKey) {
      this.snapshotKey = snapshotKey;
      store.set(measured.snapshot);
    }
  }

  private apply(decorations: Decoration[]) {
    const { state } = this.view;
    const set = DecorationSet.create(state.doc, decorations);
    this.view.dispatch(
      state.tr.setMeta(paginationKey, set).setMeta("addToHistory", false),
    );
  }

  // ---------------------------------------------------------------- tabs

  /** For every paragraph with tabs: the width of each tab, as CSS variables. */
  private measureTabs(zoom: number): [number, string, number][] {
    const { view } = this;
    const { docx } = this.options;
    const result: [number, string, number][] = [];

    view.state.doc.descendants((node, pos) => {
      if (node.type.name !== "docxParagraph") return true;
      if (!node.attrs.tabCount) return false;
      const element = view.nodeDOM(pos) as HTMLElement | null;
      if (!element) return false;
      const { paragraph } = paragraphStyleOf(node, docx);
      const widths = measureParagraphTabs(
        element,
        paragraph,
        this.options.setup.defaultTab,
        zoom,
      );
      if (widths.length) {
        const style = widths
          .map(
            ({ width, leader }, index) =>
              `--t${index}: ${width}px;` +
              (leader ? ` --l${index}: var(--leader-${leader});` : ""),
          )
          .join(" ");
        result.push([pos, style, node.nodeSize]);
      }
      return false;
    });
    return result;
  }

  // ---------------------------------------------------------------- pages

  private paginate(zoom: number, tabDecorations: Decoration[]): Measured {
    const { view } = this;
    const { setup, store } = this.options;
    const { doc } = view.state;
    const gap = store.gap;

    const pages: PageBox[] = [];
    const decorations: Decoration[] = [...tabDecorations];
    const breaks: string[] = [];
    let pageInSection = 0;

    const geometry = (section: number) => {
      const { page, margin } = setup.sections[section] ?? setup.sections[0];
      return {
        width: page.width * zoom,
        height: page.height * zoom,
        top: margin.top * zoom,
        bottom: margin.bottom * zoom,
        content: (page.height - margin.top - margin.bottom) * zoom,
      };
    };

    const addPage = (section: number) => {
      const previous = pages.at(-1);
      const sectionOf = setup.sections[section] ?? setup.sections[0];
      pageInSection =
        previous && previous.section === section ? pageInSection + 1 : 0;
      const first = sectionOf.title_page && pageInSection === 0;
      const { width, height } = geometry(section);
      pages.push({
        top: previous ? previous.top + previous.height + gap : 0,
        width,
        height,
        section,
        header: first ? sectionOf.header.first : sectionOf.header.default,
        footer: first ? sectionOf.footer.first : sectionOf.footer.default,
      });
    };

    let used = 0;
    let previousSection = -1;
    let breakAfter = false;
    const regions: { node: ProseMirrorNode; pos: number }[] = [];

    doc.forEach((node, pos) => {
      if (node.type.name === "docxRegion") {
        regions.push({ node, pos });
        return;
      }
      const section = (node.attrs.section as number | undefined) ?? 0;
      const height = this.heightOf(node, pos, zoom);
      if (!pages.length) {
        addPage(section);
        previousSection = section;
      }
      const current = pages.at(-1)!;
      const area = geometry(current.section);

      const newSection =
        section !== previousSection &&
        setup.sections[section]?.break !== "continuous";
      const forced =
        breakAfter || newSection || (node.attrs.breakBefore && used > 0);
      const overflows = used > 0 && used + height > area.content + 0.5;

      if (forced || overflows) {
        const next = geometry(section);
        const spacer =
          Math.max(0, area.content - used) + area.bottom + gap + next.top;
        decorations.push(
          Decoration.widget(pos, () => gapElement(spacer), {
            side: -1,
            key: `gap-${Math.round(spacer * 10)}`,
            ignoreSelection: true,
            kind: "page",
          }),
        );
        breaks.push(`${pos}:${Math.round(spacer * 10)}`);
        addPage(section);
        used = 0;
      }

      used += height;
      // A block taller than a page runs over onto the pages after it.
      let page = geometry(pages.at(-1)!.section);
      while (used > page.content + 0.5) {
        used -= page.content + page.bottom + gap + page.top;
        addPage(pages.at(-1)!.section);
        page = geometry(pages.at(-1)!.section);
      }

      breakAfter = !!node.attrs.breakAfter;
      previousSection = section;
    });
    if (!pages.length) addPage(0);

    // Headers and footers: edited on the first page that shows them, copied onto the others.
    const copies: RegionCopy[] = [];
    const regionSignature: string[] = [];
    for (const { node, pos } of regions) {
      const id = node.attrs.id as string;
      const kind = node.attrs.kind as "header" | "footer";
      const element = view.nodeDOM(pos) as HTMLElement | null;
      const shownOn = pages
        .map((page, index) => ({ page, index }))
        .filter(
          ({ page }) => (kind === "header" ? page.header : page.footer) === id,
        );
      if (!element || !shownOn.length) {
        decorations.push(
          Decoration.node(
            pos,
            pos + node.nodeSize,
            { style: "display: none;" },
            { kind: "page" },
          ),
        );
        regionSignature.push(`${id}:hidden`);
        continue;
      }
      const height = element.offsetHeight;
      const html = element.innerHTML;
      const place = (page: PageBox) => {
        const { margin, page: size } =
          setup.sections[page.section] ?? setup.sections[0];
        const top =
          kind === "header"
            ? page.top + margin.header * zoom
            : page.top + (size.height - margin.footer) * zoom - height;
        return {
          top,
          left: margin.left * zoom,
          width: (size.width - margin.left - margin.right) * zoom,
        };
      };
      const host = shownOn[0];
      const at = place(host.page);
      decorations.push(
        Decoration.node(
          pos,
          pos + node.nodeSize,
          {
            style: `top: ${at.top}px; left: ${at.left}px; width: ${at.width}px; --page-number: "${host.index + 1}";`,
          },
          { kind: "page" },
        ),
      );
      regionSignature.push(
        `${id}:${Math.round(at.top)}:${Math.round(at.width)}`,
      );
      for (const { page, index } of shownOn.slice(1)) {
        copies.push({ id, page: index, html, ...place(page) });
      }
    }

    const last = pages.at(-1)!;
    const width = Math.max(...pages.map((page) => page.width));
    return {
      signature: `${breaks.join(",")}|${regionSignature.join(",")}|${this.tabSignature}`,
      decorations,
      snapshot: { pages, copies, height: last.top + last.height, width },
    };
  }

  private heightOf(node: ProseMirrorNode, pos: number, zoom: number): number {
    const cached = this.heights.get(node);
    if (cached && cached.zoom === zoom) return cached.height;
    const element = this.view.nodeDOM(pos) as HTMLElement | null;
    const height = element?.offsetHeight ?? 0;
    this.heights.set(node, { zoom, height });
    return height;
  }
}

function gapElement(height: number): HTMLElement {
  const element = document.createElement("div");
  element.className = "docx-page-gap";
  element.contentEditable = "false";
  element.setAttribute("aria-hidden", "true");
  element.style.height = `${height}px`;
  return element;
}

/**
 * Widths of a paragraph's tabs, in px, so text after each one starts (left
 * stop), ends (right stop) or is centred at the next tab stop, as in Word.
 * Stops are measured from the paragraph's left edge (the margin).
 */
function measureParagraphTabs(
  element: HTMLElement,
  paragraph: DocxParagraphStyle,
  defaultTab: number,
  zoom: number,
): { width: number; leader: string | null }[] {
  const tabs = [...element.querySelectorAll<HTMLElement>(".docx-tab")];
  if (!tabs.length) return [];
  const origin = element.getBoundingClientRect().left;
  const stops = [...paragraph.tabs];
  if (paragraph.indent_first < 0) {
    // A hanging indent is a tab stop too: list text lines up after the marker.
    stops.push({ pos: paragraph.indent_left, align: "left", leader: "none" });
    stops.sort((a, b) => a.pos - b.pos);
  }

  const widths: { width: number; leader: string | null }[] = [];
  const shifts: { top: number; bottom: number; shift: number }[] = [];
  tabs.forEach((tab, index) => {
    const rect = tab.getBoundingClientRect();
    const current = rect.width;
    // Earlier tabs on this line that grow or shrink move this one along.
    const shift = shifts
      .filter(
        (item) => item.top < rect.bottom + 1 && item.bottom > rect.top - 1,
      )
      .reduce((sum, item) => sum + item.shift, 0);
    const x = (rect.left - origin + shift) / zoom;

    const range = document.createRange();
    range.setStartAfter(tab);
    if (tabs[index + 1]) range.setEndBefore(tabs[index + 1]);
    else range.setEnd(element, element.childNodes.length);
    let left = Infinity;
    let right = -Infinity;
    for (const box of range.getClientRects()) {
      if (!box.width || box.top > rect.bottom + 1 || box.bottom < rect.top - 1)
        continue;
      left = Math.min(left, box.left);
      right = Math.max(right, box.right);
    }
    const follow = right > left ? (right - left) / zoom : 0;

    const stop = stops.find((item) => item.pos > x + 0.5);
    let width: number;
    if (stop) {
      width =
        stop.align === "right" || stop.align === "decimal"
          ? stop.pos - x - follow
          : stop.align === "center"
            ? stop.pos - x - follow / 2
            : stop.pos - x;
    } else {
      width = (Math.floor(x / defaultTab + 1e-6) + 1) * defaultTab - x;
    }
    const px = Math.max(0, Math.round(width * zoom * 10) / 10);
    widths.push({
      width: px,
      leader: stop && stop.leader !== "none" ? stop.leader : null,
    });
    shifts.push({ top: rect.top, bottom: rect.bottom, shift: px - current });
  });
  return widths;
}
