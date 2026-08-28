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
        <strong>A different business from the rest of this app.</strong> Here the firm is the customer's electricity
        <em> supplier</em> in a retail-choice market. It never buys the battery — the customer already owns one and installs
        software. Value comes from cutting the supplier's own cost to serve, then sharing it back.
        <br /><br />
        A non-exporting battery never sells anything, so nothing here is arbitrage revenue. It's cost avoidance on four lines:
        capacity, transmission, energy, and scarcity exposure. Note which one is large.
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
          <Row label="Customer PLC (no battery)" value={`${econ.tag.plc.toFixed(2)} kW`} hint="grossed up" />
          <Row label="PLC reduction achieved" value={`${econ.dPlc.toFixed(2)} kW`} />
          <p className="text-xs text-zinc-400 mt-2 leading-relaxed">{market.note}</p>
        </div>
      </div>

      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">PLC methodology — the gate</p>
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
          Check the EDC's load-profiling manual or its supplier-facing EDI enrollment specs — suppliers pull PLC and NSPL per
          account through that channel specifically so they can price a customer. Some EDCs run hybrids: interval where AMI is
          deployed, profiles elsewhere. That's the good case, because you can screen at enrollment instead of writing off a state.
        </p>
      </div>

      {gated && (
        <div className="mb-4"><Note tone="red">
          <strong>PLC methodology gate is closed — the business does not exist in this configuration.</strong> This EDC is set to
          derive residential capacity tags from a class-average load profile scaled by monthly kWh, not from the account's
          interval meter data. Nothing in that formula contains the customer's actual peak-hour behavior, so the battery
          discharges 1.5 kW at 5 PM on the peak day and the tag does not move.
          <br /><br />
          It's worse than zero: round-trip losses raise monthly consumption slightly, so a profile-derived tag goes marginally
          the <em>wrong way</em>. That's the negative line in the decomposition below. This is binary and per-EDC — verify it
          before anything else in a target market, because every other number multiplies by it.
        </Note></div>
      )}

      {market.capConstruct === "none" && (
        <div className="mb-4"><Note tone="amber">
          <strong>ERCOT is energy-only</strong> — no capacity market exists, so there's no tag to reduce and the 4CP
          transmission allocation applies to large C&I load, not residential. The entire residential value here is the
          scarcity hedge. That's a thinner but genuinely real business: a supplier is structurally short spot power, and a
          fleet discharging into $5,000/MWh hours is a physical hedge on exactly the exposure that bankrupted retailers
          during Uri.
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
        <strong>CAC</strong> (customer acquisition cost) is what it costs to sign up one account — the Acquisition cost slider
        under Sharing and acquisition below. <strong>LTV</strong> (lifetime value) is the net cash a customer generates over
        their whole tenure before they churn — so LTV/CAC is "how many times over does a customer pay back what it cost to get
        them." <strong>Churn</strong> is the share of customers who cancel or switch away each year (the Annual churn slider,
        also below); residential supplier churn tends to run high, and it's what caps LTV even when the per-year margin looks
        good.
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
          The battery is paid for <strong>kW at a moment</strong>, not kWh over time. That's why the implied value per kWh runs
          orders of magnitude above any wholesale spread, and why energy arbitrage is the smallest line despite being the one
          the "buy low, sell high" framing points at.
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
            ? `There's no capacity tag here for this P10/P90 band to narrow or widen — capacity and transmission are both $0 above regardless of it. It still matters for the scarcity hedge below, which depends on the same forecast/availability/charged-ready chain.`
            : cliff
              ? `Because the tag rests on a single hour, the P10/P90 spread above is wide. Two markets with identical expected value are not the same bet when one of them is a coin flip on one hour.`
              : `Averaging across ${construct.hours} hours narrows the P10/P90 spread above, which is the main argument for entering PJM before NYISO.`}
          {!noCapMarket && (
            <>
              <br /><br />
              You dispatch on forecast, not on schedule — so catching {construct.hours} real CP{construct.hours > 1 ? "s" : ""} means
              calling more days than that, since most forecast-flagged days turn out to be false alarms. The {candidateDays}-day
              figure below is a planning estimate of that false-positive rate — the extra cycle wear it implies isn't costed
              into the dollar totals on this tab yet, so treat it as directional, not a number already baked into the total.
            </>
          )}
        </Note></div>
      </div>

      {/* ---------------- remaining inputs ---------------- */}
      <div className="mb-5">
        <p className="text-sm font-medium text-zinc-500 dark:text-zinc-400 mb-2">Prices and rates</p>
        <div className="p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg space-y-3">
          <Slider label="Capacity clearing price" value={capP} onChange={setCapPrice} min={0} max={600} step={5} fmt={(v) => "$" + v + "/MW-day"} disabled={market.capConstruct === "none"} />
          <Slider label="Transmission rate (NSPL)" value={transR} onChange={setTransRate} min={0} max={100} fmt={(v) => "$" + v + "/kW-yr"} disabled={!transSupplierBorne} />
          <label className="flex items-center gap-2 text-sm text-zinc-500 dark:text-zinc-400">
            <input type="checkbox" checked={transBorne} onChange={(e) => setTransBorne(e.target.checked)} disabled={market.transAlloc === "delivery"} className="w-4 h-4" />
            Transmission is supplier-borne in this state
          </label>
          <Slider label="Retail rate charged" value={retailR} onChange={setRetailRate} min={5} max={25} step={0.5} fmt={(v) => v + "¢/kWh"} />
          <Slider label="Scarcity hours / yr" value={scarcityH} onChange={setScarcityHrs} min={0} max={40} fmt={(v) => v + " hrs"} hint={`at $${market.scarcityPrice}/MWh`} />
          <Note tone="amber">
            <strong>None of these defaults are sourced.</strong> They're plausible magnitudes exposed as inputs because they
            should be replaced before any decision rests on them. Capacity prices in particular moved roughly tenfold across
            three PJM auctions — pull the actual BRA results. The clearing price is at least known before the summer you'd run
            the campaign, so this is known-but-variable revenue rather than uncertain revenue.
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
            Availability is the hard one and it doesn't behave like average uptime. The failure modes — unit taken camping,
            unplugged, already drained running the customer's own AC — are <em>positively correlated</em> with the hot days
            that set peaks. Effective availability during CP hours is plausibly well below fleet-average uptime, and no
            contract fixes that because you don't own the hardware and there's no SLA.
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
          This chart sits below Prices and rates and PLC methodology because it ignores both — it's each market at its{" "}
          <em>own</em> default methodology and published-ish prices, so markets are compared on equal, real footing rather
          than whatever override happens to be dialed in for the one you're currently editing above. It does still reflect
          this household's load and the Dispatch reliability sliders just above, which apply the same way regardless of
          market. Note that California, Arizona, Florida, Georgia and the Carolinas don't appear at all — they aren't retail
          choice, so this business cannot operate there. The tariffs that perform best on the Customer bill tab are precisely
          the ones missing here. These are two different companies, not two products.
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
            In plain terms: does the customer stay locked in as yours until the delayed capacity credit actually shows up on a
            bill? If not, a customer who switches suppliers in the meantime hands that already-earned savings to whoever they
            switch to, for free.
          </p>
          <Note tone={biz.forfeited > 0.15 * Math.max(1, econ.capacitySaving + econ.transSaving) ? "amber" : "zinc"}>
            <strong>The revenue arrives a delivery year late.</strong> You shave in summer 2026; the reduced tag applies to the
            delivery year starting June 2027. PLC is an attribute of the <em>account</em>, not of your relationship — so a
            customer who leaves before settlement hands your reduction to their next supplier for free.{" "}
            {termContract
              ? <>The term contract above already covers that window, so at {churnPct}% churn there's only{" "}
                  {fm(biz.forfeited)}/customer left forfeited — whatever ordinary churn risk falls outside the term itself.</>
              : <>That's {fm(biz.forfeited)}/customer forfeited at {churnPct}% churn, and unlike ordinary churn it's work
                  already performed. The fix is contractual: pay on measured delta at verification rather than on
                  delivery-year settlement, or hold the account on term.</>}
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
        <div className="mt-2 p-3 bg-zinc-100 dark:bg-zinc-800 rounded-lg">
          <Slider label="Accounts enrolled" value={accounts} onChange={setAccounts} min={1000} max={200000} step={1000} fmt={(v) => (v / 1000) + "k"} />
        </div>
      </div>

      <div className="mb-5"><Note tone="amber">
        <strong>What this tab does not model.</strong> Being a retail supplier at all: state licensing, ISO membership,
        collateral posting, wholesale procurement, hedging, billing, and regulated marketing compliance. That is the hard part
        and it is not software — it's an energy company with a software layer, funded by credit-sensitive collateral rather
        than by a SaaS round. Also unmodeled: whether an EDC's tariff permits DER-driven tag reduction at all, and the risk
        that a state exits the PJM capacity construct via a Fixed Resource Requirement, which would change the allocation
        mechanism underneath all of this. That last one is unhedgeable within a market and argues for a multi-state footprint
        earlier than unit economics alone would suggest.
      </Note></div>
    </div>
  );
}
