// ---------------------------------------------------------------------------
// model.js — pure functions. No React, no DOM. Everything here is testable
// in isolation and should stay that way.
//
// Pipeline:
//   buildLoadShape   appliances + house  -> 12x24 kWh matrix (weekday/weekend)
//   buildRateShape   tariff              -> 12x24 ¢/kWh matrix (weekday/weekend)
//   dispatchDay      one day of each     -> hourly discharge + $ value
//   annualArbitrage  loop months         -> $/yr, kWh/yr, equivalent cycles
//   projectAsset     multi-year          -> cash flows w/ fade + replacement
//   operatorEconomics                    -> per-unit operator + homeowner view
//   fleetEconomics                       -> cohort ramp, peak funding, IRR
// ---------------------------------------------------------------------------

import { PROFILES, baselineKw, ALL_APPLIANCES } from "./tariffs.js";

export const RTE = 0.85;          // round-trip efficiency
export const USABLE_SOC = 0.95;   // fraction of rated kWh actually cyclable
export const FADE_AT_RATED = 0.20; // capacity lost at rated cycle count

// --- calendar --------------------------------------------------------------

const YEAR = 2026;
export function dayCounts(month) {
  const days = new Date(YEAR, month + 1, 0).getDate();
  let wd = 0;
  for (let d = 1; d <= days; d++) {
    const dow = new Date(YEAR, month, d).getDay();
    if (dow !== 0 && dow !== 6) wd++;
  }
  return { weekday: wd, weekend: days - wd, total: days };
}

// --- rate shape ------------------------------------------------------------

/** Returns { weekday: number[24], weekend: number[24] } in ¢/kWh for a month. */
export function rateShapeForMonth(plan, month) {
  const isSummer = plan.summerMonths.includes(month);
  const s = isSummer ? plan.s : plan.w;
  const mk = (applyPeak) => {
    const a = Array(24).fill(s.rOff);
    if (s.superOff) s.superOff.forEach((h) => { a[h] = s.rSuperOff; });
    if (applyPeak) {
      if (s.partial) s.partial.forEach((h) => { a[h] = s.rPartial; });
      s.peak.forEach((h) => { a[h] = s.rPeak; });
    }
    return a;
  };
  return { weekday: mk(true), weekend: mk(!plan.weekdayOnly), isSummer };
}

/** Cheapest hour rate and how many hours are available at/near it. */
export function chargeWindow(rateArr) {
  const min = Math.min(...rateArr);
  const hoursAtMin = rateArr.filter((r) => r <= min + 0.5).length;
  return { rate: min, hours: hoursAtMin };
}

/**
 * Groups a month's weekday hours by distinct rate value -- the same buckets
 * a TOU bill itemizes usage into (Peak / Partial-peak / Off-peak / Super
 * off-peak kWh), highest rate first. Used to let a customer calibrate against
 * their bill's actual per-period usage instead of one blended monthly total.
 */
export function ratePeriodsForMonth(plan, month) {
  const isSummer = plan.summerMonths.includes(month);
  const s = isSummer ? plan.s : plan.w;
  const arr = rateShapeForMonth(plan, month).weekday;
  const byRate = new Map();
  arr.forEach((r, h) => {
    if (!byRate.has(r)) byRate.set(r, []);
    byRate.get(r).push(h);
  });
  const labelFor = (hours) => {
    const hourSet = new Set(hours);
    const matches = (a) => a && a.length === hours.length && a.every((h) => hourSet.has(h));
    if (matches(s.peak)) return "Peak";
    if (matches(s.partial)) return "Partial-peak";
    if (matches(s.superOff)) return "Super off-peak";
    return "Off-peak";
  };
  return [...byRate.entries()]
    .map(([rate, hours]) => ({ rate, hours, label: labelFor(hours) }))
    .sort((a, b) => b.rate - a.rate);
}

// --- load shape ------------------------------------------------------------

