import { useState, useMemo } from "react";
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
  billComparison, rateShapeForMonth, chargeWindow, servabilityFailure,
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

function Slider({ label, value, onChange, min, max, step = 1, fmt = (v) => v, hint }) {
  return (
    <div className="flex items-center gap-3 text-sm flex-wrap">
      <span className="text-zinc-500 dark:text-zinc-400 min-w-[150px]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} onChange={(e) => onChange(+e.target.value)} className="flex-1 min-w-[120px] max-w-[200px]" />
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
  const [custom, setCustom] = useState({ rPeakS: 30, rOffS: 10, rPeakW: 25, rOffW: 10, peakStart: 16, peakEnd: 21, fixed: 0, weekdayOnly: false });
  const [sq, setSq] = useState(1600);
  const [counts, setCounts] = useState({ wac: 2, xfr: 1, tv: 1, dw: 1 });
  const [batId, setBatId] = useState("al");
  const [connMode, setConnMode] = useState("cord");
  const [spreadEsc, setSpreadEsc] = useState(2);
  const [collapsed, setCollapsed] = useState(() => Object.fromEntries(APPLIANCE_CATS.map((_, i) => [i, i !== 1])));
  const [chartMonth, setChartMonth] = useState(6);

  // --- DR inputs
  const [preserve, setPreserve] = useState(0);
  const [dispatchSuccess, setDispatchSuccess] = useState(80);
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
  const [itcPct, setItcPct] = useState(0);
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
    };
  }, [planId, custom]);

  const bat = useMemo(() => BATTERIES.find((b) => b.id === batId), [batId]);

  // -------------------------------------------------------------------------
  // MODEL
  // -------------------------------------------------------------------------
  const eventDays = useMemo(() => {
    let e = 0;
    DR_PROGRAMS.forEach((p) => { if (drEnabled[p.id] && p.basis === "baseline" && (!p.st || p.st.includes(plan.st))) e = Math.max(e, p.events); });
    return e;
  }, [drEnabled, plan.st]);

  const arb = useMemo(
    () => annualArbitrage({ plan, bat, counts, sq, connMode, preserve: preserve / 100, eventDays }),
    [plan, bat, counts, sq, connMode, preserve, eventDays]
  );

  const dr = useMemo(
    () => drRevenue({ plan, bat, arb, enabled: drEnabled, preserve: preserve / 100, dispatchSuccess: dispatchSuccess / 100, cppEvents, overrides: drOverrides, programs: DR_PROGRAMS }),
    [plan, bat, arb, drEnabled, preserve, dispatchSuccess, cppEvents, drOverrides]
  );

  const assetRows = useMemo(() => projectAsset({
    plan, bat, counts, sq, connMode, years: LIFE, spreadEsc, preserve: preserve / 100, eventDays,
    drFn: (a, capFrac) => drRevenue({ plan, bat, arb: a, enabled: drEnabled, preserve: preserve / 100, dispatchSuccess: dispatchSuccess / 100, cppEvents, overrides: drOverrides, programs: DR_PROGRAMS, capFrac }).total,
    hwCostFn: () => bat.c,
  }), [plan, bat, counts, sq, connMode, spreadEsc, preserve, eventDays, drEnabled, dispatchSuccess, cppEvents, drOverrides]);

  const effDeemed = deemedSpread ?? Math.round(arb.spreadC);

  const op = useMemo(() => operatorEconomics({
    assetRows, bat, hwPct, cac, svcMo, churn, bizModel, subFee, splitPct, upfront,
    planFixed: plan.fixed, discount, itcPct, settlement, deemedSpreadC: effDeemed,
  }), [assetRows, bat, hwPct, cac, svcMo, churn, bizModel, subFee, splitPct, upfront, plan.fixed, discount, itcPct, settlement, effDeemed]);

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

  const bills = useMemo(() => billComparison({ plan, arb, counts, sq, bat, connMode }), [plan, arb, counts, sq, bat, connMode]);

  const frontier = useMemo(() => {
    const out = [];
    for (let p = 0; p <= 100; p += 20) {
      const a = annualArbitrage({ plan, bat, counts, sq, connMode, preserve: p / 100, eventDays });
      const d = drRevenue({ plan, bat, arb: a, enabled: drEnabled, preserve: p / 100, dispatchSuccess: dispatchSuccess / 100, cppEvents, overrides: drOverrides, programs: DR_PROGRAMS });
      out.push({ preserve: p, tou: Math.round(a.usd), drv: Math.round(d.total), total: Math.round(a.usd + d.total) });
    }
    return out;
  }, [plan, bat, counts, sq, connMode, eventDays, drEnabled, dispatchSuccess, cppEvents, drOverrides]);

  const bestPreserve = useMemo(() => frontier.reduce((b, r) => (r.total > b.total ? r : b), frontier[0]), [frontier]);

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

  const setCount = (id, delta) => setCounts((prev) => {
    const cur = prev[id] || 0;
    const nv = Math.max(0, Math.min(6, cur + delta));
    const next = { ...prev };
    if (nv === 0) delete next[id]; else next[id] = nv;
    return next;
  });

  const eolYear = assetRows.findIndex((r) => r.cumCycles > bat.cyc) + 1;
  const y1 = assetRows[0] || { arbUSD: 0, drUSD: 0 };

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
        <h1 className="font-display text-[26px] leading-tight font-semibold text-zinc-900 dark:text-zinc-100 mb-2">Plug-in battery economics, hour by hour</h1>
        <p className="text-sm text-zinc-500 dark:text-zinc-400 leading-relaxed max-w-[620px]">
          Dispatches a non-exporting battery against an hourly tariff and an hourly household load shape, then carries the result through
          degradation, demand-response baseline erosion, unit economics, and a fleet ramp.
        </p>
      </div>

      <div className="flex gap-0.5 border-b border-zinc-200 dark:border-zinc-700 mb-4 flex-wrap">
        {tabs.map((t) => (
          <button key={t.id} onClick={() => setTab(t.id)} className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px transition-colors whitespace-nowrap ${tab === t.id ? "border-blue-500 text-blue-600 dark:text-blue-400" : "border-transparent text-zinc-500 hover:text-zinc-800 dark:hover:text-zinc-300"}`}>{t.label}</button>
        ))}
      </div>

      <div className="sticky top-2 z-10 mb-5 px-3 py-2 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-white/90 dark:bg-zinc-900/90 backdrop-blur flex flex-wrap items-center gap-x-4 gap-y-1.5">
        {[["Plan", plan.n], ["Battery", bat.n], ["Mode", connMode === "cord" ? "Cord-connected" : "Subpanel"],
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
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="Bill savings (yr 1)" value={fm(arb.usd)} sub={`${Math.round(arb.kwh)} kWh shifted`} positive={arb.usd > 0} />
            <Metric label="Addressable peak load" value={arb.peakWindowLoadKwh.toFixed(1) + " kWh"} sub={`over ${arb.peakWindowHours} peak hrs`} />
            <Metric label="Equivalent cycles/yr" value={Math.round(arb.cycles)} sub={`rated ${bat.cyc.toLocaleString()} (${bat.chem})`} positive={arb.cycles * LIFE <= bat.cyc} />
            <Metric label="Simple payback" value={arb.usd > 0 ? (bat.c / arb.usd).toFixed(1) + " yrs" : "Never"} sub={`on ${fm(bat.c)} retail`} positive={arb.usd > 0 && bat.c / arb.usd <= LIFE} />
          </div>

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

          {/* --- inputs --- */}
          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Tariff</p>
            <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800">
              {PLANS_SORTED.map((p) => <option key={p.id} value={p.id}>{p.custom ? `-- ${p.n} --` : `${p.n} (${p.st})${p.ev ? " [EV req]" : ""}`}</option>)}
            </select>
            {plan.ev && <div className="mt-2"><Note tone="amber">Requires EV registration to enroll.</Note></div>}
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
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Battery and connection</p>
            <select value={batId} onChange={(e) => setBatId(e.target.value)} className="w-full p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 mb-2">
              {BAT_CLASSES.map((c) => (
                <optgroup key={c.id} label={c.n}>
                  {BATTERIES.filter((b) => b.ct === c.id).map((b) => <option key={b.id} value={b.id}>{b.n} — {b.kw} kWh, {b.pw} kW, {b.vo}V — {fm(b.c)}</option>)}
                </optgroup>
              ))}
            </select>
            <div className="grid grid-cols-2 gap-2 mb-2">
              {[["cord", "Cord-connected", "Battery sits in the room. Serves only loads you can physically plug into it. No interconnection, no permit, no electrician."],
                ["panel", "Critical-loads subpanel", "Battery drives a transfer switch or subpanel. Reaches hardwired loads — and moves the unit into the interconnected-ESS category, which is what device-list DR programs require."]].map(([id, title, body]) => {
                const ok = id === "cord" || bat.pnl;
                return (
                  <button key={id} disabled={!ok} onClick={() => setConnMode(id)} className={`p-3 rounded-lg border text-xs leading-relaxed text-left transition-colors ${connMode === id ? "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20" : "border-zinc-200 dark:border-zinc-700"} ${ok ? "cursor-pointer" : "opacity-40 cursor-not-allowed"}`}>
                    <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">{title}</div>
                    <p className="text-zinc-500 dark:text-zinc-400">{body}</p>
                    {!ok && <p className="text-amber-600 dark:text-amber-400 mt-1">{bat.n} can't drive a subpanel.</p>}
                  </button>
                );
              })}
            </div>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
              <Row label="Usable energy" value={`${(bat.kw * USABLE_SOC).toFixed(2)} kWh`} hint={`${(USABLE_SOC * 100).toFixed(0)}% of ${bat.kw}`} />
              <Row label="Continuous / surge output" value={`${bat.pw} / ${bat.sg} kW @ ${bat.vo}V`} />
              <Row label="AC charge rate" value={`${bat.ck} kW`} hint={`${(bat.kw / bat.ck).toFixed(1)} hrs to fill`} />
              <Row label="Chemistry / rated cycles" value={`${bat.chem} / ${bat.cyc.toLocaleString()}`} />
              <Row label="Round-trip efficiency" value={`${(RTE * 100).toFixed(0)}%`} hint="assumption" />
            </div>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Household load</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg mb-2">
              <Slider label="House size" value={sq} onChange={setSq} min={400} max={3500} step={50} fmt={(v) => v.toLocaleString() + " sq ft"} hint={`always-on ${baselineKw(sq).toFixed(2)} kW`} />
            </div>
            {APPLIANCE_CATS.map((cat, ci) => {
              const active = cat.i.reduce((s, a) => s + (counts[a.id] || 0), 0);
              const open = !collapsed[ci];
              return (
                <div key={ci} className="mb-1">
                  <button onClick={() => setCollapsed((p) => ({ ...p, [ci]: !p[ci] }))} className="w-full flex items-center gap-2 py-2 text-xs font-medium text-zinc-400 dark:text-zinc-500 uppercase tracking-wider">
                    <span className={`inline-block transition-transform ${open ? "" : "-rotate-90"}`}>▾</span>
                    {cat.t}{active > 0 && ` (${active})`}
                  </button>
                  {open && (
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-1.5 pb-2">
                      {cat.i.map((a) => {
                        const n = counts[a.id] || 0;
                        const kwRun = a.szf ? a.szf(sq) : a.kwRun;
                        const surge = a.sgMult ? kwRun * a.sgMult : a.sg;
                        const fail = servabilityFailure(a, kwRun, surge, bat, connMode);
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
                  )}
                </div>
              );
            })}
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Rate outlook</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
              <Slider label="Peak–off-peak spread" value={spreadEsc} onChange={setSpreadEsc} min={-4} max={6} step={0.5} fmt={(v) => (v >= 0 ? "+" : "") + v.toFixed(1) + "%/yr"} />
              <Note tone={spreadEsc > 3 ? "amber" : "zinc"}>
                This escalates the <em>spread</em>, not the bill. They move independently: a shift of revenue from volumetric
                to fixed charges — the CPUC income-graduated fixed charge is the live example — raises bills while compressing
                the spread this business runs on. Negative values are the honest downside case.
              </Note>
            </div>
          </div>
        </div>
      )}

      {/* ================================================================= */}
      {tab === "dr" && (
        <div>
          <div className="mb-4"><Note tone="amber">
            <strong>You cannot earn full TOU arbitrage and full meter-based DR from the same battery.</strong> Peak Time Rebates and
            ELRP pay for measured reduction against a rolling similar-day baseline. A battery that shaves every day suppresses its own
            baseline within about two weeks, and the payment decays toward zero. Preserving the baseline means idling on non-event days,
            which forfeits TOU savings. The slider below is that trade, priced.
            CPP-style overlays are the exception: they're bill avoidance against a published adder, so there's no baseline to erode
            and they stack cleanly.
          </Note></div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
            <Metric label="TOU savings" value={fm(arb.usd)} sub="to the homeowner" />
            <Metric label="DR revenue" value={fm(dr.total)} sub="to the operator" />
            <Metric label="Forfeited to erosion" value={fm(dr.foregone)} sub="baseline-basis only" positive={dr.foregone > 0 ? false : undefined} />
            <Metric label="Combined" value={fm(arb.usd + dr.total)} positive={arb.usd + dr.total > 0} />
          </div>

          <div className="mb-6">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Dispatch-strategy frontier</p>
            <ResponsiveContainer width="100%" height={240}>
              <ComposedChart data={frontier} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
                <XAxis dataKey="preserve" tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => v + "%"} label={{ value: "share of non-event days the battery idles to protect its baseline", position: "insideBottom", offset: -3, fontSize: 10, fill: "#888" }} />
                <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => "$" + v} />
                <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => fm(v)} />
                <Legend wrapperStyle={{ fontSize: 11 }} />
                <Bar dataKey="tou" stackId="s" fill="#16A34A" name="TOU arbitrage" />
                <Bar dataKey="drv" stackId="s" fill="#185FA5" name="DR revenue" />
                <Line type="monotone" dataKey="total" stroke="#D97706" strokeWidth={2} dot={{ r: 3 }} name="Combined" />
              </ComposedChart>
            </ResponsiveContainer>
            <p className="text-xs text-zinc-400 mt-1.5">
              On this tariff the combined value is maximized at <strong>{bestPreserve.preserve}% preservation</strong> ({fm(bestPreserve.total)}/yr).
              {bestPreserve.preserve === 0 && " Daily shaving wins because TOU pays on ~350 days a year and event programs pay on roughly a dozen — the arithmetic rarely favors idling a battery to protect a baseline."}
            </p>
          </div>

          <div className="mb-5">
            <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Dispatch strategy</p>
            <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
              <Slider label="Baseline preservation" value={preserve} onChange={setPreserve} min={0} max={100} step={5} fmt={(v) => v + "%"} hint={preserve === 0 ? "shave every peak day" : preserve === 100 ? "event days only" : ""} />
              <Slider label="Dispatch success" value={dispatchSuccess} onChange={setDispatchSuccess} min={40} max={100} step={5} fmt={(v) => v + "%"} hint="unplugged, moved, or low SoC at call time" />
              <Note>Dispatch success is an assumption, not an observed rate. For a fleet of portable units a customer can unplug and
              carry to a campsite, 70–85% is a defensible planning range; you'd replace it with telemetry once you have any.</Note>
            </div>
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
                        {p.id === "cpp" && plan.cpp ? plan.cpp.n : p.n}
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
                        {fm(item.gross)}/yr at full baseline preservation; {fm(item.eroded)} of that is forfeited at {preserve}% preservation.
                      </p>
                    )}
                    {!ok && <p className="text-xs text-zinc-400 mt-1">Not available on {plan.n} ({plan.st}).</p>}
                  </div>
                );
              })}
            </div>
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
        const dealHo = op.hoYr1 > 0;
        const dealOp = op.opIRR !== null && op.opIRR * 100 > discount;
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
                <Slider label="ITC on hardware" value={itcPct} onChange={setItcPct} min={0} max={40} step={5} fmt={(v) => v + "%"} />
                <Note tone={itcPct > 0 ? "amber" : "zinc"}>
                  Set to 0 by default and left as a switch on purpose. Company-owned storage points at §48E rather than §25D
                  (which OBBBA terminated for expenditures after 2025). Whether a cord-connected portable power station qualifies as
                  "energy storage technology" under 48E — and how the post-OBBBA phase-down and FEOC rules apply — I don't know, and
                  guidance I'm aware of has been written around installed systems. Verify with a tax advisor before putting weight
                  on this slider; it moves unit IRR more than anything else on this tab.
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
