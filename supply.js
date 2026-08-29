// ---------------------------------------------------------------------------
// supply.js — retail-choice supplier (LSE) economics
//
// Different business from the rest of this app. Here the firm is the customer's
// electricity SUPPLIER. It doesn't own the battery; the customer already has
// one and installs software. Value comes from reducing the supplier's own cost
// to serve, not from the customer's retail tariff.
//
// Four cost lines a behind-the-meter battery touches:
//   1. Capacity     PLC-based. Largest, and set by a handful of hours.
//   2. Transmission NSPL-based. Comparable or larger — IF supplier-borne.
//   3. Energy       wholesale procurement. Small.
//   4. Scarcity     the battery is a physical hedge on a short spot position.
//
// A non-exporting battery never SELLS anything. It reduces metered consumption.
// Every number below is cost avoidance on the supplier's book.
//
// NOTHING HERE IS SOURCED. Capacity prices, transmission rates, LMP levels and
// scarcity frequencies are placeholders with plausible magnitudes, exposed as
// inputs precisely because they should be replaced with real values before any
// of this is used for a decision.
// ---------------------------------------------------------------------------

import { dispatchDay, loadShapeForMonth, dayCounts, RTE } from "./model.js";

export const CAP_CONSTRUCTS = {
  "5CP": { n: "PJM 5CP", hours: 5, desc: "Average demand across the five highest RTO-wide load hours of the prior summer. Missing one costs 20% of the reduction, not all of it." },
  "1CP": { n: "NYISO 1CP", hours: 1, desc: "Demand during the single system peak hour. Genuine cliff — miss it and the year's reduction is zero." },
  "annualCP": { n: "ISO-NE annual CP", hours: 1, desc: "Demand during the annual system peak hour, used to set the capacity supply obligation." },
  "none": { n: "No capacity market", hours: 0, desc: "ERCOT is energy-only. There is no capacity charge to reduce — the value here is scarcity hedging instead." },
};

// Normalized 24-hour wholesale shapes (multiply by the market's mean $/MWh).
const nz = (a) => { const m = a.reduce((x, y) => x + y, 0) / 24; return a.map((x) => x / m); };
const SHAPE_SUMMER = nz([.62,.55,.52,.51,.53,.60,.72,.85,.92,.95,1.00,1.08,1.20,1.35,1.52,1.70,1.82,1.78,1.55,1.30,1.10,.95,.82,.70]);
const SHAPE_WINTER = nz([.72,.68,.66,.67,.72,.88,1.15,1.32,1.22,1.05,.95,.90,.88,.88,.92,1.05,1.35,1.48,1.35,1.15,1.02,.92,.84,.77]);

