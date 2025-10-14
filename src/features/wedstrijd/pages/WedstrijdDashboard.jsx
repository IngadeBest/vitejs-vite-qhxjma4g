import { useState, useMemo } from "react";
import { Card, CardContent } from "./ui/card";
import { Input } from "./ui/input";
import { Button } from "./ui/button";
import { supabase } from "@/lib/supabaseClient";

export default function WedstrijdDashboard() {
  const [entries, setEntries] = useState([]);
  const [form, setForm] = useState({ naam: "", paard: "", klasse: "WE1", land: "" });
  const [formError, setFormError] = useState("");
  const [scores, setScores] = useState({});
  const [scoreErrors, setScoreErrors] = useState({});
  const [maxScores, setMaxScores] = useState({ dressuur: 100, stijltrail: 100 });
  const [filterKlasse, setFilterKlasse] = useState("");
  const [wedstrijdDatum, setWedstrijdDatum] = useState(new Date().toISOString().split("T")[0]);

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
    setFormError("");
  };

  const handleAdd = () => {
    if (!form.naam || !form.paard || !form.klasse) {
      setFormError("Naam, paard en klasse zijn verplicht.");
      return;
    }

    const duplicate = entries.find((entry) => entry.naam === form.naam && entry.paard === form.paard && entry.klasse === form.klasse);
    if (duplicate) {
      setFormError("Deze combinatie van ruiter, paard en klasse bestaat al.");
      return;
    }

    const newEntry = { ...form };
    setEntries([...entries, newEntry]);
    setForm({ naam: "", paard: "", klasse: "WE1", land: "" });
    setFormError("");
  };

  const handleScoreChange = (index, field, key, value) => {
    const updated = { ...scores };
    const updatedErrors = { ...scoreErrors };
    if (!updated[index]) updated[index] = {};
    if (!updated[index][field]) updated[index][field] = { punten: 0, status: "ok" };

    if (key === "punten") {
      let input = parseFloat(value);
      if (field === "speedtrail") {
        if (input < 0) {
          updatedErrors[`${index}-${field}`] = "Tijd mag niet negatief zijn.";
          input = 0;
        } else {
          delete updatedErrors[`${index}-${field}`];
        }
        updated[index][field][key] = input || 0;
      } else {
        const max = maxScores[field] || 100;
        if (input < 0) {
          updatedErrors[`${index}-${field}`] = "Punten mogen niet negatief zijn.";
          input = 0;
        } else if (input > max) {
          updatedErrors[`${index}-${field}`] = `Maximaal ${max} punten toegestaan.`;
          input = max;
        } else {
          delete updatedErrors[`${index}-${field}`];
        }
        updated[index][field][key] = input || 0;
      }
    } else {
      updated[index][field][key] = value;
    }

    setScores(updated);
    setScoreErrors(updatedErrors);
  };

  const handleMaxScoreChange = (field, value) => {
    setMaxScores({ ...maxScores, [field]: parseFloat(value) || 0 });
  };

  const hasSpeedtrail = (klasse) => ["WE2", "WE3", "WE4"].includes(klasse);

  const klassement = useMemo(() => {
    const filteredEntries = filterKlasse ? entries.map((e, i) => ({ ...e, idx: i })).filter(e => e.klasse === filterKlasse) : entries.map((e, i) => ({ ...e, idx: i }));

    const speedtrailTijden = filteredEntries
      .filter(e => hasSpeedtrail(e.klasse))
      .map(e => {
        const tijd = scores[e.idx]?.speedtrail?.punten || Infinity;
        const status = scores[e.idx]?.speedtrail?.status || "ok";
        return { idx: e.idx, tijd, status };
      })
      .filter(e => e.status === "ok" && e.tijd < Infinity)
      .sort((a, b) => a.tijd - b.tijd);

    const speedtrailScores = {};
    speedtrailTijden.forEach((item, i) => {
      speedtrailScores[item.idx] = speedtrailTijden.length - i;
    });

    const totalScores = filteredEntries.map(({ idx }) => {
      const entryScores = scores[idx] || {};
      const entry = entries[idx];
      let total = 0;
      let maxTotal = 0;
      let dqCount = 0;
      let elimCount = 0;

      for (const onderdeel in entryScores) {
        const { punten = 0, status = "ok" } = entryScores[onderdeel] || {};
        if (status === "elim") elimCount++;
        else if (status === "dq") dqCount++;
        else if (onderdeel === "speedtrail") {
          total += speedtrailScores[idx] || 0;
          maxTotal += speedtrailTijden.length;
        } else {
          total += punten;
          maxTotal += maxScores[onderdeel] || 0;
        }
      }

      return {
        idx,
        total,
        maxTotal,
        dqCount,
        elimCount,
        disqualified: dqCount >= 3,
      };
    });

    totalScores.sort((a, b) => {
      if (a.disqualified !== b.disqualified) return a.disqualified ? 1 : -1;
      if (a.dqCount !== b.dqCount) return a.dqCount - b.dqCount;
      return b.total - a.total;
    });

    return totalScores.map((item, i) => {
      const entry = entries[item.idx];
      return {
        ...entry,
        score: item.total,
        max: item.maxTotal,
        percentage: item.maxTotal > 0 ? ((item.total / item.maxTotal) * 100).toFixed(2) : "-",
        dqCount: item.dqCount,
        elimCount: item.elimCount,
        disqualified: item.disqualified,
        plaats: i + 1,
      };
    });
  }, [entries, scores, maxScores, filterKlasse]);

  const inputClass = (value) => value ? "" : "border-red-500";

  return (
    <div className="p-6 space-y-6">
      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-bold mb-2">Ruiter Invoer</h2>
          <Input name="naam" placeholder="Naam ruiter" className={inputClass(form.naam)} value={form.naam} onChange={handleChange} />
          <Input name="paard" placeholder="Naam paard" className={inputClass(form.paard)} value={form.paard} onChange={handleChange} />
          <select name="klasse" className={`w-full border rounded px-2 py-1 ${inputClass(form.klasse)}`} value={form.klasse} onChange={handleChange}>
            <option value="WE Intro">WE Intro</option>
            <option value="WE1">WE1</option>
            <option value="WE2">WE2</option>
            <option value="WE3">WE3</option>
            <option value="WE4">WE4</option>
          </select>
          <Input name="land" placeholder="Land" value={form.land} onChange={handleChange} />
          {formError && <div className="text-red-500 text-sm">{formError}</div>}
          <Button onClick={handleAdd}>Toevoegen</Button>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-4">
          <h2 className="text-xl font-bold mb-2">Maximale Punten per Onderdeel</h2>
          {Object.entries(maxScores).filter(([key]) => key !== "speedtrail").map(([key, val]) => (
            <div key={key} className="flex items-center gap-2">
              <label className="w-24 capitalize">{key}</label>
            <Input key={key} type="number" value={val} onChange={(e) => handleMaxScoreChange(key, e.target.value)} placeholder={`Max ${key}`} />
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xl font-bold mb-2">Filter</h2>
          <select
            className="w-full border rounded px-2 py-1"
            value={filterKlasse}
            onChange={(e) => setFilterKlasse(e.target.value)}
          >
            <option value="">Alle klassen</option>
            <option value="WE Intro">WE Intro</option>
            <option value="WE1">WE1</option>
            <option value="WE2">WE2</option>
            <option value="WE3">WE3</option>
            <option value="WE4">WE4</option>
          </select>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xl font-bold mb-2">Klassement</h2>
          {klassement.map((item, i) => (
            <div key={i} className="border-b py-1">
              {item.plaats}. {item.naam} met {item.paard} ({item.klasse}) – {item.percentage}% {item.disqualified ? "(DSQ)" : ""}
            </div>
          ))}
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-4 space-y-2">
          <h2 className="text-xl font-bold mb-2">Tussenstand</h2>
          {klassement.map((item, i) => (
            <div key={i} className="text-sm">
              {item.plaats}. {item.naam} met {item.paard} ({item.klasse}) – Totaal: {item.score} / {item.max}
            </div>
          ))}
        </CardContent>
      </Card>

      {entries.map((entry, idx) => (
        <Card key={idx}>
          <CardContent className="p-4 space-y-2">
            <h2 className="font-semibold">{entry.naam} met {entry.paard} ({entry.klasse})</h2>
            {["dressuur", "stijltrail", ...(hasSpeedtrail(entry.klasse) ? ["speedtrail"] : [])].map((onderdeel) => (
              <div key={onderdeel} className="flex flex-col gap-1">
                <div className="flex gap-2 items-center">
                  <label className="w-32 capitalize">
                    {onderdeel === "speedtrail"
                      ? "Speedtrail (seconden)"
                      : `${onderdeel.charAt(0).toUpperCase() + onderdeel.slice(1)} (punten)`}
                  </label>
                  <Input
                    type="number"
                    placeholder={onderdeel === "speedtrail" ? "Tijd (s)" : "Punten"}
                    value={scores[idx]?.[onderdeel]?.punten || ""}
                    onChange={(e) => handleScoreChange(idx, onderdeel, "punten", e.target.value)}
                  />
                  <select
                    value={scores[idx]?.[onderdeel]?.status || "ok"}
                    onChange={(e) => handleScoreChange(idx, onderdeel, "status", e.target.value)}
                  >
                    <option value="ok">ok</option>
                    <option value="dq">DQ</option>
                    <option value="elim">ELIM</option>
                  </select>
                </div>
                {scoreErrors[`${idx}-${onderdeel}`] && (
                  <span className="text-red-500 text-xs">{scoreErrors[`${idx}-${onderdeel}`]}</span>
                )}
              </div>
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
