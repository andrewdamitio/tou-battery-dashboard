import { useState, useMemo, useEffect } from "react";
import {
  LineChart, Line, XAxis, YAxis, Tooltip, ReferenceLine, ResponsiveContainer,
  Legend, BarChart, Bar, ComposedChart, Area, Cell,
} from "recharts";
import {
  PLANS, BATTERIES, BAT_CLASSES, APPLIANCE_CATS, ALL_APPLIANCES, MONTHS,
  DR_PROGRAMS, HARDWIRED_ONLY, baselineKw,
} from "./tariffs.js";
import {
  annualArbitrage, drRevenue, projectAsset, operatorEconomics, fleetEconomics,
  billComparison, rateShapeForMonth, chargeWindow, servabilityFailure, rankBatteries,
  USABLE_SOC, RTE,
} from "./model.js";

const LIFE = 10;
const fm = (v) => (v < 0 ? "-" : "") + "$" + Math.abs(Math.round(v)).toLocaleString();
const fp = (v) => (v >= 0 ? "+" : "-") + "$" + Math.abs(Math.round(v)).toLocaleString();
const pct = (v) => (v == null ? "n/a" : (v * 100).toFixed(1) + "%");

const PLANS_SORTED = [...PLANS].sort((a, b) => (a.custom ? -1 : b.custom ? 1 : a.n.localeCompare(b.n)));