export const MARKETS = [
  {
    id: "comed", n: "ComEd (PJM, Illinois)", iso: "PJM", state: "IL",
    capConstruct: "5CP", capPrice: 329, capPriceRange: [30, 400],
    transRate: 38, transAlloc: "varies",
    lmpMean: 42, retailRate: 13.5, deliveryRate: 8.0,
    scarcityHrs: 6, scarcityPrice: 1800, priceCap: 3700,
    plcDefault: "interval",
    note: "Illinois has residential retail choice and ComEd's Hourly Pricing program shows the utility already supports interval-derived residential billing. Whether the default residential PLC is interval-derived still needs confirming against ComEd's load profiling documentation.",
  },
  {
    id: "peco", n: "PECO (PJM, Pennsylvania)", iso: "PJM", state: "PA",
    capConstruct: "5CP", capPrice: 329, capPriceRange: [30, 400],
    transRate: 45, transAlloc: "varies",
    lmpMean: 44, retailRate: 14.0, deliveryRate: 8.5,
    scarcityHrs: 6, scarcityPrice: 1800, priceCap: 3700,
    plcDefault: "interval",
    note: "Pennsylvania has the most mature residential shopping market in PJM. The 2026/27 and 2027/28 capacity price collar came out of a Pennsylvania-led settlement.",
  },
  {
    id: "bge", n: "BGE (PJM, Maryland)", iso: "PJM", state: "MD",
    capConstruct: "5CP", capPrice: 329, capPriceRange: [30, 400],
    transRate: 42, transAlloc: "varies",
    lmpMean: 45, retailRate: 13.5, deliveryRate: 9.0,
    scarcityHrs: 7, scarcityPrice: 1900, priceCap: 3700,
    plcDefault: "interval",
    note: "Maryland residential choice is active and BGE runs a Peak Time Rebate program, so the utility is already doing event-based residential settlement.",
  },
  {
    id: "pseg", n: "PSE&G (PJM, New Jersey)", iso: "PJM", state: "NJ",
    capConstruct: "5CP", capPrice: 329, capPriceRange: [30, 400],
    transRate: 55, transAlloc: "varies",
    lmpMean: 46, retailRate: 14.5, deliveryRate: 9.5,
    scarcityHrs: 7, scarcityPrice: 1900, priceCap: 3700,
    plcDefault: "profile",
    note: "Set to profile-based by default as the pessimistic case — verify. New Jersey transmission rates are among the highest in PJM, so if NSPL is supplier-borne here the transmission line is large.",
  },
  {
    id: "coned", n: "Con Edison (NYISO, NYC)", iso: "NYISO", state: "NY",
    capConstruct: "1CP", capPrice: 550, capPriceRange: [100, 900],
    transRate: 30, transAlloc: "delivery",
    lmpMean: 52, retailRate: 15.0, deliveryRate: 14.0,
    scarcityHrs: 5, scarcityPrice: 1500, priceCap: 1000,
    plcDefault: "interval",
    note: "NYC is a constrained locality so ICAP prices run well above the rest of NYISO. But the tag is set by a SINGLE peak hour — miss it and the year is zero. High price, cliff risk.",
  },
  {
    id: "nationalgrid", n: "National Grid (ISO-NE, Massachusetts)", iso: "ISO-NE", state: "MA",
    capConstruct: "annualCP", capPrice: 120, capPriceRange: [40, 300],
    transRate: 60, transAlloc: "delivery",
    lmpMean: 48, retailRate: 15.0, deliveryRate: 12.0,
    scarcityHrs: 4, scarcityPrice: 1400, priceCap: 2000,
    plcDefault: "interval",
    note: "ISO-NE Forward Capacity Market prices have been comparatively low. Transmission is high but typically sits in the regulated delivery charge, which puts it out of a competitive supplier's reach.",
  },
  {
    id: "ercot", n: "ERCOT (Texas)", iso: "ERCOT", state: "TX",
    capConstruct: "none", capPrice: 0, capPriceRange: [0, 0],
    transRate: 0, transAlloc: "delivery",
    lmpMean: 38, retailRate: 13.5, deliveryRate: 5.0,
    scarcityHrs: 25, scarcityPrice: 2800, priceCap: 5000,
    plcDefault: "interval",
    note: "Energy-only market: no capacity charge exists to reduce, and 4CP transmission allocation applies to large commercial and industrial (C&I) loads, not residential. The entire residential value here is scarcity hedging on the supplier's short position — which is exactly the exposure that bankrupted retailers during the February 2021 Winter Storm Uri outages.",
  },
];

// ---------------------------------------------------------------------------
// Load shape, reusing the household model from the retail side.
// ---------------------------------------------------------------------------

const SYNTH_PLAN = { summerMonths: [4, 5, 6, 7, 8], s: { peak: [] }, w: { peak: [] } };

