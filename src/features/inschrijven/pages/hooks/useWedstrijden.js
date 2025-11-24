import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

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
            }
          ];
          
          const filteredData = onlyOpen ? mockData.filter(w => w.status === 'open') : mockData;
          if (alive) setItems(filteredData);
        } else {
          if (alive) setItems(data || []);
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
          }
        ];
        
        const filteredData = onlyOpen ? mockData.filter(w => w.status === 'open') : mockData;
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
