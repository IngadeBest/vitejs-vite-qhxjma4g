import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabaseClient";

export function useWedstrijden(onlyOpen = false) {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      setLoading(true);
      setError(null);
      try {
        let q = supabase.from("wedstrijden").select("*").order("datum", { ascending: true });
        if (onlyOpen) q = q.eq("status", "open");
        const { data, error } = await q;
        if (error) throw error;
        if (alive) setItems(data || []);
      } catch (e) {
        if (alive) setError(e);
      } finally {
        if (alive) setLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [onlyOpen]);

  return { items, loading, error };
}
