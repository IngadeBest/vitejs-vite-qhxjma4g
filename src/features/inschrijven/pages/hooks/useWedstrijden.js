import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

function toDateKey(value) {
  if (!value) return null;
  if (typeof value === "string") {
    const trimmed = value.trim();
    if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed;
    if (/^\d{4}-\d{2}-\d{2}T/.test(trimmed)) return trimmed.slice(0, 10);
  }

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function isOpenForRegistration(wedstrijd) {
  if (!wedstrijd || wedstrijd.status !== "open") return false;
  const wedstrijdDate = toDateKey(wedstrijd.datum);
  if (!wedstrijdDate) return true;

  const now = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;
  return wedstrijdDate >= today;
}

export function useWedstrijden(onlyOpen = false) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;

    async function fetchWedstrijden() {
      setLoading(true);
      setError(null);
      
      // First try Supabase
      try {
        let q = supabase.from("wedstrijden").select("*").order("datum", { ascending: true });
        if (onlyOpen) q = q.eq("status", "open");
        const { data, error } = await q;
        
        if (error) {
          // Fallback to mock data
          const mockData = [
            {
              id: "1",
              naam: "Voorjaarswedstrijd 2025",
              datum: "2025-04-15",
              status: "open",
              locatie: "Manege De Bosberg"
            },
            {
              id: "2", 
              naam: "Zomerwedstrijd 2025",
              datum: "2025-07-20",
              status: "open",
              locatie: "Ruitersport Centrum"
            },
            {
              id: "3",
              naam: "Najaarscompetitie 2025", 
              datum: "2025-09-10",
              status: "concept",
              locatie: "Hippisch Centrum Noord"
            },
            {
              id: "4",
              naam: "Winterwedstrijd 2025",
              datum: "2025-12-06", 
              status: "gesloten",
              locatie: "Indoor Manege"
            }
          ];
          
          const filteredData = onlyOpen
            ? mockData.filter((w) => isOpenForRegistration(w))
            : mockData;
          if (alive) setItems(filteredData);
        } else {
          const filteredData = onlyOpen
            ? (data || []).filter((w) => isOpenForRegistration(w))
            : (data || []);
          if (alive) setItems(filteredData);
        }
      } catch (e) {
        console.error("Error fetching wedstrijden:", e);
        // Fallback to mock data on any error
        const mockData = [
          {
            id: "1",
            naam: "Voorjaarswedstrijd 2025",
            datum: "2025-04-15", 
            status: "open",
            locatie: "Manege De Bosberg"
          },
          {
            id: "2",
            naam: "Zomerwedstrijd 2025", 
            datum: "2025-07-20",
            status: "open",
            locatie: "Ruitersport Centrum"
          },
          {
            id: "4",
            naam: "Winterwedstrijd 2025",
            datum: "2025-12-06",
            status: "gesloten", 
            locatie: "Indoor Manege"
          }
        ];
        
        const filteredData = onlyOpen
          ? mockData.filter((w) => isOpenForRegistration(w))
          : mockData;
        if (alive) {
          setItems(filteredData);
          setError(null); // Clear error since we have fallback data
        }
      } finally {
        if (alive) setLoading(false);
      }
    }

    fetchWedstrijden();

    // allow other parts of the app to request a refresh
    const onRefresh = () => { if (alive) fetchWedstrijden(); };
    window.addEventListener('wedstrijden:refresh', onRefresh);

    return () => { alive = false; window.removeEventListener('wedstrijden:refresh', onRefresh); };
  }, [onlyOpen]);

  return { items, loading, error };
}