export function annualLoadShape({ counts, sq, bat, applianceOverrides, monthlyActual }) {
  const months = [];
  let annualKwh = 0;
  for (let m = 0; m < 12; m++) {
    const ls = loadShapeForMonth({
      counts, sq, month: m, plan: SYNTH_PLAN, bat, applianceOverrides,
      actualKwh: monthlyActual?.[m] ?? null,
    });
    const dc = dayCounts(m);
    const dayKwh = ls.total.reduce((a, b) => a + b, 0);
    annualKwh += dayKwh * dc.total;
    months.push({ m, total: ls.total, addressable: ls.addressable, days: dc });
  }
  return { months, annualKwh };
}

export function wholesaleShape(market, month) {
  const isSummer = [4, 5, 6, 7, 8, 9].includes(month);
  const base = isSummer ? SHAPE_SUMMER : SHAPE_WINTER;
  return base.map((f) => f * market.lmpMean);
}

// ---------------------------------------------------------------------------
// CAPACITY TAG (PLC) AND TRANSMISSION TAG (NSPL)
//
// PLC = mean demand across the construct's coincident-peak hours, grossed up
// for losses and reserve margin and scaled by zone.
//
//   plc_kW = mean(load during CP hours) * grossUp
//
// The battery reduces the METERED demand in those hours. Whether that flows
// through to the tag depends entirely on plcMethod:
//
//   interval — tag derived from the account's actual hourly meter data.
//              Battery discharge is visible. Tag falls.
//   profile  — tag derived from a class-average load shape scaled by monthly
//              kWh. The account's actual peak-hour behavior never enters the
//              calculation. The tag does not move — and RTE losses raise
//              monthly consumption slightly, so it moves the WRONG WAY.
//
// This is a binary gate on the whole business, not a discount factor.
// ---------------------------------------------------------------------------

export const CP_HOUR_CANDIDATES = [14, 15, 16, 17, 18]; // typical CP hours, local

export function capacityTag({ loadShape, market, grossUp = 1.15, cpHours = CP_HOUR_CANDIDATES }) {
  const construct = CAP_CONSTRUCTS[market.capConstruct];
  // Metered demand during candidate CP hours, before any gross-up. Computed
  // even where no capacity market exists, because the scarcity hedge needs it.
  // The household's PLC is set by TOTAL metered demand -- that part is real,
  // whatever wiring the load sits behind. But a non-exporting, wall-outlet
  // battery can only ever displace `addressable` load (the same servability
  // ceiling the energy line already respects): it cannot reach central AC, an
  // electric water heater, or anything else hardwired. addressableKw is that
  // ceiling at the same peak month/hours peakKw is drawn from.
  const summer = [5, 6, 7, 8];
  let peakKw = 0;
  let addressableKw = 0;
  summer.forEach((m) => {
    const mo = loadShape.months[m];
    if (!mo) return;
    const avg = cpHours.reduce((s, h) => s + mo.total[h], 0) / cpHours.length;
    if (avg > peakKw) {
      peakKw = avg;
      addressableKw = cpHours.reduce((s, h) => s + mo.addressable[h], 0) / cpHours.length;
    }
  });
  return {
    peakKw,                                   // metered kW at CP, no gross-up -- whole household
    addressableKw,                             // the subset of peakKw a plug-in battery can physically reach
    plc: construct.hours === 0 ? 0 : peakKw * grossUp,
    grossUp,
    applicable: construct.hours > 0,
    construct,
  };
}

/**
 * Expected fraction of the construct's CP hours the fleet actually covers.
 *
 * For 5CP this is roughly linear: cover k of 5 and you keep k/5 of the
 * reduction. For 1CP it is a coin flip on one hour, so the EXPECTED value is
 * the same arithmetic but the variance is enormous — reported separately so
 * the UI can show that a 1CP market is not the same bet as a 5CP market at
 * equal expected value.
 */
export function cpCapture({ forecastHit, availability, socReady, construct }) {
  const p = (forecastHit / 100) * (availability / 100) * (socReady / 100);
  const n = CAP_CONSTRUCTS[construct].hours || 1;
  // Binomial over n independent hours; variance shrinks with n.
  const sd = Math.sqrt(n * p * (1 - p)) / n;
  return { p, sd, p10: Math.max(0, p - 1.28 * sd), p90: Math.min(1, p + 1.28 * sd), n };
}

