import React, { useMemo } from "react";

const buildCsv = (rows, headers) => {
  const escape = (value) => {
    const normalized = value == null ? "" : String(value);
    return `"${normalized.replace(/"/g, '""')}"`;
  };

  const head = headers.map((header) => escape(header.label)).join(",");
  const body = rows
    .map((row) => headers.map((header) => escape(row[header.key])).join(","))
    .join("\n");

  return `${head}\n${body}`;
};

const downloadCsv = (filename, rows, headers) => {
  const csv = buildCsv(rows, headers);
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
  const link = document.createElement("a");
  const url = URL.createObjectURL(blob);
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const MiniTrendChart = ({ title, subtitle, points, strokeClass, metric }) => {
  const chartWidth = 360;
  const chartHeight = 96;

  if (!points?.length) {
    return (
      <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
        <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
        <p className="text-xs text-slate-500 mb-3">{subtitle}</p>
        <div className="h-24 flex items-center justify-center text-sm text-slate-400">
          No trend data
        </div>
      </div>
    );
  }

  const values = points.map((point) => point.value);
  const minValue = Math.min(...values);
  const maxValue = Math.max(...values);
  const safeRange = Math.max(1, maxValue - minValue);

  const coordinates = points.map((point, index) => {
    const x =
      points.length === 1
        ? chartWidth / 2
        : (index / (points.length - 1)) * chartWidth;
    const y = chartHeight - ((point.value - minValue) / safeRange) * chartHeight;
    return { x, y, raw: point };
  });

  const linePath = coordinates.map((coord) => `${coord.x},${coord.y}`).join(" ");
  const latest = points[points.length - 1]?.value || 0;
  const diffLabel =
    metric.direction === "up"
      ? `+${metric.diff}`
      : metric.direction === "down"
        ? `${metric.diff}`
        : "0";

  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
      <div className="flex items-center justify-between mb-3">
        <div>
          <h3 className="text-sm font-semibold text-slate-900">{title}</h3>
          <p className="text-xs text-slate-500">{subtitle}</p>
        </div>
        <div className="text-right">
          <p className="text-sm font-bold text-slate-900">{latest}</p>
          <p
            className={`text-xs ${
              metric.direction === "up"
                ? "text-emerald-600"
                : metric.direction === "down"
                  ? "text-rose-600"
                  : "text-slate-500"
            }`}
          >
            {diffLabel} vs prev
          </p>
        </div>
      </div>

      <svg
        viewBox={`0 0 ${chartWidth} ${chartHeight}`}
        className="w-full h-24"
        role="img"
        aria-label={title}
      >
        <polyline
          fill="none"
          points={linePath}
          className={strokeClass}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        {coordinates.map((coord, index) => (
          <circle
            key={`${coord.raw.label}-${index}`}
            cx={coord.x}
            cy={coord.y}
            r="2.5"
            className={strokeClass.replace("stroke", "fill")}
          >
            <title>{`${coord.raw.label}: ${coord.raw.value}`}</title>
          </circle>
        ))}
      </svg>

      <div className="flex items-center justify-between mt-2 text-[11px] text-slate-400">
        <span>{points[0]?.label || ""}</span>
        <span>{points[points.length - 1]?.label || ""}</span>
      </div>
    </div>
  );
};

const toHourLabel = (hour24) => {
  const safeHour = Number.isFinite(hour24) ? hour24 : 0;
  const suffix = safeHour >= 12 ? "PM" : "AM";
  const hour12 = safeHour % 12 === 0 ? 12 : safeHour % 12;
  return `${hour12}:00 ${suffix}`;
};

