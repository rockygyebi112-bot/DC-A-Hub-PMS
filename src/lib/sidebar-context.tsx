"use client";

import { createContext, useContext, useState, useCallback } from "react";

interface SidebarContextValue {
  mobileOpen: boolean;
  openMobile: () => void;
  closeMobile: () => void;
  toggleMobile: () => void;
  desktopCollapsed: boolean;
  setDesktopCollapsed: (v: boolean) => void;
  toggleDesktopCollapsed: () => void;
}

const SidebarContext = createContext<SidebarContextValue>({
  mobileOpen: false,
  openMobile: () => {},
  closeMobile: () => {},
  toggleMobile: () => {},
  desktopCollapsed: false,
  setDesktopCollapsed: () => {},
  toggleDesktopCollapsed: () => {},
});

export function SidebarProvider({ children }: { children: React.ReactNode }) {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [desktopCollapsed, setDesktopCollapsed] = useState(false);

  const openMobile = useCallback(() => setMobileOpen(true), []);
  const closeMobile = useCallback(() => setMobileOpen(false), []);
  const toggleMobile = useCallback(() => setMobileOpen((v) => !v), []);
  const toggleDesktopCollapsed = useCallback(
    () => setDesktopCollapsed((v) => !v),
    [],
  );

  return (
    <SidebarContext.Provider
      value={{
        mobileOpen,
        openMobile,
        closeMobile,
        toggleMobile,
        desktopCollapsed,
        setDesktopCollapsed,
        toggleDesktopCollapsed,
      }}
    >
      {children}
    </SidebarContext.Provider>
  );
}

export function useSidebar() {
  return useContext(SidebarContext);
}
