import { useState, useMemo } from "react";
import {
  BarChart, Bar, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer,
  LineChart, Line, ReferenceLine,
} from "recharts";
import {
  MARKETS, CAP_CONSTRUCTS, annualLoadShape, supplierEconomics, supplierBusiness,
} from "./supply.js";

const fm = (v) => (v < 0 ? "-" : "") + "$" + Math.abs(Math.round(v)).toLocaleString();
const fp = (v) => (v >= 0 ? "+" : "-") + "$" + Math.abs(Math.round(v)).toLocaleString();

function Metric({ label, value, sub, positive }) {
  const c = positive === true ? "text-green-600" : positive === false ? "text-red-500" : "text-zinc-900 dark:text-zinc-100";
  return (
    <div className="bg-zinc-100 dark:bg-zinc-800 rounded-lg p-4">
      <div className="text-[11px] uppercase tracking-wider text-zinc-500 dark:text-zinc-400 mb-1.5">{label}</div>
      <div className={`font-data text-xl font-medium ${c}`}>{value}</div>
      {sub && <div className="text-[11px] text-zinc-400 mt-1">{sub}</div>}
    </div>
  );
}
function Row({ label, value, hint }) {
  return (
    <div className="flex justify-between py-1 text-sm gap-4">
      <span className="text-zinc-500 dark:text-zinc-400">{label}{hint && <span className="text-zinc-400 text-xs ml-1.5">{hint}</span>}</span>
      <span className="font-medium text-zinc-900 dark:text-zinc-100 text-right whitespace-nowrap">{value}</span>
    </div>
  );
}
function Slider({ label, value, onChange, min, max, step = 1, fmt = (v) => v, hint, disabled }) {
  return (
    <div className={`flex items-center gap-3 text-sm flex-wrap ${disabled ? "opacity-50" : ""}`}>
      <span className="text-zinc-500 dark:text-zinc-400 min-w-[160px]">{label}</span>
      <input type="range" min={min} max={max} step={step} value={value} disabled={disabled}
        onChange={(e) => onChange(+e.target.value)} className="flex-1 min-w-[110px] max-w-[190px]" />
      <span className="font-medium min-w-[76px]">{fmt(value)}</span>
      {hint && <span className="text-xs text-zinc-400">{hint}</span>}
    </div>
  );
}
function Note({ children, tone = "zinc" }) {
  const t = {
    zinc: "bg-zinc-100 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300",
    amber: "bg-amber-50 dark:bg-amber-900/25 text-amber-800 dark:text-amber-300",
    red: "bg-red-50 dark:bg-red-900/25 text-red-700 dark:text-red-400",
    green: "bg-green-50 dark:bg-green-900/20 text-green-700 dark:text-green-400",
    purple: "bg-purple-50 dark:bg-purple-900/20 text-purple-700 dark:text-purple-300",
  }[tone];
  return <div className={`rounded-lg p-3 text-xs leading-relaxed ${t}`}>{children}</div>;
}

const COLORS = { capacity: "#185FA5", transmission: "#0E7490", scarcity: "#B45309", energy: "#16A34A", penalty: "#DC2626" };

