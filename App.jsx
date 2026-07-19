import { useState, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area, ResponsiveContainer, Legend, BarChart, Bar, Cell } from "recharts";

const CATS = [
  { t: "Always running", i: [
    { id: "xfr", n: "Extra fridge/freezer", k: 0.6, mx: 4 },
    { id: "aq", n: "Aquarium/pet", k: 0.25, mx: 5 },
    { id: "sp", n: "Sump/well pump", k: 0.4, mx: 2 },
  ]},
  { t: "Cooling (summer)", i: [
    { id: "wac", n: "Window AC", k: 2.5, mx: 6, s: true },
    { id: "pac", n: "Portable AC", k: 2, mx: 4, s: true },
    { id: "cac", n: "Central AC (zone)", sf: (q) => Math.max(3, 0.005 * q), mx: 3, s: true },
    { id: "fan", n: "Ceiling/box fans", k: 0.15, mx: 10, s: true },
    { id: "deh", n: "Dehumidifier", k: 1.5, mx: 3, s: true },
  ]},
  { t: "Heating (winter)", i: [
    { id: "sh", n: "Space heater", k: 4, mx: 5, w: true },
    { id: "hp", n: "Heat pump (zone)", sf: (q) => Math.max(2, 0.004 * q), mx: 3, w: true },
    { id: "wh", n: "Water heater", k: 1.5, mx: 2, dhrs: 0.5 },
    { id: "eb", n: "Electric blanket", k: 0.2, mx: 4, w: true },
  ]},
  { t: "Cooking & laundry", i: [
    { id: "ck", n: "Electric cooking", k: 2, mx: 3, dhrs: 1 },
    { id: "ov", n: "Oven (extended)", k: 3, mx: 2, dhrs: 1 },
    { id: "mw", n: "Microwave/kettle", k: 0.3, mx: 4, dhrs: 0.25 },
    { id: "dw", n: "Dishwasher", k: 1.5, mx: 2, dhrs: 1.5 },
    { id: "ws", n: "Washing machine", k: 1, mx: 2, dhrs: 1 },
    { id: "dr", n: "Electric dryer", k: 2.5, mx: 2, dhrs: 0.5 },
  ]},
  { t: "Entertainment & work", i: [
    { id: "tv", n: "TV", k: 0.4, mx: 4 },
    { id: "pc", n: "Computer/monitor", k: 0.4, mx: 6 },
    { id: "gm", n: "Gaming PC", k: 0.7, mx: 4 },
  ]},
  { t: "Outdoor & recreation", i: [
    { id: "pp", n: "Pool pump", k: 1.5, mx: 2, s: true, dhrs: 2 },
    { id: "ht", n: "Hot tub", k: 3, mx: 1, dhrs: 1 },
    { id: "sa", n: "Electric sauna", k: 4, mx: 1, dhrs: 1 },
    { id: "wk", n: "Workshop/tools", k: 1, mx: 2, dhrs: 1 },
  ]},
  { t: "EV charging", i: [
    { id: "e1", n: "EV Level 1 (1.4 kW)", k: 7, mx: 3 },
    { id: "e2", n: "EV Level 2 (7.7 kW)", k: 35, mx: 2, dhrs: 4.5 },
  ]},
];

const AA = CATS.flatMap((c) => c.i);

const BB = [
  { id: "j1", n: "Jackery 1000v2", kw: 1.07, c: 800, pw: 1.5, vo: 120, ct: "s", dg: 0.050 },
  { id: "ac", n: "Anker SOLIX C1000", kw: 1.06, c: 700, pw: 1.8, vo: 120, ct: "s", dg: 0.017 },
  { id: "p1", n: "Pila base", kw: 1.6, c: 1299, pw: 2.4, vo: 120, ct: "s", dg: 0.025 },
  { id: "al", n: "Bluetti AC200L", kw: 2.05, c: 1000, pw: 2.4, vo: 120, ct: "m", dg: 0.014 },
  { id: "j2", n: "Jackery 2000 Plus", kw: 2.04, c: 1999, pw: 3, vo: 120, ct: "m", dg: 0.013 },
  { id: "gz", n: "Goal Zero Yeti 3000X", kw: 3.03, c: 2700, pw: 2, vo: 120, ct: "m", dg: 0.100 },
  { id: "p2", n: "Pila + 1 Expansion", kw: 3.2, c: 2498, pw: 4.8, vo: 120, ct: "m", dg: 0.025 },
  { id: "af", n: "Anker SOLIX F3800", kw: 3.84, c: 2500, pw: 6, vo: 240, ct: "l", dg: 0.017 },
  { id: "ed", n: "EcoFlow Delta Pro 3", kw: 4, c: 2000, pw: 3.6, vo: 120, ct: "l", dg: 0.013 },
  { id: "p3", n: "Pila + 2 Expansion", kw: 4.8, c: 3697, pw: 7.2, vo: 120, ct: "l", dg: 0.025 },
  { id: "a5", n: "Bluetti AC500+B300S", kw: 5.12, c: 2400, pw: 5, vo: 240, ct: "l", dg: 0.014 },
  { id: "eu", n: "EcoFlow Delta Pro Ultra", kw: 6, c: 3500, pw: 7.2, vo: 240, ct: "l", dg: 0.013 },
  { id: "a3", n: "Bluetti AC300+2xB300", kw: 6.14, c: 3300, pw: 3, vo: 240, ct: "x", dg: 0.020 },
  { id: "f2", n: "Anker F3800 x2", kw: 7.68, c: 4900, pw: 12, vo: 240, ct: "x", dg: 0.017 },
  { id: "ep", n: "Bluetti EP900+B500", kw: 9.92, c: 6500, pw: 9, vo: 240, ct: "x", dg: 0.013 },
];

const BCT = [
  { id: "s", n: "Small (1–2 kWh)" },
  { id: "m", n: "Medium (2–3.5 kWh)" },
  { id: "l", n: "Large (3.5–6 kWh)" },
  { id: "x", n: "X-Large (6+ kWh)" },
];

const PL = [
  { id: "se5", n: "SDG&E EV-TOU-5", st: "CA", ev: true, sP: 71.1, sC: 12, wP: 47.8, wC: 11.4, sY: 153, wY: 212, inc: 0, ph: 5, phLabel: "4–9 PM daily", cpp: { a: 50, e: 12, mn: 1, mx: 18, n: "EV-TOU-5-P", src: "Up to 18/yr per SDG&E" } },
  { id: "pe2", n: "PG&E EV2-A", st: "CA", ev: true, sP: 54, sC: 23, wP: 41, wC: 23, sY: 122, wY: 243, inc: 0, ph: 5, phLabel: "4–9 PM daily", cpp: { a: 60, e: 12, mn: 9, mx: 15, n: "SmartRate", src: "9–15/yr per PG&E" } },
  { id: "rel", n: "Reliant Free Nights", st: "TX", ev: false, sP: 27.9, sC: 0, wP: 27.9, wC: 0, sY: 153, wY: 212, inc: 9.95, ph: 15, phLabel: "6 AM–9 PM (charge free 9 PM–6 AM)" },
  { id: "txu", n: "TXU Free Nights", st: "TX", ev: false, sP: 25, sC: 0, wP: 25, wC: 0, sY: 153, wY: 212, inc: 9.95, ph: 15, phLabel: "6 AM–9 PM (charge free 9 PM–6 AM)" },
  { id: "aps", n: "APS R-TOU-E", st: "AZ", ev: false, sP: 34.4, sC: 12.3, wP: 32.5, wC: 3.5, sY: 131, wY: 129, inc: 0, ph: 5, phLabel: "3–8 PM weekdays" },
  { id: "sce", n: "SCE TOU-D-PRIME", st: "CA", ev: false, sP: 58, sC: 25, wP: 38, wC: 25, sY: 122, wY: 243, inc: 24, ph: 5, phLabel: "4–9 PM daily", cpp: { a: 80, e: 12, mn: 1, mx: 12, n: "PRIME-CPP", src: "Max 12/yr per CPUC" } },
  { id: "pel", n: "PG&E E-ELEC", st: "CA", ev: false, sP: 57, sC: 31, wP: 41, wC: 31, sY: 122, wY: 243, inc: 0, ph: 5, phLabel: "4–9 PM daily", cpp: { a: 60, e: 12, mn: 9, mx: 15, n: "SmartRate", src: "9–15/yr per PG&E" } },
  { id: "sdr", n: "SDG&E TOU-DR1", st: "CA", ev: false, sP: 68, sC: 33, wP: 42, wC: 31, sY: 153, wY: 212, inc: 0, ph: 5, phLabel: "4–9 PM daily", cpp: { a: 50, e: 12, mn: 1, mx: 18, n: "TOU-DR-P", src: "Up to 18/yr per SDG&E" } },
  { id: "fpl", n: "FPL TOU", st: "FL", ev: false, sP: 26, sC: 9, wP: 26, wC: 9, sY: 150, wY: 108, inc: 0, ph: 9, phLabel: "Noon–9 PM weekdays (summer); split peak winter" },
  { id: "psg", n: "PSEG-LI 195", st: "NY", ev: false, sP: 38, sC: 12, wP: 22, wC: 12, sY: 88, wY: 172, inc: 0, ph: 12, phLabel: "10 AM–10 PM weekdays" },
  { id: "con", n: "ConEd SC-1 II", st: "NY", ev: false, sP: 35, sC: 15, wP: 25, wC: 15, sY: 88, wY: 172, inc: 0, ph: 14, phLabel: "8 AM–10 PM weekdays" },
  { id: "xce", n: "Xcel CO TOU", st: "CO", ev: false, sP: 28, sC: 10, wP: 18, wC: 10, sY: 88, wY: 172, inc: 0, ph: 5, phLabel: "3–8 PM weekdays" },
  { id: "smu", n: "SMUD ToD", st: "CA", ev: false, sP: 37.65, sC: 12.85, wP: 17.76, wC: 12.85, sY: 88, wY: 172, inc: 0, ph: 3, phLabel: "5–8 PM daily", cpp: { a: 50, e: 15, mn: 1, mx: 25, n: "SMUD CPP", src: "Max 50 hrs/summer" } },
  { id: "duk", n: "Duke NC Solar", st: "NC", ev: false, sP: 21, sC: 11, wP: 16, wC: 11, sY: 110, wY: 150, inc: 0, ph: 4, phLabel: "3–7 PM weekdays" },
  { id: "ced", n: "ComEd Hourly", st: "IL", ev: false, sP: 20, sC: 7, wP: 16, wC: 7, sY: 153, wY: 212, inc: 0, ph: 5, phLabel: "Dynamic hourly pricing" },
  { id: "pge", n: "PGE Time of Day", st: "OR", ev: false, sP: 43.65, sC: 9.01, wP: 43.65, wC: 9.01, sM: 16.89, wM: 16.89, sY: 128, wY: 127, inc: 0, ph: 4, phLabel: "5–9 PM weekdays" },
  { id: "srp", n: "SRP E-27 TOU", st: "AZ", ev: false, sP: 28.0, sC: 7.5, wP: 13.5, wC: 7.5, sY: 131, wY: 123, inc: 0, ph: 5, phLabel: "3–8 PM weekdays" },
  { id: "nve", n: "NV Energy TOU-D-1", st: "NV", ev: false, sP: 23.5, sC: 8.5, wP: 13.0, wC: 8.5, sY: 87, wY: 167, inc: 0, ph: 6, phLabel: "1–7 PM weekdays" },
  { id: "heco", n: "HECO TOU-R", st: "HI", ev: false, sP: 54.0, sC: 28.0, wP: 54.0, wC: 28.0, sY: 183, wY: 182, inc: 0, ph: 4, phLabel: "5–9 PM daily" },
  { id: "rmp", n: "Rocky Mountain Power R-TO", st: "UT", ev: false, sP: 16.5, sC: 7.8, wP: 10.5, wC: 7.8, sY: 87, wY: 167, inc: 0, ph: 6, phLabel: "2–8 PM weekdays" },
  { id: "ipco", n: "Idaho Power TOD-I", st: "ID", ev: false, sP: 16.0, sC: 6.5, wP: 10.0, wC: 6.5, sY: 65, wY: 189, inc: 0, ph: 6, phLabel: "3–9 PM weekdays" },
  { id: "dom", n: "Dominion DOM-TOU", st: "VA", ev: false, sP: 21.0, sC: 7.5, wP: 10.5, wC: 7.5, sY: 87, wY: 167, inc: 0, ph: 3, phLabel: "6–9 PM weekdays" },
  { id: "gpc", n: "Georgia Power TOU-RD", st: "GA", ev: false, sP: 24.0, sC: 6.5, wP: 8.5, wC: 6.5, sY: 87, wY: 167, inc: 0, ph: 5, phLabel: "2–7 PM weekdays" },
  { id: "evsma", n: "Eversource MA TOU", st: "MA", ev: false, sP: 31.0, sC: 16.5, wP: 26.0, wC: 14.0, sY: 131, wY: 123, inc: 0, ph: 11, phLabel: "9 AM–8 PM weekdays" },
  { id: "teco", n: "Tampa Electric TOU", st: "FL", ev: false, sP: 20.5, sC: 7.5, wP: 10.5, wC: 7.5, sY: 87, wY: 167, inc: 0, ph: 10, phLabel: "11 AM–9 PM weekdays" },
  { id: "pse", n: "Puget Sound Energy TOU", st: "WA", ev: false, sP: 17.5, sC: 9.0, wP: 17.5, wC: 9.0, sY: 183, wY: 182, inc: 0, ph: 3, phLabel: "6–9 PM daily" },
  { id: "cus", n: "Custom plan", st: "—", ev: false, custom: true },
];

