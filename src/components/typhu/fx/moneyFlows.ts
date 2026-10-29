/** One transfer of money between two parties; `null` is the bank (taxes, salary, purchases, the Nghỉ chân pot…). */
export interface MoneyFlow {
  from: string | null;
  to: string | null;
  amount: number;
}

/**
 * What moved between two snapshots of everybody's cash. Payers are matched with receivers in turn
 * (rent: tenant → owner), so what is left over goes to / comes from the bank. The totals per
 * player always add up to their real change, only the pairing is inferred.
 * `skip` holds players whose cash jumped for another reason (a bankruptcy wipes it).
 */
export function moneyFlows(prev: Record<string, number>, next: Record<string, number>, skip: ReadonlySet<string> = new Set()): MoneyFlow[] {
  const pay: { id: string; left: number }[] = [];
  const get: { id: string; left: number }[] = [];
  for (const [id, cash] of Object.entries(next)) {
    const before = prev[id];
    if (before === undefined || skip.has(id) || before === cash) continue;
    (cash < before ? pay : get).push({ id, left: Math.abs(cash - before) });
  }
  const flows: MoneyFlow[] = [];
  let g = 0;
  for (const p of pay) {
    while (p.left > 0 && g < get.length) {
      const r = get[g];
      const amount = Math.min(p.left, r.left);
      flows.push({ from: p.id, to: r.id, amount });
      p.left -= amount;
      r.left -= amount;
      if (r.left === 0) g++;
    }
    if (p.left > 0) flows.push({ from: p.id, to: null, amount: p.left });
  }
  for (const r of get.slice(g)) if (r.left > 0) flows.push({ from: null, to: r.id, amount: r.left });
  return flows;
}
