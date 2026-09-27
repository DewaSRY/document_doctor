"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

/** How PDF pages are drawn; shared by the toolbar and the node views. */
export interface PdfViewSettings {
  documentId: string;
  pageCount: number;
  /** CSS px per PDF point. */
  zoom: number;
  /** Resolution of the page images, in image px per PDF point. */
  imageScale: number;
  /** Show the original page next to each translated page. */
  compare: boolean;
  /** Outline every text box. */
  showBoxes: boolean;
  /** Show the original text under the active block. */
  showSource: boolean;
  fits: FitStore;
}

export const PdfViewContext = createContext<PdfViewSettings | null>(null);

export function usePdfView(): PdfViewSettings {
  const settings = useContext(PdfViewContext);
  if (!settings) throw new Error("usePdfView must be used inside PdfViewContext");
  return settings;
}

/**
 * The font scale each segment needs so its text fits its box, as measured by
 * its node view. Like the service, a long translation shrinks rather than overflows.
 */
export class FitStore {
  private values = new Map<string, number>();
  private listeners = new Set<() => void>();

  get(key: string): number {
    return this.values.get(key) ?? 1;
  }

  set(key: string, fit: number) {
    if (this.get(key) === fit) return;
    this.values.set(key, fit);
    this.listeners.forEach((listener) => listener());
  }

  subscribe = (listener: () => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };
}

export function useFit(store: FitStore | undefined, key: string | undefined): number {
  return useSyncExternalStore(
    store?.subscribe ?? noopSubscribe,
    () => (store && key ? store.get(key) : 1),
    () => 1,
  );
}

const noopSubscribe = () => () => {};
