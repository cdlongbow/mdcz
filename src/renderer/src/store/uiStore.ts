import { create } from "zustand";

interface UIState {
  selectedResultId: string | null;
  sidebarOpen: boolean;
  showInfoPanel: boolean;
  showPreviewPanel: boolean;

  setSelectedResultId: (id: string | null) => void;
  setSidebarOpen: (open: boolean) => void;
  toggleSidebar: () => void;
  setShowInfoPanel: (show: boolean) => void;
  setShowPreviewPanel: (show: boolean) => void;
}

export const useUIStore = create<UIState>((set) => ({
  selectedResultId: null,
  sidebarOpen: true,
  showInfoPanel: true,
  showPreviewPanel: true,

  setSelectedResultId: (id) => set({ selectedResultId: id }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  toggleSidebar: () => set((state) => ({ sidebarOpen: !state.sidebarOpen })),
  setShowInfoPanel: (show) => set({ showInfoPanel: show }),
  setShowPreviewPanel: (show) => set({ showPreviewPanel: show }),
}));