/**
 * @param opts.actualKwh optional real monthly total (e.g. from a utility bill).
 *   When given, the appliance-implied shape is rescaled so its monthly total
 *   matches exactly, while keeping the same hour-by-hour proportions -- real
 *   totals, still a shape a battery can be dispatched against.
 * @param opts.actualByTier optional real per-rate-period monthly totals (e.g.
 *   the Peak/Off-Peak kWh a TOU bill itemizes), array-aligned with
 *   ratePeriodsForMonth(plan, month). Takes priority over actualKwh -- rescales
 *   each period's hours independently, so the peak/off-peak *split* can be
 *   corrected too, not just the total.
 * @returns {{ total: number[24], addressable: number[24], blocked: object[] }}
 * `addressable` is the subset a given battery can physically serve.
 */
export function loadShapeForMonth({ counts, sq, month, plan, bat, applianceOverrides = {}, actualKwh = null, actualByTier = null }) {
  const isSummer = plan.summerMonths.includes(month);
  const total = Array(24).fill(0);
  const addressable = Array(24).fill(0);
  const blocked = [];
  const servedNames = [];

  // House baseline: lighting, networking, standby, main fridge. Plugged into
  // a wall outlet, the unit backfeeds the home's shared wiring the same way
  // balcony solar does, so the baseline is fully reachable regardless of
  // which circuit it's actually on.
  const baseKw = baselineKw(sq);
  const baseProf = PROFILES.evening;
  for (let h = 0; h < 24; h++) {
    const kwh = baseKw * 24 * baseProf[h];
    total[h] += kwh;
    addressable[h] += kwh;
  }

  Object.entries(counts).forEach(([id, qty]) => {
    if (!qty) return;
    const a = ALL_APPLIANCES.find((x) => x.id === id);
    if (!a) return;
    if (a.season === "s" && !isSummer) return;
    if (a.season === "w" && isSummer) return;

    const kwRun = a.szf ? a.szf(sq) : a.kwRun;
    const surge = a.sgMult ? kwRun * a.sgMult : a.sg;
    const hrsDay = applianceOverrides[id]?.hrsDay ?? a.hrsDay;
    const prof = PROFILES[applianceOverrides[id]?.prof ?? a.prof];

    const reason = servabilityFailure(a, kwRun, surge, bat);
    for (let h = 0; h < 24; h++) {
      const kwh = kwRun * hrsDay * prof[h] * qty;
      total[h] += kwh;
      if (!reason) addressable[h] += kwh;
    }
    if (reason) blocked.push({ id, n: a.n, reason, kwRun, surge });
    else servedNames.push(a.n);
  });

  if (actualByTier) {
    const days = dayCounts(month).total;
    ratePeriodsForMonth(plan, month).forEach((tier, i) => {
      const target = actualByTier[i];
      if (target == null) return;
      const dailyTierTotal = tier.hours.reduce((s, h) => s + total[h], 0);
      const impliedMonthly = dailyTierTotal * days;
      if (impliedMonthly > 0) {
        const scale = target / impliedMonthly;
        tier.hours.forEach((h) => { total[h] *= scale; addressable[h] *= scale; });
      }
    });
  } else if (actualKwh != null) {
    const dailyTotal = total.reduce((s, v) => s + v, 0);
    const impliedMonthly = dailyTotal * dayCounts(month).total;
    if (impliedMonthly > 0) {
      const scale = actualKwh / impliedMonthly;
      for (let h = 0; h < 24; h++) { total[h] *= scale; addressable[h] *= scale; }
    }
  }

  return { total, addressable, blocked, servedNames, isSummer };
}

/** Why a battery cannot serve this load. Returns null if it can. */
export function servabilityFailure(a, kwRun, surge, bat) {
  if (!a.cord) return "hardwired — not reachable by a plug-in unit";
  if (a.volts > bat.vo) return `needs a 240V outlet — unit is ${bat.vo}V`;
  if (kwRun > bat.pw + 1e-9) return `draws ${kwRun.toFixed(1)} kW — inverter is ${bat.pw} kW`;
  if (surge > bat.sg + 1e-9) return `surges to ${surge.toFixed(1)} kW — surge limit is ${bat.sg} kW`;
  return null;
}

// --- dispatch --------------------------------------------------------------

/**
 * Greedy price-ordered dispatch against a single energy budget.
 * Optimal here because hours are independent given the budget.
 */