// ---------------------------------------------------------------------------
// SUPPLIER P&L, per customer per year
// ---------------------------------------------------------------------------

export function supplierEconomics({
  market, loadShape, bat, plcMethod, capPrice, transRate, transSupplierBorne,
  forecastHit, availability, socReady, candidateDays, retailRate, ancillaryAdder,
  scarcityHrs, scarcityPrice, includeScarcity,
}) {
  const construct = market.capConstruct;
  const cap = cpCapture({ forecastHit, availability, socReady, construct });
  const avail = bat.kw * 0.95;
  const invKw = bat.pw;

  // --- 1. ENERGY: dispatch against wholesale price, all 12 months
  let energySaving = 0, shiftedKwh = 0;
  loadShape.months.forEach((mo) => {
    const lmp = wholesaleShape(market, mo.m);
    const cents = lmp.map((p) => p / 10); // $/MWh -> ¢/kWh
    const off = Math.min(...cents);
    const r = dispatchDay({
      rateArr: cents, loadArr: mo.addressable, invKw, availKwh: avail,
      chargeRate: off, chargeKw: bat.ck, chargeHrs: 8,
    });
    energySaving += (r.valueUSD * mo.days.total);
    shiftedKwh += r.discharged * mo.days.total;
  });

  // --- 2. CAPACITY: PLC reduction
  //
  // Each coincident peak falls on a DIFFERENT day, so the battery gets a fresh
  // charge for each one. The per-CP-hour limit is therefore inverter power and
  // one hour of stored energy — not stored energy split across five hours. And
  // it can only ever displace addressable load: a wall-outlet battery cannot
  // reach the central AC or water heater draw that dominates a CP hour, even
  // if it has the inverter power and stored energy to spare.
  const tag = capacityTag({ loadShape, market });
  const perHourKw = Math.min(invKw, avail, tag.addressableKw); // metered kW removed in a CP hour
  const profileGated = plcMethod === "profile";
  const capApplicable = tag.applicable && !profileGated;
  const dPlc = capApplicable ? perHourKw * cap.p * tag.grossUp : 0;
  const capacitySaving = capApplicable ? dPlc * (capPrice / 1000) * 365 : 0;

  // --- 3. TRANSMISSION: NSPL reduction, same mechanism, separate bucket
  const transApplicable = transSupplierBorne && !profileGated && tag.applicable;
  const transSaving = transApplicable ? dPlc * transRate : 0;

  // --- 4. SCARCITY: physical hedge on the short spot position.
  // Independent of the capacity construct — ERCOT has no capacity market and
  // is the market where this line matters most. Same addressable-load ceiling
  // as capacity: the battery can only hedge the load it can actually reach.
  const scarcityKw = Math.min(invKw, avail, tag.addressableKw);
  const scarcitySaving = includeScarcity
    ? scarcityHrs * scarcityKw * ((scarcityPrice - market.lmpMean) / 1000) * cap.p
    : 0;

  // Profile-based tags move the WRONG way: RTE losses raise monthly kWh.
  const rteLossKwh = shiftedKwh * (1 / RTE - 1);
  const profilePenalty = profileGated ? -(rteLossKwh * retailRate) / 100 : 0;

  const total = energySaving + capacitySaving + transSaving + scarcitySaving + profilePenalty;

  // --- supplier margin context
  const revenue = (loadShape.annualKwh * retailRate) / 100;
  const energyCost = loadShape.months.reduce((s, mo) => {
    const lmp = wholesaleShape(market, mo.m);
    return s + mo.total.reduce((x, kwh, h) => x + kwh * lmp[h] / 1000, 0) * mo.days.total;
  }, 0);
  const capacityCost = tag.applicable ? tag.plc * (capPrice / 1000) * 365 : 0;
  const transCost = transSupplierBorne ? tag.plc * transRate : 0;
  const otherCost = (loadShape.annualKwh * ancillaryAdder) / 100;
  const marginBase = revenue - energyCost - capacityCost - transCost - otherCost;

  return {
    components: [
      { k: "capacity", n: "Capacity (PLC)", v: capacitySaving, gated: profileGated || !tag.applicable },
      { k: "transmission", n: "Transmission (NSPL)", v: transSaving, gated: profileGated || !transSupplierBorne },
      { k: "scarcity", n: "Scarcity hedge", v: scarcitySaving, gated: !includeScarcity },
      { k: "energy", n: "Energy arbitrage", v: energySaving, gated: false },
      ...(profileGated ? [{ k: "penalty", n: "RTE loss on profile tag", v: profilePenalty, gated: false }] : []),
    ],
    total, cap, tag, dPlc, profileGated,
    energySaving, capacitySaving, transSaving, scarcitySaving,
    shiftedKwh,
    revenue, energyCost, capacityCost, transCost, marginBase,
    marginWith: marginBase + total,
  };
}

