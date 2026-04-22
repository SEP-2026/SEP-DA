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

function endOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), 23, 59, 59, 999);
}

function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

function addMonths(date, months) {
  return new Date(date.getFullYear(), date.getMonth() + months, 1);
}

function startOfHour(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate(), date.getHours(), 0, 0, 0);
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

function formatHourLabel(date) {
  return `${String(date.getHours()).padStart(2, "0")}:00`;
}

function buildRangeBounds(dateFrom, dateTo, range) {
  const anchor = parseDateOnly(dateTo);

  if (range === "quarter") {
    const quarterStart = new Date(anchor.getFullYear(), anchor.getMonth() - 2, 1);
    return {
      from: quarterStart,
      to: new Date(endOfMonth(anchor).getFullYear(), endOfMonth(anchor).getMonth(), endOfMonth(anchor).getDate(), 23, 59, 59, 999),
    };
  }

  if (range === "month") {
    const monthStart = startOfMonth(anchor);
    return {
      from: monthStart,
      to: new Date(endOfMonth(anchor).getFullYear(), endOfMonth(anchor).getMonth(), endOfMonth(anchor).getDate(), 23, 59, 59, 999),
    };
  }

  if (range === "week") {
    const weekStart = startOfWeek(anchor);
    const weekEnd = addDays(weekStart, 6);
    return {
      from: weekStart,
      to: new Date(weekEnd.getFullYear(), weekEnd.getMonth(), weekEnd.getDate(), 23, 59, 59, 999),
    };
  }

  if (range === "day") {
    return {
      from: anchor,
      to: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59, 999),
    };
  }

  return {
    from: parseDateOnly(dateFrom),
    to: new Date(anchor.getFullYear(), anchor.getMonth(), anchor.getDate(), 23, 59, 59, 999),
  };
}

export function filterTransactionsByRange(transactions, dateFrom, dateTo, range) {
  const normalizedRange = range === "custom" ? "custom" : range;
  const { from, to } = buildRangeBounds(dateFrom, dateTo, normalizedRange);
  return transactions.filter((item) => {
    const date = new Date(item.time);
    return date >= from && date <= to;
  });
}

function getBucketMode(range) {
  if (range === "day") {
    return "hour";
  }
  if (range === "quarter") {
    return "month";
  }
  return "day";
}

function createBucketDate(date, mode) {
  if (mode === "hour") {
    return startOfHour(date);
  }
  if (mode === "month") {
    return startOfMonth(date);
  }
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function createBucketLabel(date, mode) {
  if (mode === "hour") {
    return formatHourLabel(date);
  }
  if (mode === "month") {
    return formatMonthLabel(date);
  }
  return formatDateLabel(date);
}

function createEmptyBuckets(from, to, mode) {
  const buckets = [];
  let cursor = createBucketDate(from, mode);
  const end = createBucketDate(to, mode);

  while (cursor <= end) {
    buckets.push({
      key: cursor.toISOString(),
      label: createBucketLabel(cursor, mode),
      amount: 0,
      date: new Date(cursor),
    });
    if (mode === "hour") {
      cursor = new Date(cursor.getTime() + (60 * 60 * 1000));
    } else if (mode === "month") {
      cursor = addMonths(cursor, 1);
    } else {
      cursor = addDays(cursor, 1);
    }
  }

  return buckets;
}

export function buildRevenueSeries(transactions, dateFrom, dateTo, range) {
  const { from, to } = buildRangeBounds(dateFrom, dateTo, range);
  const mode = getBucketMode(range);
  const buckets = new Map(
    createEmptyBuckets(from, to, mode).map((bucket) => [bucket.key, bucket]),
  );

  transactions
    .filter((item) => item.status === "paid")
    .forEach((item) => {
      const date = new Date(item.time);
      if (date < from || date > to) {
        return;
      }
      const bucketDate = createBucketDate(date, mode);
      const key = bucketDate.toISOString();
      const current = buckets.get(key) || { label: createBucketLabel(bucketDate, mode), amount: 0, date: bucketDate };
      current.amount += Number(item.amount || 0);
      buckets.set(key, current);
    });

  return Array.from(buckets.values())
    .sort((a, b) => a.date - b.date)
    .map(({ label, amount }) => ({ label, amount }));
}

export function filterTransactionsByDate(transactions, dateFrom, dateTo) {
  return filterTransactionsByRange(transactions, dateFrom, dateTo, "day");
}

export function getRangeSummaryLabel(range, dateFrom, dateTo) {
  if (range === "quarter") {
    return "3 tháng gần nhất";
  }
  if (range === "month") {
    return `Tháng ${parseDateOnly(dateTo).getMonth() + 1}`;
  }
  if (range === "week") {
    return `Tuần ${formatDateLabel(startOfWeek(parseDateOnly(dateTo)))}`;
  }
  if (range === "day") {
    return formatDateLabel(parseDateOnly(dateTo));
  }
  const fromLabel = formatDateLabel(parseDateOnly(dateFrom));
  const toLabel = formatDateLabel(parseDateOnly(dateTo));
  return `${fromLabel} - ${toLabel}`;
}