export function dispatchDay({ rateArr, loadArr, invKw, availKwh, chargeRate, chargeKw, chargeHrs }) {
  const marginalCost = chargeRate / RTE; // ¢ of charging per ¢ of delivered kWh
  const order = Array.from({ length: 24 }, (_, h) => h).sort((a, b) => rateArr[b] - rateArr[a]);
  const d = Array(24).fill(0);
  let rem = availKwh;

  for (const h of order) {
    if (rem <= 1e-9) break;
    if (rateArr[h] <= marginalCost + 0.01) break; // no profitable hours left
    const x = Math.min(loadArr[h], invKw, rem);
    if (x > 0) { d[h] = x; rem -= x; }
  }

  let discharged = d.reduce((a, b) => a + b, 0);
  const energyLimited = rem <= 1e-9 && discharged > 0;

  // Did the inverter ceiling cost us anything? Only counts if we still had
  // stored energy available when we hit the ceiling.
  let powerCapped = 0;
  if (!energyLimited) {
    for (let h = 0; h < 24; h++) {
      if (rateArr[h] > marginalCost && loadArr[h] > invKw + 1e-9) powerCapped += loadArr[h] - invKw;
    }
  }

  const needIn = discharged / RTE;
  const maxIn = chargeHrs * chargeKw;
  const chargeLimited = needIn > maxIn + 1e-9;
  if (chargeLimited && needIn > 0) {
    const scale = maxIn / needIn;
    for (let h = 0; h < 24; h++) d[h] *= scale;
    discharged *= scale;
  }

  const revenueC = d.reduce((s, x, h) => s + x * rateArr[h], 0);
  const costC = (discharged / RTE) * chargeRate;
  return {
    d, discharged,
    valueUSD: (revenueC - costC) / 100,
    chargeLimited, energyLimited, powerCapped,
    headroomKwh: rem,
    unservedPeak: peakUnserved(rateArr, loadArr, d, marginalCost),
  };
}

function peakUnserved(rateArr, loadArr, d, marginal) {
  let u = 0;
  for (let h = 0; h < 24; h++) if (rateArr[h] > marginal) u += Math.max(0, loadArr[h] - d[h]);
  return u;
}

// --- annual arbitrage ------------------------------------------------------

/**
 * @param opts.capFrac  remaining usable capacity fraction (degradation)
 * @param opts.preserve 0..1 — share of NON-EVENT days the battery idles to
 *                      protect its DR baseline. 0 = shave daily.
 * @param opts.eventDays number of DR event days/yr that must be shaved regardless
 * @param opts.cppOn whether a CPP overlay is enrolled — bill avoidance, so it's
 *                    counted as bill savings here, not as third-party DR revenue
 * @param opts.dispatchSuccess 0..1 share of CPP events the battery actually covers
 */
