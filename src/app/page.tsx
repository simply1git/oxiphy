"use client";

import useSWR from "swr";
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Wind, Thermometer, Droplets, Activity, CloudFog, CloudRain, HeartPulse } from "lucide-react";
import { calculateAQI } from "@/lib/aqi";

type Telemetry = {
  id: number;
  timestamp: string;
  pm25: number;
  pm10: number;
  voc: number;
  temperature: number;
  humidity: number;
  co2: number;
};

const fetcher = (url: string) => fetch(url).then((res) => res.json()).then(data => data.reverse());

export default function Dashboard() {
  const { data, error, isLoading } = useSWR<Telemetry[]>('/api/telemetry', fetcher, { 
    refreshInterval: 5000,
    revalidateOnFocus: true,
  });

  const latest = data && data.length > 0 ? data[data.length - 1] : null;
  
  let aqiInfo = { aqi: 0, level: "Loading...", color: "bg-slate-800" };
  if (latest) {
    aqiInfo = calculateAQI(latest.pm25, latest.pm10);
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-8 font-sans">
      <div className="max-w-7xl mx-auto space-y-8">
        <header className="flex items-center justify-between">
          <div>
            <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-emerald-400 bg-clip-text text-transparent">
              Air Quality Monitoring
            </h1>
            <p className="text-slate-400 mt-1">Live data from AI-IAQ6-PH Sensor</p>
          </div>
          {isLoading && <div className="text-sm text-slate-400 animate-pulse">Loading data...</div>}
        </header>

        {/* Health Status Banner */}
        {latest && (
          <div className={`p-6 rounded-2xl ${aqiInfo.color} text-white shadow-lg flex items-center justify-between transition-all duration-500`}>
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                <HeartPulse size={28} />
                Air Quality is {aqiInfo.level}
              </h2>
              <p className="mt-1 opacity-90">
                {aqiInfo.aqi <= 50 ? "The air is clean and optimal for health." 
                : aqiInfo.aqi <= 100 ? "Air quality is acceptable." 
                : "Air quality is poor. Consider improving ventilation."}
                {latest.co2 > 1000 ? " High CO2 detected. Please open a window!" : ""}
              </p>
            </div>
            <div className="text-right">
              <div className="text-4xl font-black">{aqiInfo.aqi}</div>
              <div className="text-sm font-semibold opacity-90 uppercase tracking-widest">US EPA AQI</div>
            </div>
          </div>
        )}

        {/* Metric Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          <MetricCard
            title="CO2 Level"
            value={latest?.co2.toString()}
            unit="ppm"
            icon={<Wind className="text-emerald-400" size={24} />}
            status={getCO2Status(latest?.co2)}
          />
          <MetricCard
            title="Temperature"
            value={latest?.temperature.toFixed(1)}
            unit="°C"
            icon={<Thermometer className="text-orange-400" size={24} />}
            status="normal"
          />
          <MetricCard
            title="Humidity"
            value={latest?.humidity.toFixed(1)}
            unit="% RH"
            icon={<Droplets className="text-blue-400" size={24} />}
            status="normal"
          />
          <MetricCard
            title="PM 2.5"
            value={latest?.pm25.toString()}
            unit="µg/m³"
            icon={<CloudFog className="text-slate-400" size={24} />}
            status={getPM25Status(latest?.pm25)}
          />
          <MetricCard
            title="PM 10"
            value={latest?.pm10.toString()}
            unit="µg/m³"
            icon={<CloudRain className="text-slate-400" size={24} />}
            status={getPM10Status(latest?.pm10)}
          />
          <MetricCard
            title="VOC"
            value={latest?.voc.toString()}
            unit="ppm"
            icon={<Activity className="text-purple-400" size={24} />}
            status="normal"
          />
        </div>

        {/* Charts */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* CO2 Chart */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <h3 className="text-lg font-semibold mb-6">CO2 Trends</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
                    stroke="#475569"
                    fontSize={12}
                  />
                  <YAxis stroke="#475569" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "none" }}
                    labelFormatter={formatTime}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="co2"
                    name="CO2 (ppm)"
                    stroke="#10b981"
                    strokeWidth={3}
                    dot={false}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* PM Chart */}
          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl shadow-lg">
            <h3 className="text-lg font-semibold mb-6">Particulate Matter</h3>
            <div className="h-64 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={data || []}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
                  <XAxis
                    dataKey="timestamp"
                    tickFormatter={formatTime}
                    stroke="#475569"
                    fontSize={12}
                  />
                  <YAxis stroke="#475569" fontSize={12} />
                  <Tooltip
                    contentStyle={{ backgroundColor: "#0f172a", border: "none" }}
                    labelFormatter={formatTime}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="pm25"
                    name="PM2.5"
                    stroke="#3b82f6"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    type="monotone"
                    dataKey="pm10"
                    name="PM10"
                    stroke="#8b5cf6"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

// Helpers
function formatTime(isoString: any) {
  if (!isoString || typeof isoString !== 'string') return "";
  const date = new Date(isoString);
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function getCO2Status(co2?: number) {
  if (co2 === undefined) return "normal";
  if (co2 > 1500) return "critical";
  if (co2 > 1000) return "warning";
  return "normal";
}

function getPM25Status(pm25?: number) {
  if (pm25 === undefined) return "normal";
  if (pm25 > 50) return "critical";
  if (pm25 > 25) return "warning";
  return "normal";
}

function getPM10Status(pm10?: number) {
  if (pm10 === undefined) return "normal";
  if (pm10 > 100) return "critical";
  if (pm10 > 50) return "warning";
  return "normal";
}

function MetricCard({
  title,
  value,
  unit,
  icon,
  status,
}: {
  title: string;
  value?: string;
  unit: string;
  icon: React.ReactNode;
  status: "normal" | "warning" | "critical";
}) {
  const statusColors = {
    normal: "bg-slate-900 border-slate-800",
    warning: "bg-orange-950/30 border-orange-900/50",
    critical: "bg-red-950/30 border-red-900/50",
  };

  const textColors = {
    normal: "text-slate-100",
    warning: "text-orange-400",
    critical: "text-red-400",
  };

  return (
    <div
      className={`p-6 rounded-2xl border backdrop-blur-sm transition-all duration-300 ${statusColors[status]}`}
    >
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-slate-400">{title}</p>
          <div className="mt-2 flex items-baseline gap-2">
            <span className={`text-3xl font-bold tracking-tight ${textColors[status]}`}>
              {value || "--"}
            </span>
            <span className="text-sm font-medium text-slate-500">{unit}</span>
          </div>
        </div>
        <div className="p-3 bg-slate-800/50 rounded-xl">{icon}</div>
      </div>
    </div>
  );
}