const AnalyticsSections = ({
  chartSeries,
  trendSummary,
  peakHours,
  userInsights,
  topShelfUtilization,
  roleName,
}) => {
  const trendExportRows = useMemo(
    () =>
      chartSeries.txTrend.map((item, index) => ({
        date: item.label,
        checkouts: item.value,
        activity_index: chartSeries.activityTrend[index]?.value || 0,
        fine_collections: chartSeries.fineTrend[index]?.value || 0,
      })),
    [chartSeries],
  );

  const canSeeAdminInsights = ["admin", "librarian"].includes(
    (roleName || "").toLowerCase(),
  );

  return (
    <>
      <div className="card">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold tracking-tight">Trend Overview</h2>
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-500">Last 14 points</span>
            <button
              type="button"
              className="btn btn-secondary py-2 px-3 text-sm"
              onClick={() =>
                downloadCsv(
                  "dashboard-trends.csv",
                  trendExportRows,
                  [
                    { key: "date", label: "Date" },
                    { key: "checkouts", label: "Checkouts" },
                    { key: "activity_index", label: "Activity Index" },
                    { key: "fine_collections", label: "Fine Collections" },
                  ],
                )
              }
            >
              Export CSV
            </button>
          </div>
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
          <MiniTrendChart
            title="Daily Checkouts"
            subtitle="Book circulation pace"
            points={chartSeries.txTrend}
            strokeClass="stroke-indigo-500"
            metric={trendSummary.tx}
          />
          <MiniTrendChart
            title="Activity Index"
            subtitle="Entries + returns"
            points={chartSeries.activityTrend}
            strokeClass="stroke-emerald-500"
            metric={trendSummary.activity}
          />
          <MiniTrendChart
            title="Fine Collections"
            subtitle="Amount collected per day"
            points={chartSeries.fineTrend}
            strokeClass="stroke-rose-500"
            metric={trendSummary.fine}
          />
        </div>
      </div>

      {canSeeAdminInsights && (
        <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
          <div className="card">
            <h2 className="text-xl font-bold tracking-tight mb-4">Peak Usage Hours</h2>
            {peakHours.length ? (
              <div className="space-y-2">
                {peakHours.map((hourData) => (
                  <div
                    key={hourData.hour}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        {toHourLabel(hourData.hour)}
                      </p>
                      <span className="text-xs rounded-full bg-indigo-100 text-indigo-700 px-2 py-1">
                        {hourData.traffic} traffic
                      </span>
                    </div>
                    <p className="text-xs text-slate-500 mt-1">
                      Entries {hourData.entries} | Checkouts {hourData.checkouts}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No usage-hour data</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold tracking-tight mb-4">User Retention</h2>
            {(userInsights?.user_retention || []).length ? (
              <div className="space-y-2">
                {userInsights.user_retention.map((segment) => (
                  <div
                    key={segment.user_segment}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <div className="flex items-center justify-between">
                      <p className="text-sm font-semibold text-slate-900">
                        {segment.user_segment}
                      </p>
                      <span className="text-sm font-bold text-slate-800">
                        {Number(segment.user_count || 0)}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No retention data</p>
            )}
          </div>

          <div className="card">
            <h2 className="text-xl font-bold tracking-tight mb-4">Role Engagement</h2>
            {(userInsights?.role_insights || []).length ? (
              <div className="space-y-2">
                {userInsights.role_insights.slice(0, 6).map((role) => (
                  <div
                    key={role.role_name}
                    className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2"
                  >
                    <p className="text-sm font-semibold text-slate-900">{role.role_name}</p>
                    <p className="text-xs text-slate-500 mt-1">
                      Active users {Number(role.active_users || 0)} | Avg books {Number(role.avg_books_per_user || 0).toFixed(1)}
                    </p>
                  </div>
                ))}
              </div>
            ) : (
              <p className="text-slate-500 text-center py-8">No role-insight data</p>
            )}
          </div>
        </div>
      )}

      {canSeeAdminInsights && (
        <div className="card">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-xl font-bold tracking-tight">Shelf Utilization</h2>
            <button
              type="button"
              className="btn btn-secondary py-2 px-3 text-sm"
              onClick={() =>
                downloadCsv(
                  "shelf-utilization.csv",
                  topShelfUtilization.map((shelf) => ({
                    shelf_number: shelf.shelf_number,
                    location: shelf.location,
                    utilization_percent: shelf.utilization_percent.toFixed(1),
                    current_books: Number(shelf.current_books || 0),
                    capacity: Number(shelf.capacity || 0),
                  })),
                  [
                    { key: "shelf_number", label: "Shelf Number" },
                    { key: "location", label: "Location" },
                    { key: "utilization_percent", label: "Utilization %" },
                    { key: "current_books", label: "Current Books" },
                    { key: "capacity", label: "Capacity" },
                  ],
                )
              }
            >
              Export CSV
            </button>
          </div>
          {topShelfUtilization.length ? (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
              {topShelfUtilization.map((shelf) => (
                <div
                  key={`${shelf.shelf_number}-${shelf.location}`}
                  className="rounded-xl border border-slate-200 bg-slate-50 p-3"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-semibold text-slate-900 truncate pr-2">
                      Shelf {shelf.shelf_number}
                    </p>
                    <span className="text-xs rounded-full bg-sky-100 text-sky-700 px-2 py-1">
                      {shelf.utilization_percent.toFixed(1)}%
                    </span>
                  </div>
                  <p className="text-xs text-slate-500 mt-1 truncate">{shelf.location}</p>
                  <div className="h-2 rounded-full bg-slate-200 mt-2 overflow-hidden">
                    <div
                      className="h-full bg-sky-500"
                      style={{ width: `${Math.min(100, shelf.utilization_percent)}%` }}
                    />
                  </div>
                  <p className="text-xs text-slate-500 mt-2">
                    {Number(shelf.current_books || 0)} of {Number(shelf.capacity || 0)} books
                  </p>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-slate-500 text-center py-8">No shelf-utilization data</p>
          )}
        </div>
      )}
    </>
  );
};

export default AnalyticsSections;