export function annualArbitrage({ plan, bat, counts, sq, capFrac = 1, preserve = 0, eventDays = 0, applianceOverrides, cppOn = false, cppEvents = null, dispatchSuccess = 1, monthlyActual = null, monthlyActualByTier = null }) {
  const months = [];
  let usd = 0, kwh = 0, cycles = 0, anyChargeLimited = false, anyPowerLimited = false;
  const bind = { energy: 0, power: 0, charge: 0, load: 0 };
  const avail = bat.kw * USABLE_SOC * capFrac;
  const shapeSample = { weekday: null, weekend: null, month: 6 };

  for (let m = 0; m < 12; m++) {
    const rs = rateShapeForMonth(plan, m);
    const ls = loadShapeForMonth({ counts, sq, month: m, plan, bat, applianceOverrides, actualKwh: monthlyActual?.[m] ?? null, actualByTier: monthlyActualByTier?.[m] ?? null });
    const dc = dayCounts(m);

    const run = (rateArr, nDays) => {
      const cw = chargeWindow(rateArr);
      const r = dispatchDay({
        rateArr, loadArr: ls.addressable, invKw: bat.pw, availKwh: avail,
        chargeRate: cw.rate, chargeKw: bat.ck, chargeHrs: cw.hours,
      });
      if (r.chargeLimited) anyChargeLimited = true;
      if (r.powerCapped > 0.05) anyPowerLimited = true;
      if (nDays > 0) {
        if (r.chargeLimited) bind.charge += nDays;
        else if (r.energyLimited) bind.energy += nDays;
        else if (r.powerCapped > 0.05) bind.power += nDays;
        else bind.load += nDays;
      }
      return { ...r, nDays };
    };

    const wd = run(rs.weekday, dc.weekday);
    const we = run(rs.weekend, dc.weekend);

    // Baseline preservation: idle on a share of non-event days.
    const totalDays = dc.total;
    const evShare = totalDays > 0 ? Math.min(1, (eventDays / 12) / totalDays) : 0;
    const activeShare = evShare + (1 - evShare) * (1 - preserve);

    const mUsd = (wd.valueUSD * wd.nDays + we.valueUSD * we.nDays) * activeShare;
    const mKwh = (wd.discharged * wd.nDays + we.discharged * we.nDays) * activeShare;

    usd += mUsd;
    kwh += mKwh;
    cycles += bat.kw > 0 ? mKwh / bat.kw : 0;

    months.push({
      m, usd: mUsd, kwh: mKwh, isSummer: rs.isSummer,
      dischargeShape: wd.d, rateShape: rs.weekday, loadShape: ls.addressable,
      totalLoadShape: ls.total, blocked: ls.blocked,
      chargeLimited: wd.chargeLimited, unservedPeak: wd.unservedPeak,
    });
    if (m === 6) { shapeSample.weekday = wd; }
  }

  // Peak-window addressable load on a summer weekday — the ceiling on what any
  // event-based program can ever pay for, and the deemed-settlement reference.
  const blocked = months[6]?.blocked || [];
  const summerM = plan.summerMonths.includes(6) ? 6 : plan.summerMonths[0] ?? 6;
  const peakHours = plan.s.peak;
  const summerShape = months[summerM];
  const peakWindowLoadKwh = peakHours.reduce((s, h) => s + (summerShape?.loadShape[h] ?? 0), 0);
  const spreadC = plan.s.rPeak - Math.min(plan.s.rOff, plan.s.superOff ? plan.s.rSuperOff : plan.s.rOff);

  // CPP avoidance is a rate feature, not a payment — the customer's own bill
  // is simply smaller on event days, exactly like ordinary TOU shaving. So it
  // belongs in `usd` (bill savings), not in the separate DR-revenue stack that
  // other, third-party-paid programs are counted in.
  let cppUsd = 0;
  if (cppOn && plan.cpp) {
    const ev = cppEvents ?? plan.cpp.ev;
    const perEventKwh = Math.min(
      bat.kw * USABLE_SOC * capFrac,
      4 * bat.pw,
      peakWindowLoadKwh * (4 / Math.max(1, peakHours.length)),
    );
    cppUsd = (ev * perEventKwh * plan.cpp.adder) / 100 * dispatchSuccess;
    usd += cppUsd;
  }

  const bindTotal = bind.energy + bind.power + bind.charge + bind.load;
  const bindingConstraint = bindTotal === 0 ? "none"
    : Object.entries(bind).sort((a, b) => b[1] - a[1])[0][0];

  return {
    usd, kwh, cycles, months, blocked, anyChargeLimited, anyPowerLimited,
    peakWindowLoadKwh, peakWindowHours: peakHours.length, spreadC, cppUsd,
    bind, bindingConstraint, bindShare: bindTotal ? bind[bindingConstraint] / bindTotal : 0,
    sample: shapeSample,
  };
}

// --- what the customer's bill actually does --------------------------------

/** Monthly bill with and without the battery, including fixed charges. */
export function billComparison({ plan, arb, counts, sq, bat, applianceOverrides, monthlyActual = null, monthlyActualByTier = null }) {
  const rows = [];
  for (let m = 0; m < 12; m++) {
    const rs = rateShapeForMonth(plan, m);
    const ls = loadShapeForMonth({ counts, sq, month: m, plan, bat, applianceOverrides, actualKwh: monthlyActual?.[m] ?? null, actualByTier: monthlyActualByTier?.[m] ?? null });
    const dc = dayCounts(m);
    const dayCost = (rateArr) => ls.total.reduce((s, kwh, h) => s + kwh * rateArr[h], 0) / 100;
    const without = dayCost(rs.weekday) * dc.weekday + dayCost(rs.weekend) * dc.weekend + plan.fixed;
    const saved = arb.months[m].usd;
    rows.push({ m, without, with: without - saved, saved });
  }
  return rows;
}

