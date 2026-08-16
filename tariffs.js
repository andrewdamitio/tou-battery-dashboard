// ---------------------------------------------------------------------------
// tariffs.js — rate structures, battery specs, appliance specs
//
// Every number here is an INPUT ASSUMPTION, not a model output. Rates were
// hand-keyed from utility tariff sheets; `asOf` records the vintage. Nothing
// in this file is auto-refreshed, so treat a stale `asOf` as a reason to
// re-check before underwriting anything on it.
// ---------------------------------------------------------------------------

export const hrs = (a, b) => {
  const o = [];
  for (let h = a; h < b; h++) o.push(h % 24);
  return o;
};

// ---------------------------------------------------------------------------
// TARIFFS
//
// Period model: each season has `peak`, optional `partial`, and everything
// else is off-peak. `superOff` is an optional cheaper block used preferentially
// for charging. Rates in ¢/kWh, all-in volumetric (generation + delivery).
//
// `partial: null` means the tariff HAS a partial-peak period we haven't keyed
// in. That is a two-period approximation and it understates savings — the
// battery is credited nothing for discharging into partial-peak. Flagged in
// the UI as `approx: true`.
// ---------------------------------------------------------------------------

const CA_SUMMER = [5, 6, 7, 8]; // Jun–Sep
const BROAD_SUMMER = [4, 5, 6, 7, 8]; // May–Sep

