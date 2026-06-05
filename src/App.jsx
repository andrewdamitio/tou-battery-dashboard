import { useState, useMemo, useCallback } from "react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, Area, ResponsiveContainer } from "recharts";

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
  { id: "s", n: "Small (1\u20132 kWh)" },
  { id: "m", n: "Medium (2\u20133.5 kWh)" },
  { id: "l", n: "Large (3.5\u20136 kWh)" },
  { id: "x", n: "X-Large (6+ kWh)" },
];

const PL = [
  { id: "se5", n: "SDG&E EV-TOU-5", st: "CA", ev: true, sP: 71.1, sC: 12, wP: 47.8, wC: 11.4, sY: 153, wY: 212, inc: 0, ph: 5, phLabel: "4\u20139 PM daily", cpp: { a: 50, e: 12, mn: 1, mx: 18, n: "EV-TOU-5-P", src: "Up to 18/yr per SDG&E" } },
  { id: "pe2", n: "PG&E EV2-A", st: "CA", ev: true, sP: 54, sC: 23, wP: 41, wC: 23, sY: 122, wY: 243, inc: 0, ph: 5, phLabel: "4\u20139 PM daily", cpp: { a: 60, e: 12, mn: 9, mx: 15, n: "SmartRate", src: "9\u201315/yr per PG&E" } },
  { id: "rel", n: "Reliant Free Nights", st: "TX", ev: false, sP: 27.9, sC: 0, wP: 27.9, wC: 0, sY: 153, wY: 212, inc: 9.95, ph: 15, phLabel: "6 AM\u20139 PM (charge free 9 PM\u20136 AM)" },
  { id: "txu", n: "TXU Free Nights", st: "TX", ev: false, sP: 25, sC: 0, wP: 25, wC: 0, sY: 153, wY: 212, inc: 9.95, ph: 15, phLabel: "6 AM\u20139 PM (charge free 9 PM\u20136 AM)" },
  { id: "aps", n: "APS R-TOU-E", st: "AZ", ev: false, sP: 34.4, sC: 12.3, wP: 32.5, wC: 3.5, sY: 131, wY: 129, inc: 0, ph: 5, phLabel: "3\u20138 PM weekdays" },
  { id: "sce", n: "SCE TOU-D-PRIME", st: "CA", ev: false, sP: 58, sC: 25, wP: 38, wC: 25, sY: 122, wY: 243, inc: 24, ph: 5, phLabel: "4\u20139 PM daily", cpp: { a: 80, e: 12, mn: 1, mx: 12, n: "PRIME-CPP", src: "Max 12/yr per CPUC" } },
  { id: "pel", n: "PG&E E-ELEC", st: "CA", ev: false, sP: 57, sC: 31, wP: 41, wC: 31, sY: 122, wY: 243, inc: 0, ph: 5, phLabel: "4\u20139 PM daily", cpp: { a: 60, e: 12, mn: 9, mx: 15, n: "SmartRate", src: "9\u201315/yr per PG&E" } },
  { id: "sdr", n: "SDG&E TOU-DR1", st: "CA", ev: false, sP: 68, sC: 33, wP: 42, wC: 31, sY: 153, wY: 212, inc: 0, ph: 5, phLabel: "4\u20139 PM daily", cpp: { a: 50, e: 12, mn: 1, mx: 18, n: "TOU-DR-P", src: "Up to 18/yr per SDG&E" } },
  { id: "fpl", n: "FPL TOU", st: "FL", ev: false, sP: 26, sC: 9, wP: 26, wC: 9, sY: 150, wY: 108, inc: 0, ph: 9, phLabel: "Noon\u20139 PM weekdays (summer); split peak winter" },
  { id: "psg", n: "PSEG-LI 195", st: "NY", ev: false, sP: 38, sC: 12, wP: 22, wC: 12, sY: 88, wY: 172, inc: 0, ph: 12, phLabel: "10 AM\u201310 PM weekdays" },
  { id: "con", n: "ConEd SC-1 II", st: "NY", ev: false, sP: 35, sC: 15, wP: 25, wC: 15, sY: 88, wY: 172, inc: 0, ph: 14, phLabel: "8 AM\u201310 PM weekdays" },
  { id: "xce", n: "Xcel CO TOU", st: "CO", ev: false, sP: 28, sC: 10, wP: 18, wC: 10, sY: 88, wY: 172, inc: 0, ph: 5, phLabel: "3\u20138 PM weekdays" },
  { id: "smu", n: "SMUD ToD", st: "CA", ev: false, sP: 37.65, sC: 12.85, wP: 17.76, wC: 12.85, sY: 88, wY: 172, inc: 0, ph: 3, phLabel: "5\u20138 PM daily", cpp: { a: 50, e: 15, mn: 1, mx: 25, n: "SMUD CPP", src: "Max 50 hrs/summer" } },
  { id: "duk", n: "Duke NC Solar", st: "NC", ev: false, sP: 21, sC: 11, wP: 16, wC: 11, sY: 110, wY: 150, inc: 0, ph: 4, phLabel: "3\u20137 PM weekdays" },
  { id: "ced", n: "ComEd Hourly", st: "IL", ev: false, sP: 20, sC: 7, wP: 16, wC: 7, sY: 153, wY: 212, inc: 0, ph: 5, phLabel: "Dynamic hourly pricing" },
  { id: "pge", n: "PGE Time of Day", st: "OR", ev: false, sP: 43.65, sC: 9.01, wP: 43.65, wC: 9.01, sM: 16.89, wM: 16.89, sY: 128, wY: 127, inc: 0, ph: 4, phLabel: "5\u20139 PM weekdays" },
  { id: "srp", n: "SRP E-27 TOU", st: "AZ", ev: false, sP: 28.0, sC: 7.5, wP: 13.5, wC: 7.5, sY: 131, wY: 123, inc: 0, ph: 5, phLabel: "3\u20138 PM weekdays" },
  { id: "nve", n: "NV Energy TOU-D-1", st: "NV", ev: false, sP: 23.5, sC: 8.5, wP: 13.0, wC: 8.5, sY: 87, wY: 167, inc: 0, ph: 6, phLabel: "1\u20137 PM weekdays" },
  { id: "heco", n: "HECO TOU-R", st: "HI", ev: false, sP: 54.0, sC: 28.0, wP: 54.0, wC: 28.0, sY: 183, wY: 182, inc: 0, ph: 4, phLabel: "5\u20139 PM daily" },
  { id: "rmp", n: "Rocky Mountain Power R-TO", st: "UT", ev: false, sP: 16.5, sC: 7.8, wP: 10.5, wC: 7.8, sY: 87, wY: 167, inc: 0, ph: 6, phLabel: "2\u20138 PM weekdays" },
  { id: "ipco", n: "Idaho Power TOD-I", st: "ID", ev: false, sP: 16.0, sC: 6.5, wP: 10.0, wC: 6.5, sY: 65, wY: 189, inc: 0, ph: 6, phLabel: "3\u20139 PM weekdays" },
  { id: "dom", n: "Dominion DOM-TOU", st: "VA", ev: false, sP: 21.0, sC: 7.5, wP: 10.5, wC: 7.5, sY: 87, wY: 167, inc: 0, ph: 3, phLabel: "6\u20139 PM weekdays" },
  { id: "gpc", n: "Georgia Power TOU-RD", st: "GA", ev: false, sP: 24.0, sC: 6.5, wP: 8.5, wC: 6.5, sY: 87, wY: 167, inc: 0, ph: 5, phLabel: "2\u20137 PM weekdays" },
  { id: "evsma", n: "Eversource MA TOU", st: "MA", ev: false, sP: 31.0, sC: 16.5, wP: 26.0, wC: 14.0, sY: 131, wY: 123, inc: 0, ph: 11, phLabel: "9 AM\u20138 PM weekdays" },
  { id: "teco", n: "Tampa Electric TOU", st: "FL", ev: false, sP: 20.5, sC: 7.5, wP: 10.5, wC: 7.5, sY: 87, wY: 167, inc: 0, ph: 10, phLabel: "11 AM\u20139 PM weekdays" },
  { id: "pse", n: "Puget Sound Energy TOU", st: "WA", ev: false, sP: 17.5, sC: 9.0, wP: 17.5, wC: 9.0, sY: 183, wY: 182, inc: 0, ph: 3, phLabel: "6\u20139 PM daily" },
  { id: "cus", n: "Custom plan", st: "\u2014", ev: false, custom: true },
];

