import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/lib/supabaseClient";
import { useWedstrijden } from "@/features/inschrijven/pages/hooks/useWedstrijden";

// Klassen (incl. WE2+ = 'we2p')
const KLASSEN = [
  { code: "",     label: "Alle klassen" },
  { code: "we0",  label: "Introductieklasse (WE0)" },
  { code: "we1",  label: "WE1" },
  { code: "we2",  label: "WE2" },
  { code: "we2p", label: "WE2+" },
  { code: "we3",  label: "WE3" },
  { code: "we4",  label: "WE4" },
];
const KLASSEN_EDIT = KLASSEN.filter(k => k.code !== "");

// Categorieën (Senioren / Young Riders / Junioren)
const CATS = [
  { code: "",       label: "Alle categorieën" },
  { code: "senior", label: "Senioren" },
  { code: "yr",     label: "Young Riders" },
  { code: "junior", label: "Junioren" },
];
const CATS_EDIT = CATS.filter(c => c.code !== "");
const CAT_LABEL = Object.fromEntries(CATS_EDIT.map(c => [c.code, c.label]));

export default function Startlijst() {
  const { items: wedstrijden, loading: loadingWed } = useWedstrijden(false);
  const [sp] = useSearchParams();
  const qId = sp.get("wedstrijdId") || "";

  const [selectedWedstrijdId, setSelectedWedstrijdId] = useState(qId);
  const [klasseFilter, setKlasseFilter] = useState("");
  const [catFilter, setCatFilter] = useState("");
  const [beheer, setBeheer] = useState(false);

  const [rows, setRows] = useState([]);         // ruwe DB-rows
  const [editRows, setEditRows] = useState([]); // bewerkbare kopie
  const [changed, setChanged] = useState(new Set()); // id's met wijzigingen

  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [msg, setMsg] = useState("");

  const gekozen = useMemo(
    () => wedstrijden.find((w) => w.id === selectedWedstrijdId) || null,
    [wedstrijden, selectedWedstrijdId]
  );

  const fetchRows = useCallback(async () => {
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      if (!selectedWedstrijdId) {
        setRows([]);
        setEditRows([]);
        return;
      }
      let q = supabase
        .from("inschrijvingen")
        .select("id, created_at, wedstrijd_id, klasse, categorie, ruiter, paard, email, startnummer, omroeper, opmerkingen")
        .eq("wedstrijd_id", selectedWedstrijdId)
        .order("startnummer", { ascending: true, nullsFirst: true })
        .order("created_at", { ascending: true });

      if (klasseFilter) q = q.eq("klasse", klasseFilter);
      if (catFilter) q = q.eq("categorie", catFilter);

      const { data, error } = await q;
      if (error) throw error;

      setRows(data || []);
      setEditRows((data || []).map(r => ({ ...r })));
      setChanged(new Set());
    } catch (e) {
      setErr(e?.message || String(e));
    } finally {
      setBusy(false);
    }
  }, [selectedWedstrijdId, klasseFilter, catFilter]);

  useEffect(() => {
    fetchRows();
  }, [fetchRows]);

  // Realtime updates (verversen bij wijzigingen, ook als iemand anders iets toevoegt)
  useEffect(() => {
    if (!selectedWedstrijdId) return;
    const channel = supabase
      .channel("rt_startlijst_beheer")
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "inschrijvingen",
          filter: `wedstrijd_id=eq.${selectedWedstrijdId}`,
        },
        () => fetchRows()
      )
      .subscribe();
    return () => {
      try { supabase.removeChannel(channel); } catch {}
    };
  }, [selectedWedstrijdId, fetchRows]);

  const markChanged = (id) => {
    setChanged(prev => new Set(prev).add(id));
    setMsg("");
  };

  const onCellChange = (id, field, value) => {
    setEditRows(list => list.map(r => r.id === id ? { ...r, [field]: value } : r));
    markChanged(id);
  };

  const moveRow = (idx, dir) => {
    setEditRows(list => {
      const next = [...list];
      const j = idx + dir;
      if (j < 0 || j >= next.length) return list;
      const tmp = next[idx];
      next[idx] = next[j];
      next[j] = tmp;
      return next;
    });
  };

  const renumber = () => {
    setEditRows(list => list.map((r, i) => ({ ...r, startnummer: i + 1 })));
    // markeer alles gewijzigd
    setChanged(new Set(editRows.map(r => r.id)));
    setMsg("Startnummers hernummerd (nog niet opgeslagen).");
  };

  const saveChanges = async () => {
    if (!changed.size) {
      setMsg("Geen wijzigingen om op te slaan.");
      return;
    }
    setBusy(true);
    setErr("");
    setMsg("");
    try {
      const toSave = editRows
        .filter(r => changed.has(r.id))
        .map(r => ({
          id: r.id,
          wedstrijd_id: r.wedstrijd_id,
          klasse: r.klasse || null,
          categorie: r.categorie || nul
