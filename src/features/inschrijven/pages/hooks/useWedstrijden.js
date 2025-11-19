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
      try {
        let q = supabase.from("wedstrijden").select("*").order("datum", { ascending: true });
        if (onlyOpen) q = q.eq("status", "open");
        const { data, error } = await q;
        if (error) throw error;
        
        console.log("Fetched wedstrijden:", data?.map(w => ({
          id: w.id, 
          naam: w.naam, 
          datum: w.datum, 
          status: w.status
        })));
        
        if (alive) setItems(data || []);
      } catch (e) {
        console.error("Error fetching wedstrijden:", e);
        if (alive) setError(e);
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