// --- demand response -------------------------------------------------------

/**
 * DR revenue with baseline erosion made explicit. CPP is not included here —
 * it's bill avoidance, not a third-party payment, so it's counted directly in
 * annualArbitrage's `usd` instead (see its `cppOn` param).
 * `preserve` (0..1) is the share of non-event days the battery idles.
 * Baseline-basis programs pay ~proportionally to preserve; indirect programs
 * are manual overrides.
 */
export function drRevenue({ plan, bat, arb, enabled, preserve, dispatchSuccess, overrides = {}, programs, capFrac = 1 }) {
  const out = [];

  // Energy deliverable during ONE event, not one day. Bounded by three things:
  // stored energy, inverter power over the event duration, and the load
  // actually present in the peak window (you can't reduce load you don't have).
  const eventKwh = (hoursPerEvent) => Math.min(
    bat.kw * USABLE_SOC * capFrac,
    hoursPerEvent * bat.pw,
    arb.peakWindowLoadKwh * (hoursPerEvent / Math.max(1, arb.peakWindowHours)),
  );

  programs.forEach((p) => {
    if (!enabled[p.id]) return;
    const stateOk = !p.st || p.st.includes(plan.st);
    if (!stateOk) return;
    if (p.basis === "avoidance") return;

    if (p.basis === "baseline") {
      const perEventKwh = eventKwh(p.hoursPerEvent);
      const gross = p.events * perEventKwh * p.rate * dispatchSuccess;
      const value = gross * preserve;
      out.push({ id: p.id, n: p.n, basis: p.basis, value, gross, eroded: gross - value, perEventKwh });
    } else {
      const value = overrides[p.id] ?? 0;
      out.push({ id: p.id, n: p.n, basis: p.basis, value, eroded: 0, manual: true });
    }
  });

  const total = out.reduce((s, x) => s + x.value, 0);
  const foregone = out.reduce((s, x) => s + (x.eroded || 0), 0);
  return { items: out, total, foregone };
}

// --- multi-year asset projection ------------------------------------------

/**
 * Cycle-based fade. Capacity falls FADE_AT_RATED over the rated cycle count;
 * past rated cycles the unit is replaced (or retired), which the caller sees
 * as a `replacement` flag on that year.
 */
export function projectAsset({ plan, bat, counts, sq, applianceOverrides, years, preserve, eventDays, drFn, replaceOnEOL = true, hwCostFn, cppOn = false, cppEvents = null, dispatchSuccess = 1, monthlyActual = null, monthlyActualByTier = null }) {
  const rows = [];
  let cumCycles = 0;

  for (let y = 1; y <= years; y++) {
    const capFrac = Math.max(0.5, 1 - FADE_AT_RATED * (cumCycles / bat.cyc));
    const arb = annualArbitrage({ plan, bat, counts, sq, applianceOverrides, capFrac, preserve, eventDays, cppOn, cppEvents, dispatchSuccess, monthlyActual, monthlyActualByTier });
    cumCycles += arb.cycles;

    const dr = drFn ? drFn(arb, capFrac) : 0;
    const replacement = replaceOnEOL && cumCycles > bat.cyc && !rows.some((r) => r.replaced);
    if (replacement) cumCycles = 0;

    rows.push({
      y, capFrac, cycles: arb.cycles, cumCycles,
      arbUSD: arb.usd, drUSD: dr, kwh: arb.kwh,
      replaced: replacement, replaceCost: replacement && hwCostFn ? hwCostFn(y) : 0,
      eolYear: cumCycles > bat.cyc,
    });
  }
  return rows;
}

// --- finance ---------------------------------------------------------------

export function npv(rate, flows) {
  return flows.reduce((s, f, t) => s + f / Math.pow(1 + rate, t), 0);
}