export const PLANS = [
  {
    id: "cus", n: "Custom plan", st: "—", ev: false, custom: true, asOf: "user-defined",
    summerMonths: BROAD_SUMMER, weekdayOnly: false,
    s: { peak: hrs(16, 21), partial: null, rPeak: 30, rPartial: 0, rOff: 10, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(16, 21), partial: null, rPeak: 25, rPartial: 0, rOff: 10, superOff: null, rSuperOff: 0 },
    fixed: 0,
  },
  {
    id: "sdr", n: "SDG&E TOU-DR1", st: "CA", ev: false, asOf: "mid-2026", approx: true,
    summerMonths: BROAD_SUMMER, weekdayOnly: false,
    s: { peak: hrs(16, 21), partial: null, rPeak: 68, rPartial: 0, rOff: 33, superOff: hrs(0, 6), rSuperOff: 31 },
    w: { peak: hrs(16, 21), partial: null, rPeak: 42, rPartial: 0, rOff: 31, superOff: hrs(0, 6), rSuperOff: 29 },
    fixed: 0, phLabel: "4–9 PM daily",
    cpp: { adder: 50, ev: 12, mn: 1, mx: 18, n: "TOU-DR-P", src: "Up to 18/yr per SDG&E" },
  },
  {
    id: "se5", n: "SDG&E EV-TOU-5", st: "CA", ev: true, asOf: "mid-2026", approx: true,
    summerMonths: BROAD_SUMMER, weekdayOnly: false,
    s: { peak: hrs(16, 21), partial: null, rPeak: 71.1, rPartial: 0, rOff: 12, superOff: hrs(0, 6), rSuperOff: 11 },
    w: { peak: hrs(16, 21), partial: null, rPeak: 47.8, rPartial: 0, rOff: 11.4, superOff: hrs(0, 6), rSuperOff: 10.5 },
    fixed: 16, phLabel: "4–9 PM daily",
    cpp: { adder: 50, ev: 12, mn: 1, mx: 18, n: "EV-TOU-5-P", src: "Up to 18/yr per SDG&E" },
  },
  {
    id: "pe2", n: "PG&E EV2-A", st: "CA", ev: true, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: false,
    s: { peak: hrs(16, 21), partial: [15, 21, 22, 23], rPeak: 54, rPartial: 47, rOff: 23, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(16, 21), partial: [15, 21, 22, 23], rPeak: 41, rPartial: 37, rOff: 23, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "4–9 PM daily, partial 3–4 PM & 9 PM–midnight",
    cpp: { adder: 60, ev: 12, mn: 9, mx: 15, n: "SmartRate", src: "9–15/yr per PG&E" },
  },
  {
    id: "rel", n: "Reliant Free Nights", st: "TX", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: false,
    s: { peak: hrs(6, 21), partial: null, rPeak: 27.9, rPartial: 0, rOff: 0, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(6, 21), partial: null, rPeak: 27.9, rPartial: 0, rOff: 0, superOff: null, rSuperOff: 0 },
    fixed: 9.95, phLabel: "6 AM–9 PM (free 9 PM–6 AM)",
  },
  {
    id: "txu", n: "TXU Free Nights", st: "TX", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: false,
    s: { peak: hrs(6, 21), partial: null, rPeak: 25, rPartial: 0, rOff: 0, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(6, 21), partial: null, rPeak: 25, rPartial: 0, rOff: 0, superOff: null, rSuperOff: 0 },
    fixed: 9.95, phLabel: "6 AM–9 PM (free 9 PM–6 AM)",
  },
  {
    id: "aps", n: "APS R-TOU-E", st: "AZ", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: true,
    s: { peak: hrs(15, 20), partial: null, rPeak: 34.4, rPartial: 0, rOff: 12.3, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(15, 20), partial: null, rPeak: 32.5, rPartial: 0, rOff: 3.5, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "3–8 PM weekdays",
  },
  {
    id: "sce", n: "SCE TOU-D-PRIME", st: "CA", ev: false, asOf: "mid-2026", approx: true,
    summerMonths: CA_SUMMER, weekdayOnly: false,
    s: { peak: hrs(16, 21), partial: null, rPeak: 58, rPartial: 0, rOff: 25, superOff: hrs(0, 6), rSuperOff: 22 },
    w: { peak: hrs(16, 21), partial: null, rPeak: 38, rPartial: 0, rOff: 25, superOff: hrs(0, 6), rSuperOff: 22 },
    fixed: 24, phLabel: "4–9 PM daily",
    cpp: { adder: 80, ev: 12, mn: 1, mx: 12, n: "PRIME-CPP", src: "Max 12/yr per CPUC" },
  },
  {
    id: "pel", n: "PG&E E-ELEC", st: "CA", ev: false, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: false,
    s: { peak: hrs(16, 21), partial: [15, 21, 22, 23], rPeak: 57, rPartial: 48, rOff: 31, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(16, 21), partial: [15, 21, 22, 23], rPeak: 41, rPartial: 37, rOff: 31, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "4–9 PM daily, partial 3–4 PM & 9 PM–midnight",
    cpp: { adder: 60, ev: 12, mn: 9, mx: 15, n: "SmartRate", src: "9–15/yr per PG&E" },
  },
  {
    id: "fpl", n: "FPL TOU", st: "FL", ev: false, asOf: "mid-2026",
    summerMonths: [3, 4, 5, 6, 7, 8, 9], weekdayOnly: true,
    s: { peak: hrs(12, 21), partial: null, rPeak: 26, rPartial: 0, rOff: 9, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(6, 10).concat(hrs(18, 22)), partial: null, rPeak: 26, rPartial: 0, rOff: 9, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "Noon–9 PM weekdays (summer); split peak winter",
  },
  {
    id: "psg", n: "PSEG-LI 195", st: "NY", ev: false, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: true,
    s: { peak: hrs(10, 22), partial: null, rPeak: 38, rPartial: 0, rOff: 12, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(10, 22), partial: null, rPeak: 22, rPartial: 0, rOff: 12, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "10 AM–10 PM weekdays",
  },
  {
    id: "con", n: "ConEd SC-1 II", st: "NY", ev: false, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: true,
    s: { peak: hrs(8, 22), partial: null, rPeak: 35, rPartial: 0, rOff: 15, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(8, 22), partial: null, rPeak: 25, rPartial: 0, rOff: 15, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "8 AM–10 PM weekdays",
  },
  {
    id: "xce", n: "Xcel CO TOU", st: "CO", ev: false, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: true,
    s: { peak: hrs(15, 20), partial: null, rPeak: 28, rPartial: 0, rOff: 10, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(15, 20), partial: null, rPeak: 18, rPartial: 0, rOff: 10, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "3–8 PM weekdays",
  },
  {
    id: "smu", n: "SMUD ToD", st: "CA", ev: false, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: false,
    s: { peak: hrs(17, 20), partial: hrs(12, 17), rPeak: 37.65, rPartial: 19.5, rOff: 12.85, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(17, 20), partial: null, rPeak: 17.76, rPartial: 0, rOff: 12.85, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "5–8 PM daily, mid-peak noon–5 PM summer",
    cpp: { adder: 50, ev: 15, mn: 1, mx: 25, n: "SMUD CPP", src: "Max 50 hrs/summer" },
  },
  {
    id: "duk", n: "Duke NC Solar", st: "NC", ev: false, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: true,
    s: { peak: hrs(15, 19), partial: null, rPeak: 21, rPartial: 0, rOff: 11, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(15, 19), partial: null, rPeak: 16, rPartial: 0, rOff: 11, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "3–7 PM weekdays",
  },
  {
    id: "ced", n: "ComEd Hourly (approx.)", st: "IL", ev: false, asOf: "mid-2026", approx: true,
    summerMonths: BROAD_SUMMER, weekdayOnly: true,
    s: { peak: hrs(15, 20), partial: null, rPeak: 20, rPartial: 0, rOff: 7, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(15, 20), partial: null, rPeak: 16, rPartial: 0, rOff: 7, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "Dynamic hourly — modeled as a fixed 3–8 PM block",
  },
  {
    id: "pge", n: "PGE Time of Day", st: "OR", ev: false, asOf: "mid-2026",
    summerMonths: [4, 5, 6, 7, 8, 9], weekdayOnly: true,
    s: { peak: hrs(17, 21), partial: hrs(6, 17), rPeak: 43.65, rPartial: 16.89, rOff: 9.01, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(17, 21), partial: hrs(6, 17), rPeak: 43.65, rPartial: 16.89, rOff: 9.01, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "5–9 PM weekdays, mid-peak 6 AM–5 PM",
  },
  {
    id: "srp", n: "SRP E-27 TOU", st: "AZ", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: true,
    s: { peak: hrs(15, 20), partial: null, rPeak: 28, rPartial: 0, rOff: 7.5, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(15, 20), partial: null, rPeak: 13.5, rPartial: 0, rOff: 7.5, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "3–8 PM weekdays",
  },
  {
    id: "nve", n: "NV Energy TOU-D-1", st: "NV", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: true,
    s: { peak: hrs(13, 19), partial: null, rPeak: 23.5, rPartial: 0, rOff: 8.5, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(13, 19), partial: null, rPeak: 13, rPartial: 0, rOff: 8.5, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "1–7 PM weekdays",
  },
  {
    id: "heco", n: "HECO TOU-R", st: "HI", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: false,
    s: { peak: hrs(17, 21), partial: null, rPeak: 54, rPartial: 0, rOff: 28, superOff: hrs(9, 17), rSuperOff: 22 },
    w: { peak: hrs(17, 21), partial: null, rPeak: 54, rPartial: 0, rOff: 28, superOff: hrs(9, 17), rSuperOff: 22 },
    fixed: 0, phLabel: "5–9 PM daily",
  },
  {
    id: "rmp", n: "Rocky Mountain Power R-TO", st: "UT", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: true,
    s: { peak: hrs(14, 20), partial: null, rPeak: 16.5, rPartial: 0, rOff: 7.8, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(14, 20), partial: null, rPeak: 10.5, rPartial: 0, rOff: 7.8, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "2–8 PM weekdays",
  },
  {
    id: "ipco", n: "Idaho Power TOD-I", st: "ID", ev: false, asOf: "mid-2026",
    summerMonths: [5, 6, 7, 8], weekdayOnly: true,
    s: { peak: hrs(15, 21), partial: null, rPeak: 16, rPartial: 0, rOff: 6.5, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(15, 21), partial: null, rPeak: 10, rPartial: 0, rOff: 6.5, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "3–9 PM weekdays",
  },
  {
    id: "dom", n: "Dominion DOM-TOU", st: "VA", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: true,
    s: { peak: hrs(18, 21), partial: null, rPeak: 21, rPartial: 0, rOff: 7.5, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(18, 21), partial: null, rPeak: 10.5, rPartial: 0, rOff: 7.5, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "6–9 PM weekdays",
  },
  {
    id: "gpc", n: "Georgia Power TOU-RD", st: "GA", ev: false, asOf: "mid-2026",
    summerMonths: [5, 6, 7, 8], weekdayOnly: true,
    s: { peak: hrs(14, 19), partial: null, rPeak: 24, rPartial: 0, rOff: 6.5, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(14, 19), partial: null, rPeak: 8.5, rPartial: 0, rOff: 6.5, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "2–7 PM weekdays",
  },
  {
    id: "evsma", n: "Eversource MA TOU", st: "MA", ev: false, asOf: "mid-2026",
    summerMonths: CA_SUMMER, weekdayOnly: true,
    s: { peak: hrs(9, 20), partial: null, rPeak: 31, rPartial: 0, rOff: 16.5, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(9, 20), partial: null, rPeak: 26, rPartial: 0, rOff: 14, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "9 AM–8 PM weekdays",
  },
  {
    id: "teco", n: "Tampa Electric TOU", st: "FL", ev: false, asOf: "mid-2026",
    summerMonths: [3, 4, 5, 6, 7, 8, 9], weekdayOnly: true,
    s: { peak: hrs(11, 21), partial: null, rPeak: 20.5, rPartial: 0, rOff: 7.5, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(11, 21), partial: null, rPeak: 10.5, rPartial: 0, rOff: 7.5, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "11 AM–9 PM weekdays",
  },
  {
    id: "pse", n: "Puget Sound Energy TOU", st: "WA", ev: false, asOf: "mid-2026",
    summerMonths: BROAD_SUMMER, weekdayOnly: false,
    s: { peak: hrs(18, 21), partial: null, rPeak: 17.5, rPartial: 0, rOff: 9, superOff: null, rSuperOff: 0 },
    w: { peak: hrs(18, 21), partial: null, rPeak: 17.5, rPartial: 0, rOff: 9, superOff: null, rSuperOff: 0 },
    fixed: 0, phLabel: "6–9 PM daily",
  },
];

// ---------------------------------------------------------------------------
// BATTERIES
//
//   kw   usable energy, kWh          pw   continuous AC output, kW
//   sg   surge output, kW            ck   AC charge input rate, kW
//   vo   output voltage              cyc  rated cycles to 80% capacity
//   pnl  (retained for reference) unit supports a transfer switch. Not modeled:
//        subpanel install is ~$1,500-4,000 and converts the unit into an
//        interconnected ESS, which is the category this business avoids.
//
// pw / vo / kw are manufacturer spec. sg, ck, cyc are ESTIMATES from spec
// sheets and chemistry class — treat cyc especially as an assumption, since
// warranty cycle counts are quoted at different depth-of-discharge and
// temperature conditions across vendors.
// ---------------------------------------------------------------------------

export const BATTERIES = [
  { id: "j1", n: "Jackery 1000v2",        kw: 1.07, c: 800,  pw: 1.5,  sg: 3.0,  ck: 1.5, vo: 120, ct: "s", chem: "LFP", cyc: 3000, pnl: false },
  { id: "ac", n: "Anker SOLIX C1000",     kw: 1.06, c: 700,  pw: 1.8,  sg: 2.4,  ck: 1.3, vo: 120, ct: "s", chem: "LFP", cyc: 3000, pnl: false },
  { id: "p1", n: "Pila base",             kw: 1.6,  c: 1299, pw: 2.4,  sg: 3.6,  ck: 1.2, vo: 120, ct: "s", chem: "LFP", cyc: 4000, pnl: false },
  { id: "al", n: "Bluetti AC200L",        kw: 2.05, c: 1000, pw: 2.4,  sg: 3.6,  ck: 1.2, vo: 120, ct: "m", chem: "LFP", cyc: 3500, pnl: false },
  { id: "j2", n: "Jackery 2000 Plus",     kw: 2.04, c: 1999, pw: 3.0,  sg: 6.0,  ck: 1.5, vo: 120, ct: "m", chem: "LFP", cyc: 4000, pnl: false },
  { id: "gz", n: "Goal Zero Yeti 3000X",  kw: 3.03, c: 2700, pw: 2.0,  sg: 3.5,  ck: 0.6, vo: 120, ct: "m", chem: "NMC", cyc: 500,  pnl: false },
  { id: "p2", n: "Pila + 1 Expansion",    kw: 3.2,  c: 2498, pw: 4.8,  sg: 7.2,  ck: 1.2, vo: 120, ct: "m", chem: "LFP", cyc: 4000, pnl: false },
  { id: "af", n: "Anker SOLIX F3800",     kw: 3.84, c: 2500, pw: 6.0,  sg: 9.0,  ck: 1.8, vo: 240, ct: "l", chem: "LFP", cyc: 3000, pnl: true  },
  { id: "ed", n: "EcoFlow Delta Pro 3",   kw: 4.0,  c: 2000, pw: 3.6,  sg: 7.2,  ck: 1.8, vo: 120, ct: "l", chem: "LFP", cyc: 4000, pnl: true  },
  { id: "p3", n: "Pila + 2 Expansion",    kw: 4.8,  c: 3697, pw: 7.2,  sg: 10.8, ck: 1.2, vo: 120, ct: "l", chem: "LFP", cyc: 4000, pnl: false },
  { id: "a5", n: "Bluetti AC500+B300S",   kw: 5.12, c: 2400, pw: 5.0,  sg: 10.0, ck: 3.0, vo: 240, ct: "l", chem: "LFP", cyc: 3500, pnl: true  },
  { id: "eu", n: "EcoFlow Delta Pro Ultra", kw: 6.0, c: 3500, pw: 7.2, sg: 14.4, ck: 2.9, vo: 240, ct: "l", chem: "LFP", cyc: 4000, pnl: true },
  { id: "a3", n: "Bluetti AC300+2xB300",  kw: 6.14, c: 3300, pw: 3.0,  sg: 6.0,  ck: 3.0, vo: 240, ct: "x", chem: "LFP", cyc: 3500, pnl: true  },
  { id: "f2", n: "Anker F3800 x2",        kw: 7.68, c: 4900, pw: 12.0, sg: 18.0, ck: 3.6, vo: 240, ct: "x", chem: "LFP", cyc: 3000, pnl: true  },
  { id: "ep", n: "Bluetti EP900+B500",    kw: 9.92, c: 6500, pw: 9.0,  sg: 13.5, ck: 3.0, vo: 240, ct: "x", chem: "LFP", cyc: 3500, pnl: true  },
];

export const BAT_CLASSES = [
  { id: "s", n: "Small (1–2 kWh)" },
  { id: "m", n: "Medium (2–3.5 kWh)" },
  { id: "l", n: "Large (3.5–6 kWh)" },
  { id: "x", n: "X-Large (6+ kWh)" },
];

// ---------------------------------------------------------------------------
// DIURNAL PROFILES
// 24-length arrays, normalized to sum to 1. Multiplied by kwRun * hrsDay to
// get hourly kWh. These are shapes, not measurements — a metered sample would
// replace them, and should if you ever get one.
// ---------------------------------------------------------------------------

const norm = (a) => { const s = a.reduce((x, y) => x + y, 0); return a.map((x) => x / s); };
const build = (spec) => { const a = Array(24).fill(0); Object.entries(spec).forEach(([h, v]) => { a[+h] = v; }); return norm(a); };
const span = (a, b, v = 1) => { const o = {}; for (let h = a; h < b; h++) o[h % 24] = v; return o; };

export const PROFILES = {
  // Flat — always-on loads
  flat: norm(Array(24).fill(1)),
  // Cooling — tracks outdoor temperature, lags solar noon, peaks 4–7 PM
  cooling: build({ 0: .3, 1: .25, 2: .2, 3: .2, 4: .2, 5: .2, 6: .25, 7: .35, 8: .5, 9: .65, 10: .8, 11: .95, 12: 1.1, 13: 1.25, 14: 1.4, 15: 1.5, 16: 1.55, 17: 1.5, 18: 1.35, 19: 1.1, 20: .85, 21: .65, 22: .5, 23: .4 }),
  // Heating — bimodal, morning and evening
  heating: build({ 0: .5, 1: .45, 2: .45, 3: .5, 4: .6, 5: .9, 6: 1.3, 7: 1.4, 8: 1.1, 9: .7, 10: .5, 11: .4, 12: .4, 13: .4, 14: .45, 15: .6, 16: .9, 17: 1.3, 18: 1.5, 19: 1.4, 20: 1.2, 21: 1.0, 22: .8, 23: .6 }),
  // Evening — occupancy-driven
  evening: build({ 6: .3, 7: .5, 8: .3, 9: .2, 10: .2, 11: .25, 12: .3, 13: .25, 14: .25, 15: .35, 16: .6, 17: 1.0, 18: 1.4, 19: 1.5, 20: 1.4, 21: 1.1, 22: .7, 23: .4 }),
  // Cooking — sharp morning and dinner peaks
  cooking: build({ 6: .3, 7: .7, 8: .4, 12: .5, 13: .3, 16: .6, 17: 1.4, 18: 1.6, 19: .9, 20: .3 }),
  // Chores — laundry/dishes, afternoon and evening
  chores: build({ 9: .5, 10: .7, 11: .7, 12: .5, 13: .5, 14: .5, 15: .6, 16: .7, 17: .8, 18: 1.0, 19: 1.2, 20: 1.1, 21: .8, 22: .5 }),
  // Overnight — default EV / water heater timer behavior
  overnight: build({ ...span(22, 24), ...span(0, 7) }),
  // Plug-in-on-arrival — EV plugged in at 6 PM with no timer
  evNoTimer: build({ 18: 1, 19: 1, 20: 1, 21: 1, 22: .8, 23: .6, 0: .4, 1: .2 }),
  // Daytime — pool pumps, workshop
  daytime: build({ ...span(9, 18) }),
};

// ---------------------------------------------------------------------------
// APPLIANCES
//
//   kwRun  running (nameplate) power draw, kW — NOT average over the window
//   hrsDay total run-hours on a typical day
//   sg     inrush / locked-rotor surge, kW
//   volts  120 or 240
//   cord   true if the load is genuinely cord-and-plug connected. A plug-in
//          battery can only serve cord loads unless the household installs a
//          transfer switch or critical-loads subpanel.
//   szf    optional function of sq ft, overrides kwRun
//   season 'all' | 's' | 'w'
// ---------------------------------------------------------------------------

export const APPLIANCE_CATS = [
  { t: "Always running", i: [
    { id: "xfr", n: "Extra fridge/freezer", kwRun: 0.15, hrsDay: 8,  sg: 0.9, volts: 120, cord: true,  prof: "flat",    season: "all" },
    { id: "aq",  n: "Aquarium/pet",         kwRun: 0.08, hrsDay: 10, sg: 0.2, volts: 120, cord: true,  prof: "flat",    season: "all" },
    { id: "sp",  n: "Sump pump",            kwRun: 0.6,  hrsDay: 0.7,sg: 2.4, volts: 120, cord: true,  prof: "flat",    season: "all" },
  ]},
  { t: "Cooling (summer)", i: [
    { id: "wac", n: "Window AC",            kwRun: 1.2,  hrsDay: 7,  sg: 3.6, volts: 120, cord: true,  prof: "cooling", season: "s" },
    { id: "pac", n: "Portable AC",          kwRun: 1.1,  hrsDay: 6,  sg: 3.3, volts: 120, cord: true,  prof: "cooling", season: "s" },
    { id: "cac", n: "Central AC",           szf: (q) => Math.max(2.5, 0.0022 * q), hrsDay: 8, sgMult: 3, volts: 240, cord: false, prof: "cooling", season: "s" },
    { id: "fan", n: "Ceiling/box fans",     kwRun: 0.06, hrsDay: 10, sg: 0.1, volts: 120, cord: true,  prof: "evening", season: "s" },
    { id: "deh", n: "Dehumidifier",         kwRun: 0.6,  hrsDay: 9,  sg: 1.8, volts: 120, cord: true,  prof: "flat",    season: "s" },
  ]},
  { t: "Heating (winter)", i: [
    { id: "sh",  n: "Space heater",         kwRun: 1.5,  hrsDay: 5,  sg: 1.5, volts: 120, cord: true,  prof: "heating", season: "w" },
    { id: "hp",  n: "Heat pump",            szf: (q) => Math.max(2.0, 0.0018 * q), hrsDay: 9, sgMult: 3, volts: 240, cord: false, prof: "heating", season: "w" },
    { id: "wh",  n: "Electric water heater",kwRun: 4.5,  hrsDay: 3,  sg: 4.5, volts: 240, cord: false, prof: "evening", season: "all" },
    { id: "eb",  n: "Electric blanket",     kwRun: 0.15, hrsDay: 7,  sg: 0.15,volts: 120, cord: true,  prof: "overnight", season: "w" },
  ]},
  { t: "Cooking & laundry", i: [
    { id: "ck",  n: "Electric cooktop",     kwRun: 2.2,  hrsDay: 0.8,sg: 2.2, volts: 240, cord: false, prof: "cooking", season: "all" },
    { id: "ov",  n: "Electric oven",        kwRun: 2.8,  hrsDay: 0.7,sg: 2.8, volts: 240, cord: false, prof: "cooking", season: "all" },
    { id: "mw",  n: "Microwave/kettle",     kwRun: 1.2,  hrsDay: 0.4,sg: 1.5, volts: 120, cord: true,  prof: "cooking", season: "all" },
    { id: "dw",  n: "Dishwasher",           kwRun: 0.9,  hrsDay: 1.4,sg: 1.2, volts: 120, cord: true,  prof: "chores",  season: "all" },
    { id: "ws",  n: "Washing machine",      kwRun: 0.5,  hrsDay: 1,  sg: 1.5, volts: 120, cord: true,  prof: "chores",  season: "all" },
    { id: "dr",  n: "Electric dryer",       kwRun: 3.5,  hrsDay: 1,  sg: 3.5, volts: 240, cord: false, prof: "chores",  season: "all" },
  ]},
  { t: "Entertainment & work", i: [
    { id: "tv",  n: "TV",                   kwRun: 0.12, hrsDay: 5,  sg: 0.2, volts: 120, cord: true,  prof: "evening", season: "all" },
    { id: "pc",  n: "Computer/monitor",     kwRun: 0.15, hrsDay: 7,  sg: 0.3, volts: 120, cord: true,  prof: "daytime", season: "all" },
    { id: "gm",  n: "Gaming PC",            kwRun: 0.45, hrsDay: 3,  sg: 0.7, volts: 120, cord: true,  prof: "evening", season: "all" },
  ]},
  { t: "Outdoor & recreation", i: [
    { id: "pp",  n: "Pool pump",            kwRun: 1.1,  hrsDay: 7,  sg: 3.3, volts: 240, cord: false, prof: "daytime", season: "s" },
    { id: "ht",  n: "Hot tub",              kwRun: 4.0,  hrsDay: 2,  sg: 4.0, volts: 240, cord: false, prof: "evening", season: "all" },
    { id: "sa",  n: "Electric sauna",       kwRun: 4.5,  hrsDay: 1,  sg: 4.5, volts: 240, cord: false, prof: "evening", season: "all" },
    { id: "wk",  n: "Workshop/tools",       kwRun: 1.0,  hrsDay: 1,  sg: 3.0, volts: 120, cord: true,  prof: "daytime", season: "all" },
  ]},
  { t: "EV charging", i: [
    { id: "e1",  n: "EV Level 1 (1.4 kW)",  kwRun: 1.4,  hrsDay: 8,  sg: 1.4, volts: 120, cord: true,  prof: "evNoTimer", season: "all" },
    { id: "e2",  n: "EV Level 2 (7.7 kW)",  kwRun: 7.7,  hrsDay: 3.5,sg: 7.7, volts: 240, cord: true,  prof: "overnight", season: "all" },
  ]},
];

export const ALL_APPLIANCES = APPLIANCE_CATS.flatMap((c) => c.i);

// Always-on house baseline (lighting, standby, main fridge, networking).
// Roughly 0.09 kW plus 0.00013 kW/sq ft, shaped to the evening.
export const baselineKw = (sq) => 0.09 + 0.00013 * sq;

export const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

// ---------------------------------------------------------------------------
// DEMAND RESPONSE PROGRAMS
//
//   basis: 'baseline'  — paid on measured reduction vs a rolling similar-day
//                        baseline. SUBJECT TO EROSION: a battery that shaves
//                        every day lowers its own baseline and the payment
//                        decays toward zero.
//          'avoidance' — bill avoidance against a published adder. Immune to
//                        erosion; stacks cleanly with daily TOU shaving.
//          'indirect'  — value arrives through supply rates, not a direct
//                        payment. Requires a passthrough tariff to monetize.
// ---------------------------------------------------------------------------

export const DR_PROGRAMS = [
  { id: "elrp", n: "CA ELRP (aggregator)", basis: "baseline", rate: 2.00, events: 12, hoursPerEvent: 3, st: ["CA"],
    note: "California's emergency grid-response program. Pays $2/kWh for verified load reduction during CAISO emergencies, May–Oct, up to 60 hrs/yr. Requires an aggregator to enroll a fleet. Live through 2027." },
  { id: "ptr", n: "Peak Time Rebates", basis: "baseline", rate: 1.10, events: 12, hoursPerEvent: 3, st: ["OR", "MD", "MI", "DE", "IL"],
    note: "A utility credit for using less than your own recent average during announced peak events — $1.00–$1.25/kWh, meter-based, no specific hardware required. Live in OR, MD, MI, DE, and IL." },
  { id: "cpp", n: "CPP / CPP overlay", basis: "avoidance", rate: null, events: null, hoursPerEvent: null, st: null,
    note: "An overlay on a TOU rate: the price jumps 50–80¢/kWh on a handful of declared days a year, and the battery avoids paying it by covering the load through the event. Bill avoidance, not a rebate — nothing to erode. Rate and event count depend on the selected tariff." },
  { id: "cpk", n: "PJM capacity tag (5CP)", basis: "indirect", rate: null, events: 5, hoursPerEvent: 1, st: ["IL", "MD", "VA", "DE"],
    note: "Your capacity charge is set by usage during a handful of the grid's highest-demand hours each summer. Avoiding those hours lowers that charge — but only on rate plans that pass capacity costs through directly (e.g. ComEd Hourly), so most residential customers can't actually capture it. Live in IL, MD, VA, and DE." },
  { id: "whl", n: "Wholesale aggregation (Order 2222)", basis: "indirect", rate: null, events: null, hoursPerEvent: null, st: ["CA", "NY"],
    note: "Lets a fleet of small batteries bid into wholesale electricity markets as one combined resource, via an aggregator — something only large power plants could do before. Live in CAISO and NYISO; other grid operators are still years out. Payment terms are negotiated case by case, not published." },
];

export const HARDWIRED_ONLY = [
  { n: "ConnectedSolutions (MA/NH/RI)", v: "$225–$275/kW-summer, +$50/kW-winter; ConnectedSolutions+ pilot to $400/kW (Jun 2026). CT closed to new enrollment Dec 2023." },
  { n: "ConEd BYOB (NY)", v: "$100/kW seasonal average performance; approved service providers only." },
  { n: "PSEG-LI Battery Storage Rewards (NY)", v: "$250/kWh upfront, cap $6,250; ~10 events/yr May–Sep." },
  { n: "SRP Battery Partner (AZ)", v: "$110/kW-yr." },
  { n: "Duke PowerPair / Battery Control (NC)", v: "~$6.50/kW-mo." },
  { n: "Rocky Mountain Power Wattsmart (UT)", v: "$1,000 upfront + $15/kW-yr as restructured mid-2026." },
  { n: "HECO BYOD+ (HI)", v: "Export credits; requires interconnected ESS." },
];