const PROGRAMS = [
  { title: "Critical peak pricing overlays", status: "Live", region: "SDG&E (up to 18/yr), SCE (up to 12), PG&E SmartRate (9\u201315), SMUD (max 50 hrs/summer)", body: "CPP adds $0.50\u2013$0.80/kWh above the normal peak rate during called events.", pay: "$20\u2013$50/yr additional", note: "Included in the Model tab with an adjustable event slider." },
  { title: "Smart thermostat + battery stacking", status: "Live", region: "SCE SmartShift, PG&E SmartAC, OhmConnect, Xcel Saver\u2019s Switch", body: "These programs pay you to use less grid power during peak events. A battery can run your AC instead of the grid, so your house stays cool and the utility credits you for the lower draw.", pay: "$50\u2013$200/yr" },
  { title: "PJM / ISO-NE coincident peak avoidance", status: "Live", region: "All PJM and ISO-NE utilities", body: "Your capacity tag is set by usage during the grid\u2019s top peak hours. Battery discharge reduces next year\u2019s capacity costs.", pay: "$50\u2013$300/yr" },
  { title: "California ELRP", status: "Live", region: "PG&E, SCE, SDG&E (May\u2013Oct)", body: "$2/kWh for verified load reduction during grid emergencies.", pay: "$50\u2013$100/yr" },
  { title: "New York BYOB", status: "Launching", region: "ConEd, Central Hudson, O&R launching; PSEG-LI since 2019", body: "Currently restricted to hardwired ESS.", pay: "~$250/kW-summer" },
  { title: "ConnectedSolutions", status: "Live", region: "Eversource, National Grid (MA, CT, RI, NH)", body: "Currently requires approved hardware.", pay: "$225\u2013$900/yr" },
];

