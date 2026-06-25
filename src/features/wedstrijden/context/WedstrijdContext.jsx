import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";

const STORAGE_KEY = "workingpoint_selected_wedstrijd_id";

const WedstrijdContext = createContext(null);

export function WedstrijdProvider({ children }) {
  const { items: wedstrijden, loading, error } = useWedstrijden(false);
  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState("");
  const clearSelectedWedstrijd = useCallback(() => setSelectedWedstrijdId(""), []);

  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY) || "";
      if (stored) setSelectedWedstrijdId(stored);
    } catch (storageError) {
      // ignore storage issues; the app still works without persistence
    }
  }, []);

  useEffect(() => {
    try {
      if (selectedWedstrijdId) {
        window.localStorage.setItem(STORAGE_KEY, selectedWedstrijdId);
      } else {
        window.localStorage.removeItem(STORAGE_KEY);
      }
    } catch (storageError) {
      // ignore storage issues; the app still works without persistence
    }
  }, [selectedWedstrijdId]);

  const selectedWedstrijd = useMemo(
    () => wedstrijden.find((wedstrijd) => wedstrijd.id === selectedWedstrijdId) || null,
    [wedstrijden, selectedWedstrijdId]
  );

  const value = useMemo(
    () => ({
      wedstrijden,
      loadingWedstrijden: loading,
      wedstrijdenError: error,
      selectedWedstrijdId,
      selectedWedstrijd,
      setSelectedWedstrijdId,
      clearSelectedWedstrijd,
    }),
    [clearSelectedWedstrijd, error, loading, selectedWedstrijd, selectedWedstrijdId, wedstrijden]
  );

  return <WedstrijdContext.Provider value={value}>{children}</WedstrijdContext.Provider>;
}

export function useWedstrijdContext() {
  const context = useContext(WedstrijdContext);
  if (!context) {
    throw new Error("useWedstrijdContext must be used within a WedstrijdProvider");
  }
  return context;
}