export function irr(flows, lo = -0.95, hi = 5) {
  const f = (r) => npv(r, flows);
  if (f(lo) * f(hi) > 0) return null;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (f(lo) * f(mid) <= 0) hi = mid; else lo = mid;
  }
  return (lo + hi) / 2;
}

export function paybackYear(flows) {
  let cum = 0;
  for (let t = 0; t < flows.length; t++) {
    const prev = cum;
    cum += flows[t];
    if (prev < 0 && cum >= 0) return t - 1 + (-prev) / (cum - prev || 1);
  }
  return Infinity;
}

// --- operator economics (per unit) ----------------------------------------

export function operatorEconomics({
  assetRows, bat, hwPct, cac, svcMo, churn, bizModel, subFee, splitPct, upfront,
  planFixed, discount, deemedSpreadC,
}) {
  const hw = bat.c * (hwPct / 100);
  const opFlows = [-(hw + cac) + upfront];
  const hoFlows = [-upfront];
  const detail = [];

  for (const r of assetRows) {
    const surv = Math.pow(1 - churn / 100, r.y);
    // Billed on metered discharge x a published rate -- never a modeled
    // counterfactual bill the customer has no way to independently verify.
    const deemed = (r.kwh * deemedSpreadC) / 100;
    const billable = deemed;

    let op, ho;
    if (bizModel === "sub") {
      op = (subFee * 12 - svcMo * 12) * surv + r.drUSD * surv;
      ho = r.arbUSD - subFee * 12 - planFixed * 12;
    } else {
      op = (billable * (splitPct / 100) + r.drUSD) * surv - svcMo * 12 * surv;
      ho = r.arbUSD - billable * (splitPct / 100) - planFixed * 12;
    }
    op -= (r.replaceCost || 0) * (hwPct / 100) * surv;

    opFlows.push(op);
    hoFlows.push(ho);
    detail.push({ y: r.y, op, ho, deemed, actual: r.arbUSD, capFrac: r.capFrac, replaced: r.replaced });
  }

  const cum = (arr) => arr.reduce((acc, v) => { acc.push((acc[acc.length - 1] ?? 0) + v); return acc; }, []);
  return {
    hw, opFlows, hoFlows, detail,
    opCum: cum(opFlows), hoCum: cum(hoFlows),
    opNPV: npv(discount / 100, opFlows),
    opIRR: irr(opFlows),
    opPayback: paybackYear(opFlows),
    hoYr1: hoFlows[1] ?? 0,
    hoLifetime: hoFlows.reduce((a, b) => a + b, 0),
    opLifetime: opFlows.reduce((a, b) => a + b, 0),
  };
}

// --- fleet: cohort ramp, peak funding, aggregation ------------------------

/**
 * Deploys `perMonth` units each month for `rampMonths`, then holds.
 * Returns the monthly cash curve, peak funding requirement, and fleet IRR.
 */
export function fleetEconomics({ unitOpFlows, perMonth, rampMonths, horizonYears, discount, recoveryRate, churn, hw, refurb, deliverableKw, dispatchSuccess, minAggKw }) {
  const months = horizonYears * 12;
  const monthly = Array(months + 1).fill(0);
  // spread each unit-year flow evenly across its 12 months
  const unitMonthly = [unitOpFlows[0]];
  for (let y = 1; y < unitOpFlows.length; y++) for (let k = 0; k < 12; k++) unitMonthly.push(unitOpFlows[y] / 12);

  let deployed = 0;
  for (let m = 0; m <= months; m++) {
    const cohort = m < rampMonths ? perMonth : 0;
    if (cohort) deployed += cohort;
    for (let t = 0; t <= m; t++) {
      const size = t < rampMonths ? perMonth : 0;
      if (!size) continue;
      const age = m - t;
      if (age < unitMonthly.length) monthly[m] += size * unitMonthly[age];
    }
  }

  // churned units return hardware worth (residual - refurb), redeployed
  const annualChurn = churn / 100;
  for (let m = 12; m <= months; m++) {
    const yearIdx = Math.floor(m / 12);
    const fleetSize = Math.min(deployed, perMonth * Math.min(rampMonths, m));
    const churnedThisMonth = (fleetSize * annualChurn) / 12;
    const residual = hw * Math.max(0, 1 - 0.08 * yearIdx);
    monthly[m] += churnedThisMonth * (recoveryRate / 100) * (residual - refurb);
  }

  const cum = [];
  let c = 0;
  monthly.forEach((v) => { c += v; cum.push(c); });
  const peakFunding = -Math.min(0, ...cum);

  const yearly = [];
  for (let y = 0; y <= horizonYears; y++) {
    let s = 0;
    for (let m = y === 0 ? 0 : (y - 1) * 12 + 1; m <= y * 12; m++) s += monthly[m] || 0;
    yearly.push(y === 0 ? monthly[0] : s);
  }

  const fleetKw = deployed * deliverableKw * (dispatchSuccess);
  return {
    monthly, cum, peakFunding, yearly, deployed,
    fleetNPV: npv(discount / 100, yearly),
    fleetIRR: irr(yearly),
    fleetKw,
    meetsAggMin: fleetKw >= minAggKw,
    unitsForAggMin: deliverableKw > 0 ? Math.ceil(minAggKw / (deliverableKw * dispatchSuccess)) : Infinity,
  };
}

