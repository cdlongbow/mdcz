import { create } from "zustand";

interface UIState {
  selectedResultId: string | null;
  sidebarOpen: boolean;
  showInfoPanel: boolean;
  showPreviewPanel: boolean;
  workbenchMode: "scrape" | "maintenance";
  settingsActiveTab: string;

  setSelectedResultId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setShowInfoPanel: (show: boolean) => void;
  setShowPreviewPanel: (show: boolean) => void;
  setWorkbenchMode: (mode: "scrape" | "maintenance") => void;
  setSettingsActiveTab: (tab: string) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedResultId: null,
  sidebarOpen: true,
  showInfoPanel: true,
  showPreviewPanel: true,
  workbenchMode: "scrape",
  settingsActiveTab: "",

  setSelectedResultId: (id) => set({ selectedResultId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setShowInfoPanel: (show) => set({ showInfoPanel: show }),
  setShowPreviewPanel: (show) => set({ showPreviewPanel: show }),
  setWorkbenchMode: (mode) => set({ workbenchMode: mode }),
  setSettingsActiveTab: (tab) => set({ settingsActiveTab: tab }),
}));