export default function RetailChoiceTab({ counts, sq, bat, applianceOverrides, monthlyActual }) {
  const [marketId, setMarketId] = useState("comed");
  const [plcMethod, setPlcMethod] = useState("interval");
  const [capPrice, setCapPrice] = useState(null);
  const [transRate, setTransRate] = useState(null);
  const [transBorne, setTransBorne] = useState(true);
  const [retailRate, setRetailRate] = useState(null);
  const [forecastHit, setForecastHit] = useState(80);
  const [availability, setAvailability] = useState(85);
  const [socReady, setSocReady] = useState(90);
  const [candidateDays, setCandidateDays] = useState(25);
  const [includeScarcity, setIncludeScarcity] = useState(true);
  const [scarcityHrs, setScarcityHrs] = useState(null);

  const [sharePct, setSharePct] = useState(50);
  const [cac, setCac] = useState(120);
  const [softwareMo, setSoftwareMo] = useState(1.5);
  const [churnPct, setChurnPct] = useState(25);
  const [termContract, setTermContract] = useState(false);
  const [accounts, setAccounts] = useState(25000);

  const market = useMemo(() => MARKETS.find((m) => m.id === marketId), [marketId]);
  const capP = capPrice ?? market.capPrice;
  const transR = transRate ?? market.transRate;
  const retailR = retailRate ?? market.retailRate;
  const scarcityH = scarcityHrs ?? market.scarcityHrs;
  const transSupplierBorne = transBorne && market.transAlloc !== "delivery";

  const loadShape = useMemo(
    () => annualLoadShape({ counts, sq, bat, applianceOverrides, monthlyActual }),
    [counts, sq, bat, applianceOverrides, monthlyActual]
  );

  const econArgs = {
    market, loadShape, bat, plcMethod, capPrice: capP, transRate: transR, transSupplierBorne,
    forecastHit, availability, socReady, candidateDays, retailRate: retailR,
    ancillaryAdder: 1.0, scarcityHrs: scarcityH, scarcityPrice: market.scarcityPrice, includeScarcity,
  };
  const econ = useMemo(() => supplierEconomics(econArgs), [JSON.stringify({ marketId, plcMethod, capP, transR, transSupplierBorne, forecastHit, availability, socReady, retailR, scarcityH, includeScarcity }), loadShape, bat]);

  const biz = useMemo(() => supplierBusiness({
    econ, sharePct, cac, softwareMo, churnPct, years: 10, discount: 12,
    lagYears: 1, termContract,
  }), [econ, sharePct, cac, softwareMo, churnPct, termContract]);


  const marketCompare = useMemo(() => MARKETS.map((m) => {
    const e = supplierEconomics({
      ...econArgs, market: m, capPrice: m.capPrice, transRate: m.transRate,
      transSupplierBorne: m.transAlloc !== "delivery", retailRate: m.retailRate,
      scarcityHrs: m.scarcityHrs, scarcityPrice: m.scarcityPrice, plcMethod: m.plcDefault,
    });
    return {
      n: m.n.split(" (")[0], id: m.id,
      capacity: Math.round(e.capacitySaving), transmission: Math.round(e.transSaving),
      scarcity: Math.round(e.scarcitySaving), energy: Math.round(e.energySaving), total: Math.round(e.total),
    };
  }), [loadShape, bat, forecastHit, availability, socReady, includeScarcity]);

  const stack = econ.components.filter((c) => Math.abs(c.v) > 0.5);
  const gated = econ.profileGated;
  const construct = CAP_CONSTRUCTS[market.capConstruct];
  const cliff = market.capConstruct === "1CP" || market.capConstruct === "annualCP";
  const noCapMarket = market.capConstruct === "none";

  return (
    <div>
      <div className="mb-4"><Note tone="purple">
        <strong>A different business from the rest of this app.</strong> In retail-choice states, two companies serve a
        household: the EDC (owns the wires, regulated) and a <em>supplier</em> (sells the electricity itself — here, the
        firm). The firm never buys the battery; the customer already owns one and just runs software on it.
        <br /><br />
        Once a year the EDC checks how much power an account drew during a handful of the grid's worst-strain hours, and
        locks in that number — the account's <strong>PLC</strong> — as what the supplier gets billed to keep it supplied
        through next year. A battery that shaves usage during those specific hours lowers the PLC, which lowers what the
        supplier owes the EDC. <strong>That's where customer savings come from:</strong> the firm splits the saved money —
        part comes back as a bill credit, part is kept as margin (see Sharing and acquisition below). Only whoever holds the
        customer's supply contract ever sees that EDC bill, which is why the firm has to <em>be</em> the supplier, not just
        sell it software.
        <br /><br />
        Four things drive the total below: capacity (via PLC), transmission (same idea, its own tag: NSPL), energy, and a
        scarcity hedge — each explained where it appears.
      </Note></div>

      {/* ---------------- market & methodology: chosen first, everything below reacts to it ---------------- */}
      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Market</p>
        <select value={marketId} onChange={(e) => { setMarketId(e.target.value); setCapPrice(null); setTransRate(null); setRetailRate(null); setScarcityHrs(null); setPlcMethod(MARKETS.find((m) => m.id === e.target.value).plcDefault); }}
          className="w-full p-3 text-sm rounded-lg border border-zinc-300 dark:border-zinc-600 bg-white dark:bg-zinc-800 mb-2">
          {MARKETS.map((m) => <option key={m.id} value={m.id}>{m.n} — {CAP_CONSTRUCTS[m.capConstruct].n}</option>)}
        </select>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm">
          <Row label="Capacity construct" value={CAP_CONSTRUCTS[market.capConstruct].n} />
          <Row label="Transmission allocation" value={market.transAlloc === "delivery" ? "Regulated delivery — out of reach" : "Varies by state — verify"} />
          <Row label="Customer PLC (no battery)" value={`${econ.tag.plc.toFixed(2)} kW`} hint="Peak Load Contribution, grossed up" />
          <Row label="PLC reduction achieved" value={`${econ.dPlc.toFixed(2)} kW`} />
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{market.note}</p>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">PLC methodology — the gate</p>
        <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
          The EDC decides <em>how</em> PLC gets calculated — and that choice alone decides whether a battery can move the
          number at all, before prices or battery size matter. Pick the option that matches this market.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {[["interval", "Interval-derived", "Tag comes from the account's actual hourly meter data. Battery discharge during CP hours is visible to the calculation and the tag falls."],
            ["profile", "Class load profile", "Tag comes from a class-average shape scaled by monthly kWh. The account's real peak-hour behavior never enters the formula. The battery is invisible."]].map(([id, t, d]) => (
            <button key={id} onClick={() => setPlcMethod(id)}
              className={`p-3 rounded-lg border text-xs leading-relaxed text-left transition-colors ${plcMethod === id ? (id === "profile" ? "border-red-300 dark:border-red-700 bg-red-50 dark:bg-red-900/20" : "border-blue-300 dark:border-blue-700 bg-blue-50 dark:bg-blue-900/20") : "border-zinc-200 dark:border-zinc-700"}`}>
              <div className="font-medium text-sm text-zinc-900 dark:text-zinc-100 mb-1">{t}</div>
              <p className="text-zinc-500 dark:text-zinc-400">{d}</p>
            </button>
          ))}
        </div>
        <p className="text-xs text-zinc-400 mt-2">
          Check the EDC's enrollment documentation to confirm which one applies. Some EDCs run hybrids — interval-derived
          where AMI (smart meters) is installed, profiles elsewhere — which is the good case, since you can screen for it at
          signup instead of writing off a whole state.
        </p>
      </div>

      {gated && (
        <div className="mb-4"><Note tone="red">
          <strong>PLC methodology gate is closed — this business doesn't work in this configuration.</strong> This EDC
          calculates capacity tags from a class-average profile, not real meter data, so a battery cutting usage on the actual
          peak hour never touches the number the supplier gets billed on.
          <br /><br />
          It's worse than zero: charge/discharge losses nudge monthly kWh up slightly, pushing a profile-derived tag the{" "}
          <em>wrong</em> way — that's the negative line below. Verify this before anything else in a target market, since
          every other number on this tab multiplies by it.
        </Note></div>
      )}

      {market.capConstruct === "none" && (
        <div className="mb-4"><Note tone="amber">
          <strong>ERCOT is energy-only</strong> — no capacity market, so there's no tag to shave, and its transmission
          charge (4CP) only applies to large commercial accounts, not homes. The only value here is the{" "}
          <strong>scarcity hedge</strong>: a supplier is short on wholesale power by design, and a fleet that can discharge
          during a genuine price spike ($5,000+/MWh) protects against exactly the exposure that bankrupted retailers during
          Winter Storm Uri.
        </Note></div>
      )}

      {/* ---------------- everything below reacts live to the market & methodology chosen above ---------------- */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
        <Metric label="Margin uplift / customer" value={fm(econ.total)} sub="per year, before sharing" positive={econ.total > 60} />
        <Metric label="Firm keeps" value={fm(biz.keepFirm)} sub={`customer gets ${fm(biz.shareCustomer)}`} />
        <Metric label="CAC payback" value={biz.paybackMo ? Math.round(biz.paybackMo) + " mo" : "Never"} positive={!!biz.paybackMo && biz.paybackMo < 36} />
        <Metric label="LTV / CAC" value={biz.ltvCac === Infinity ? "∞" : biz.ltvCac.toFixed(1) + "×"} sub={`at ${churnPct}% churn`} positive={biz.ltvCac >= 3} />
      </div>
      <div className="mb-4"><Note>
        <strong>CAC</strong> is what it costs to sign up one account (Acquisition cost slider, below). <strong>LTV</strong>{" "}
        is the cash one customer generates over their whole time as a customer, so LTV/CAC is "how many times over does a
        customer pay back what it cost to get them" — 3× or more is the usual bar. <strong>Churn</strong> (Annual churn
        slider, below) is what caps LTV even when yearly margin looks fine; residential supplier churn runs high.
      </Note></div>

      {/* ---------------- value decomposition ---------------- */}
      <div className="mb-6">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Where the value comes from</p>
        <ResponsiveContainer width="100%" height={190}>
          <BarChart data={[{ n: "per customer/yr", ...Object.fromEntries(stack.map((c) => [c.k, Math.round(c.v)])) }]} layout="vertical" margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
            <XAxis type="number" tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => "$" + v}
              label={{ value: "$/yr per customer", position: "insideBottom", offset: -3, fontSize: 10, fill: "#888" }} />
            <YAxis type="category" dataKey="n" hide />
            <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => fm(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <ReferenceLine x={0} stroke="#999" />
            {stack.map((c) => <Bar key={c.k} dataKey={c.k} stackId="a" fill={COLORS[c.k]} name={c.n} />)}
          </BarChart>
        </ResponsiveContainer>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm mt-1">
          {stack.map((c) => (
            <Row key={c.k} label={c.n} value={fm(c.v)} hint={econ.total !== 0 ? `${Math.round(100 * c.v / econ.total)}%` : ""} />
          ))}
          <div className="border-t border-zinc-200 dark:border-zinc-700 mt-1 pt-1">
            <Row label="Total" value={fm(econ.total)} hint="100%" />
          </div>
          <div className="border-t border-zinc-200 dark:border-zinc-700 mt-1 pt-1">
            <Row label="Energy delivered to earn it" value={`${Math.round(econ.shiftedKwh)} kWh/yr shifted`} />
            <Row label="Implied value per kWh" value={econ.shiftedKwh > 0 ? `$${(econ.total / econ.shiftedKwh).toFixed(2)}/kWh` : "—"} hint="vs ~$0.04 wholesale spread" />
          </div>
        </div>
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
          <strong>Capacity</strong> and <strong>transmission</strong> pay for kW at a moment, not kWh over time — the PLC/NSPL
          mechanism above — which is why the implied value per kWh runs so far above any wholesale spread.{" "}
          <strong>Energy arbitrage</strong> is the ordinary "buy low, sell high" idea, but against the supplier's own hourly
          wholesale price instead of a retail rate. <strong>Scarcity hedge</strong> is insurance, not a saving: a supplier
          selling at a fixed rate is short the wholesale market, and a fleet that can discharge during a genuine price spike
          (Winter Storm Uri territory) protects against a loss that could otherwise erase years of margin in one week — which
          is why it's sized off rare-event hours per year, not a normal load shape.
        </p>
      </div>

      {/* ---------------- capture, as live numbers off the Dispatch reliability sliders ---------------- */}
      <div className="mb-6">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">
          Value against coincident-peak capture
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-2">
          <Metric label="CP forecast accuracy" value={forecastHit + "%"} sub="Dispatch reliability slider" />
          <Metric label="Device online" value={availability + "%"} sub="Dispatch reliability slider" />
          <Metric label="Charged when called" value={socReady + "%"} sub="Dispatch reliability slider" />
          <Metric label="Effective capture" value={(econ.cap.p * 100).toFixed(0) + "%"} sub="product of the three" positive={econ.cap.p >= 0.5} />
        </div>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm mt-1">
          <Row label="Capacity + transmission value at this capture" value={fm(econ.capacitySaving + econ.transSaving)} />
          <Row label="P10 / P90 capture" value={`${(econ.cap.p10 * 100).toFixed(0)}% / ${(econ.cap.p90 * 100).toFixed(0)}%`} hint={noCapMarket ? "no capacity tag here" : cliff ? "wide — single-hour cliff" : `narrows across ${construct.hours} hours`} />
        </div>
        <div className="mt-1"><Note tone={cliff ? "amber" : "zinc"}>
          <strong>{construct.n}.</strong> {construct.desc}
          <br /><br />
          {noCapMarket
            ? `No capacity tag here, so this P10/P90 band doesn't apply to capacity or transmission (both $0). It still matters for the scarcity hedge below, which runs off the same forecast/availability/charged chain.`
            : cliff
              ? `The tag rests on a single hour, so the P10/P90 spread above is wide — a coin-flip bet, not a sure thing, even when the expected value looks the same as a smoother market.`
              : `Averaging across ${construct.hours} hours narrows the P10/P90 spread above — the main reason to prefer this construct.`}
          {!noCapMarket && (
            <>
              {" "}You dispatch on forecast, not schedule, so catching {construct.hours} real CP{construct.hours > 1 ? "s" : ""} means
              calling more days than that — most forecast-flagged days are false alarms. The {candidateDays}-day figure below is
              a planning estimate of that; the extra wear it implies isn't costed into the totals here yet.
            </>
          )}
        </Note></div>
      </div>

      {/* ---------------- remaining inputs ---------------- */}
      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Prices and rates</p>
        <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
          These are what turn your PLC cut (in kW, from above) into the dollar lines in the chart below. Capacity and
          transmission each multiply that same kW number by a different price; retail rate doesn't touch the battery
          savings at all — it only sets the supplier's baseline margin, further down this tab.
        </p>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
          <Slider label="Capacity clearing price" value={capP} onChange={setCapPrice} min={0} max={600} step={5} fmt={(v) => "$" + v + "/MW-day"} disabled={market.capConstruct === "none"} hint="× your kW cut × 365 = capacity $" />
          <Slider label="Transmission rate (NSPL)" value={transR} onChange={setTransRate} min={0} max={100} fmt={(v) => "$" + v + "/kW-yr"} disabled={!transSupplierBorne} hint="× your kW cut = transmission $" />
          <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <input type="checkbox" checked={transBorne} onChange={(e) => setTransBorne(e.target.checked)} disabled={market.transAlloc === "delivery"} className="w-4 h-4" />
            Transmission is supplier-borne in this state
          </label>
          <Slider label="Retail rate charged" value={retailR} onChange={setRetailRate} min={5} max={25} step={0.5} fmt={(v) => v + "¢/kWh"} hint="sets baseline margin, not battery value" />
          <Slider label="Scarcity hours / yr" value={scarcityH} onChange={setScarcityHrs} min={0} max={40} fmt={(v) => v + " hrs"} hint={`at $${market.scarcityPrice}/MWh — more hours = bigger hedge`} />
          <Note tone="amber">
            <strong>None of these are sourced yet</strong> — replace them before anything relies on them. Capacity prices
            especially: they swung roughly 10× across recent PJM auctions, so pull the real BRA (auction) result for the
            target delivery year rather than trust this default.
          </Note>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Dispatch reliability</p>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
          <Slider label="CP forecast accuracy" value={forecastHit} onChange={setForecastHit} min={20} max={100} step={5} fmt={(v) => v + "%"} />
          <Slider label="Device online" value={availability} onChange={setAvailability} min={30} max={100} step={5} fmt={(v) => v + "%"} hint="you don't own it" />
          <Slider label="Charged when called" value={socReady} onChange={setSocReady} min={30} max={100} step={5} fmt={(v) => v + "%"} />
          <Slider label="Candidate days called" value={candidateDays} onChange={setCandidateDays} min={5} max={60} fmt={(v) => v + " days"} hint="planning estimate — not yet costed below" />
          <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <input type="checkbox" checked={includeScarcity} onChange={(e) => setIncludeScarcity(e.target.checked)} className="w-4 h-4" />
            Count the scarcity hedge
          </label>
          <Note>
            These three multiply together into "Effective capture" above, which is what actually shrinks your PLC.{" "}
            <strong>Device online</strong> is the hard one: failure modes — unit taken camping, unplugged, already drained
            running the AC — are <em>positively correlated</em> with the hot days that set peaks, so real availability on
            peak days likely runs below fleet-average uptime. No contract fixes that; you don't own the hardware, so there's
            no SLA to enforce.
          </Note>
        </div>
      </div>

      {/* ---------------- market comparison: placed after the sliders it ignores, not before ---------------- */}
      <div className="mb-6">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Reference: all retail-choice markets, this household</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={marketCompare} margin={{ top: 25, right: 5, left: 15, bottom: 40 }}>
            <XAxis dataKey="n" tick={{ fontSize: 10, fill: "#888" }} angle={-30} textAnchor="end" interval={0} height={60} />
            <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => "$" + v}
              label={{ value: "$/yr per customer", angle: -90, position: "insideLeft", fontSize: 10, fill: "#888" }} />
            <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => fm(v)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="capacity" stackId="s" fill={COLORS.capacity} name="Capacity" />
            <Bar dataKey="transmission" stackId="s" fill={COLORS.transmission} name="Transmission" />
            <Bar dataKey="scarcity" stackId="s" fill={COLORS.scarcity} name="Scarcity" />
            <Bar dataKey="energy" stackId="s" fill={COLORS.energy} name="Energy" />
          </BarChart>
        </ResponsiveContainer>
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
          Each market here uses its own default prices and methodology, not whatever you've dialed in above, so this is a
          fair side-by-side. States like California, Arizona, and Florida don't appear at all — they aren't retail-choice,
          so this business can't operate there, even though their tariffs perform best on the Customer bill tab. Two
          different companies, not two products.
        </p>
      </div>

      {/* ---------------- business ---------------- */}
      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Sharing and acquisition</p>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
          <Slider label="Shared with customer" value={sharePct} onChange={setSharePct} min={0} max={90} step={5} fmt={(v) => v + "%"} hint={`${fm(biz.shareCustomer)}/yr to them`} />
          <Slider label="Acquisition cost" value={cac} onChange={setCac} min={0} max={400} step={10} fmt={(v) => "$" + v} hint="switching a supplier" />
          <Slider label="Software + telemetry" value={softwareMo} onChange={setSoftwareMo} min={0} max={10} step={0.5} fmt={(v) => "$" + v + "/mo"} />
          <Slider label="Annual churn" value={churnPct} onChange={setChurnPct} min={5} max={60} step={5} fmt={(v) => v + "%"} hint="residential supplier churn is high" />
          <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <input type="checkbox" checked={termContract} onChange={(e) => setTermContract(e.target.checked)} className="w-4 h-4" />
            Term contract through the delivery year
          </label>
          <p className="text-xs text-zinc-400 -mt-2 leading-relaxed">
            Plainly: does the customer stay yours until the delayed capacity credit actually lands on a bill? If not, a
            customer who switches suppliers first hands that already-earned savings to whoever they switch to, for free.
          </p>
          <Note tone={biz.forfeited > 0.15 * Math.max(1, econ.capacitySaving + econ.transSaving) ? "amber" : "zinc"}>
            <strong>The payoff arrives a year late.</strong> You shave usage in summer 2026, but the lower tag only applies to
            the delivery year starting June 2027 — and PLC belongs to the account, not to you, so a customer who leaves before
            then hands your work to their next supplier for free.{" "}
            {termContract
              ? <>The term contract above covers that gap, so at {churnPct}% churn only {fm(biz.forfeited)}/customer is
                  still forfeited.</>
              : <>That's {fm(biz.forfeited)}/customer forfeited at {churnPct}% churn. Fix: pay on measured reduction at
                  verification instead of waiting for delivery-year settlement, or hold the account on term.</>}
          </Note>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Cumulative cash per customer</p>
        <ResponsiveContainer width="100%" height={210}>
          <LineChart data={biz.flows.map((v, i) => ({ y: "Y" + i, Cash: Math.round(biz.flows.slice(0, i + 1).reduce((a, b) => a + b, 0)) }))} margin={{ top: 5, right: 5, left: 0, bottom: 5 }}>
            <XAxis dataKey="y" tick={{ fontSize: 11, fill: "#888" }} />
            <YAxis tick={{ fontSize: 11, fill: "#888" }} tickFormatter={(v) => fm(v)} />
            <Tooltip contentStyle={{ fontSize: 12 }} formatter={(v) => fm(v)} />
            <ReferenceLine y={0} stroke="#999" strokeDasharray="5 5" />
            <Line type="monotone" dataKey="Cash" stroke={COLORS.capacity} strokeWidth={2} dot={{ r: 3 }} />
          </LineChart>
        </ResponsiveContainer>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg text-sm mt-1">
          <Row label="Supplier margin without battery" value={fm(econ.marginBase)} hint="per customer/yr" />
          <Row label="With battery" value={fm(econ.marginWith)} />
          <Row label="Portfolio uplift" value={fm(biz.keepFirm * accounts)} hint={`${accounts.toLocaleString()} accounts`} />
          <Row label="Fleet capacity reduction" value={`${(econ.dPlc * accounts / 1000).toFixed(1)} MW`} hint="at coincident peak" />
        </div>
        <p className="text-xs text-zinc-400 mt-1.5 leading-relaxed">
          This is how one account's PLC cut becomes a real cost saving: the supplier's total capacity bill is just the sum of
          every customer's PLC, priced out. Shave each account a little and the fleet total — what the supplier actually has
          to buy — shrinks by that many MW.
        </p>
        <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <Slider label="Accounts enrolled" value={accounts} onChange={setAccounts} min={1000} max={200000} step={1000} fmt={(v) => (v / 1000) + "k"} />
        </div>
      </div>

      <div className="mb-5"><Note tone="amber">
        <strong>What this tab does not model.</strong> Being a retail supplier at all — state licensing, ISO membership,
        collateral posting, wholesale procurement, hedging, billing, regulated marketing compliance. That's the hard part,
        and it's not software: it's an energy company with a software layer, funded by credit-sensitive collateral rather
        than a SaaS round. Also unmodeled: whether an EDC's tariff even permits a battery-driven tag reduction, and the risk
        that a state changes its capacity market structure entirely, which would rewrite the mechanism underneath everything
        above — unhedgeable within one market, and an argument for spreading across several sooner than unit economics alone
        would suggest.
      </Note></div>
    </div>
  );
}