// ---------------------------------------------------------------------------
// BUSINESS: no hardware, so this is SaaS-shaped — except that capacity revenue
// arrives a delivery year late, which churn can forfeit outright.
// ---------------------------------------------------------------------------

export function supplierBusiness({ econ, sharePct, cac, softwareMo, churnPct, years, discount, lagYears, termContract }) {
  const shareCustomer = econ.total * (sharePct / 100);
  const keepFirm = econ.total - shareCustomer;

  // Capacity + transmission settle a delivery year late. A customer who
  // leaves before settlement hands the reduced tag to the next supplier free.
  // A term contract through the delivery year removes nearly all of that risk
  // -- the customer can't leave during the term, so only the single year
  // beyond it carries ordinary churn exposure. Used for both the per-year
  // cash flows below and the summary `forfeited` figure, so they can't drift
  // apart the way they used to (forfeited previously ignored termContract).
  const retainFrac = termContract
    ? Math.pow(1 - churnPct / 100, Math.max(0, lagYears - 1))
    : Math.pow(1 - churnPct / 100, lagYears);

  const flows = [-cac];
  const rows = [];
  let survivors = 1;
  for (let y = 1; y <= years; y++) {
    const startSurv = survivors;
    survivors *= 1 - churnPct / 100;
    const tagValue = (econ.capacitySaving + econ.transSaving) * (1 - sharePct / 100) * startSurv * (y > lagYears ? retainFrac : 0);
    const promptValue = (econ.energySaving + econ.scarcitySaving) * (1 - sharePct / 100) * startSurv;
    const cost = softwareMo * 12 * startSurv;
    const net = tagValue + promptValue - cost;
    flows.push(net);
    rows.push({ y, survivors: startSurv, tagValue, promptValue, cost, net });
  }

  const forfeited = (econ.capacitySaving + econ.transSaving) * (1 - sharePct / 100) * (1 - retainFrac);

  let cum = -cac, paybackMo = null, everNegative = cum < 0;
  for (let i = 1; i < flows.length && paybackMo === null; i++) {
    const prev = cum; cum += flows[i];
    if (prev < 0 && cum >= 0) paybackMo = (i - 1 + (-prev) / (cum - prev)) * 12;
    if (cum < 0) everNegative = true;
  }
  // Cumulative never went negative (e.g. cac=0 with a profitable year one) --
  // paid back immediately, not "never." The crossing check above can't catch
  // this since it only fires on a negative-to-non-negative transition.
  if (paybackMo === null && !everNegative) paybackMo = 0;

  const ltv = rows.reduce((s, r) => s + r.net, 0) + cac;
  return { rows, flows, shareCustomer, keepFirm, forfeited, paybackMo, ltv, ltvCac: cac > 0 ? ltv / cac : Infinity };
}
