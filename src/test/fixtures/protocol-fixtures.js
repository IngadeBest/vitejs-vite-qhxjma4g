// Test fixtures voor protocol PDF generatie

export const fixture_we0_dressuur = {
  protocol: {
    onderdeel: "dressuur",
    klasse: "we0",
    klasse_naam: "Introductieklasse (WE0)",
    wedstrijd_naam: "Test Wedstrijd 2025",
    datum: "2025-01-15",
    jury: "J. de Vries",
    ruiter: "Anna Bakker",
    paard: "Stormwind",
    startnummer: "001",
    max_score: 100,
    onderdeel_label: "Dressuur"
  },
  items: [
    ["A-X", "Binnenkomen in arbeidsdraf", "", "Zuiverheid, takt"],
    ["X", "Halthouden en groeten", "", "Halt kwaliteit"],
    ["", "Gangen, Takt, regelmaat, ritme", "", ""],
    ["", "Impuls, Losgelatenheid", "", ""],
  ]
};

export const fixture_we1_stijl = {
  protocol: {
    onderdeel: "stijl",
    klasse: "we1",
    klasse_naam: "WE1",
    wedstrijd_naam: "Lente Trail 2025",
    datum: "2025-03-20",
    jury: "M. Peters",
    ruiter: "Jan Smit",
    paard: "Bella",
    startnummer: "102",
    max_score: 80,
    onderdeel_label: "Stijltrail"
  },
  items: [
    "Acht om twee vaten",
    "Brug",
    "Parallelslalom",
    "Slalom",
    "3 vaten",
  ]
};

export const fixture_we2_speed = {
  protocol: {
    onderdeel: "speed",
    klasse: "we2",
    klasse_naam: "WE2",
    wedstrijd_naam: "Zomer Speed Trail",
    datum: "2025-07-10",
    jury: "P. van Dam",
    ruiter: "Sophie de Jong",
    paard: "Thunder",
    startnummer: "205",
    max_score: null,
    onderdeel_label: "Speedtrail"
  },
  items: [
    ["Slalom", "1 sec per paal"],
    ["Sprong", "3 sec weigering"],
    ["3 vaten", "2 sec per vat"],
    ["Poort", "5 sec niet door poort"],
  ]
};

export const fixture_we3_dressuur = {
  protocol: {
    onderdeel: "dressuur",
    klasse: "we3",
    klasse_naam: "WE3",
    wedstrijd_naam: "Herfst Dressuur",
    datum: "2025-10-05",
    jury: "K. Jansen",
    ruiter: "Laura Visser",
    paard: "Midnight Star",
    startnummer: "303",
    max_score: 120,
    onderdeel_label: "Dressuur"
  },
  items: [
    ["A", "Binnen rijden stap", "", "Ontspanning"],
    ["X", "Halt, groet", "", "Kwaliteit halt"],
    ["C", "Rechterhand", "", "Zuiverheid"],
    ["", "Gehoorzaamheid en harmonie", "", ""],
  ]
};

export const fixture_jeugd_we1_stijl = {
  protocol: {
    onderdeel: "stijl",
    klasse: "we1",
    klasse_naam: "WE1 - Jeugd",
    wedstrijd_naam: "Jeugd Trail Kampioenschap",
    datum: "2025-06-15",
    jury: "S. Mulder",
    ruiter: "Emma de Groot",
    paard: "Pippin",
    startnummer: "151",
    max_score: 75,
    onderdeel_label: "Stijltrail"
  },
  items: [
    "Round pen links",
    "Round pen rechts",
    "Tafel met kan",
    "Gang met beker omzetten",
    "Door water rijden",
  ]
};

export const fixture_we2plus_dressuur = {
  protocol: {
    onderdeel: "dressuur",
    klasse: "we2+",
    klasse_naam: "WE2+",
    wedstrijd_naam: "Winter Dressuur Finale",
    datum: "2025-12-01",
    jury: "R. Bakker",
    ruiter: "Thomas van Dijk",
    paard: "Apollo",
    startnummer: "701",
    max_score: 110,
    onderdeel_label: "Dressuur"
  },
  items: [
    ["A-X-C", "Binnen rijden middendraf", "", "Takt en impuls"],
    ["C-M", "Slangenvolte 4 bogen", "", "Buiging"],
    ["", "Stap/galop/stap overgangen", "", ""],
    ["", "Artistieke presentatie", "", ""],
  ]
};