function Metric({ label, value, sub, positive }) {
  const color = positive === true ? "text-green-600" : positive === false ? "text-red-500" : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</div>
      <div className={`font-data text-xl font-medium ${color}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-1">{sub}</div>}
    </div>
  );
}

function Row({ label, value, hint }) {
  return (
    <div className="flex justify-between py-1 text-sm gap-4">
      <span className="text-zinc-500 dark:text-zinc-400">{label}{hint && <span className="text-zinc-400 dark:text-zinc-500 text-xs ml-1.5">{hint}</span>}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right whitespace-nowrap">{value}</span>
    </div>
  );
}

function Slider({ label, value, onChange, min, max, step = 1, fmt = (v) => v, hint, disabled = false }) {
  return (
    <div className={`flex items-center gap-3 text-sm flex-wrap ${disabled ? "opacity-50" : ""}`}>
      <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled} onChange={(e) => onChange(+e.target.value)} className="flex-1 min-w-[120px] max-w-[200px]" />
      <span className="font-medium min-w-[70px]">{fmt(value)}</span>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}

function Note({ children, tone = "zinc" }) {
  const tones = {
    zinc: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
    amber: "bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300",
    red: "bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
  };
  return <div className={`rounded-lg p-3 text-xs leading-relaxed ${tones[tone]}`}>{children}</div>;
}

export default function Dashboard() {
  const [tab, setTab] = useState("model");

  // --- consumer inputs
  const [planId, setPlanId] = useState("sdr");
  const [custom, setCustom] = useState({
    rPeakS: 30, rOffS: 10, rPeakW: 25, rOffW: 10, peakStart: 16, peakEnd: 21, fixed: 0, weekdayOnly: false,
    cppOn: false, cppName: "Custom CPP", cppAdder: 50, cppEvMin: 1, cppEvMax: 18, cppEvDefault: 12,
  });
  const [sq, setSq] = useState(1600);
  const [counts, setCounts] = useState({ wac: 2, xfr: 1, tv: 1, dw: 1 });
  const [batId, setBatId] = useState("al");
  const [evTimer, setEvTimer] = useState(false);
  const [ranking, setRanking] = useState(null);
  const [rankBuyer, setRankBuyer] = useState("homeowner");
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(APPLIANCE_CATS.map((_, i) => [i, i !== 1])));
  const [chartMonth, setChartMonth] = useState(6);

  // --- DR inputs
  const [dispatchSuccess, setDispatchSuccess] = useState(95);
  const [drEnabled, setDrEnabled] = useState({ cpp: true, elrp: false, ptr: false, cpk: false, whl: false });
  const [drOverrides, setDrOverrides] = useState({ cpk: 40, whl: 0 });
  const [cppEvents, setCppEvents] = useState(null);

  // --- operator inputs
  const [hwPct, setHwPct] = useState(55);
  const [cac, setCac] = useState(150);
  const [svcMo, setSvcMo] = useState(3);
  const [churn, setChurn] = useState(8);
  const [bizModel, setBizModel] = useState("split");
  const [subFee, setSubFee] = useState(15);
  const [splitPct, setSplitPct] = useState(65);
  const [upfront, setUpfront] = useState(0);
  const [discount, setDiscount] = useState(12);
  const [settlement, setSettlement] = useState("actual");
  const [deemedSpread, setDeemedSpread] = useState(null);

  // --- fleet inputs
  const [perMonth, setPerMonth] = useState(100);
  const [rampMonths, setRampMonths] = useState(24);
  const [recoveryRate, setRecoveryRate] = useState(60);
  const [refurb, setRefurb] = useState(120);
  const [minAggKw, setMinAggKw] = useState(100);

  const plan = useMemo(() => {
    const p = PLANS.find((x) => x.id === planId);
    if (!p.custom) return p;
    const peak = [];
    for (let h = custom.peakStart; h < custom.peakEnd; h++) peak.push(h % 24);
    return {
      ...p,
      weekdayOnly: custom.weekdayOnly,
      fixed: custom.fixed,
      s: { ...p.s, peak, rPeak: custom.rPeakS, rOff: custom.rOffS, partial: null, superOff: null },
      w: { ...p.w, peak, rPeak: custom.rPeakW, rOff: custom.rOffW, partial: null, superOff: null },
      phLabel: `${custom.peakStart}:00–${custom.peakEnd}:00 ${custom.weekdayOnly ? "weekdays" : "daily"}`,
      cpp: custom.cppOn ? {
        n: custom.cppName || "Custom CPP", adder: custom.cppAdder,
        ev: custom.cppEvDefault, mn: custom.cppEvMin, mx: custom.cppEvMax, src: "user-defined",
      } : undefined,
    };
  }, [planId, custom]);

  const bat = useMemo(() => BATTERIES.find((b) => b.id === batId), [batId]);

  // Tariffs that require an EV are meaningless without EV load in the model.
  const EV_CAT = APPLIANCE_CATS.findIndex((c) => c.t === "EV charging");
  useEffect(() => { if (plan.ev) setCollapsed((p) => ({ ...p, [EV_CAT]: false })); }, [plan.ev, EV_CAT]);
  const evLoad = (counts.e1 || 0) + (counts.e2 || 0);

  // Charging schedule, not charger size, decides whether an EV is worth anything
  // to a battery. A timer that already charges off-peak leaves nothing to shift.
  const applianceOverrides = useMemo(() => (
    evTimer ? { e1: { prof: "overnight" }, e2: { prof: "overnight" } }
            : { e1: { prof: "evNoTimer" }, e2: { prof: "evNoTimer" } }
  ), [evTimer]);

  // -------------------------------------------------------------------------
  // MODEL
  // -------------------------------------------------------------------------
  const eventDays = useMemo(() => {
    let e = 0;
    DR_PROGRAMS.forEach((p) => { if (drEnabled[p.id] && p.basis === "baseline" && (!p.st || p.st.includes(plan.st))) e = Math.max(e, p.events); });
    return e;
  }, [drEnabled, plan.st]);

  const anyDrActive = useMemo(
    () => DR_PROGRAMS.some((p) => drEnabled[p.id] && (!p.st || p.st.includes(plan.st)) && (p.basis !== "avoidance" || !!plan.cpp)),
    [drEnabled, plan.st, plan.cpp]
  );

  // The battery always shaves every peak day for TOU savings — it never idles
  // to protect a Peak Time Rebates / ELRP baseline. A battery that only pencils
  // out by sitting idle isn't a battery worth buying, so that strategy isn't
  // modeled. Baseline-basis programs stay toggleable in Programs below and are
  // shown honestly at $0: their measured-reduction credit needs a baseline
  // this battery's daily use has already eroded to nothing.
  const preserve = 0;

  const arb = useMemo(
    () => annualArbitrage({ plan, bat, counts, sq, applianceOverrides, preserve, eventDays }),
    [plan, bat, counts, sq, applianceOverrides, eventDays]
  );

  const dr = useMemo(
    () => drRevenue({ plan, bat, arb, enabled: drEnabled, preserve, dispatchSuccess: dispatchSuccess / 100, cppEvents, overrides: drOverrides, programs: DR_PROGRAMS }),
    [plan, bat, arb, drEnabled, dispatchSuccess, cppEvents, drOverrides]
  );

  const assetRows = useMemo(() => projectAsset({
    plan, bat, counts, sq, applianceOverrides, years: LIFE, preserve, eventDays,
    drFn: (a, capFrac) => drRevenue({ plan, bat, arb: a, enabled: drEnabled, preserve, dispatchSuccess: dispatchSuccess / 100, cppEvents, overrides: drOverrides, programs: DR_PROGRAMS, capFrac }).total,
    hwCostFn: () => bat.c,
  }), [plan, bat, counts, sq, applianceOverrides, eventDays, drEnabled, dispatchSuccess, cppEvents, drOverrides]);

  const effDeemed = deemedSpread ?? Math.round(arb.spreadC);

  const op = useMemo(() => operatorEconomics({
    assetRows, bat, hwPct, cac, svcMo, churn, bizModel, subFee, splitPct, upfront,
    planFixed: plan.fixed, discount, settlement, deemedSpreadC: effDeemed,
  }), [assetRows, bat, hwPct, cac, svcMo, churn, bizModel, subFee, splitPct, upfront, plan.fixed, discount, settlement, effDeemed]);

  const deliverableKw = useMemo(() => {
    const m = arb.months[6];
    if (!m) return 0;
    return Math.max(...m.dischargeShape);
  }, [arb]);

  const fleet = useMemo(() => fleetEconomics({
    unitOpFlows: op.opFlows, perMonth, rampMonths, horizonYears: LIFE, discount,
    recoveryRate, churn, hw: op.hw, refurb, deliverableKw,
    dispatchSuccess: dispatchSuccess / 100, minAggKw,
  }), [op.opFlows, perMonth, rampMonths, discount, recoveryRate, churn, op.hw, refurb, deliverableKw, dispatchSuccess, minAggKw]);

  const bills = useMemo(() => billComparison({ plan, arb, counts, sq, bat, applianceOverrides }), [plan, arb, counts, sq, bat, applianceOverrides]);

  // 24-hour dispatch series for the selected month
  const daySeries = useMemo(() => {
    const m = arb.months[chartMonth];
    if (!m) return [];
    const rs = rateShapeForMonth(plan, chartMonth);
    const cw = chargeWindow(rs.weekday);
    const cap = bat.kw * USABLE_SOC;
    let soc = 0;
    const out = [];
    for (let h = 0; h < 24; h++) {
      const charging = rs.weekday[h] <= cw.rate + 0.5 ? Math.min(bat.ck, cap - soc) : 0;
      soc = Math.min(cap, soc + charging);
      const disc = Math.min(m.dischargeShape[h], soc);
      soc = Math.max(0, soc - disc);
      out.push({
        h: `${h}`.padStart(2, "0"),
        rate: +m.rateShape[h].toFixed(1),
        total: +m.totalLoadShape[h].toFixed(3),
        addressable: +m.loadShape[h].toFixed(3),
        discharge: +disc.toFixed(3),
        grid: +Math.max(0, m.totalLoadShape[h] - disc).toFixed(3),
        charge: +charging.toFixed(3),
        soc: +soc.toFixed(2),
      });
    }
    return out;
  }, [arb, chartMonth, plan, bat]);

  const runRanking = () => {
    const opMode = rankBuyer === "operator";
    setRanking(rankBatteries({
      plan, batteries: BATTERIES, counts, sq, applianceOverrides,
      years: LIFE, preserve, eventDays, discount,
      hwPct: opMode ? hwPct : 100,
      drFn: (b, a, capFrac) => drRevenue({
        plan, bat: b, arb: a, enabled: opMode ? drEnabled : { cpp: true },
        preserve, dispatchSuccess: dispatchSuccess / 100,
        cppEvents, overrides: drOverrides, programs: DR_PROGRAMS, capFrac,
      }).total,
    }));
  };

  const BIND_TEXT = {
    energy: ["Stored energy", "The battery empties before the peak window ends. A bigger pack helps; a bigger inverter does not."],
    power: ["Inverter power", "Load in the peak window exceeds the inverter's continuous rating, so some of it stays on the meter even with energy left in the pack. A higher-output unit helps; more kWh does not."],
    charge: ["Charge window", "The off-peak window is too short to refill the pack at its AC input rate, so it starts the next peak partly empty. A faster-charging unit helps."],
    load: ["Addressable load", "The battery has energy and power to spare — there simply isn't enough servable load in the peak window to use it. A bigger battery is wasted money; unlocking hardwired loads or a wider peak window is what helps."],
    none: ["None", "No profitable discharge on this tariff."],
  };

  const setCount = (id, delta) => setCounts((prev) => {
    const cur = prev[id] || 0;
    const nv = Math.max(0, Math.min(6, cur + delta));
    const next = { ...prev };
    if (nv === 0) delete next[id]; else next[id] = nv;
    return next;
  });

  const eolYear = assetRows.findIndex((r) => r.cumCycles > bat.cyc) + 1;
  const y1 = assetRows[0] || { arbUSD: 0, drUSD: 0 };

  // Does either side of this deal actually make money? Computed once, at the
  // top level, so it can drive the sticky verdict strip on every tab, not
  // just the Unit economics tab where the full banner lives.
  const dealHo = op.hoYr1 > 0;
  const dealOp = op.opIRR !== null && op.opIRR * 100 > discount;

  const tabs = [
    { id: "model", label: "Customer bill" },
    { id: "dr", label: "DR stack" },
    { id: "operator", label: "Unit economics" },
    { id: "fleet", label: "Fleet & funding" },
    { id: "programs", label: "Program reference" },
  ];

  return (
    <div className="max-w-[860px] mx-auto pb-16 px-1">
      <div className="mb-6 pt-2">
        <div className="font-data text-[11px] tracking-[0.2em] uppercase text-blue-600 dark:text-blue-400 mb-2">BTM fleet console</div>
        <h1 className="font-display text-[26px] leading-tight font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Can plug-in batteries make money — for the company, and the customer?</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[620px]">
          Every tab feeds one question: at this tariff, this household, this battery, and this offer, does the homeowner actually
          save money, and does the operator actually clear its cost of capital? Dispatches a wall-outlet battery that backfeeds
          the home (never the grid) against an hourly tariff and load shape, then carries the result through degradation, DR
          baseline erosion, unit economics, and a fleet ramp — no step is allowed to flatter the answer.
        </p>
      </div>

      <div className="flex gap-0.5 border-b border-zinc-200 dark:border-zinc-700 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}>{t.label}</button>
        ))}
      </div>

      <div className="sticky top-2 z-10 mb-5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur flex flex-wrap items-center gap-x-4 gap-y-1.5">
        <div className="flex items-center gap-3 pr-3 border-r border-zinc-200 dark:border-zinc-700">
          <span className={`flex items-center gap-1.5 text-xs font-medium ${dealHo ? "text-green-600" : "text-red-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dealHo ? "bg-green-500" : "bg-red-500"}`} />Customer {dealHo ? fp(op.hoYr1) : fm(op.hoYr1)}/yr
          </span>
          <span className={`flex items-center gap-1.5 text-xs font-medium ${dealOp ? "text-green-600" : "text-red-500"}`}>
            <span className={`w-1.5 h-1.5 rounded-full ${dealOp ? "bg-green-500" : "bg-red-500"}`} />Operator {op.opIRR === null ? "no payback" : pct(op.opIRR) + " IRR"}
          </span>
        </div>
        {[["Plan", plan.n], ["Battery", bat.n], ["Limit", BIND_TEXT[arb.bindingConstraint][0]],
          ["TOU", fm(arb.usd) + "/yr"], ["DR", fm(dr.total) + "/yr"]].map(([k, v]) => (
          <div key={k} className="flex items-baseline gap-1.5 min-w-0">
            <span className="font-data text-[10px] uppercase tracking-wider text-zinc-400">{k}</span>
            <span className="font-data text-xs font-medium text-zinc-900 dark:text-zinc-100 truncate">{v}</span>
          </div>
        ))}
      </div>

      {/* ================================================================= */}
      {tab === "model" && (
        <div>
          {/* --- inputs --- */}
          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Tariff</p>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800">
              {PLANS_SORTED.map((p) => <option key={p.id} value={p.id}>{p.custom ? `-- ${p.n} --` : `${p.n} (${p.st})${p.ev ? " [EV req]" : ""}`}</option>)}
            </select>
            {plan.ev && <div className="mt-2"><Note tone={evLoad === 0 ? "amber" : "green"}>
              Requires a registered EV to enroll. {evLoad === 0
                ? "No EV charging is in the load model yet — scroll to the EV charging section below (highlighted) and add it, or the result describes a household that couldn't sign up for this rate."
                : `EV charging is in the model. It is usually the dominant shiftable load on these tariffs, and the ${plan.s.rPeak - plan.s.rOff}¢ spread is priced for exactly that.`}
            </Note></div>}
            {!plan.custom ? (
              <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
                <Row label="Summer peak / off" value={`${plan.s.rPeak}¢ / ${plan.s.rOff}¢`} />
                {plan.s.partial && <Row label="Summer partial-peak" value={`${plan.s.rPartial}¢`} hint={`${plan.s.partial.length} hrs`} />}
                {plan.s.superOff && <Row label="Summer super-off-peak" value={`${plan.s.rSuperOff}¢`} hint={`${plan.s.superOff.length} hrs`} />}
                <Row label="Winter peak / off" value={`${plan.w.rPeak}¢ / ${plan.w.rOff}¢`} />
                <Row label="Peak window" value={plan.phLabel} />
                <Row label="Plan premium" value={plan.fixed > 0 ? `$${plan.fixed}/mo` : "$0/mo"} />
                <Row label="Rates as of" value={plan.asOf} />
                {plan.approx && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">Two-period approximation — this tariff has partial-peak hours that aren't keyed in, so savings are understated.</p>}
              </div>
            ) : (
              <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg grid grid-cols-2 md:grid-cols-4 gap-3">
                {[["Summer peak ¢", "rPeakS"], ["Summer off ¢", "rOffS"], ["Winter peak ¢", "rPeakW"], ["Winter off ¢", "rOffW"], ["Peak start hr", "peakStart"], ["Peak end hr", "peakEnd"], ["Premium $/mo", "fixed"]].map(([lbl, k]) => (
                  <div key={k} className="flex flex-col gap-1">
                    <label className="text-xs text-zinc-500 dark:text-zinc-400">{lbl}</label>
                    <input type="number" value={custom[k]} onChange={(e) => setCustom((p) => ({ ...p, [k]: +e.target.value || 0 }))} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  </div>
                ))}
                <label className="flex items-center gap-2 text-xs text-zinc-500 dark:text-zinc-400 self-end pb-2">
                  <input type="checkbox" checked={custom.weekdayOnly} onChange={(e) => setCustom((p) => ({ ...p, weekdayOnly: e.target.checked }))} className="w-4 h-4" />Weekdays only
                </label>
              </div>
            )}
            {plan.custom && (
              <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <label className="flex items-center gap-2 text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-2">
                  <input type="checkbox" checked={custom.cppOn} onChange={(e) => setCustom((p) => ({ ...p, cppOn: e.target.checked }))} className="w-4 h-4" />
                  Add a CPP overlay
                </label>
                {custom.cppOn && (
                  <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                    <div className="flex flex-col gap-1 col-span-2 md:col-span-1">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">Overlay name</label>
                      <input type="text" value={custom.cppName} onChange={(e) => setCustom((p) => ({ ...p, cppName: e.target.value }))} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">Adder ¢/kWh</label>
                      <input type="number" value={custom.cppAdder} onChange={(e) => setCustom((p) => ({ ...p, cppAdder: +e.target.value || 0 }))} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">Min events/yr</label>
                      <input type="number" min={1} value={custom.cppEvMin} onChange={(e) => setCustom((p) => ({ ...p, cppEvMin: Math.max(1, +e.target.value || 1) }))} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">Max events/yr</label>
                      <input type="number" min={custom.cppEvMin} value={custom.cppEvMax} onChange={(e) => setCustom((p) => ({ ...p, cppEvMax: Math.max(p.cppEvMin, +e.target.value || p.cppEvMin) }))} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                    </div>
                    <div className="flex flex-col gap-1">
                      <label className="text-xs text-zinc-500 dark:text-zinc-400">Default events/yr</label>
                      <input type="number" min={custom.cppEvMin} max={custom.cppEvMax} value={custom.cppEvDefault} onChange={(e) => setCustom((p) => ({ ...p, cppEvDefault: Math.min(p.cppEvMax, Math.max(p.cppEvMin, +e.target.value || p.cppEvMin)) }))} className="p-2 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                    </div>
                  </div>
                )}
                <p className="text-xs text-zinc-400 mt-2 leading-relaxed">
                  Adds a CPP row to the DR stack tab exactly like a real tariff's overlay: on the events you set, the peak
                  price jumps by the adder above, and a battery serving load through the event avoids it. Bill avoidance,
                  not a rebate — no baseline to erode, and it stacks cleanly with daily TOU shaving.
                </p>
              </div>
            )}
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Household load</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-2 space-y-3">
              <Slider label="House size" value={sq} onChange={setSq} min={400} max={3500} step={50} fmt={(v) => v.toLocaleString() + " sq ft"} hint={`always-on ${baselineKw(sq).toFixed(2)} kW`} />
              <Note>
                Plugged into a wall outlet, the unit backfeeds the home's shared wiring the same way balcony solar does —
                power injected anywhere behind the meter offsets demand anywhere else on that panel, not just what's on the
                same circuit. So the always-on baseline (fridge, networking, standby) is fully reachable regardless of which
                outlet the unit is plugged into: 100%, not a slider. This assumes export-to-home is treated as legal and
                permitted, which is the premise the business runs on — it is not the case everywhere today.
              </Note>
            </div>
            {APPLIANCE_CATS.map((cat, ci) => {
              const active = cat.i.reduce((s, a) => s + (counts[a.id] || 0), 0);
              const open = !collapsed[ci];
              return (
                <div key={ci} className="mb-1">
                  <button onClick={() => setCollapsed((p) => ({ ...p, [ci]: !p[ci] }))} className={`w-full flex items-center gap-2 py-2 text-xs font-medium uppercase tracking-wider ${plan.ev && ci === EV_CAT ? "text-amber-600 dark:text-amber-400" : "text-zinc-400 dark:text-zinc-500"}`}>
                    <span className={`inline-block transition-transform ${open ? "" : "-rotate-90"}`}>▾</span>
                    {cat.t}{active > 0 && ` (${active})`}
                    {plan.ev && ci === EV_CAT && (
                      <span className={`ml-1 text-[10px] normal-case tracking-normal px-1.5 py-0.5 rounded font-medium ${evLoad === 0 ? "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400" : "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"}`}>
                        {evLoad === 0 ? "required by this tariff — none added" : "required by this tariff ✓"}
                      </span>
                    )}
                  </button>
                  {open && (
                    <>
                    {ci === EV_CAT && evLoad > 0 && (
                      <div className="flex items-center gap-2 flex-wrap mb-2 px-1">
                        <span className="text-[11px] text-zinc-500 dark:text-zinc-400">Charging schedule</span>
                        {[[false, "Plugs in on arrival"], [true, "Charges on a timer"]].map(([v, lbl]) => (
                          <button key={String(v)} onClick={() => setEvTimer(v)} className={`text-[11px] px-2 py-1 rounded-md font-medium border ${evTimer === v ? "bg-blue-500 border-blue-500 text-white" : "border-zinc-300 dark:border-zinc-600 text-zinc-500"}`}>{lbl}</button>
                        ))}
                      </div>
                    )}
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 pb-2">
                      {cat.i.map((a) => {
                        const n = counts[a.id] || 0;
                        const kwRun = a.szf ? a.szf(sq) : a.kwRun;
                        const surge = a.sgMult ? kwRun * a.sgMult : a.sg;
                        const fail = servabilityFailure(a, kwRun, surge, bat);
                        return (
                          <div key={a.id} className={`flex flex-col p-2 rounded-lg border text-sm ${n > 0 ? (fail ? "bg-amber-50 dark:bg-amber-900/20 border-amber-200 dark:border-amber-800" : "bg-blue-50 dark:bg-blue-900/30 border-blue-200 dark:border-blue-700") : "border-zinc-200 dark:border-zinc-700"}`}>
                            <div className="flex items-center gap-1.5">
                              <div className="flex-1 min-w-0">
                                <div className="font-medium text-zinc-900 dark:text-zinc-100 text-xs truncate">{a.n}</div>
                                <div className="text-[11px] text-zinc-400 dark:text-zinc-500">{kwRun.toFixed(2)} kW · {a.hrsDay} hr/d · {a.volts}V</div>
                              </div>
                              <div className="flex items-center gap-1">
                                <button onClick={() => setCount(a.id, -1)} className="w-6 h-6 rounded text-sm border border-zinc-300 dark:border-zinc-600">−</button>
                                <span className="w-4 text-center text-sm font-medium">{n}</span>
                                <button onClick={() => setCount(a.id, 1)} className="w-6 h-6 rounded text-sm border border-zinc-300 dark:border-zinc-600">+</button>
                              </div>
                            </div>
                            {n > 0 && fail && <div className="text-[10px] text-amber-700 dark:text-amber-400 mt-1 leading-snug">{fail}</div>}
                          </div>
                        );
                      })}
                    </div>
                    </>
                  )}
                </div>
              );
            })}
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Battery</p>
            <select value={batId} onChange={(e) => setBatId(e.target.value)} className="w-full p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 mb-2">
              {BAT_CLASSES.map((c) => (
                <optgroup key={c.id} label={c.n}>
                  {BATTERIES.filter((b) => b.ct === c.id).map((b) => <option key={b.id} value={b.id}>{b.n} — {b.kw} kWh, {b.pw} kW, {b.vo}V — {fm(b.c)}</option>)}
                </optgroup>
              ))}
            </select>

            {/* --- battery finder --- */}
            <div className="mb-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <div className="flex items-center gap-2 flex-wrap mb-2">
                <span className="text-sm text-zinc-500 dark:text-zinc-400">Rank all {BATTERIES.length} for a</span>
                <div className="flex gap-0.5 bg-white dark:bg-zinc-900 p-0.5 rounded-md">
                  {[["homeowner", "homeowner buying retail"], ["operator", "operator at volume"]].map(([id, lbl]) => (
                    <button key={id} onClick={() => { setRankBuyer(id); setRanking(null); }} className={`px-2.5 py-1 text-xs font-medium rounded ${rankBuyer === id ? "bg-blue-500 text-white" : "text-zinc-500"}`}>{lbl}</button>
                  ))}
                </div>
                <button onClick={runRanking} className="ml-auto px-3 py-1.5 text-xs font-medium rounded-md bg-blue-600 text-white hover:bg-blue-700">Find best</button>
              </div>
              <p className="text-xs text-zinc-400 leading-relaxed">
                Ranks by discounted net value over {LIFE} years at your {discount}% rate, against this tariff, this household, and
                this connection mode — purchase price, bill savings, {rankBuyer === "operator" ? "the DR stack you have enabled," : "CPP avoidance,"} and any
                mid-life replacement. {rankBuyer === "operator" ? `Hardware at ${hwPct}% of retail.` : "Hardware at full retail; DR revenue excluded, since a homeowner doesn't capture it."}
              </p>

              {ranking && (() => {
                const winners = ranking.filter((r) => r.npv > 0);
                const top = ranking[0];
                return (
                  <div className="mt-3">
                    <div className={`p-3 rounded-lg mb-2 text-xs leading-relaxed ${winners.length ? "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400" : "bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300"}`}>
                      {winners.length
                        ? <><strong>{top.bat.n}</strong> — NPV {fm(top.npv)}, payback {top.payback === Infinity ? "never" : top.payback.toFixed(1) + " yrs"}. {winners.length} of {ranking.length} clear the {discount}% hurdle.</>
                        : <><strong>Nothing clears the {discount}% hurdle on this configuration.</strong> {top.bat.n} is the least-bad at {fm(top.npv)}. This is the normal result for a homeowner at retail prices — it is the reason a company-owned fleet buying at volume is the model that works, and you can see that by switching the toggle above to operator.</>}
                    </div>
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead><tr className="text-zinc-400 text-left">
                          <th className="py-1 pr-2 font-medium">Unit</th><th className="py-1 px-2 font-medium text-right">Cost</th>
                          <th className="py-1 px-2 font-medium text-right">Yr 1</th><th className="py-1 px-2 font-medium text-right">NPV</th>
                          <th className="py-1 px-2 font-medium text-right">Payback</th><th className="py-1 pl-2 font-medium">Limited by</th>
                        </tr></thead>
                        <tbody>
                          {ranking.map((r, i) => (
                            <tr key={r.bat.id} onClick={() => setBatId(r.bat.id)} className={`cursor-pointer border-t border-zinc-200 dark:border-zinc-700 ${r.bat.id === batId ? "bg-blue-50 dark:bg-blue-900/25" : "hover:bg-white dark:hover:bg-zinc-900"}`}>
                              <td className="py-1.5 pr-2">
                                <span className="text-zinc-400 mr-1.5">{i + 1}</span>
                                <span className="font-medium text-zinc-800 dark:text-zinc-200">{r.bat.n}</span>
                                {r.eolYear && <span className="ml-1.5 text-[10px] text-red-500">replace y{r.eolYear}</span>}
                              </td>
                              <td className="py-1.5 px-2 text-right font-data text-zinc-500">{fm(r.cost)}</td>
                              <td className="py-1.5 px-2 text-right font-data text-zinc-500">{fm(r.yr1)}</td>
                              <td className={`py-1.5 px-2 text-right font-data font-medium ${r.npv > 0 ? "text-green-600" : "text-red-500"}`}>{fp(r.npv)}</td>
                              <td className="py-1.5 px-2 text-right font-data text-zinc-500">{r.payback === Infinity ? "—" : r.payback.toFixed(1)}</td>
                              <td className="py-1.5 pl-2 text-zinc-400">{BIND_TEXT[r.binding][0]}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <p className="text-xs text-zinc-400 mt-2">Click any row to load that unit. Note how often the cheapest unit wins: on an energy-limited household the extra kWh in a larger pack never get used, so paying for them destroys value.</p>
                  </div>
                );
              })()}
            </div>
            <div className="mb-2"><Note>
              Every unit here plugs into a standard wall outlet — no electrician, no permit, no subpanel install — which is the
              entire premise of the business, and the reason it can be sold and shipped like a consumer product. That same
              outlet connection backfeeds the home's shared wiring the way balcony solar does, which is why the always-on
              household baseline (Household load below) is fully reachable regardless of which circuit it's actually on — under
              the assumption that this kind of export is treated as legal, which is the premise the business runs on and is not
              the case everywhere today.
              <br /><br />
              Switched, hardwired appliances (central AC, an electric dryer, a range) are a separate question from the
              always-on baseline and are still not modeled as reachable — formally requiring a subpanel/transfer switch, which
              runs roughly $1,500–4,000 installed and reclassifies the unit as an interconnected ESS, triggering the
              permitting and utility-approval process this model otherwise avoids.
              <br /><br />
              240V output still matters: an EV Level 2 charger plugs into a NEMA 14-50, so a 240V unit can serve it with no
              wiring work regardless.
            </Note></div>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
              <Row label="Usable energy" value={`${(bat.kw * USABLE_SOC).toFixed(2)} kWh`} hint={`${(USABLE_SOC * 100).toFixed(0)}% of ${bat.kw}`} />
              <Row label="Continuous / surge output" value={`${bat.pw} / ${bat.sg} kW @ ${bat.vo}V`} />
              <Row label="AC charge rate" value={`${bat.ck} kW`} hint={`${(bat.kw / bat.ck).toFixed(1)} hrs to fill`} />
              <Row label="Chemistry / rated cycles" value={`${bat.chem} / ${bat.cyc.toLocaleString()}`} />
              <Row label="Round-trip efficiency" value={`${(RTE * 100).toFixed(0)}%`} hint="assumption" />
            </div>
          </div>

          {/* --- results --- */}
          <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Results</p>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="Bill savings (yr 1)" value={fm(arb.usd)} sub={`${Math.round(arb.kwh)} kWh shifted`} positive={arb.usd > 0} />
            <Metric label="Binding constraint" value={BIND_TEXT[arb.bindingConstraint][0]} sub={`${arb.peakWindowLoadKwh.toFixed(1)} kWh addressable in peak`} />
            <Metric label="Equivalent cycles/yr" value={Math.round(arb.cycles)} sub={`rated ${bat.cyc.toLocaleString()} (${bat.chem})`} positive={arb.cycles * LIFE <= bat.cyc} />
            <Metric label="Simple payback" value={arb.usd > 0 ? (bat.c / arb.usd).toFixed(1) + " yrs" : "Never"} sub={`on ${fm(bat.c)} retail`} positive={arb.usd > 0 && bat.c / arb.usd <= LIFE} />
          </div>

          <div className="mb-4"><Note tone={arb.bindingConstraint === "load" ? "amber" : "zinc"}>
            <strong>{BIND_TEXT[arb.bindingConstraint][0]} is what limits savings here</strong> on {Math.round(arb.bindShare * 100)}% of
            billing days. {BIND_TEXT[arb.bindingConstraint][1]} This is the readout to check before changing battery or connection
            mode — if the constraint is stored energy, unlocking more load changes nothing.
          </Note></div>

          {plan.ev && evLoad === 0 && (
            <div className="mb-4"><Note tone="amber">
              <strong>{plan.n} requires a registered EV to enroll</strong>, but no EV charging is in the load model — so the
              savings above are for a household that couldn't actually sign up for this rate. EV charging is the largest
              shiftable load most homes have, and on an EV tariff it usually dominates the result. Add Level 1 or Level 2
              charging below, or switch to a tariff without the EV requirement.
            </Note></div>
          )}

          {evLoad > 0 && (
            <div className="mb-4"><Note tone={evTimer ? "amber" : "zinc"}>
              <strong>Charging schedule matters more than charger size.</strong>{" "}
              {evTimer
                ? "A timer already draws at off-peak prices, so there is nothing left for the battery to shift — which is why the savings collapse on this setting. The battery is competing with a free scheduling feature the car already has."
                : "A driver who plugs in on arrival draws straight through the peak window, and that is precisely the load a battery can move."}{" "}
              Most EV owners on a TOU rate already run a timer, because the utility told them to when they enrolled. The
              addressable customer is the one who doesn't — and on an EV tariff that single distinction swings the result
              further than the choice of battery does.
            </Note></div>
          )}

          {eolYear > 0 && eolYear <= LIFE && (
            <div className="mb-4"><Note tone="red">
              At {Math.round(arb.cycles)} equivalent full cycles a year, this unit passes its rated {bat.cyc.toLocaleString()}-cycle
              life in <strong>year {eolYear}</strong>. The projection books a replacement there. Daily-cycling a battery sold on a
              backup-power duty cycle is the warranty exposure in this business — {bat.chem === "NMC" ? "and NMC chemistry makes it acute." : "check the warranty's cycle basis before underwriting ten years."}
            </Note></div>
          )}

          {arb.blocked.length > 0 && (
            <div className="mb-4"><Note tone="amber">
              <strong>Not servable by this unit</strong> — excluded from savings:
              <ul className="mt-1.5 space-y-0.5">
                {arb.blocked.map((b) => <li key={b.id}>· {b.n} — {b.reason}</li>)}
              </ul>
              <p className="mt-1.5">In most homes the largest peak loads are hardwired. That, not battery capacity, is usually what caps savings for a cord-connected unit.</p>
            </Note></div>
          )}

          {/* --- the day --- */}
          <div className="mb-6">
            <div className="flex items-baseline justify-between mb-2 flex-wrap gap-2">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400">Typical weekday — load, price, and what the battery actually covers</p>
              <select value={chartMonth} onChange={(e) => setChartMonth(+e.target.value)} className="text-xs p-1.5 rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800">
                {MONTHS.map((m, i) => <option key={i} value={i}>{m}</option>)}
              </select>
            </div>
            <ResponsiveContainer width="100%" height={280}>
              <ComposedChart data={daySeries} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <XAxis dataKey="h" tick={{ fontSize: 10, fill: "#888" }} interval={1} />
                <YAxis yAxisId="l" tick={{ fontSize: 10, fill: "#888" }} label={{ value: "kWh", angle: -90, position: "insideLeft", fontSize: 10, fill: "#888" }} />
                <YAxis yAxisId="r" orientation="right" tick={{ fontSize: 10, fill: "#888" }} label={{ value: "¢/kWh", angle: 90, position: "insideRight", fontSize: 10, fill: "#888" }} />
                <Tooltip contentStyle={{ fontSize: 12 }} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar yAxisId="l" dataKey="grid" stackId="a" fill="#a1a1aa" name="From grid" />
                <Bar yAxisId="l" dataKey="discharge" stackId="a" fill="#16A34A" name="From battery" />
                <Line yAxisId="l" type="stepAfter" dataKey="soc" stroke="#185FA5" strokeWidth={2} dot={false} name="State of charge (kWh)" />
                <Line yAxisId="r" type="stepAfter" dataKey="rate" stroke="#D97706" strokeWidth={2} dot={false} strokeDasharray="4 3" name="Rate ¢/kWh" />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
              Dispatch is greedy by price: the battery serves the most expensive hours first until stored energy, inverter power, or
              addressable load runs out. Grey is what still comes off the meter — hardwired loads, hours past the energy budget, and
              anything above the {bat.pw} kW inverter ceiling.
              {arb.anyChargeLimited && <span className="text-amber-600 dark:text-amber-400"> Charging is the binding constraint in at least one month: the off-peak window is too short to refill at {bat.ck} kW.</span>}
            </p>
          </div>

          {/* --- the bill --- */}
          <div className="mb-6">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Monthly bill, with and without the battery</p>
            <ResponsiveContainer width="100%" height={230}>
              <BarChart data={bills.map((b) => ({ m: MONTHS[b.m], With: Math.round(b.with), Saved: Math.round(b.saved) }))} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => "$" + v} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => fm(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="With" stackId="b" fill="#71717a" name="Bill with battery" />
                <Bar dataKey="Saved" stackId="b" fill="#16A34A" name="Saved" />
              </BarChart>
            </ResponsiveContainer>
            <p className="text-xs text-zinc-400 mt-1.5">
              Annual bill without: <strong>{fm(bills.reduce((s, b) => s + b.without, 0))}</strong> · with:{" "}
              <strong>{fm(bills.reduce((s, b) => s + b.with, 0))}</strong> · saved {fm(arb.usd)} (
              {(100 * arb.usd / Math.max(1, bills.reduce((s, b) => s + b.without, 0))).toFixed(1)}%).
              Volumetric charges plus the {fm(plan.fixed)}/mo plan premium only — tiered baseline credits, minimum bills, and
              non-bypassable charges are not modeled.
            </p>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {tab === "dr" && (
        <div>
          <div className="mb-4 flex items-center gap-3 flex-wrap">
            <span className="text-sm font-medium text-zinc-500 dark:text-zinc-400 whitespace-nowrap">Tariff</span>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="flex-1 min-w-[220px] p-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800">
              {PLANS_SORTED.map((p) => <option key={p.id} value={p.id}>{p.custom ? `-- ${p.n} --` : `${p.n} (${p.st})${p.ev ? " [EV req]" : ""}`}</option>)}
            </select>
          </div>

          <div className="mb-4"><Note>
            <strong>CPP = Critical Peak Pricing.</strong> You enroll in an overlay on top of your normal TOU rate. In exchange
            for a small year-round discount, you agree that on a limited number of days — called the afternoon before, typically
            9 to 18 times a summer — the peak price jumps by a large adder, {plan.cpp ? `${plan.cpp.adder}¢/kWh on ${plan.cpp.n}` : "usually 50–80¢/kWh"}.
            A battery serving your load through the event means you never pay the adder.
            <br /><br />
            That mechanism is why CPP behaves differently from every other program here. It is <em>bill avoidance</em>, not a
            rebate: nobody measures you against a baseline, so nothing erodes, and it stacks on top of daily TOU shaving without
            conflict. The model counts only the avoided adder — the enrollment discount is excluded, because you'd receive it
            with or without a battery, so it isn't value the battery created.
          </Note></div>

          <div className="mb-4"><Note tone="amber">
            <strong>Nothing pays you to idle — idling only protects the size of a future payment.</strong> Peak Time Rebates and
            ELRP pay for measured reduction against a rolling similar-day baseline: a reference usage level built from your own
            recent non-event days. A battery that shaves every day drags that reference down within about two weeks, so the
            "reduction" it can show during a real event — and the payment for it — shrinks along with it. Idling on non-event
            days keeps the reference high, at the direct cost of the TOU savings that day would have earned. It's a trade against
            a future DR payment, not a revenue source in its own right, and it only matters at all when a baseline-basis program
            is actually enabled below. CPP-style overlays are the exception: they're bill avoidance against a published adder, so
            there's no baseline to protect and they stack cleanly with daily shaving.
          </Note></div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="TOU savings" value={fm(arb.usd)} sub="to the homeowner" />
            <Metric label="DR revenue" value={fm(dr.total)} sub="to the operator" />
            <Metric label="Forfeited to erosion" value={fm(dr.foregone)} sub="baseline-basis only" positive={dr.foregone > 0 ? false : undefined} />
            <Metric label="Combined" value={fm(arb.usd + dr.total)} positive={arb.usd + dr.total > 0} />
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Programs</p>
            <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg overflow-hidden">
              {DR_PROGRAMS.map((p) => {
                const ok = (!p.st || p.st.includes(plan.st)) && (p.basis !== "avoidance" || !!plan.cpp);
                const item = dr.items.find((x) => x.id === p.id);
                const badge = { baseline: ["Erodes", "bg-amber-100 dark:bg-amber-900/40 text-amber-700 dark:text-amber-400"], avoidance: ["Stacks", "bg-green-100 dark:bg-green-900/40 text-green-700 dark:text-green-400"], indirect: ["Indirect", "bg-zinc-200 dark:bg-zinc-700 text-zinc-600 dark:text-zinc-300"] }[p.basis];
                return (
                  <div key={p.id} className="border-b border-zinc-200 dark:border-zinc-700 last:border-0 p-3">
                    <div className="flex items-center gap-3 flex-wrap">
                      <label className={`flex items-center gap-2 font-medium text-sm min-w-[200px] ${ok ? "cursor-pointer text-zinc-900 dark:text-zinc-100" : "text-zinc-400"}`}>
                        <input type="checkbox" disabled={!ok} checked={!!(drEnabled[p.id] && ok)} onChange={(e) => setDrEnabled((v) => ({ ...v, [p.id]: e.target.checked }))} className="w-4 h-4" />
                        {p.id === "cpp" && plan.cpp ? `${plan.cpp.n} (critical peak pricing)` : p.n}
                      </label>
                      <span className={`text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium ${badge[1]}`}>{badge[0]}</span>
                      {p.basis === "indirect" && drEnabled[p.id] && ok && (
                        <span className="flex items-center gap-1 text-sm"><span className="text-zinc-400">$</span>
                          <input type="number" min={0} step={5} value={drOverrides[p.id] ?? 0} onChange={(e) => setDrOverrides((v) => ({ ...v, [p.id]: Math.max(0, +e.target.value || 0) }))} className="p-1 w-20 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                          <span className="text-zinc-400">/yr</span></span>
                      )}
                      <span className="ml-auto font-data text-sm font-medium text-green-600">{item ? fm(item.value) + "/yr" : ok ? "—" : "n/a"}</span>
                    </div>
                    <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">{p.note}</p>
                    {item && item.eroded > 0 && (
                      <p className="text-xs text-amber-600 dark:text-amber-400 mt-1">
                        Would be {fm(item.gross)}/yr if this battery idled to protect its baseline — but it always shaves daily
                        (see Dispatch strategy below), so the full amount is forfeited to erosion.
                      </p>
                    )}
                    {!ok && <p className="text-xs text-zinc-400 mt-1">Not available on {plan.n} ({plan.st}).</p>}
                  </div>
                );
              })}
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Dispatch strategy</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
              <Note>
                This battery always shaves every peak day for TOU savings — it never sits idle to protect a Peak Time Rebates /
                ELRP baseline. If a battery only pencils out by holding it back from doing its job, that's a sign the battery
                isn't a good purchase for this household, not a dispatch strategy worth modeling. The tradeoff was real —
                idling can inflate a baseline-basis payment — but it's not a dial here: baseline-basis programs stay toggleable
                in Programs above and are shown honestly at what they're actually worth under daily use, which is $0.
                CPP-style overlays are unaffected: they're bill avoidance against a published adder, not a measured reduction,
                so they stack cleanly with daily shaving regardless.
              </Note>
              <Slider label="Dispatch success" value={dispatchSuccess} onChange={setDispatchSuccess} min={40} max={100} step={5} disabled={!anyDrActive} fmt={(v) => v + "%"} hint={anyDrActive ? "unplugged, moved, or low SoC at call time" : "no DR program active"} />
              <Note tone={anyDrActive ? "zinc" : "amber"}>
                {anyDrActive ? (
                  <>Share of DR calls the fleet actually delivers on — the rest are unplugged, physically moved, or too low
                  on charge when the event fires. {eventDays > 0 && <>Of the <strong>{eventDays} baseline-program event
                  days/yr</strong>, about <strong>{Math.round((eventDays * dispatchSuccess) / 100)}</strong> are successfully
                  dispatched at {dispatchSuccess}%. </>}Telemetry is this fleet's real edge — knowing state of charge and
                  location lets you target low-risk accounts and route around units that won't deliver — but it doesn't stop a
                  customer from unplugging the unit or taking it camping, so treat 100% as unrealistic even with full
                  visibility. Planning ranges by fleet visibility: <strong>60–70%</strong> with no location or
                  state-of-charge signal at all (pure trust); <strong>70–85%</strong> once the app can nudge a customer before
                  a call; <strong>85–95%</strong> with real dispatch telemetry and low-risk-account targeting — the top of
                  that range, 95%, is the default here. Replace this slider with an observed rate the moment you have one.</>
                ) : (
                  <>Grayed out: no DR program is enabled and eligible on {plan.n} right now — check a box in Programs above
                  to make this slider do anything.</>
                )}
              </Note>
            </div>
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Dispatch outcome</p>
            <div className="grid grid-cols-2 gap-3">
              <Metric label="TOU arbitrage" value={fm(arb.usd)} sub="to the homeowner, at current settings" positive={arb.usd > 0} />
              <Metric label="DR revenue" value={fm(dr.total)} sub="to the operator, at current settings" positive={dr.total > 0} />
            </div>
            <p className="text-xs text-zinc-400 mt-1.5">
              DR revenue shifts live with the dispatch success slider above. TOU arbitrage is fixed by the tariff, battery, and
              household load set elsewhere — dispatch strategy on this tab no longer touches it, since the battery never idles
              to trade it away.
            </p>
          </div>

          {plan.cpp && (
            <div className="mb-5">
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
                <Slider label={`${plan.cpp.n} events/yr`} value={cppEvents ?? plan.cpp.ev} onChange={setCppEvents} min={plan.cpp.mn} max={plan.cpp.mx} fmt={(v) => v} hint={plan.cpp.src} />
              </div>
            </div>
          )}
        </div>
      )}

      {/* ================================================================= */}
      {tab === "operator" && (() => {
        return (
          <div>
            <div className={`py-5 px-5 rounded-xl mb-5 ${dealHo && dealOp ? "bg-green-50 dark:bg-green-900/20" : "bg-red-50 dark:bg-red-900/20"}`}>
              <div className={`text-lg font-medium mb-1 ${dealHo && dealOp ? "text-green-600" : "text-red-500"}`}>
                {dealHo && dealOp ? `Clears on both sides — ${pct(op.opIRR)} unit IRR against a ${discount}% hurdle`
                  : !dealHo ? "Homeowner loses money — nobody signs up"
                  : `Unit IRR ${pct(op.opIRR)} is below the ${discount}% hurdle`}
              </div>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
                {!dealHo
                  ? `The offer costs the homeowner ${fm(-op.hoYr1)}/yr more than the battery saves them. Lower the fee or split, switch settlement basis, or pick a wider-spread tariff.`
                  : `Homeowner nets ${fm(op.hoYr1)}/yr; operator NPV ${fm(op.opNPV)} per unit at ${discount}%.`}
              </p>
            </div>

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <Metric label="Unit IRR" value={pct(op.opIRR)} sub={`vs ${discount}% hurdle`} positive={dealOp} />
              <Metric label={`NPV @ ${discount}%`} value={fm(op.opNPV)} positive={op.opNPV > 0} />
              <Metric label="Payback (undiscounted)" value={op.opPayback === Infinity ? "Never" : op.opPayback.toFixed(1) + " yrs"} sub="flatters the deal — use IRR" />
              <Metric label="Homeowner yr 1" value={fp(op.hoYr1)} positive={dealHo} />
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Offer structure</p>
              <div className="grid grid-cols-2 gap-2 mb-2">
                {[["sub", "Flat subscription", "Fixed monthly fee; homeowner keeps all bill savings. Predictable revenue, easy collections — but the homeowner carries performance risk and on a thin spread the fee exceeds the savings."],
                  ["split", "Savings split", "No fixed fee; you bill a share of savings. The homeowner can't lose, which maximizes sign-ups — but revenue tracks utilization, and you're invoicing people for money they never saw leave their account."]].map(([id, t, b]) => (
                  <button key={id} onClick={() => setBizModel(id)} className={`p-3 rounded-lg border text-xs leading-relaxed text-left transition-colors ${bizModel === id ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-700"}`}>
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">{t}</div>
                    <p className="text-zinc-500 dark:text-zinc-400">{b}</p>
                  </button>
                ))}
              </div>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
                {bizModel === "sub"
                  ? <Slider label="Monthly fee" value={subFee} onChange={setSubFee} min={0} max={50} fmt={(v) => "$" + v + "/mo"} />
                  : <Slider label="Operator share" value={splitPct} onChange={setSplitPct} min={30} max={90} step={5} fmt={(v) => v + "%"} hint={`homeowner keeps ${100 - splitPct}%`} />}
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Homeowner upfront</span>
                  <input type="number" min={0} step={50} value={upfront} onChange={(e) => setUpfront(Math.max(0, +e.target.value || 0))} className="p-2 w-24 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  <span className="text-xs text-zinc-400">deposit / activation fee</span>
                </div>
              </div>
            </div>

            {bizModel === "split" && (
              <div className="mb-5">
                <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Settlement basis</p>
                <div className="grid grid-cols-2 gap-2 mb-2">
                  {[["actual", "Modeled bill delta", "Bill the customer a share of the savings the battery actually produced. Correct in principle, unverifiable in practice — you'd have to know the bill they would have had."],
                    ["deemed", "Deemed formula", "Metered discharge kWh × a published spread. Auditable, disputable only against the tariff sheet, and does not require a counterfactual — but it systematically diverges from what the customer sees on their bill."]].map(([id, t, b]) => (
                    <button key={id} onClick={() => setSettlement(id)} className={`p-3 rounded-lg border text-xs leading-relaxed text-left ${settlement === id ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-700"}`}>
                      <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">{t}</div>
                      <p className="text-zinc-500 dark:text-zinc-400">{b}</p>
                    </button>
                  ))}
                </div>
                {settlement === "deemed" && (
                  <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-2">
                    <Slider label="Deemed spread" value={effDeemed} onChange={setDeemedSpread} min={0} max={80} fmt={(v) => v + "¢/kWh"} hint={`tariff spread is ${arb.spreadC.toFixed(1)}¢`} />
                    <div className="text-sm">
                      <Row label="Billed on (deemed)" value={fm((arb.kwh * effDeemed) / 100)} />
                      <Row label="Customer's actual saving" value={fm(arb.usd)} />
                      <Row label="Divergence" value={fp((arb.kwh * effDeemed) / 100 - arb.usd)} />
                    </div>
                    <Note tone={Math.abs((arb.kwh * effDeemed) / 100 - arb.usd) > 0.15 * Math.max(1, arb.usd) ? "amber" : "zinc"}>
                      A deemed formula that overstates actual savings is the churn and complaint engine in this business — the customer
                      compares your invoice to their bill and the numbers don't agree. Keep the deemed spread at or below the real one.
                    </Note>
                  </div>
                )}
              </div>
            )}

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Operator costs and capital</p>
              <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
                <Slider label="Hardware cost" value={hwPct} onChange={setHwPct} min={30} max={100} step={5} fmt={(v) => v + "% = " + fm(op.hw)} hint="of retail" />
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Acquisition + deploy</span>
                  <input type="number" min={0} step={25} value={cac} onChange={(e) => setCac(Math.max(0, +e.target.value || 0))} className="p-2 w-24 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  <span className="text-xs text-zinc-400">$/unit</span>
                </div>
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Servicing + software</span>
                  <input type="number" min={0} step={1} value={svcMo} onChange={(e) => setSvcMo(Math.max(0, +e.target.value || 0))} className="p-2 w-24 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                  <span className="text-xs text-zinc-400">$/unit/mo</span>
                </div>
                <Slider label="Annual churn" value={churn} onChange={setChurn} min={0} max={30} fmt={(v) => v + "%"} />
                <Slider label="Discount rate" value={discount} onChange={setDiscount} min={4} max={25} fmt={(v) => v + "%"} hint="cost of capital" />
                <Note>
                  Moving this won't touch Unit IRR — IRR is the break-even rate for these cash flows, computed independent of
                  any assumed discount rate, so it's fixed once hardware cost and the offer terms are set. What this slider
                  actually moves: <strong>NPV</strong> ({fm(op.opNPV)} above) and the pass/fail verdict, since "clears" means
                  the fixed IRR beats whatever hurdle you set here.
                </Note>
              </div>
            </div>

            <div className="mb-5">
              <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Cumulative cash — both sides, per unit</p>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={op.opCum.map((v, i) => ({ year: "Y" + i, Operator: Math.round(v), Homeowner: Math.round(op.hoCum[i]) }))} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                  <XAxis dataKey="year" tick={{ fontSize: 11, fill: "#888" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => fm(v)} />
                  <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => fm(v)} />
                  <Legend wrapperStyle={{ fontSize: 11 }} />
                  <ReferenceLine y={0} stroke="#999" strokeDasharray="5 5" />
                  <Line type="monotone" dataKey="Operator" stroke="#185FA5" strokeWidth={2} dot={{ r: 3 }} />
                  <Line type="monotone" dataKey="Homeowner" stroke="#16A34A" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
              <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
                {assetRows.filter((r) => r.replaced).map((r) => (
                  <Row key={r.y} label={`Replacement booked — year ${r.y}`} value={fm(r.replaceCost * hwPct / 100)} hint="cycle life exhausted" />
                ))}
                <Row label="Capacity remaining at Y10" value={`${(assetRows[LIFE - 1]?.capFrac * 100).toFixed(0)}%`} />
                <Row label="Cumulative equivalent cycles" value={Math.round(assetRows[LIFE - 1]?.cumCycles || 0).toLocaleString()} hint={`rated ${bat.cyc.toLocaleString()}`} />
              </div>
            </div>
          </div>
        );
      })()}

      {/* ================================================================= */}
      {tab === "fleet" && (
        <div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="Peak funding need" value={fm(fleet.peakFunding)} sub="max cumulative deficit" />
            <Metric label="Fleet IRR" value={pct(fleet.fleetIRR)} positive={fleet.fleetIRR !== null && fleet.fleetIRR * 100 > discount} />
            <Metric label={`Fleet NPV @ ${discount}%`} value={fm(fleet.fleetNPV)} positive={fleet.fleetNPV > 0} />
            <Metric label="Units deployed" value={fleet.deployed.toLocaleString()} sub={`${perMonth}/mo for ${rampMonths} mo`} />
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Cumulative fleet cash</p>
            <ResponsiveContainer width="100%" height={260}>
              <LineChart data={fleet.cum.map((v, i) => ({ m: i, Cash: Math.round(v) }))} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <XAxis dataKey="m" tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => v % 12 === 0 ? "Y" + v / 12 : ""} interval={0} />
                <YAxis tick={{ fontSize: 10, fill: "#888" }} tickFormatter={(v) => fm(v)} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => fm(v)} labelFormatter={(l) => `Month ${l}`} />
                <ReferenceLine y={0} stroke="#999" strokeDasharray="5 5" />
                <ReferenceLine y={-fleet.peakFunding} stroke="#DC2626" strokeDasharray="3 3" label={{ value: "peak funding", fontSize: 10, fill: "#DC2626", position: "insideBottomRight" }} />
                <Line type="monotone" dataKey="Cash" stroke="#185FA5" strokeWidth={2} dot={false} />
              </LineChart>
            </ResponsiveContainer>
            <p className="text-xs text-zinc-400 mt-1.5">
              Each monthly cohort carries its own capital outlay and its own revenue ramp, so the deficit deepens for as long as you
              keep deploying. The trough — not year-one revenue — is the raise. Churned units are credited back at
              {" "}{recoveryRate}% recovery times declining residual value, net of {fm(refurb)} refurbishment; redeployment revenue from
              recovered units is not credited, which makes this conservative.
            </p>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Ramp and recovery</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
              <Slider label="Units deployed / month" value={perMonth} onChange={setPerMonth} min={10} max={1000} step={10} fmt={(v) => v.toLocaleString()} />
              <Slider label="Ramp duration" value={rampMonths} onChange={setRampMonths} min={6} max={60} step={6} fmt={(v) => v + " mo"} />
              <Slider label="Hardware recovery on churn" value={recoveryRate} onChange={setRecoveryRate} min={0} max={100} step={5} fmt={(v) => v + "%"} hint="units you get back" />
              <div className="flex items-center gap-3 text-sm">
                <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">Refurb + reship</span>
                <input type="number" min={0} step={10} value={refurb} onChange={(e) => setRefurb(Math.max(0, +e.target.value || 0))} className="p-2 w-24 text-sm rounded border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-900" />
                <span className="text-xs text-zinc-400">$/recovered unit</span>
              </div>
              <Note>Recovery is the structural advantage over residential solar leasing: the collateral fits in a car. It is also
              the assumption with no market data behind it — nobody has run a recovery operation on 10,000 portable batteries.</Note>
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Wholesale aggregation</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
              <Slider label="Minimum aggregation" value={minAggKw} onChange={setMinAggKw} min={20} max={1000} step={10} fmt={(v) => v + " kW"} />
              <div className="text-sm">
                <Row label="Deliverable per unit" value={`${deliverableKw.toFixed(2)} kW`} hint="peak-hour discharge" />
                <Row label="After dispatch success" value={`${(deliverableKw * dispatchSuccess / 100).toFixed(2)} kW`} />
                <Row label="Units needed to bid" value={fleet.unitsForAggMin.toLocaleString()} hint="in a single node/zone" />
                <Row label="Fleet capacity" value={`${Math.round(fleet.fleetKw).toLocaleString()} kW`} />
              </div>
              <Note tone={fleet.meetsAggMin ? "green" : "amber"}>
                {fleet.meetsAggMin
                  ? `The fleet clears ${minAggKw} kW in aggregate — but the requirement is per pricing node, not nationwide. ${fleet.unitsForAggMin.toLocaleString()} units have to sit in the same zone before you can bid anything.`
                  : `The fleet is below ${minAggKw} kW. No wholesale participation until it isn't.`}
                {" "}I believe CAISO's Proxy Demand Resource minimum is on the order of 100 kW; check the current CAISO Business
                Practice Manual rather than this default. This single constraint is why fleet density, not fleet size, is the
                go-to-market variable.
              </Note>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {tab === "programs" && (
        <div>
          <div className="mb-5"><Note>
            <strong>Two archetypes decide everything.</strong> <em>Meter-based</em> programs pay for measured kWh reduction and don't
            care what device achieved it — a non-export battery qualifies directly. <em>Device-list</em> programs require an
            interconnected, export-capable ESS from an approved hardware list and pay per kW discharged to the grid; plug-in stations
            are categorically excluded from all of them. Switching the connection mode to a critical-loads subpanel is what moves a
            customer across that line.
          </Note></div>

          {DR_PROGRAMS.map((p) => (
            <div key={p.id} className="mb-3 p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
              <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mb-1 flex items-center gap-2 flex-wrap">
                {p.n}
                <span className="text-[10px] px-1.5 py-0.5 rounded uppercase tracking-wide font-medium bg-white dark:bg-zinc-900 text-zinc-500">{p.basis}</span>
                {p.st && <span className="text-xs font-normal text-zinc-400">{p.st.join(", ")}</span>}
              </h3>
              <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{p.note}</p>
              {p.basis === "baseline" && <p className="text-xs text-amber-600 dark:text-amber-400 mt-1.5">Baseline-measured — value decays if the battery also shaves TOU peaks daily. See the DR stack tab.</p>}
            </div>
          ))}

          <h3 className="text-sm font-medium text-zinc-900 dark:text-zinc-100 mt-6 mb-2">Hardwired-only — the richest programs, all closed to plug-in stations</h3>
          <div className="p-4 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-xs space-y-2">
            {HARDWIRED_ONLY.map((h) => (
              <div key={h.n} className="grid md:grid-cols-[220px_1fr] gap-x-4">
                <span className="font-medium text-zinc-700 dark:text-zinc-300">{h.n}</span>
                <span className="text-zinc-500 dark:text-zinc-400">{h.v}</span>
              </div>
            ))}
            <p className="text-zinc-400 pt-2 border-t border-zinc-200 dark:border-zinc-700">
              Every one requires grid interconnection, export capability, and hardware from an approved list. A 5 kW hardwired system
              earns roughly $1,100–$1,650/yr on MA ConnectedSolutions — an order of magnitude above anything a plug-in unit can reach.
              Never underwrite plug-in economics on these numbers. Watch for any program publishing a load-reduction-only device
              class; that would be the expansion trigger.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