const RTE = 0.85;
const LIFE = 10;

const bl = (sq) => 1.0 + 0.0005 * sq;
const ak = (a, sq) => (a.sf ? a.sf(sq) : a.k);
const fm = (v) => (v < 0 ? "-" : "") + "$" + Math.abs(Math.round(v)).toLocaleString();
const fp = (v) => (v >= 0 ? "+" : "-") + "$" + Math.abs(Math.round(v)).toLocaleString();

function MetricCard({ label, value, positive }) {
  const color = positive === true ? "text-green-600" : positive === false ? "text-red-500" : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
      <div className="text-sm text-zinc-500 dark:text-zinc-400 mb-1">{label}</div>
      <div className={`text-2xl font-medium ${color}`}>{value}</div>
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

  const loads = useMemo(() => {
    const ph = curPlan?.ph || 5;
    if (src === "bill") {
      const b = billLoads();
      const f = appLoads(ph);
      return { summer: b.summer ?? f.summer, winter: b.winter ?? f.winter };
    }
    return appLoads(ph);
  }, [src, appLoads, billLoads, curPlan]);

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
    { id: "model", label: "Model" },
    { id: "programs", label: "Peak shaving programs" },
    { id: "pitch", label: "Sales pitch" },
  ];

  const r = result;
  const p = curPlan;

  return (
    <div className="max-w-[680px] mx-auto">
      <div className="flex gap-1 border-b border-zinc-200 dark:border-zinc-700 mb-6">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-5 py-3 text-sm font-medium border-b-2 -mb-px transition-colors ${tab === t.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}>{t.label}</button>
        ))}
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
                  <span className="text-zinc-500 dark:text-zinc-400 flex-1">{p.cpp.a}\u00a2/kWh adder</span>
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
                  <DetailRow label="Summer peak" value={`${p.sP.toFixed(1)}\u00a2`} />
                  {p.sM != null && <DetailRow label="Mid-peak (ignored)" value={`${p.sM.toFixed(1)}\u00a2`} />}
                  <DetailRow label="Summer charge" value={p.sC === 0 ? "Free" : `${p.sC.toFixed(1)}\u00a2`} />
                  <DetailRow label="Winter peak" value={`${p.wP.toFixed(1)}\u00a2`} />
                  {p.wM != null && <DetailRow label="Mid-peak (ignored)" value={`${p.wM.toFixed(1)}\u00a2`} />}
                  <DetailRow label="Winter charge" value={p.wC === 0 ? "Free" : `${p.wC.toFixed(1)}\u00a2`} />
                  <DetailRow label="Peak hours" value={p.phLabel || `${p.ph || 5} hrs/day`} />
                  <DetailRow label="Cycles/yr" value={p.sY + p.wY} />
                  <DetailRow label="TOU incremental" value={p.inc > 0 ? `$${p.inc.toFixed(2)}/mo` : "$0/mo"} />
                </div>
                {p.sM != null && <p className="mt-1.5 text-xs text-zinc-400 dark:text-zinc-500">Mid-peak hours are economically idle for arbitrage \u2014 the battery holds charge and waits for the on-peak window.</p>}
              </>
            ) : (
              <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg grid grid-cols-2 gap-3">
                {[["Summer peak (\u00a2)", "sP"], ["Summer charge (\u00a2)", "sC"], ["Winter peak (\u00a2)", "wP"], ["Winter charge (\u00a2)", "wC"], ["Summer cycles", "sY"], ["Winter cycles", "wY"], ["TOU incr ($/mo)", "inc"], ["Peak window (hrs)", "ph"]].map(([lbl, key]) => (
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
              {["appliance", "bill"].map((s) => <button key={s} onClick={() => setSrc(s)} className={`flex-1 py-2 px-3 text-sm font-medium rounded-md transition-colors ${src === s ? "bg-white dark:bg-zinc-700 text-zinc-900 dark:text-zinc-100" : "text-zinc-500"}`}>{s === "appliance" ? "Appliance toggles" : "From my electric bill"}</button>)}
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
                                    <button onClick={() => updateCnt(a.id, -1)} className="w-6 h-6 flex items-center justify-center rounded text-sm border border-zinc-300 dark:border-zinc-600">{"\u2212"}</button>
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
                {[["Summer bills", "Jun\u2013Sep typically", billS, setBillS, sShare, setSShare, sUnk, setSUnk, "bsm"], ["Winter bills", "Dec\u2013Mar typically", billW, setBillW, wShare, setWShare, wUnk, setWUnk, "bwm"]].map(([title, hint, vals, setVals, share, setShareFn, unk, setUnkFn, key]) => (
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
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2 flex items-center gap-2"><span className="w-5 h-5 rounded-full bg-blue-500 text-white text-xs flex items-center justify-center font-medium">3</span>Battery</p>
            <div className="flex gap-2 items-center mb-3">
              <select value={bat} onChange={(e) => setBat(e.target.value)} className="flex-1 p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800">
                {BCT.map((cat) => <optgroup key={cat.id} label={cat.n}>{BB.filter((b) => b.ct === cat.id).map((b) => <option key={b.id} value={b.id}>{b.n} \u2014 {b.kw.toFixed(2)} kWh, {b.pw} kW, {b.vo}V \u2014 ${b.c.toLocaleString()}</option>)}</optgroup>)}
              </select>
              <button onClick={recommend} className="px-3 py-3 rounded-lg border border-zinc-300 dark:border-zinc-600 text-sm hover:bg-zinc-100 dark:hover:bg-zinc-700"><i className="ti ti-sparkles" aria-hidden="true" /> Find best</button>
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

      {tab === "programs" && (
        <div>
          <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4 mb-5 text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">
            <strong className="text-zinc-900 dark:text-zinc-100">How peak shaving works without export.</strong> During grid stress events, a plug-in battery powers your home's loads directly, reducing what the utility meter sees. The battery never pushes power back onto the grid.
          </div>
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-3">Programs that work via behind-the-meter load reduction</p>
          {PROGRAMS.map((prog, i) => (
            <div key={i} className="border border-zinc-200 dark:border-zinc-700 rounded-xl p-5 mb-3">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2">
                {prog.title}
                <span className={`text-xs px-2 py-0.5 rounded-md font-medium ${prog.status === "Live" ? "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400" : "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"}`}>{prog.status === "Launching" ? "Launching 2026" : prog.status}</span>
              </h3>
              <p className="text-xs text-zinc-400 dark:text-zinc-500 mb-2">{prog.region}</p>
              <p className="text-sm text-zinc-600 dark:text-zinc-300 leading-relaxed">{prog.body} <span className="font-medium text-green-600">{prog.pay}</span>.{prog.note ? ` ${prog.note}` : ""}</p>
            </div>
          ))}
        </div>
      )}

      {tab === "pitch" && (
        <div>
          <div className={`text-center py-8 px-6 rounded-xl mb-6 ${r.net > 0 ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
            <div className={`text-2xl font-medium mb-1 ${r.net > 0 ? "text-green-600" : "text-red-500"}`}>
              {r.net <= 0 ? "Don\u2019t buy it for the arbitrage" : r.pb <= 5 ? `Pays for itself in ${r.pb.toFixed(1)} years` : r.pb <= LIFE ? `Pays back in ${r.pb.toFixed(1)} years` : "Payback longer than battery life"}
            </div>
            <p className="text-sm text-zinc-500 dark:text-zinc-400">
              {r.net <= 0 ? `On ${p.n}, a ${curBat.n} can\u2019t earn back its cost.` : r.pb <= 5 ? `Then ${fm(r.net)}/yr savings (growing with rates). ${fp(r.lt)} over 10 years.` : r.pb <= LIFE ? `Lifetime net: ${fp(r.lt)}. Revenue grows as rates rise.` : `${r.pb.toFixed(1)} years vs 10-yr battery life.`}
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
    </div>
  );
}