// --- battery selection -----------------------------------------------------

/**
 * Ranks every battery on discounted net value to whoever pays for the hardware.
 *
 *   value = NPV(annual bill savings + CPP avoidance - replacement cost) - purchase price
 *
 * Deliberately NOT the same objective as operator IRR: an operator buying at a
 * volume discount and keeping DR revenue optimizes something different. Callers
 * that want the operator's pick should pass `hwPct` and `drFn`.
 */
export function rankBatteries({ plan, batteries, counts, sq, applianceOverrides, years, preserve, eventDays, discount, hwPct = 100, drFn, opTerms, cppOn = false, cppEvents = null, dispatchSuccess = 1, monthlyActual = null, monthlyActualByTier = null }) {
  const rows = batteries.map((bat) => {
    const proj = projectAsset({
      plan, bat, counts, sq, applianceOverrides, years, preserve, eventDays,
      drFn: drFn ? (a, capFrac) => drFn(bat, a, capFrac) : null,
      hwCostFn: () => bat.c * (hwPct / 100),
      cppOn, cppEvents, dispatchSuccess, monthlyActual, monthlyActualByTier,
    });
    const cost = bat.c * (hwPct / 100);
    const arb1 = annualArbitrage({ plan, bat, counts, sq, applianceOverrides, preserve, eventDays, cppOn, cppEvents, dispatchSuccess, monthlyActual, monthlyActualByTier });

    let flows, yr1;
    if (opTerms) {
      // Same cash flows as the configured offer on Unit economics -- the
      // operator only ever captures a subscription fee or a split of
      // savings, never the full arbitrage + DR value outright. Reusing
      // operatorEconomics directly guarantees this never drifts from what
      // the sticky header shows for the currently selected unit.
      const deemedSpreadC = Math.round((arb1.usd / Math.max(1, arb1.kwh)) * 100);
      const op = operatorEconomics({
        assetRows: proj, bat, hwPct, cac: opTerms.cac, svcMo: opTerms.svcMo, churn: opTerms.churn,
        bizModel: opTerms.bizModel, subFee: opTerms.subFee, splitPct: opTerms.splitPct, upfront: opTerms.upfront,
        planFixed: plan.fixed, discount, deemedSpreadC,
      });
      flows = op.opFlows;
      yr1 = flows[1] ?? 0;
    } else {
      flows = [-cost, ...proj.map((r) => r.arbUSD + r.drUSD - (r.replaceCost || 0))];
      const y1 = proj[0] || { arbUSD: 0, drUSD: 0 };
      yr1 = y1.arbUSD + y1.drUSD;
    }

    return {
      bat, cost,
      npv: npv(discount / 100, flows),
      irr: irr(flows),
      payback: paybackYear(flows),
      yr1,
      cyclesYr: arb1.cycles,
      eolYear: proj.findIndex((r) => r.replaced) + 1 || null,
      binding: arb1.bindingConstraint,
      blockedCount: arb1.blocked.length,
      lifetime: flows.reduce((a, b) => a + b, 0),
    };
  });
  rows.sort((a, b) => b.npv - a.npv);
  return rows;
}