const PROGRAMS = [
  { elig: "yes", title: "California ELRP (aggregator pathways)", status: "Live through 2027", region: "PG&E, SCE, SDG&E — May–Oct, 4–9 PM, up to 60 hrs/yr", body: "$2/kWh of load reduction measured at the customer's meter during CAISO grid emergencies, no penalty for non-performance. VPP aggregators (Group A.4) can enroll residential meters; the A.4/A.5 event window was cut from 5 to 3 hours by D.23-12-005. The consumer-facing Power Saver Rewards subgroup sunset after 2025 (rate lowered to $1/kWh in its final years; SDG&E stopped applications Nov 2025) — the aggregator pathway is the durable route.", pay: "$30–$60/yr realistic" },
  { elig: "yes", title: "PGE Peak Time Rebates", status: "Live", region: "Portland General Electric (OR) — summer Jun–Sep, winter Nov–Feb", body: "$1/kWh reduced below a 10-similar-day weather-adjusted baseline during ~3-hour Peak Time Events. No qualified-products list and no direct utility connection required — the meter is the measurement, so a non-export battery qualifies outright.", pay: "$15–$50/yr" },
  { elig: "yes", title: "BGE Energy Savings Days", status: "Live", region: "Baltimore Gas & Electric (MD) — summer weekdays ~2–6 PM", body: "$1.25/kWh bill credit versus a weather-adjusted baseline; meter-based and device-agnostic, and stackable with PeakRewards/Connected Rewards in 2026. Paid to the account holder — a fleet operator captures it contractually.", pay: "$20–$60/yr" },
  { elig: "yes", title: "Consumers Energy Peak Time Rewards", status: "Live", region: "Michigan — up to 14 summer event days, 2–6 PM", body: "$1/kWh reduced versus a similar-weather baseline. Meter-based, device-agnostic, utility-run.", pay: "$15–$50/yr" },
  { elig: "yes", title: "Delmarva Peak Energy Savings Credit", status: "Live", region: "Delaware", body: "$1.25/kWh reduced below a personal baseline during called events. Meter-based, device-agnostic. (Delmarva/Pepco Energy Wise Rewards in MD is AC-cycling hardware — a different, battery-unfriendly program.)", pay: "$15–$50/yr" },
  { elig: "yes", title: "ComEd Peak Time Savings", status: "Live", region: "Northern Illinois — summer peak events", body: "Per-kWh bill credit versus an estimated baseline; smart-meter customers can auto-enroll, and it cannot combine with Central AC Cycling. Illinois' CRGA statewide VPP (tariff due mid-2026) adds a $10/kW dispatch floor plus a $250/kWh storage rebate, but is dispatch- and storage-rebate-oriented rather than a meter-based fit.", pay: "$10–$40/yr" },
  { elig: "yes", title: "Critical peak pricing overlays", status: "Live", region: "SDG&E TOU-DR-P / EV-TOU-5-P, PG&E SmartRate (9–15 events/yr), SCE, SMUD (≤50 hrs/summer)", body: "A $0.50–$0.80/kWh adder applies during called events; a battery serving loads avoids it. This is bill-avoidance rather than a rebate, which makes it immune to baseline erosion — often the most durable meter-side value. Modeled directly on the Consumer tab with the event slider.", pay: "$20–$50/yr avoided" },
  { elig: "indirect", title: "PJM capacity-tag suppression (5CP)", status: "Record capacity prices", region: "ComEd, BGE, Pepco, Dominion + all PJM territories", body: "Capacity cleared at the FERC cap of $329.17/MW-day for 2026/27 and $333.44/MW-day for 2027/28 — a third consecutive record. Residential value flows indirectly through capacity charges embedded in supply rates and generally requires a passthrough rate (e.g. ComEd Hourly Pricing / Rate BESH) to monetize. ERCOT's 4CP applies to large C&I transmission allocation, not residential.", pay: "$20–$60/yr indirect" },
  { elig: "indirect", title: "Wholesale aggregation (FERC Order 2222)", status: "CAISO + NYISO live", region: "CAISO (Nov 2024), NYISO (Apr 2024); PJM delayed to Feb 2028; MISO 2027–29", body: "Load-reduction-only residential DERs can join ~100 kW+ aggregations as Proxy Demand Resources via aggregators like Leap or Olivine (which also administers ELRP). This is the only clean fleet-level, revenue-keeping wholesale route as of mid-2026 — revenue-share terms are negotiated, not published.", pay: "negotiated" },
  { elig: "no", title: "ConnectedSolutions", status: "Live — excluded", region: "Eversource / National Grid (MA, NH), Rhode Island Energy; CT closed to new enrollment Dec 2023", body: "$275/kW-summer (legacy MA), $225/kW (RI and new MA enrollees), +$50/kW-winter; a June 2026 ConnectedSolutions+ pilot reaches $400/kW. Requires an interconnected ESS from an approved manufacturer list discharging to the grid — plug-in stations are categorically excluded. This is the upgrade-pathway target if a customer converts to panel-mounted hardware.", pay: "$1,100–$2,000/yr (hardwired)" },
  { elig: "no", title: "New York BYOB / Battery Storage Rewards", status: "Live — excluded", region: "ConEd ($100/kW seasonal average), PSEG-LI ($250/kWh upfront, ~10 events/yr, May–Sep)", body: "Approved service providers and interconnected behind-the-meter storage required. Third-party aggregators may enroll customers — relevant only if the fleet ever adopts compliant hardware.", pay: "hardwired only" },
  { elig: "no", title: "Other device-list battery VPPs", status: "All excluded", region: "SRP Battery Partner ($110/kW-yr) · APS Storage Rewards · Duke PowerPair / Battery Control (~$6.50/kW-mo) · HECO BYOD+ (export credits) · Rocky Mountain Power Wattsmart ($1,000 upfront + $15/kW-yr as of mid-2026) · Austin Energy Power Partner", body: "Every one requires grid interconnection, export capability, and hardware from an approved list (Tesla, Enphase, SolarEdge, FranklinWH, sonnen). None currently admits a load-reduction-only device class — a single major program publishing one would be a material expansion trigger worth monitoring.", pay: "—" },
];

const DR_ITEMS = [
  { id: "ptr", n: "Peak Time Rebates (meter-based)", d: 40, note: "PGE OR / BGE MD / Consumers MI / Delmarva DE / ComEd IL — $1–$1.25/kWh vs baseline", st: ["OR", "MD", "MI", "DE", "IL"] },
  { id: "elrp", n: "Emergency DR (ELRP-style)", d: 50, note: "CA IOUs via aggregator pathway — $2/kWh meter-measured, through 2027", st: ["CA"] },
  { id: "cpk", n: "Coincident peak avoidance", d: 40, note: "PJM territories — indirect capacity-tag value via supply rates", st: ["IL", "MD", "VA", "NY", "MA", "DE"] },
  { id: "thermo", n: "DR program stacking", d: 50, note: "Thermostat-style events served by battery discharge", st: null },
];

const RTE = 0.85;
const LIFE = 10;

const drForPlan = (p2, drOn, drVal) => {
  return DR_ITEMS.reduce((s, d) => {
    if (!drOn[d.id]) return s;
    if (d.st && !d.st.includes(p2.st)) return s;
    return s + (drVal[d.id] || 0);
  }, 0);
};

const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];
const SUMMER_MONTHS = [4, 5, 6, 7, 8]; // May–Sep indexes
const WINTER_MONTHS = [0, 1, 2, 10, 11]; // Jan–Mar, Nov–Dec

