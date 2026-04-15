function parseDateOnly(value) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function startOfWeek(date) {
  const result = new Date(date);
  const day = result.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + diff);
  result.setHours(0, 0, 0, 0);
  return result;
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function endOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth() + 1, 0);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function formatDateLabel(date) {
  return new Intl.DateTimeFormat("vi-VN", {
    day: "2-digit",
    month: "2-digit",
  }).format(date);
}

function formatMonthLabel(date) {
  return `Thg ${date.getMonth() + 1}`;
}

function formatWeekLabel(date) {
  return `Tuần ${formatDateLabel(date)}`;
}

function buildRangeBounds(dateFrom, dateTo, range) {
  const from = parseDateOnly(dateFrom);
  const to = parseDateOnly(dateTo);

  if (range === "quarter") {
    const quarterStart = new Date(to.getFullYear(), to.getMonth() - 2, 1);
    return {
      from: quarterStart,
      to: endOfMonth(to),
    };
  }

  return {
    from,
    to: new Date(to.getFullYear(), to.getMonth(), to.getDate(), 23, 59, 59, 999),
  };
}

function createBucketKey(date, range) {
  if (range === "week") {
    return startOfWeek(date).toISOString();
  }
  if (range === "month" || range === "quarter") {
    return startOfMonth(date).toISOString();
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate()).toISOString();
}

function createBucketLabel(date, range) {
  if (range === "week") {
    return formatWeekLabel(startOfWeek(date));
  }
  if (range === "month" || range === "quarter") {
    return formatMonthLabel(startOfMonth(date));
  }
  return formatDateLabel(date);
}

export function buildRevenueSeries(transactions, dateFrom, dateTo, range) {
  const { from, to } = buildRangeBounds(dateFrom, dateTo, range);
  const buckets = new Map();

  transactions
    .filter((item) => item.status === "paid")
    .forEach((item) => {
      const date = new Date(item.time);
      if (date < from || date > to) {
        return;
      }
      const key = createBucketKey(date, range);
      const current = buckets.get(key) || { label: createBucketLabel(date, range), amount: 0, date };
      current.amount += Number(item.amount || 0);
      buckets.set(key, current);
    });

  return Array.from(buckets.values())
    .sort((a, b) => a.date - b.date)
    .map(({ label, amount }) => ({ label, amount }));
}

export function filterTransactionsByDate(transactions, dateFrom, dateTo) {
  const { from, to } = buildRangeBounds(dateFrom, dateTo, "day");
  return transactions.filter((item) => {
    const date = new Date(item.time);
    return date >= from && date <= to;
  });
}

export function getRangeSummaryLabel(range, dateFrom, dateTo) {
  if (range === "quarter") {
    return "3 tháng gần nhất";
  }
  const fromLabel = formatDateLabel(parseDateOnly(dateFrom));
  const toLabel = formatDateLabel(parseDateOnly(dateTo));
  return `${fromLabel} - ${toLabel}`;
}
