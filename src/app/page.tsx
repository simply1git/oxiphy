'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import useSWR from 'swr';
import mqtt from 'mqtt';
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer,
} from 'recharts';
import {
  calculateAQI, getCO2Severity, getTVOCSeverity, getTempSeverity, getHumiditySeverity,
  getPM25Severity, getPM10Severity, type SeverityResult
} from '@/lib/aqi';
import {
  Wind, Droplets, Thermometer, CloudFog, Activity, Gauge, Wifi, WifiOff, TrendingUp, ArrowUp, ArrowDown, Minus
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// ── Tabs ──────────────────────────────────────────────────────
type TabId = 'overview' | 'pm25' | 'pm10' | 'co2' | 'tvoc';
const TABS: { id: TabId; label: string; chemical?: string }[] = [
  { id: 'overview', label: 'Overview' },
  { id: 'pm25', label: 'PM', chemical: '2.5' },
  { id: 'pm10', label: 'PM', chemical: '10' },
  { id: 'co2',  label: 'CO', chemical: '2' },
  { id: 'tvoc', label: 'TVOC' },
];

// ── Mini Sparkline ────────────────────────────────────────────
const Sparkline = ({ data, dataKey, color }: { data: any[]; dataKey: string; color: string }) => (
  <div className="sparkline-container">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 2, right: 0, left: 0, bottom: 0 }}>
        <defs>
          <linearGradient id={`spark-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor={color} stopOpacity={0.3} />
            <stop offset="95%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={1.5} fill={`url(#spark-${dataKey})`} dot={false} isAnimationActive={false} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
);

// ── Trend Arrow ───────────────────────────────────────────────
const TrendArrow = ({ current, previous }: { current: number; previous: number }) => {
  const diff = current - previous;
  if (Math.abs(diff) < 0.5) return <Minus className="w-3 h-3 text-slate-500" />;
  if (diff > 0) return <ArrowUp className="w-3 h-3 text-red-400" />;
  return <ArrowDown className="w-3 h-3 text-emerald-400" />;
};

// ── Pollutant Card ────────────────────────────────────────────
interface PollutantCardProps {
  icon: React.ReactNode;
  name: string;
  chemical?: string;
  value: number | string;
  unit: string;
  severity: SeverityResult;
  sparkData: any[];
  sparkKey: string;
  sparkColor: string;
  previousValue?: number;
}

const PollutantCard = ({ icon, name, chemical, value, unit, severity, sparkData, sparkKey, sparkColor, previousValue }: PollutantCardProps) => (
  <div className={`pollutant-card border-l-2 ${severity.borderColor}`}>
    <div className="flex items-start justify-between mb-3">
      <div className="flex items-center gap-2">
        {icon}
        <span className="text-sm text-slate-400 font-medium">
          {name}{chemical && <sub className="text-xs">{chemical}</sub>}
        </span>
      </div>
      <span className={`severity-pill ${severity.textColor} bg-opacity-10`}
        style={{ backgroundColor: `color-mix(in srgb, currentColor 12%, transparent)` }}>
        {severity.level}
      </span>
    </div>
    <div className="flex items-baseline gap-2 mb-3">
      <span className="mono-value text-3xl font-bold text-white">{value}</span>
      <span className="text-xs text-slate-500 font-medium uppercase tracking-wider">{unit}</span>
      {previousValue !== undefined && <TrendArrow current={Number(value)} previous={previousValue} />}
    </div>
    <Sparkline data={sparkData} dataKey={sparkKey} color={sparkColor} />
  </div>
);

// ── Drill-Down Pollutant View ─────────────────────────────────
interface DrillDownProps {
  title: string;
  chemical?: string;
  unit: string;
  dataKey: string;
  color: string;
  chartData: any[];
  latest: any;
  severity: SeverityResult;
}

const DrillDownView = ({ title, chemical, unit, dataKey, color, chartData, latest, severity }: DrillDownProps) => {
  const values = chartData.map(d => d[dataKey]).filter((v: any) => v !== undefined && v !== null);
  const min = values.length ? Math.min(...values) : 0;
  const max = values.length ? Math.max(...values) : 0;
  const avg = values.length ? Math.round(values.reduce((a: number, b: number) => a + b, 0) / values.length) : 0;

  return (
    <div className="animate-fade-in space-y-6">
      {/* Stats Row */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="glass rounded-xl p-5">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Current</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className={`mono-value text-3xl font-bold ${severity.textColor}`}>{latest[dataKey]}</span>
            <span className="text-xs text-slate-500">{unit}</span>
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Average</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="mono-value text-3xl font-bold text-slate-200">{avg}</span>
            <span className="text-xs text-slate-500">{unit}</span>
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Min</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="mono-value text-3xl font-bold text-emerald-400">{min}</span>
            <span className="text-xs text-slate-500">{unit}</span>
          </div>
        </div>
        <div className="glass rounded-xl p-5">
          <span className="text-xs text-slate-500 uppercase tracking-wider font-medium">Max</span>
          <div className="flex items-baseline gap-2 mt-1">
            <span className="mono-value text-3xl font-bold text-red-400">{max}</span>
            <span className="text-xs text-slate-500">{unit}</span>
          </div>
        </div>
      </div>

      {/* Large Area Chart */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-300 mb-6 flex items-center gap-2">
          <TrendingUp className="w-5 h-5" style={{ color }} />
          {title}{chemical && <sub className="text-sm">{chemical}</sub>} — Historical Trend
        </h3>
        <div className="h-[350px]">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <defs>
                <linearGradient id={`drillFill-${dataKey}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor={color} stopOpacity={0.25} />
                  <stop offset="95%" stopColor={color} stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', fontSize: '13px' }}
                itemStyle={{ color: '#f8fafc' }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Area type="monotone" dataKey={dataKey} stroke={color} strokeWidth={2.5} fill={`url(#drillFill-${dataKey})`} dot={false} activeDot={{ r: 5, fill: color, stroke: '#0b1120', strokeWidth: 2 }} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* Bar Chart */}
      <div className="glass rounded-2xl p-6">
        <h3 className="text-lg font-semibold text-slate-300 mb-6">Reading Distribution</h3>
        <div className="h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
              <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} minTickGap={40} />
              <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
              <RechartsTooltip
                contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', fontSize: '13px' }}
                itemStyle={{ color: '#f8fafc' }}
                labelStyle={{ color: '#94a3b8', marginBottom: '4px' }}
              />
              <Bar dataKey={dataKey} fill={color} radius={[4, 4, 0, 0]} opacity={0.8} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  );
};


// ══════════════════════════════════════════════════════════════
// MAIN PAGE
// ══════════════════════════════════════════════════════════════
export default function Home() {
  const { data: telemetryData, isLoading } = useSWR('/api/telemetry?limit=20', fetcher, { revalidateOnFocus: true });

  const [mounted, setMounted] = useState(false);
  const [liveData, setLiveData] = useState<any[]>([]);
  const [mqttStatus, setMqttStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');
  const [deviceStatus, setDeviceStatus] = useState<'live' | 'idle' | 'offline'>('offline');
  const [activeTab, setActiveTab] = useState<TabId>('overview');
  const lastMessageTime = useRef<number>(0);

  useEffect(() => {
    setMounted(true);
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');
    client.on('connect', () => { setMqttStatus('connected'); client.subscribe('oxiphy/telemetry/live'); });
    client.on('message', (_topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        if (!data.timestamp) data.timestamp = new Date().toISOString();
        lastMessageTime.current = Date.now();
        setLiveData(prev => [data, ...prev].slice(0, 20));
      } catch { /* ignore parse errors */ }
    });
    client.on('close', () => setMqttStatus('disconnected'));

    // Check every second if the ESP32 is still sending data
    const statusInterval = setInterval(() => {
      const elapsed = Date.now() - lastMessageTime.current;
      if (lastMessageTime.current === 0 || elapsed > 10000) {
        setDeviceStatus('idle');
      } else {
        setDeviceStatus('live');
      }
    }, 1000);

    return () => { client.end(); clearInterval(statusInterval); };
  }, []);

  // ── Derived Data ──────────────────────────────────────────
  const displayData = useMemo(() => {
    if (liveData.length > 0) return [...liveData, ...(telemetryData || [])].slice(0, 20);
    return telemetryData || [];
  }, [liveData, telemetryData]);

  const chartData = useMemo(() =>
    [...displayData].reverse().map(item => ({
      ...item,
      time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    })),
    [displayData]
  );

  if (!mounted) return null;

  // ── Loading State ─────────────────────────────────────────
  if (isLoading && liveData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center text-white">
        <div className="flex flex-col items-center space-y-4">
          <div className="relative w-16 h-16">
            <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
            <Gauge className="absolute inset-0 m-auto w-6 h-6 text-blue-400 animate-pulse" />
          </div>
          <span className="text-sm text-slate-500 tracking-widest uppercase">Loading Telemetry</span>
        </div>
      </div>
    );
  }

  const latest = displayData[0] || { pm25: 0, pm10: 0, voc: 0, temperature: 0, humidity: 0, co2: 0, timestamp: new Date().toISOString() };
  const previous = displayData[1] || latest;
  const aqiResult = calculateAQI(latest.pm25, latest.pm10);

  // ── Severities ────────────────────────────────────────────
  const pm25Sev = getPM25Severity(latest.pm25);
  const pm10Sev = getPM10Severity(latest.pm10);
  const co2Sev  = getCO2Severity(latest.co2);
  const tvocSev = getTVOCSeverity(latest.voc);
  const tempSev = getTempSeverity(latest.temperature);
  const humSev  = getHumiditySeverity(latest.humidity);

  const lastUpdated = new Date(latest.timestamp).toLocaleString([], {
    month: 'short', day: 'numeric', year: 'numeric',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  });

  return (
    <main className="min-h-screen p-4 md:p-6 lg:p-8 max-w-[1400px] mx-auto space-y-6 font-sans">

      {/* ── Hero AQI Banner ─────────────────────────────────── */}
      <div className={`hero-banner glass ${aqiResult.borderColor} border`}>
        <div className="relative z-10 flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
          {/* Left: AQI */}
          <div className="flex items-center gap-8">
            <div>
              <span className={`mono-value text-7xl md:text-8xl font-extrabold ${aqiResult.textColor}`}>
                {aqiResult.aqi}
              </span>
            </div>
            <div className="flex flex-col gap-2">
              <h1 className="text-2xl md:text-3xl font-bold text-white tracking-tight">Air Quality Index</h1>
              <span className={`severity-pill text-sm ${aqiResult.textColor}`}
                style={{ backgroundColor: `color-mix(in srgb, currentColor 12%, transparent)` }}>
                {aqiResult.level}
              </span>
              <div className="flex items-center gap-3 mt-1">
                <span className="text-xs text-slate-500">
                  Primary Pollutant: <strong className={`${aqiResult.textColor}`}>{aqiResult.prominentPollutant}</strong>
                </span>
                <span className="text-xs text-slate-600">|</span>
                <span className="text-xs text-slate-500">
                  PM2.5 Sub: <strong className="text-slate-300 mono-value">{aqiResult.pm25SubIndex}</strong>
                </span>
                <span className="text-xs text-slate-500">
                  PM10 Sub: <strong className="text-slate-300 mono-value">{aqiResult.pm10SubIndex}</strong>
                </span>
              </div>
            </div>
          </div>

          {/* Right: Meta */}
          <div className="flex flex-col items-start md:items-end gap-2 text-sm">
            <div className="flex items-center gap-2">
              {mqttStatus !== 'connected'
                ? <><WifiOff className="w-4 h-4 text-red-400" /><span className="text-red-400 font-medium">Disconnected</span></>
                : deviceStatus === 'live'
                  ? <><Wifi className="w-4 h-4 text-emerald-400" /><span className="text-emerald-400 font-medium">Live · MQTT</span><span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span></>
                  : <><Wifi className="w-4 h-4 text-yellow-400" /><span className="text-yellow-400 font-medium">Connected · Idle</span></>
              }
            </div>
            <span className="text-xs text-slate-500">Last Updated: {lastUpdated}</span>
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><Thermometer className="w-3 h-3" /> {latest.temperature.toFixed(1)}°C</span>
              <span className="flex items-center gap-1"><Droplets className="w-3 h-3" /> {latest.humidity.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ──────────────────────────────────── */}
      <div className="tab-bar">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`tab-item ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}{tab.chemical && <sub className="text-xs ml-0.5">{tab.chemical}</sub>}
          </button>
        ))}
      </div>

      {/* ── Tab Content ─────────────────────────────────────── */}

      {activeTab === 'overview' && (
        <div className="animate-fade-in space-y-6">
          {/* Pollutant Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            <PollutantCard
              icon={<Wind className="w-4 h-4 text-blue-400" />}
              name="PM" chemical="2.5" value={latest.pm25} unit="µg/m³"
              severity={pm25Sev} sparkData={chartData} sparkKey="pm25" sparkColor="#3b82f6"
              previousValue={previous.pm25}
            />
            <PollutantCard
              icon={<Wind className="w-4 h-4 text-violet-400" />}
              name="PM" chemical="10" value={latest.pm10} unit="µg/m³"
              severity={pm10Sev} sparkData={chartData} sparkKey="pm10" sparkColor="#8b5cf6"
              previousValue={previous.pm10}
            />
            <PollutantCard
              icon={<CloudFog className="w-4 h-4 text-purple-400" />}
              name="CO" chemical="2" value={latest.co2} unit="ppm"
              severity={co2Sev} sparkData={chartData} sparkKey="co2" sparkColor="#a855f7"
              previousValue={previous.co2}
            />
            <PollutantCard
              icon={<Activity className="w-4 h-4 text-amber-400" />}
              name="TVOC" value={latest.voc} unit="ppb"
              severity={tvocSev} sparkData={chartData} sparkKey="voc" sparkColor="#f59e0b"
              previousValue={previous.voc}
            />
            <PollutantCard
              icon={<Thermometer className="w-4 h-4 text-orange-400" />}
              name="Temperature" value={latest.temperature.toFixed(1)} unit="°C"
              severity={tempSev} sparkData={chartData} sparkKey="temperature" sparkColor="#f97316"
            />
            <PollutantCard
              icon={<Droplets className="w-4 h-4 text-cyan-400" />}
              name="Humidity" value={latest.humidity.toFixed(1)} unit="%"
              severity={humSev} sparkData={chartData} sparkKey="humidity" sparkColor="#06b6d4"
            />
          </div>

          {/* Overview Charts */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <div className="glass rounded-2xl p-6 h-[380px] flex flex-col">
              <h3 className="text-base font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <Wind className="w-4 h-4 text-blue-400" /> Particulate Matter
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData} margin={{ top: 5, right: 10, left: -15, bottom: 0 }}>
                    <defs>
                      <linearGradient id="oPm25" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                      </linearGradient>
                      <linearGradient id="oPm10" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                        <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                    <YAxis stroke="#475569" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', fontSize: '13px' }}
                      itemStyle={{ color: '#f8fafc' }} labelStyle={{ color: '#94a3b8' }}
                    />
                    <Area type="monotone" dataKey="pm25" name="PM2.5" stroke="#3b82f6" strokeWidth={2} fill="url(#oPm25)" dot={false} activeDot={{ r: 4, fill: '#3b82f6', stroke: '#0b1120', strokeWidth: 2 }} />
                    <Area type="monotone" dataKey="pm10" name="PM10" stroke="#8b5cf6" strokeWidth={2} fill="url(#oPm10)" dot={false} activeDot={{ r: 4, fill: '#8b5cf6', stroke: '#0b1120', strokeWidth: 2 }} />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="glass rounded-2xl p-6 h-[380px] flex flex-col">
              <h3 className="text-base font-semibold text-slate-300 mb-4 flex items-center gap-2">
                <CloudFog className="w-4 h-4 text-purple-400" /> Gas Concentrations
              </h3>
              <div className="flex-1">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData} margin={{ top: 5, right: 10, left: -5, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" vertical={false} />
                    <XAxis dataKey="time" stroke="#475569" fontSize={11} tickLine={false} axisLine={false} minTickGap={50} />
                    <YAxis yAxisId="left" stroke="#a855f7" fontSize={11} tickLine={false} axisLine={false} />
                    <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={11} tickLine={false} axisLine={false} />
                    <RechartsTooltip
                      contentStyle={{ backgroundColor: 'rgba(15,23,42,0.95)', border: '1px solid rgba(148,163,184,0.1)', borderRadius: '12px', fontSize: '13px' }}
                      itemStyle={{ fontWeight: 500 }} labelStyle={{ color: '#94a3b8' }}
                    />
                    <Line yAxisId="left" type="monotone" dataKey="co2" name="CO₂ (ppm)" stroke="#a855f7" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#a855f7', stroke: '#0b1120', strokeWidth: 2 }} />
                    <Line yAxisId="right" type="monotone" dataKey="voc" name="VOC (ppb)" stroke="#f59e0b" strokeWidth={2} dot={false} activeDot={{ r: 4, fill: '#f59e0b', stroke: '#0b1120', strokeWidth: 2 }} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'pm25' && (
        <DrillDownView title="PM" chemical="2.5" unit="µg/m³" dataKey="pm25" color="#3b82f6" chartData={chartData} latest={latest} severity={pm25Sev} />
      )}
      {activeTab === 'pm10' && (
        <DrillDownView title="PM" chemical="10" unit="µg/m³" dataKey="pm10" color="#8b5cf6" chartData={chartData} latest={latest} severity={pm10Sev} />
      )}
      {activeTab === 'co2' && (
        <DrillDownView title="CO" chemical="2" unit="ppm" dataKey="co2" color="#a855f7" chartData={chartData} latest={latest} severity={co2Sev} />
      )}
      {activeTab === 'tvoc' && (
        <DrillDownView title="TVOC" unit="ppb" dataKey="voc" color="#f59e0b" chartData={chartData} latest={latest} severity={tvocSev} />
      )}

    </main>
  );
}