const bl = (sq) => 1.0 + 0.0005 * sq;
const ak = (a, sq) => (a.sf ? a.sf(sq) : a.k);
const fm = (v) => (v < 0 ? "-" : "") + "$" + Math.abs(Math.round(v)).toLocaleString();
const fp = (v) => (v >= 0 ? "+" : "-") + "$" + Math.abs(Math.round(v)).toLocaleString();

function MetricCard({ label, value, positive }) {
  const color = positive === true ? "text-green-600" : positive === false ? "text-red-500" : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</div>
      <div className={`font-data text-xl font-medium ${color}`}>{value}</div>
    </div>
  );
}

function DetailRow({ label, value }) {
  return (
    <div className="flex justify-between py-1 text-sm">
      <span className="text-zinc-500 dark:text-zinc-400">{label}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100">{value}</span>
    </div>
  );
}

export default function Dashboard() {
  const [tab, setTab] = useState("model");
  const [plan, setPlan] = useState("sdr");
  const [src, setSrc] = useState("appliance");
  const [sq, setSq] = useState(1200);
  const [cnt, setCnt] = useState({ e1: 1 });
  const [bat, setBat] = useState("a5");
  const [esc, setEsc] = useState(3);
  const [cpp, setCpp] = useState(false);
  const [cppE, setCppE] = useState(0);
  const [collapsed, setCollapsed] = useState(() => {
    const m = {};
    CATS.forEach((_, i) => { m[i] = true; });
    return m;
  });
  const [custom, setCustom] = useState({ sP: 30, sC: 10, wP: 25, wC: 10, sY: 153, wY: 212, inc: 0, ph: 5 });
  const [sShare, setSShare] = useState(35);
  const [wShare, setWShare] = useState(25);
  const [billS, setBillS] = useState(["", "", ""]);
  const [billW, setBillW] = useState(["", "", ""]);
  const [sUnk, setSUnk] = useState(false);
  const [wUnk, setWUnk] = useState(false);
  const [peakHrs, setPeakHrs] = useState({});
  const [hwPct, setHwPct] = useState(50);
  const [cac, setCac] = useState(150);
  const [svc, setSvc] = useState(3);
  const [churn, setChurn] = useState(8);
  const [bizModel, setBizModel] = useState("sub");
  const [subFee, setSubFee] = useState(20);
  const [splitPct, setSplitPct] = useState(65);
  const [upfront, setUpfront] = useState(0);
  const [drOn, setDrOn] = useState({ cpp: true, ptr: false, elrp: false, cpk: false, thermo: false });
  const [drVal, setDrVal] = useState({ ptr: 40, elrp: 50, cpk: 40, thermo: 50 });
  const [drExp, setDrExp] = useState({});
  const [units, setUnits] = useState(1000);
  const [monthlyKwh, setMonthlyKwh] = useState(Array(12).fill(""));
  const [monthlyShare, setMonthlyShare] = useState(30);

  const curPlan = useMemo(() => {
    const p = PL.find((x) => x.id === plan);
    return p && p.custom ? { ...p, ...custom } : p;
  }, [plan, custom]);

  const curBat = useMemo(() => BB.find((b) => b.id === bat), [bat]);

  const appLoads = useCallback((ph) => {
    const base = bl(sq) * ph / 5;
    let s = base, w = base;
    Object.entries(cnt).forEach(([id, c]) => {
      if (c <= 0) return;
      const a = AA.find((x) => x.id === id);
      if (!a) return;
      const pwKw = ak(a, sq) / (a.dhrs || 5);
      const hrs = Math.min(peakHrs[id] !== undefined ? peakHrs[id] : (a.dhrs || ph), ph);
      const kwh = pwKw * hrs * c;
      if (a.s) s += kwh; else if (a.w) w += kwh; else { s += kwh; w += kwh; }
    });
    return { summer: s, winter: w };
  }, [cnt, sq, peakHrs]);

  const billLoads = useCallback(() => {
    const su = billS.map(Number).filter((v) => v > 0);
    const wi = billW.map(Number).filter((v) => v > 0);
    let s = null, w = null;
    if (!sUnk && su.length > 0) s = (su.reduce((a, b) => a + b, 0) / su.length / 30) * (sShare / 100);
    if (!wUnk && wi.length > 0) w = (wi.reduce((a, b) => a + b, 0) / wi.length / 30) * (wShare / 100);
    return { summer: s, winter: w };
  }, [billS, billW, sUnk, wUnk, sShare, wShare]);

  const monthlyLoads = useCallback(() => {
    const sVals = SUMMER_MONTHS.map((i) => Number(monthlyKwh[i])).filter((v) => v > 0);
    const wVals = WINTER_MONTHS.map((i) => Number(monthlyKwh[i])).filter((v) => v > 0);
    return {
      summer: sVals.length > 0 ? (sVals.reduce((a, b) => a + b, 0) / sVals.length / 30) * monthlyShare / 100 : null,
      winter: wVals.length > 0 ? (wVals.reduce((a, b) => a + b, 0) / wVals.length / 30) * monthlyShare / 100 : null,
    };
  }, [monthlyKwh, monthlyShare]);

  const loads = useMemo(() => {
    const ph = curPlan?.ph || 5;
    if (src === "monthly") {
      const m = monthlyLoads();
      const f = appLoads(ph);
      return { summer: m.summer ?? f.summer, winter: m.winter ?? f.winter };
    }
    if (src === "bill") {
      const b = billLoads();
      const f = appLoads(ph);
      return { summer: b.summer ?? f.summer, winter: b.winter ?? f.winter };
    }
    return appLoads(ph);
  }, [src, appLoads, billLoads, monthlyLoads, curPlan]);

  const result = useMemo(() => {
    const p = curPlan;
    const b = curBat;
    const maxDeliverable = b.pw * (p.ph || 5);
    const wantedS = Math.min(b.kw, loads.summer);
    const wantedW = Math.min(b.kw, loads.winter);
    const eS = Math.min(wantedS, maxDeliverable);
    const eW = Math.min(wantedW, maxDeliverable);
    const windowLimited = maxDeliverable < wantedS - 0.01 || maxDeliverable < wantedW - 0.01;
    const cS = eS / RTE, cW = eW / RTE;
    const util = b.kw > 0 ? (eS + eW) / 2 / b.kw : 0;
    let baseGross = p.sY * (eS * p.sP - cS * p.sC) / 100 + p.wY * (eW * p.wP - cW * p.wC) / 100;
    let baseCpp = 0;
    if (cpp && p.cpp) baseCpp = (cppE || p.cpp.e) * eS * p.cpp.a / 100;
    const baseNet = baseGross + baseCpp - (p.inc || 0) * 12;
    const cfData = [{ year: "Y0", value: -b.c }];
    let cum = -b.c, pbYr = Infinity;
    for (let y = 1; y <= LIFE; y++) {
      const capF = Math.max(0, 1 - b.dg * y);
      const rateF = Math.pow(1 + esc / 100, y);
      cum += baseNet * capF * rateF;
      cfData.push({ year: "Y" + y, value: Math.round(cum) });
      if (pbYr === Infinity && cum >= 0) {
        const prev = cfData[y - 1].value;
        pbYr = y - 1 + (-prev) / (cum - prev || 1);
      }
    }
    return { bat: b, plan: p, loads, eS, eW, util, gross: baseGross, net: baseNet, pb: pbYr === Infinity ? Infinity : Math.round(pbYr * 10) / 10, lt: Math.round(cum), cfData, cppRev: baseCpp, maxDeliverable, windowLimited };
  }, [curPlan, curBat, loads, cpp, cppE, esc]);

  const opResult = useMemo(() => {
    const b = curBat, p = curPlan, r = result;
    const hw = b.c * hwPct / 100;
    const cppPot = p.cpp ? p.cpp.e * r.eS * p.cpp.a / 100 : 0;
    const drRev = (drOn.cpp ? cppPot : 0) + drForPlan(p, drOn, drVal);
    const arb = r.gross;
    const planFee = (p.inc || 0) * 12;
    const subAnnual = subFee * 12, svcAnnual = svc * 12;
    const opY0 = -(hw + cac) + upfront;
    const hoY0 = -upfront;
    const data = [{ year: "Y0", op: Math.round(opY0), ho: Math.round(hoY0) }];
    let opCum = opY0, hoCum = hoY0, pbYr = Infinity, opYr1 = 0, hoYr1 = 0;
    for (let y = 1; y <= LIFE; y++) {
      const capF = Math.max(0, 1 - b.dg * y);
      const rateF = Math.pow(1 + esc / 100, y);
      const surv = Math.pow(1 - churn / 100, y);
      let op, ho;
      if (bizModel === "sub") {
        op = (subAnnual - svcAnnual) * surv + drRev * capF * rateF * surv;
        ho = arb * capF * rateF - subAnnual - planFee;
      } else {
        op = (arb * splitPct / 100 + drRev) * capF * rateF * surv - svcAnnual * surv;
        ho = arb * (100 - splitPct) / 100 * capF * rateF - planFee;
      }
      if (y === 1) { opYr1 = op; hoYr1 = ho; }
      const prevOp = opCum;
      opCum += op; hoCum += ho;
      data.push({ year: "Y" + y, op: Math.round(opCum), ho: Math.round(hoCum) });
      if (pbYr === Infinity && opCum >= 0) pbYr = y - 1 + (-prevOp) / (opCum - prevOp || 1);
    }
    return { hw, cppPot, drRev, arb, opY0, opYr1, hoYr1, opLt: Math.round(opCum), hoLt: Math.round(hoCum), pb: pbYr === Infinity ? Infinity : Math.round(pbYr * 10) / 10, data };
  }, [curBat, curPlan, result, hwPct, cac, svc, churn, bizModel, subFee, splitPct, upfront, drOn, drVal, esc]);

  const recommend = () => {
    const p = curPlan;
    let best = null, bestLt = -Infinity;
    BB.forEach((b) => {
      const maxDel = b.pw * (p.ph || 5);
      const eS = Math.min(b.kw, loads.summer, maxDel), eW = Math.min(b.kw, loads.winter, maxDel);
      const cS = eS / RTE, cW = eW / RTE;
      let g = p.sY * (eS * p.sP - cS * p.sC) / 100 + p.wY * (eW * p.wP - cW * p.wC) / 100;
      const n = g - (p.inc || 0) * 12;
      let c2 = -b.c;
      for (let y = 1; y <= LIFE; y++) c2 += n * Math.max(0, 1 - b.dg * y) * Math.pow(1 + esc / 100, y);
      if (c2 > bestLt) { bestLt = c2; best = b.id; }
    });
    if (best) setBat(best);
  };

  const updateCnt = (id, delta) => {
    const app = AA.find((a) => a.id === id);
    const mx = app ? app.mx : 5;
    setCnt((prev) => {
      const cur = prev[id] || 0;
      const nv = Math.max(0, Math.min(mx, cur + delta));
      const next = { ...prev };
      if (nv === 0) delete next[id]; else next[id] = nv;
      return next;
    });
  };

  const toggleCat = (i) => setCollapsed((prev) => ({ ...prev, [i]: !prev[i] }));

  const tabs = [
    { id: "model", label: "Consumer model" },
    { id: "operator", label: "Operator economics" },
    { id: "programs", label: "DR programs" },
    { id: "pitch", label: "Customer pitch" },
  ];

  const r = result;
  const p = curPlan;
  const consumerOk = r.pb !== Infinity && r.pb <= LIFE;
  const operatorOk = opResult.pb !== Infinity && opResult.pb <= LIFE && opResult.hoYr1 > 0;

  return (
    <div className="max-w-[720px] mx-auto pb-4">
      <div className="mb-6 pt-2">
        <div className="font-data text-[11px] tracking-[0.2em] uppercase text-blue-600 dark:text-blue-400 mb-2">Fleet underwriting console</div>
        <h1 className="font-display text-[26px] leading-tight font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Behind-the-meter battery economics</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[560px]">One deal, five lenses. Configure a tariff, load profile, and battery on the consumer side; underwrite the company-owned, non-export fleet model on the operator side; then screen every market to see where the deal clears.</p>
      </div>
      <div className="flex gap-0.5 border-b border-zinc-200 dark:border-zinc-700 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}>{t.label}</button>
        ))}
      </div>

      <div className="sticky top-2 z-10 mb-5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-data text-[10px] uppercase tracking-wider text-zinc-400">Plan</span>
          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{p.n}</span>
        </div>
        <div className="flex items-baseline gap-1.5 min-w-0">
          <span className="font-data text-[10px] uppercase tracking-wider text-zinc-400">Battery</span>
          <span className="text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{curBat.n}</span>
        </div>
        <div className="flex items-baseline gap-1.5">
          <span className="font-data text-[10px] uppercase tracking-wider text-zinc-400">Arb</span>
          <span className="font-data text-xs font-medium text-zinc-900 dark:text-zinc-100">{fm(r.gross)}/yr</span>
        </div>
        <div className="flex items-center gap-3 ml-auto">
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"><span className={`w-2 h-2 rounded-full ${consumerOk ? "bg-green-500" : "bg-red-500"}`} />Consumer</span>
          <span className="flex items-center gap-1.5 text-[11px] text-zinc-500 dark:text-zinc-400"><span className={`w-2 h-2 rounded-full ${operatorOk ? "bg-green-500" : "bg-red-500"}`} />Operator</span>
        </div>
      </div>

      {tab === "model" && (
        <div>
          <div className="grid grid-cols-3 gap-3 mb-4">
            <MetricCard label="Net annual revenue (yr 1)" value={fm(r.net)} positive={r.net > 0 ? true : r.net < 0 ? false : undefined} />
            <MetricCard label="Years to payback" value={r.pb === Infinity ? "Never" : r.pb.toFixed(1) + " yrs"} positive={r.pb <= LIFE ? true : false} />
            <MetricCard label="10-year lifetime net" value={fp(r.lt)} positive={r.lt > 0 ? true : r.lt < 0 ? false : undefined} />
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">1</span>TOU plan</p>
            <select value={plan} onChange={(e) => { setPlan(e.target.value); setCpp(false); setCppE(0); }} className="w-full p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800">
              {PL.map((pl) => <option key={pl.id} value={pl.id}>{pl.n} ({pl.st}){pl.ev ? " [EV req]" : ""}</option>)}
            </select>
            {p.ev && <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm font-medium flex items-center gap-2"><i className="ti ti-alert-triangle" aria-hidden="true" />Requires EV registration to enroll</div>}
            {p.cpp && !p.custom && (
              <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
                <div className="flex items-center gap-3 flex-wrap">
                  <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-900 dark:text-zinc-100"><input type="checkbox" checked={cpp} onChange={(e) => { setCpp(e.target.checked); if (e.target.checked) setCppE(p.cpp.e); }} className="w-4 h-4" />Include {p.cpp.n}</label>
                  <span className="text-zinc-500 dark:text-zinc-400 flex-1">{p.cpp.a}¢/kWh adder</span>
                  {cpp && <span className="text-green-600 font-medium">+{fm(r.cppRev)}/yr</span>}
                </div>
                {cpp && (
                  <div className="flex items-center gap-2 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                    <span>Events/yr:</span>
                    <input type="range" min={p.cpp.mn} max={p.cpp.mx} step={1} value={cppE || p.cpp.e} onChange={(e) => setCppE(+e.target.value)} className="flex-1 max-w-[160px]" />
                    <span className="font-medium text-zinc-900 dark:text-zinc-100 min-w-[24px]">{cppE || p.cpp.e}</span>
                    <span className="text-xs text-zinc-400">({p.cpp.src})</span>
                  </div>
                )}
              </div>
            )}
            {!p.custom ? (
              <>
                <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
                  <DetailRow label="Summer peak" value={`${p.sP.toFixed(1)}¢`} />
                  {p.sM != null && <DetailRow label="Mid-peak (ignored)" value={`${p.sM.toFixed(1)}¢`} />}
                  <DetailRow label="Summer charge" value={p.sC === 0 ? "Free" : `${p.sC.toFixed(1)}¢`} />
                  <DetailRow label="Winter peak" value={`${p.wP.toFixed(1)}¢`} />
                  {p.wM != null && <DetailRow label="Mid-peak (ignored)" value={`${p.wM.toFixed(1)}¢`} />}
                  <DetailRow label="Winter charge" value={p.wC === 0 ? "Free" : `${p.wC.toFixed(1)}¢`} />
                  <DetailRow label="Peak hours" value={p.phLabel || `${p.ph || 5} hrs/day`} />
                  <DetailRow label="Cycles/yr" value={p.sY + p.wY} />
                  <DetailRow label="TOU incremental" value={p.inc > 0 ? `$${p.inc.toFixed(2)}/mo` : "$0/mo"} />
                </div>
                {p.sM != null && <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">Mid-peak hours are economically idle for arbitrage — the battery holds charge and waits for the on-peak window.</p>}
              </>
            ) : (
              <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg grid grid-cols-2 gap-3">
                {[["Summer peak (¢)", "sP"], ["Summer charge (¢)", "sC"], ["Winter peak (¢)", "wP"], ["Winter charge (¢)", "wC"], ["Summer cycles", "sY"], ["Winter cycles", "wY"], ["TOU incr ($/mo)", "inc"], ["Peak window (hrs)", "ph"]].map(([lbl, key]) => (
                  <div key={key} className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{lbl}</label>
                    <input type="number" value={custom[key]} onChange={(e) => setCustom((prev) => ({ ...prev, [key]: +e.target.value || 0 }))} step={key === "sY" || key === "wY" || key === "ph" ? 1 : 0.5} min={0} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 pl-7">Utility rate escalation</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400">Annual increase in electricity rates</span>
                <input type="range" min={0} max={8} step={0.5} value={esc} onChange={(e) => setEsc(+e.target.value)} className="flex-1 max-w-[200px]" list="escTicks" />
                <span className="font-medium text-zinc-900 dark:text-zinc-100 min-w-[44px]">{esc.toFixed(1)}%</span>
                <span className="text-xs text-zinc-400">US avg ~3%</span>
                <datalist id="escTicks"><option value="3" /></datalist>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">2</span>Peak-window load</p>
            <div className="flex gap-1 bg-zinc-100 dark:bg-zinc-800 p-1 rounded-lg mb-3">
              {[["appliance", "Appliance toggles"], ["bill", "Seasonal bills"], ["monthly", "Monthly kWh"]].map(([s, lbl]) => <button key={s} onClick={() => setSrc(s)} className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${src === s ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>{lbl}</button>)}
            </div>

            {src === "appliance" && (
              <div>
                <div className="flex items-center gap-3 mb-2">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400 min-w-[70px]">House size:</span>
                  <input type="range" min={400} max={3500} step={50} value={sq} onChange={(e) => setSq(+e.target.value)} className="flex-1" />
                  <span className="text-sm font-medium min-w-[90px] text-right">{sq.toLocaleString()} sq ft</span>
                </div>
                <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-3">Always-on baseline: <span className="font-medium text-zinc-900 dark:text-zinc-100">{(bl(sq) * (p.ph || 5) / 5).toFixed(2)} kWh</span> <span className="text-zinc-400 dark:text-zinc-500">(fridge, lighting, standby — {p.ph || 5} hrs)</span></div>
                {CATS.map((cat, ci) => {
                  const activeCount = cat.i.reduce((sum, a) => sum + (cnt[a.id] || 0), 0);
                  const isOpen = !collapsed[ci];
                  return (
                    <div key={ci} className="mb-1">
                      <button onClick={() => toggleCat(ci)} className="w-full flex items-center gap-2 py-2 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                        <i className={`ti ti-chevron-down text-sm transition-transform ${isOpen ? "" : "-rotate-90"}`} aria-hidden="true" />
                        {cat.t}{activeCount > 0 && ` (${activeCount} selected)`}
                      </button>
                      {isOpen && (
                        <div className="grid grid-cols-3 gap-1.5 pb-2">
                          {cat.i.map((a) => {
                            const n = cnt[a.id] || 0;
                            const ph = p.ph || 5;
                            const pwKw = ak(a, sq) / (a.dhrs || 5);
                            const defaultHrs = Math.min(a.dhrs || ph, ph);
                            const effHrs = Math.min(peakHrs[a.id] !== undefined ? peakHrs[a.id] : defaultHrs, ph);
                            const effKwh = pwKw * effHrs;
                            return (
                              <div key={a.id} className={`flex flex-col p-2 rounded-lg border text-sm ${n > 0 ? "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700" : "border-zinc-200 dark:border-zinc-700"}`}>
                                <div className="flex items-center gap-1.5">
                                  <div className="flex-1 min-w-0">
                                    <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs">{a.n}</div>
                                    <div className="text-[11px] text-zinc-400 dark:text-zinc-500">+{effKwh.toFixed(2)} kWh ea</div>
                                  </div>
                                  <div className="flex items-center gap-1">
                                    <button onClick={() => updateCnt(a.id, -1)} className="w-6 h-6 flex items-center justify-center rounded text-sm border border-zinc-300 dark:border-zinc-600">{"−"}</button>
                                    <span className="w-5 text-center text-sm font-medium">{n}</span>
                                    <button onClick={() => updateCnt(a.id, 1)} className="w-6 h-6 flex items-center justify-center rounded text-sm border border-zinc-300 dark:border-zinc-600">+</button>
                                  </div>
                                </div>
                                {n > 0 && (
                                  <div className="flex items-center gap-1.5 mt-1.5 pt-1.5 border-t border-blue-200 dark:border-blue-700/50">
                                    <input type="range" min={0.5} max={ph} step={0.5} value={effHrs} onChange={(e) => setPeakHrs((prev) => ({ ...prev, [a.id]: +e.target.value }))} className="flex-1 h-1.5 accent-blue-500" />
                                    <span className="text-[10px] text-zinc-500 dark:text-zinc-400 min-w-[26px] text-right">{effHrs.toFixed(1)}h</span>
                                  </div>
                                )}
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {src === "bill" && (
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Your bill replaces appliance estimates entirely.</p>
                {[["Summer bills", "Jun–Sep typically", billS, setBillS, sShare, setSShare, sUnk, setSUnk, "bsm"], ["Winter bills", "Dec–Mar typically", billW, setBillW, wShare, setWShare, wUnk, setWUnk, "bwm"]].map(([title, hint, vals, setVals, share, setShareFn, unk, setUnkFn, key]) => (
                  <div key={key} className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3 mt-2">
                    <div className="flex items-center justify-between mb-2">
                      <div><div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{title}</div><div className="text-xs text-zinc-400">{hint}</div></div>
                      <label className="flex items-center gap-2 text-sm text-zinc-500 cursor-pointer"><input type="checkbox" checked={unk} onChange={(e) => setUnkFn(e.target.checked)} className="w-3.5 h-3.5" />Don't know</label>
                    </div>
                    <div className={`grid grid-cols-3 gap-2 ${unk ? "opacity-40 pointer-events-none" : ""}`}>
                      {[0, 1, 2].map((i) => <input key={i} type="number" placeholder={`Mo ${i + 1} kWh`} value={vals[i]} onChange={(e) => { const nv = [...vals]; nv[i] = e.target.value; setVals(nv); }} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />)}
                    </div>
                    <div className="flex items-center gap-2 mt-2 text-sm text-zinc-500 dark:text-zinc-400">
                      <span>Peak share:</span>
                      <input type="range" min={15} max={50} step={1} value={share} onChange={(e) => setShareFn(+e.target.value)} className="flex-1 max-w-[200px]" />
                      <span className="font-medium min-w-[40px] text-right">{share}%</span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {src === "monthly" && (
              <div>
                <p className="text-sm text-zinc-500 dark:text-zinc-400 mb-2">Enter total monthly kWh from your utility bill (12 months). The model splits each month's consumption into peak-window load using the share slider below.</p>
                <div className="grid grid-cols-4 gap-2 mb-3">
                  {MONTH_LABELS.map((m, i) => (
                    <div key={i} className="flex flex-col gap-1">
                      <label className={`text-xs font-medium ${SUMMER_MONTHS.includes(i) ? "text-orange-500" : WINTER_MONTHS.includes(i) ? "text-blue-500" : "text-zinc-400"}`}>{m}</label>
                      <input type="number" placeholder="kWh" value={monthlyKwh[i]} onChange={(e) => { const nv = [...monthlyKwh]; nv[i] = e.target.value; setMonthlyKwh(nv); }} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                    </div>
                  ))}
                </div>
                <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                  <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                    <span className="min-w-[110px]">Peak-window share</span>
                    <input type="range" min={15} max={60} step={1} value={monthlyShare} onChange={(e) => setMonthlyShare(+e.target.value)} className="flex-1 max-w-[200px]" />
                    <span className="font-medium min-w-[40px] text-right">{monthlyShare}%</span>
                    <span className="text-xs text-zinc-400">of daily kWh consumed during peak hours</span>
                  </div>
                  {(() => {
                    const sVals = SUMMER_MONTHS.map((i) => Number(monthlyKwh[i])).filter((v) => v > 0);
                    const wVals = WINTER_MONTHS.map((i) => Number(monthlyKwh[i])).filter((v) => v > 0);
                    const sAvg = sVals.length > 0 ? sVals.reduce((a, b) => a + b, 0) / sVals.length : 0;
                    const wAvg = wVals.length > 0 ? wVals.reduce((a, b) => a + b, 0) / wVals.length : 0;
                    const sDailyPeak = sAvg > 0 ? (sAvg / 30) * monthlyShare / 100 : 0;
                    const wDailyPeak = wAvg > 0 ? (wAvg / 30) * monthlyShare / 100 : 0;
                    return sAvg > 0 || wAvg > 0 ? (
                      <div className="mt-2 pt-2 border-t border-zinc-200 dark:border-zinc-700 text-sm text-zinc-500 dark:text-zinc-400 space-y-1">
                        {sAvg > 0 && <div>Summer avg: <span className="font-medium text-zinc-900 dark:text-zinc-100">{Math.round(sAvg)} kWh/mo</span> → peak-window load: <span className="font-medium text-zinc-900 dark:text-zinc-100">{sDailyPeak.toFixed(1)} kWh/day</span></div>}
                        {wAvg > 0 && <div>Winter avg: <span className="font-medium text-zinc-900 dark:text-zinc-100">{Math.round(wAvg)} kWh/mo</span> → peak-window load: <span className="font-medium text-zinc-900 dark:text-zinc-100">{wDailyPeak.toFixed(1)} kWh/day</span></div>}
                      </div>
                    ) : null;
                  })()}
                </div>
              </div>
            )}
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">3</span>Battery</p>
            <div className="flex flex-col gap-2 mb-3">
              <select value={bat} onChange={(e) => setBat(e.target.value)} className="w-full p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800">
                {BCT.map((cat) => <optgroup key={cat.id} label={cat.n}>{BB.filter((b) => b.ct === cat.id).map((b) => <option key={b.id} value={b.id}>{b.n} — {b.kw.toFixed(2)} kWh, {b.pw} kW, {b.vo}V — ${b.c.toLocaleString()}</option>)}</optgroup>)}
              </select>
              <button onClick={recommend} className="self-start px-3 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"><i className="ti ti-sparkles" aria-hidden="true" /> Find best</button>
            </div>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
              <DetailRow label="Capacity" value={`${curBat.kw.toFixed(2)} kWh`} />
              <DetailRow label="Max output" value={`${curBat.pw} kW @ ${curBat.vo}V`} />
              <DetailRow label="Cost" value={`$${curBat.c.toLocaleString()}`} />
              <DetailRow label="$/kWh" value={`$${Math.round(curBat.c / curBat.kw).toLocaleString()}`} />
              <DetailRow label="Max deliverable in peak window" value={`${r.maxDeliverable.toFixed(1)} kWh (${curBat.pw} kW × ${p.ph || 5} hrs)`} />
            </div>
            {r.windowLimited && (
              <div className="mt-2 p-3 bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 rounded-lg text-sm flex items-start gap-2">
                <i className="ti ti-alert-triangle mt-0.5" aria-hidden="true" />
                <span>The {p.ph || 5}-hour peak window is too short for this battery to discharge fully at {curBat.pw} kW. Delivery is capped at {r.maxDeliverable.toFixed(1)} kWh per cycle; the rest of the battery's capacity sits unused. A smaller or lower-output battery may give better value on this plan.</span>
              </div>
            )}
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">4</span>Assumptions</p>
            <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
              <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="min-w-[150px]">Battery degradation/yr</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{(curBat.dg * 100).toFixed(1)}%</span>
                <span className="text-xs text-zinc-400">(from manufacturer cycle-life spec)</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="min-w-[150px]">Round-trip efficiency</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{(RTE * 100).toFixed(0)}%</span>
              </div>
              <div className="flex items-center gap-3 text-sm text-zinc-500 dark:text-zinc-400">
                <span className="min-w-[150px]">Battery life</span>
                <span className="font-medium text-zinc-900 dark:text-zinc-100">{LIFE} years</span>
              </div>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 pl-7">Live calculations</p>
            <div className="grid grid-cols-4 gap-2">
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3"><div className="text-xs text-zinc-500 dark:text-zinc-400">Summer peak load</div><div className="text-base font-medium mt-0.5">{r.loads.summer.toFixed(1)} kWh</div></div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3"><div className="text-xs text-zinc-500 dark:text-zinc-400">Winter peak load</div><div className="text-base font-medium mt-0.5">{r.loads.winter.toFixed(1)} kWh</div></div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3"><div className="text-xs text-zinc-500 dark:text-zinc-400">Utilization</div><div className="text-base font-medium mt-0.5">{Math.round(r.util * 100)}%</div><div className="h-1 bg-zinc-200 dark:bg-zinc-700 rounded mt-1.5 overflow-hidden"><div className="h-full bg-blue-500 rounded" style={{ width: Math.min(100, Math.round(r.util * 100)) + "%" }} /></div></div>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3"><div className="text-xs text-zinc-500 dark:text-zinc-400">Gross yr 1</div><div className="text-base font-medium mt-0.5">{fm(r.gross)}</div></div>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 pl-7">Cumulative cash flow</p>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={r.cfData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#888" }} />
                <YAxis tick={{ fontSize: 12, fill: "#888" }} tickFormatter={(v) => fm(v)} />
                <Tooltip formatter={(v) => fm(v)} labelFormatter={(l) => l} />
                <ReferenceLine y={0} stroke="#999" strokeDasharray="5 5" />
                <Line type="monotone" dataKey="value" stroke="#185FA5" strokeWidth={2} dot={{ r: 3, fill: "#185FA5" }} />
                <Area type="monotone" dataKey="value" fill="rgba(24,95,165,0.08)" stroke="none" />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 leading-relaxed">Cash flow reflects annual utility rate escalation ({esc.toFixed(1)}%/yr spread growth) and battery degradation ({(curBat.dg * 100).toFixed(1)}%/yr capacity fade). CPP revenue included when toggled on.</p>
          </div>
        </div>
      )}

      {tab === "operator" && (() => {
        const oo = opResult;
        const dealHo = oo.hoYr1 > 0;
        const dealOp = oo.pb !== Infinity && oo.pb <= LIFE;
        return (
          <div>
            <div className={`text-center py-6 px-6 rounded-xl mb-5 ${dealHo && dealOp ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
              <div className={`text-xl font-medium mb-1 ${dealHo && dealOp ? "text-green-600" : "text-red-500"}`}>
                {dealHo && dealOp ? `Deal works for both sides — operator payback in ${oo.pb.toFixed(1)} yrs` : !dealHo ? "Homeowner loses money — no one signs up" : "Operator never recovers initial hardware investment"}
              </div>
              <p className="text-sm text-zinc-500 dark:text-zinc-400">
                {dealHo && dealOp ? `Homeowner nets ${fm(oo.hoYr1)}/yr with $${upfront} down; operator earns ${fm(oo.opLt)}/unit over ${LIFE} years.` : !dealHo ? `The offer costs the homeowner ${fm(-oo.hoYr1)}/yr more than the battery saves them on ${p.n}. Lower the fee/split or pick a wider-spread plan.` : `${oo.pb === Infinity ? "No payback" : oo.pb.toFixed(1) + " yrs"} vs ${LIFE}-yr battery life at ${fm(oo.hw + cac)} deployed cost.`}
              </p>
            </div>

            <div className="grid grid-cols-3 gap-3 mb-4">
              <MetricCard label="Operator payback" value={oo.pb === Infinity ? "Never" : oo.pb.toFixed(1) + " yrs"} positive={dealOp} />
              <MetricCard label={`Operator ${LIFE}-yr net / unit`} value={fp(oo.opLt)} positive={oo.opLt > 0 ? true : oo.opLt < 0 ? false : undefined} />
              <MetricCard label="Homeowner net (yr 1)" value={fp(oo.hoYr1)} positive={dealHo ? true : oo.hoYr1 < 0 ? false : undefined} />
            </div>

            <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-5">Company-owned, non-export model. Inherits the Model tab's configuration: <span className="font-medium text-zinc-600 dark:text-zinc-300">{curBat.n}</span> on <span className="font-medium text-zinc-600 dark:text-zinc-300">{p.n}</span>, {fm(oo.arb)}/yr gross arbitrage at current load settings.</p>

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">1</span>Offer structure</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                <button onClick={() => setBizModel("sub")} className={`p-3 rounded-lg border text-xs leading-relaxed text-left cursor-pointer transition-colors ${bizModel === "sub" ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"}`}>
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">Flat subscription</div>
                  <p className="text-zinc-500 dark:text-zinc-400">Homeowner pays a fixed monthly fee and keeps 100% of the bill savings the battery produces. Sold as backup power, priced like a streaming service. Operator revenue is predictable and easy to collect — but the homeowner bears performance risk: if the battery underdelivers (bad placement, low utilization), they still pay full fare, and on thin-spread plans the fee can exceed the savings.</p>
                </button>
                <button onClick={() => setBizModel("split")} className={`p-3 rounded-lg border text-xs leading-relaxed text-left cursor-pointer transition-colors ${bizModel === "split" ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-700 hover:border-zinc-400 dark:hover:border-zinc-500"}`}>
                  <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">Savings split</div>
                  <p className="text-zinc-500 dark:text-zinc-400">No fixed fee. The operator meters the battery's verified discharge, computes the savings it generated, and bills the homeowner a percentage each month. The homeowner can never lose money — worst case is $0 saved, $0 owed — which maximizes sign-ups. But operator revenue now varies with utilization and rates, and collections are messier: you're invoicing people for money they never saw leave their account.</p>
                </button>
              </div>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3 text-sm">
                {bizModel === "sub" ? (
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Monthly fee</span>
                    <input type="range" min={0} max={50} step={1} value={subFee} onChange={(e) => setSubFee(+e.target.value)} className="flex-1 max-w-[200px]" />
                    <span className="font-medium min-w-[70px]">${subFee}/mo</span>
                    <span className="text-xs text-zinc-400">homeowner keeps all bill savings</span>
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Operator share of savings</span>
                    <input type="range" min={40} max={90} step={5} value={splitPct} onChange={(e) => setSplitPct(+e.target.value)} className="flex-1 max-w-[200px]" />
                    <span className="font-medium min-w-[70px]">{splitPct}%</span>
                    <span className="text-xs text-zinc-400">homeowner keeps {100 - splitPct}%, billed monthly on verified discharge</span>
                  </div>
                )}
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Homeowner upfront</span>
                  <input type="number" min={0} step={50} value={upfront} onChange={(e) => setUpfront(Math.max(0, +e.target.value || 0))} className="p-2 w-24 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  <span className="text-xs text-zinc-400">deposit / activation fee, paid to operator</span>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">2</span>Operator costs</p>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3 text-sm">
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Fleet hardware cost</span>
                  <input type="range" min={30} max={100} step={5} value={hwPct} onChange={(e) => setHwPct(+e.target.value)} className="flex-1 max-w-[200px]" />
                  <span className="font-medium min-w-[110px]">{hwPct}% of retail = {fm(oo.hw)}</span>
                  <span className="text-xs text-zinc-400">volume/wholesale pricing</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Acquisition + deployment</span>
                  <input type="number" min={0} step={25} value={cac} onChange={(e) => setCac(Math.max(0, +e.target.value || 0))} className="p-2 w-24 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  <span className="text-xs text-zinc-400">per unit — marketing, shipping, onboarding</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Servicing + software</span>
                  <input type="number" min={0} step={1} value={svc} onChange={(e) => setSvc(Math.max(0, +e.target.value || 0))} className="p-2 w-24 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  <span className="text-xs text-zinc-400">$/unit/month — cloud dispatch, support, warranty reserve</span>
                </div>
                <div className="flex items-center gap-3">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Annual churn</span>
                  <input type="range" min={0} max={25} step={1} value={churn} onChange={(e) => setChurn(+e.target.value)} className="flex-1 max-w-[200px]" />
                  <span className="font-medium min-w-[44px]">{churn}%</span>
                  <span className="text-xs text-zinc-400">cancellations + non-payment haircut on operator revenue</span>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">3</span>DR revenue stack <span className="text-xs font-normal text-zinc-400">(operator keeps these)</span></p>
              <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
                <div className="p-3 text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed border-b border-zinc-200 dark:border-zinc-700">The operator enrolls the fleet in every stackable demand-side program and keeps this revenue. The homeowner's deal (tab above) is the TOU arbitrage savings; the DR stack is pure operator upside. Click each row for market reference data.</div>

                {/* CPP */}
                <div className="border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3 flex-wrap p-3">
                    <label className={`flex items-center gap-2 font-medium min-w-[220px] text-sm ${p.cpp ? "cursor-pointer text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
                      <input type="checkbox" checked={!!(drOn.cpp && p.cpp)} disabled={!p.cpp} onChange={(e) => setDrOn((prev) => ({ ...prev, cpp: e.target.checked }))} className="w-4 h-4" />
                      CPP event revenue
                    </label>
                    <span className={`font-medium text-sm ${p.cpp ? "text-green-600" : "text-zinc-400"}`}>{p.cpp ? "+" + fm(oo.cppPot) + "/yr" : "n/a"}</span>
                    <button onClick={() => setDrExp((prev) => ({ ...prev, cpp: !prev.cpp }))} className="ml-auto text-xs text-blue-500 hover:text-blue-700">{drExp.cpp ? "hide" : "market data ▾"}</button>
                  </div>
                  {p.cpp && <p className="text-xs text-zinc-400 px-3 pb-2">{p.cpp.n}: {p.cpp.e} events × {p.cpp.a}¢/kWh adder on this plan</p>}
                  {!p.cpp && <p className="text-xs text-zinc-400 px-3 pb-2">Selected plan has no CPP overlay — switch to a CA IOU or SMUD plan to enable</p>}
                  {drExp.cpp && (
                    <div className="mx-3 mb-3 p-2.5 bg-white dark:bg-zinc-900 rounded-lg text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Plans with CPP overlays in the model</div>
                      <div className="grid grid-cols-2 gap-x-4 gap-y-1 text-zinc-500 dark:text-zinc-400">
                        <span>SDG&E TOU-DR-P</span><span>50¢/kWh, up to 18 events/yr</span>
                        <span>SCE PRIME-CPP</span><span>80¢/kWh, up to 12 events/yr</span>
                        <span>PG&E SmartRate</span><span>60¢/kWh, 9–15 events/yr</span>
                        <span>SMUD CPP</span><span>50¢/kWh, max 50 hrs/summer</span>
                        <span>SDG&E EV-TOU-5-P</span><span>50¢/kWh, up to 18 events/yr</span>
                      </div>
                      <p className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800">CPP is auto-calculated from the plan: events × battery discharge × adder. The operator captures this by enrolling the customer's meter in the overlay and dispatching the battery during called events. No export needed — the meter just reads lower.</p>
                    </div>
                  )}
                </div>

                {/* Peak Time Rebates */}
                <div className="border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3 flex-wrap p-3">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-900 dark:text-zinc-100 min-w-[220px] text-sm">
                      <input type="checkbox" checked={!!drOn.ptr} onChange={(e) => setDrOn((prev) => ({ ...prev, ptr: e.target.checked }))} className="w-4 h-4" />
                      Peak Time Rebates (meter-based)
                    </label>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-zinc-400">$</span>
                      <input type="number" min={0} step={5} value={drVal.ptr} onChange={(e) => setDrVal((prev) => ({ ...prev, ptr: Math.max(0, +e.target.value || 0) }))} className="p-1.5 w-20 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                      <span className="text-zinc-400">/yr</span>
                    </div>
                    <button onClick={() => setDrExp((prev) => ({ ...prev, ptr: !prev.ptr }))} className="ml-auto text-xs text-blue-500 hover:text-blue-700">{drExp.ptr ? "hide" : "market data ▾"}</button>
                  </div>
                  {drExp.ptr && (
                    <div className="mx-3 mb-3 p-2.5 bg-white dark:bg-zinc-900 rounded-lg text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">The best structural fit for a non-export fleet: pay for measured kWh reduction vs. a baseline, device-agnostic</div>
                      <div className="space-y-1 text-zinc-500 dark:text-zinc-400">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">PGE Peak Time Rebates (OR)</span><span>$1/kWh vs 10-day weather-adjusted baseline; summer + winter events; no qualified-product list</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">BGE Energy Savings Days (MD)</span><span>$1.25/kWh vs baseline; weekday ~2–6 PM; stackable with Connected Rewards in 2026</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Consumers Energy (MI)</span><span>$1/kWh; up to 14 summer events, 2–6 PM</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Delmarva (DE)</span><span>$1.25/kWh vs personal baseline</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">ComEd Peak Time Savings (IL)</span><span>Per-kWh credit vs baseline; smart-meter auto-enroll; can't combine with AC Cycling</span>
                        </div>
                        <p className="mt-1"><span className="font-medium text-zinc-700 dark:text-zinc-300">Math:</span> 3 kWh shifted × $1–$1.25/kWh × 8–14 events ≈ $25–$50/yr per unit. Conservative underwriting: $30–$50/yr in PTR territories, $0 elsewhere.</p>
                      </div>
                      <div className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                        <p>Two structural caveats. <span className="font-medium text-zinc-600 dark:text-zinc-300">Baseline erosion:</span> payment is measured against the customer's own recent usage — a battery that shifts load every day lowers the baseline over time, shrinking measured "reduction." Reserve routine cycling for arbitrage and dispatch hardest on event days. <span className="font-medium text-zinc-600 dark:text-zinc-300">Enrollment:</span> these tariffs pay the account holder, not an aggregator — the operator captures the value contractually (service agreement assigns the credit), and each tariff needs legal review for assignment terms before scaling.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* ELRP */}
                <div className="border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3 flex-wrap p-3">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-900 dark:text-zinc-100 min-w-[220px] text-sm">
                      <input type="checkbox" checked={!!drOn.elrp} onChange={(e) => setDrOn((prev) => ({ ...prev, elrp: e.target.checked }))} className="w-4 h-4" />
                      Emergency DR (ELRP-style)
                    </label>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-zinc-400">$</span>
                      <input type="number" min={0} step={5} value={drVal.elrp} onChange={(e) => setDrVal((prev) => ({ ...prev, elrp: Math.max(0, +e.target.value || 0) }))} className="p-1.5 w-20 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                      <span className="text-zinc-400">/yr</span>
                    </div>
                    <button onClick={() => setDrExp((prev) => ({ ...prev, elrp: !prev.elrp }))} className="ml-auto text-xs text-blue-500 hover:text-blue-700">{drExp.elrp ? "hide" : "market data ▾"}</button>
                  </div>
                  {drExp.elrp && (
                    <div className="mx-3 mb-3 p-2.5 bg-white dark:bg-zinc-900 rounded-lg text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">California ELRP — the reference program</div>
                      <div className="space-y-1 text-zinc-500 dark:text-zinc-400">
                        <p><span className="font-medium text-zinc-700 dark:text-zinc-300">Rate:</span> $2/kWh of load reduction measured at the customer's meter (set in CPUC D.21-12-015); no penalty for non-performance</p>
                        <p><span className="font-medium text-zinc-700 dark:text-zinc-300">Window:</span> May–Oct, 4–9 PM, up to 60 hrs/yr, triggered by CAISO emergency alerts. D.23-12-005 cut the VPP/VGI aggregator (A.4/A.5) event window from 5 hrs to 3 hrs</p>
                        <p><span className="font-medium text-zinc-700 dark:text-zinc-300">Territories:</span> PG&E, SCE, SDG&E. Pilot extended through 2027 for aggregator pathways</p>
                        <p><span className="font-medium text-zinc-700 dark:text-zinc-300">Residential caveat:</span> the consumer-facing Power Saver Rewards subgroup sunset after the 2025 season — rate lowered to $1/kWh in its final years, and SDG&E stopped applications Nov 2025. The VPP aggregator pathway (Group A.4) is the durable enrollment route for a fleet</p>
                        <p><span className="font-medium text-zinc-700 dark:text-zinc-300">Math:</span> 3 kWh/event × $2/kWh × 5–10 events ≈ $30–$60/yr. More in an active grid-emergency year; near zero in a mild one</p>
                      </div>
                      <p className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800">Measurement is meter-based (5-in-10 baseline with same-day adjustment) — a non-export battery powering loads qualifies directly. Olivine administers ELRP and is also a CAISO scheduling coordinator, making it a natural aggregation partner for the same fleet.</p>
                    </div>
                  )}
                </div>

                {/* Coincident Peak */}
                <div className="border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3 flex-wrap p-3">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-900 dark:text-zinc-100 min-w-[220px] text-sm">
                      <input type="checkbox" checked={!!drOn.cpk} onChange={(e) => setDrOn((prev) => ({ ...prev, cpk: e.target.checked }))} className="w-4 h-4" />
                      Coincident peak avoidance
                    </label>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-zinc-400">$</span>
                      <input type="number" min={0} step={10} value={drVal.cpk} onChange={(e) => setDrVal((prev) => ({ ...prev, cpk: Math.max(0, +e.target.value || 0) }))} className="p-1.5 w-20 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                      <span className="text-zinc-400">/yr</span>
                    </div>
                    <button onClick={() => setDrExp((prev) => ({ ...prev, cpk: !prev.cpk }))} className="ml-auto text-xs text-blue-500 hover:text-blue-700">{drExp.cpk ? "hide" : "market data ▾"}</button>
                  </div>
                  {drExp.cpk && (
                    <div className="mx-3 mb-3 p-2.5 bg-white dark:bg-zinc-900 rounded-lg text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Capacity-tag suppression — real but smaller and more indirect than it first looks</div>
                      <div className="space-y-2 text-zinc-500 dark:text-zinc-400">
                        <div>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">PJM (5CP) — ComEd, BGE, Pepco, Dominion + all PJM</span>
                          <p>Capacity cleared at the FERC-approved cap of $329.17/MW-day for 2026/27 and $333.44/MW-day for 2027/28 — the third consecutive record auction. A customer's capacity obligation (PLC) is set by usage during PJM's five highest summer peak hours, identified retroactively.</p>
                          <p className="mt-1">The catch for residential: this value flows through capacity charges embedded in supply rates, and generally requires a rate that passes capacity through (ComEd Hourly Pricing / Rate BESH, or a competitive supplier that credits PLC reductions) to actually monetize. Realistic per-unit: <span className="font-medium text-zinc-700 dark:text-zinc-300">$20–$60/yr</span> — meaningful as a stack layer, not a headline.</p>
                        </div>
                        <div>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">ERCOT (4CP) — not a residential mechanism</span>
                          <p>4CP transmission cost allocation applies to large commercial and industrial customers. Residential Texas customers have no 4CP tag to suppress — don't underwrite any 4CP value on a residential fleet. (Texas residential value lives in the retail plan spread and REP-run DR instead.)</p>
                        </div>
                        <div>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">NYISO (ICAP) — ConEd, PSEG-LI</span>
                          <p>Peak-hour usage feeds ICAP tags with similar supply-rate passthrough dynamics. Same story as PJM at somewhat lower capacity prices: a modest, indirect stack layer.</p>
                        </div>
                      </div>
                      <p className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800">The aggregator's edge is still real: hitting the 5 retroactively-identified peak hours requires weather monitoring and load forecasting no homeowner will do, and a fleet operator with telemetry will catch most of them. But treat this as $20–$60/yr of indirect value on passthrough rates — the earlier-cycle framing of $100–$300/yr assumed wholesale-level capture residential customers can't access directly.</p>
                    </div>
                  )}
                </div>

                {/* DR stacking */}
                <div className="border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3 flex-wrap p-3">
                    <label className="flex items-center gap-2 cursor-pointer font-medium text-zinc-900 dark:text-zinc-100 min-w-[220px] text-sm">
                      <input type="checkbox" checked={!!drOn.thermo} onChange={(e) => setDrOn((prev) => ({ ...prev, thermo: e.target.checked }))} className="w-4 h-4" />
                      DR program stacking
                    </label>
                    <div className="flex items-center gap-1 text-sm">
                      <span className="text-zinc-400">$</span>
                      <input type="number" min={0} step={5} value={drVal.thermo} onChange={(e) => setDrVal((prev) => ({ ...prev, thermo: Math.max(0, +e.target.value || 0) }))} className="p-1.5 w-20 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                      <span className="text-zinc-400">/yr</span>
                    </div>
                    <button onClick={() => setDrExp((prev) => ({ ...prev, thermo: !prev.thermo }))} className="ml-auto text-xs text-blue-500 hover:text-blue-700">{drExp.thermo ? "hide" : "market data ▾"}</button>
                  </div>
                  {drExp.thermo && (
                    <div className="mx-3 mb-3 p-2.5 bg-white dark:bg-zinc-900 rounded-lg text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">Thermostat-style DR and aggregator platforms the battery can serve</div>
                      <div className="space-y-1 text-zinc-500 dark:text-zinc-400">
                        <p>These programs pay for using less grid power during peak events. Normally they adjust a thermostat or cycle an AC; a battery can serve the load instead, so the house stays comfortable and the meter still reads lower.</p>
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1 mt-1">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Renew Home / OhmConnect (CA)</span><span>Meter-based "Watts" for load reduction — device-agnostic, but B2C (pays the resident, modest payouts); exited Texas retail in 2026</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">SCE SmartShift / SmartAC</span><span>$50–$150/yr</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">PG&E SmartAC</span><span>$50–$100/yr; cannot combine with SmartRate</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Xcel AC Rewards (CO/MN)</span><span>$25–$40/yr, device-specific</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Generic utility thermostat DR</span><span>$40–$200/yr nationwide, usually device-specific</span>
                        </div>
                      </div>
                      <div className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800 space-y-1">
                        <p>Watch the eligibility fine print: many of these credit a specific device (thermostat, AC switch), not the meter — the battery only stacks where measurement is meter-based or the battery serves the curtailed load. Most CA IOUs also limit customers to one energy-incentive program at a time (CPUC D.18-11-029).</p>
                        <p>The fleet-scale version of this line is wholesale aggregation under FERC Order 2222: CAISO (live since Nov 2024) and NYISO (live since Apr 2024) accept load-reduction-only residential aggregations of ~100 kW+ via aggregators like Leap or Olivine — negotiated revenue share. PJM is delayed to Feb 2028; MISO to 2027–29. Conservative underwriting for this row: $40–$80/yr where programs exist, $0 elsewhere.</p>
                      </div>
                    </div>
                  )}
                </div>

                {/* Hardwired-only reference */}
                <div className="border-b border-zinc-200 dark:border-zinc-700">
                  <div className="flex items-center gap-3 p-3">
                    <span className="flex items-center gap-2 font-medium text-zinc-400 min-w-[220px] text-sm">
                      <span className="w-4 h-4 flex items-center justify-center text-xs">🔒</span>
                      ConnectedSolutions / NY BYOB
                    </span>
                    <span className="text-sm text-zinc-400 italic">hardwired only</span>
                    <button onClick={() => setDrExp((prev) => ({ ...prev, hw: !prev.hw }))} className="ml-auto text-xs text-blue-500 hover:text-blue-700">{drExp.hw ? "hide" : "market data ▾"}</button>
                  </div>
                  {drExp.hw && (
                    <div className="mx-3 mb-3 p-2.5 bg-white dark:bg-zinc-900 rounded-lg text-xs space-y-1.5 border border-zinc-200 dark:border-zinc-700">
                      <div className="font-medium text-zinc-700 dark:text-zinc-300 mb-1">The richest programs — all categorically closed to plug-in stations</div>
                      <div className="space-y-1 text-zinc-500 dark:text-zinc-400">
                        <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Eversource / Nat'l Grid MA</span><span>$275/kW summer (legacy), $225/kW new enrollees post-June 2024, +$50/kW winter; ConnectedSolutions+ pilot (June 2026) up to $400/kW</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Rhode Island Energy</span><span>$225/kW summer</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">Connecticut</span><span>ConnectedSolutions closed to new enrollment Dec 2023 (replaced by CT Energy Storage Solutions)</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">ConEd BYOB (NY)</span><span>$100/kW average seasonal performance; approved service providers</span>
                          <span className="font-medium text-zinc-700 dark:text-zinc-300">PSEG-LI (NY)</span><span>$250/kWh upfront (cap $6,250), ~10 events/yr</span>
                        </div>
                        <p className="mt-1">A 5 kW hardwired system earns <span className="font-medium text-zinc-700 dark:text-zinc-300">$1,100–$1,650/yr</span> on MA ConnectedSolutions. Also closed to plug-ins for the same reason: SRP Battery Partner ($110/kW-yr), APS Storage Rewards, Duke PowerPair / Battery Control (~$6.50/kW-mo), HECO BYOD+ (export credits), Rocky Mountain Power Wattsmart ($1,000 upfront + $15/kW-yr as restructured mid-2026), Austin Energy Power Partner.</p>
                      </div>
                      <p className="text-zinc-400 dark:text-zinc-500 pt-1 border-t border-zinc-100 dark:border-zinc-800">Every one requires grid interconnection, export/dispatch capability, and hardware from an approved list (Tesla, Enphase, SolarEdge, FranklinWH, sonnen). Shown as the upgrade-pathway target: if a customer converts to a panel-mounted system (Anker F3800, Bluetti EP900), this tier unlocks — several NY programs even permit third-party aggregator enrollment. Never underwrite plug-in fleet economics on these numbers, and watch for any program publishing a load-reduction-only device class — that would be a material expansion trigger.</p>
                    </div>
                  )}
                </div>

                <div className="flex justify-between p-3">
                  <span className="text-sm text-zinc-500 dark:text-zinc-400">Total DR revenue to operator</span>
                  <span className="font-medium text-sm text-green-600">+{fm(oo.drRev)}/yr per unit</span>
                </div>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 pl-7">Cumulative cash flow — both sides of the deal</p>
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={oo.data} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 12, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 12, fill: "#888" }} tickFormatter={(v) => fm(v)} />
                  <Tooltip formatter={(v, name) => [fm(v), name === "op" ? "Operator" : "Homeowner"]} labelFormatter={(l) => l} />
                  <Legend formatter={(v) => (v === "op" ? "Operator (per unit)" : "Homeowner")} />
                  <ReferenceLine y={0} stroke="#999" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="op" stroke="#185FA5" strokeWidth={2} dot={{ r: 3, fill: "#185FA5" }} />
                  <Line type="monotone" dataKey="ho" stroke="#16A34A" strokeWidth={2} dot={{ r: 3, fill: "#16A34A" }} />
                </LineChart>
              </ResponsiveContainer>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mt-2 leading-relaxed">Operator revenue is haircut by churn ({churn}%/yr compounding); the homeowner curve shows the deal as experienced by a customer who stays enrolled. Both apply rate escalation ({esc.toFixed(1)}%/yr) and battery degradation ({(curBat.dg * 100).toFixed(1)}%/yr). Assumes remote management: a unit that stops paying reverts to a dumb power bank.</p>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 pl-7">Fleet view</p>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-2">
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400">Deployed units</span>
                  <input type="range" min={100} max={20000} step={100} value={units} onChange={(e) => setUnits(+e.target.value)} className="flex-1 max-w-[240px]" />
                  <span className="font-medium min-w-[70px]">{units.toLocaleString()}</span>
                </div>
              </div>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3"><div className="text-xs text-zinc-500 dark:text-zinc-400">Capital deployed</div><div className="text-base font-medium mt-0.5">{fm(units * (oo.hw + cac - upfront))}</div></div>
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3"><div className="text-xs text-zinc-500 dark:text-zinc-400">Operator revenue (yr 1)</div><div className="text-base font-medium mt-0.5">{fm(units * oo.opYr1)}</div></div>
                <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-3"><div className="text-xs text-zinc-500 dark:text-zinc-400">{LIFE}-yr fleet net</div><div className={`text-base font-medium mt-0.5 ${units * oo.opLt > 0 ? "text-green-600" : "text-red-500"}`}>{fp(units * oo.opLt)}</div></div>
              </div>
            </div>
          </div>
        );
      })()}

      {tab === "programs" && (
        <div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mb-5 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <strong className="text-zinc-900 dark:text-zinc-100">Two program archetypes decide everything.</strong> <em>Meter-based</em> programs pay for measured kWh reduction against a baseline and don't care what device achieved it — a non-export battery powering household loads qualifies directly. <em>Device-list</em> programs require an interconnected, export-capable ESS from an approved hardware list and pay per kW discharged to the grid — plug-in stations are categorically excluded from all of them.
          </div>
          {[
            ["yes", "Eligible — meter-based, device-agnostic", "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"],
            ["indirect", "Indirect — value via rates and wholesale routes", "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"],
            ["no", "Excluded — export / approved hardware required", "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"],
          ].map(([elig, heading, chipCls]) => (
            <div key={elig} className="mb-6">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">{heading}</p>
              {PROGRAMS.filter((prog) => prog.elig === elig).map((prog, i) => (
                <div key={i} className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 mb-3">
                  <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2 flex-wrap">
                    {prog.title}
                    <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${chipCls}`}>{prog.status}</span>
                  </h3>
                  <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">{prog.region}</p>
                  <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{prog.body} <span className={`font-medium ${elig === "no" ? "text-zinc-400" : "text-green-600"}`}>{prog.pay}</span>.</p>
                </div>
              ))}
            </div>
          ))}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4 text-xs text-amber-800 dark:text-amber-300 leading-relaxed space-y-1.5">
            <p><strong>Baseline erosion:</strong> meter-based rebates measure reduction against the customer's own recent usage. A fleet that shifts load daily lowers its own baselines over time, shrinking measured "reduction" and payment. CPP-overlay bill-avoidance is immune to this, which is why it's often the more durable value despite lower headline rates.</p>
            <p><strong>Enrollment friction:</strong> most Peak Time Rebate tariffs pay the resident/account-holder and offer no third-party aggregator pathway — a company-owned fleet captures the value through the service agreement, and each tariff needs legal review for assignment terms before scaling.</p>
            <p><strong>Volatility:</strong> program terms above were last verified July 2026 and change frequently (CA residential rebates sunset in 2025, OhmConnect exited Texas retail in 2026, Wattsmart restructured mid-2026). Re-verify against the official tariff before underwriting.</p>
          </div>
        </div>
      )}

      {tab === "pitch" && (
        <div>
          <div className={`text-center py-8 px-6 rounded-xl mb-6 ${r.net > 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
            <div className={`text-2xl font-medium mb-1 ${r.net > 0 ? "text-green-600" : "text-red-500"}`}>
              {r.net <= 0 ? "Don’t buy it for the arbitrage" : r.pb <= 5 ? `Pays for itself in ${r.pb.toFixed(1)} years` : r.pb <= LIFE ? `Pays back in ${r.pb.toFixed(1)} years` : "Payback longer than battery life"}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {r.net <= 0 ? `On ${p.n}, a ${curBat.n} can’t earn back its cost.` : r.pb <= 5 ? `Then ${fm(r.net)}/yr savings (growing with rates). ${fp(r.lt)} over 10 years.` : r.pb <= LIFE ? `Lifetime net: ${fp(r.lt)}. Revenue grows as rates rise.` : `${r.pb.toFixed(1)} years vs 10-yr battery life.`}
            </p>
          </div>

          <div className="space-y-3">
            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2"><i className="ti ti-cash" aria-hidden="true" />Save money in the corner</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed"><span className="text-xl font-medium text-zinc-900 dark:text-zinc-100 block mb-1">{fm(r.net)}/yr</span>Just plug it in. The battery charges off-peak when electricity is cheap and discharges on-peak when it's expensive. No installer, no panel work, no permits.</p>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2"><i className="ti ti-volume-off" aria-hidden="true" />Set it and forget it</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">Smaller than a side table. Silent. Plug into any 120V outlet. It learns your TOU schedule and runs itself. Tucks into a corner or utility closet, just keep the ventilation clear per manufacturer guidelines.</p>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2"><i className="ti ti-arrows-move" aria-hidden="true" />Take it with you</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">A hardwired Powerwall stays with the house. A plug-in battery stays with you. Move apartments, switch cities, change utilities, change TOU plans. Unplug, pack, replug. For the 44 million US renter households who can't install permanent equipment, this is the only residential storage option that works. And on weekends, take it camping, tailgating, or on an RV trip. It runs a mini-fridge, charges phones, powers lights, and keeps a CPAP running all night. Same battery, two lives.</p>
            </div>

            <div className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2 flex items-center gap-2"><i className="ti ti-plug" aria-hidden="true" />Backup power, every day</h3>
              <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed">Unlike a generator that sits in the garage for emergencies only, this battery works every single day earning back its cost — and it's always charged when you need it most. Keep your router, phone, laptop, and medical devices running through an outage. Run a box fan or space heater for several hours. Power a CPAP machine through the night. A {curBat.kw.toFixed(1)} kWh battery can run a typical home office setup for <span className="font-medium text-zinc-900 dark:text-zinc-100">{Math.round(curBat.kw / 0.4)} hours</span> or keep a fridge cold for <span className="font-medium text-zinc-900 dark:text-zinc-100">{Math.round(curBat.kw / 0.15)} hours</span> — without burning a drop of fuel or making any noise.</p>
            </div>
          </div>
        </div>
      )}

      <div className="mt-10 pt-4 border-t border-zinc-200 dark:border-zinc-800 text-[11px] text-zinc-400 dark:text-zinc-500 leading-relaxed">
        <span className="font-data uppercase tracking-wider">Methodology</span> — Arbitrage = daily peak-window discharge × (peak − charge rate ÷ {Math.round(RTE * 100)}% RTE) × seasonal cycles, with {(curBat.dg * 100).toFixed(1)}%/yr capacity fade and {esc.toFixed(1)}%/yr rate escalation over a {LIFE}-year life. Operator cash flows are haircut by compounding churn; homeowner cash flows are shown as experienced by a retained customer. Tariff rates compiled from published utility schedules and DR values from CPUC, PJM/ISO auction results, and program administrators as of mid-2026 — verify against current tariffs before underwriting. Screening estimates only; not tariff, tax, or investment advice.
      </div>
    </div>
  );
}
