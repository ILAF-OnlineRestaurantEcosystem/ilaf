// حسابات الأرباح والتقارير — دوال صافية بدون قاعدة بيانات (بيستعملها السيرفر والبيانات التجريبية)

export const r2 = (n) => Math.round(n * 100) / 100;

/** تكلفة السطر: من اللقطة المحفوظة وقت الطلب، وإذا ما في (طلبات قديمة) من تكلفة الصنف الحالية */
export function lineCost(line, { items, offers }) {
  if (line.unitCost != null) return line.unitCost * line.qty;
  if (line.kind === 'offer') {
    const offer = offers.find((o) => o.id === line.refId);
    const unit = (offer?.itemIds ?? []).reduce((s, id) => s + (items.find((i) => i.id === id)?.cost ?? 0), 0);
    return unit * line.qty;
  }
  return (items.find((i) => i.id === line.refId)?.cost ?? 0) * line.qty;
}

/** ملخص مبيعات مجموعة طلبات: الإيراد، التكلفة، الربح، الخصومات، وكل صنف لحاله */
export function summarize(orders, catalog) {
  let revenue = 0, cost = 0, discounts = 0, count = 0, itemsSold = 0;
  const per = {};
  for (const o of orders) {
    if (o.status === 'cancelled') continue;
    count++;
    revenue += o.total;
    discounts += (o.discount ?? 0) + (o.manualDiscount ?? 0);
    for (const l of o.lines) {
      const c = lineCost(l, catalog);
      cost += c;
      itemsSold += l.qty;
      const row = (per[l.refId] ??= { id: l.refId, name: l.name, kind: l.kind, qty: 0, revenue: 0, cost: 0 });
      row.qty += l.qty;
      row.revenue += l.lineTotal;
      row.cost += c;
    }
  }
  const items = Object.values(per)
    .map((x) => ({ ...x, revenue: r2(x.revenue), cost: r2(x.cost), profit: r2(x.revenue - x.cost) }))
    .sort((a, b) => b.revenue - a.revenue);
  return {
    orders: count,
    revenue: r2(revenue),
    cost: r2(cost),
    profit: r2(revenue - cost),
    discounts: r2(discounts),
    itemsSold,
    avgTicket: count ? r2(revenue / count) : 0,
    items,
  };
}
