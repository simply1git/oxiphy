'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import { calculateAQI, getAQIStatus } from '@/lib/aqi';
import { 
  Wind, Droplets, Thermometer, CloudFog, Activity, AlertTriangle, ShieldCheck, Clock
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Radial Progress Component
const RadialProgress = ({ value, max, label, colorClass, size = 120 }: { value: number, max: number, label: string, colorClass: string, size?: number }) => {
  const radius = (size / 2) - 10;
  const circumference = radius * 2 * Math.PI;
  const safeValue = isNaN(value) ? 0 : Math.min(Math.max(value, 0), max);
  const strokeDashoffset = circumference - (safeValue / max) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg className="transform -rotate-90 w-full h-full">
        <circle cx={size/2} cy={size/2} r={radius} className="stroke-slate-700 fill-none" strokeWidth="8" />
        <circle 
          cx={size/2} cy={size/2} r={radius} 
          className={`${colorClass} fill-none transition-all duration-1000 ease-out`} 
          strokeWidth="8" 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          strokeLinecap="round" 
        />
      </svg>
      <div className="absolute flex flex-col items-center justify-center text-center">
        <span className="text-3xl font-bold">{value}</span>
        <span className="text-xs text-slate-400 uppercase tracking-widest">{label}</span>
      </div>
    </div>
  );
};

export default function Home() {
  const { data: telemetryData, error, isLoading } = useSWR('/api/telemetry?limit=20', fetcher, {
    refreshInterval: 15000,
    revalidateOnFocus: true,
  });

  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  if (!mounted) return null;

  if (isLoading || !telemetryData) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="flex flex-col items-center space-y-4 animate-pulse">
          <Activity className="w-12 h-12 text-blue-500 animate-spin" />
          <h2 className="text-2xl font-semibold tracking-wider text-slate-300">CALIBRATING SENSORS...</h2>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 text-white">
        <div className="glass p-8 rounded-2xl flex flex-col items-center text-red-400">
          <AlertTriangle className="w-16 h-16 mb-4" />
          <h2 className="text-2xl font-bold">Connection Lost</h2>
          <p className="mt-2 text-slate-400">Unable to reach environmental sensors.</p>
        </div>
      </div>
    );
  }

  const latest = telemetryData[0] || {
    pm25: 0, pm10: 0, voc: 0, temperature: 0, humidity: 0, co2: 0, timestamp: new Date().toISOString()
  };

  const pm25AQI = calculateAQI(latest.pm25, 'pm2.5');
  const pm10AQI = calculateAQI(latest.pm10, 'pm10');
  const primaryAQI = Math.max(pm25AQI, pm10AQI);
  const aqiStatus = getAQIStatus(primaryAQI);
  
  // Format data for Recharts (reverse to show chronological left-to-right)
  const chartData = [...telemetryData].reverse().map(item => ({
    ...item,
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }));

  const isCo2Warning = latest.co2 > 1000;

  return (
    <main className="min-h-screen p-4 md:p-8 text-slate-100 max-w-7xl mx-auto space-y-6">
      
      {/* Header Section */}
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
        <div>
          <h1 className="text-4xl md:text-5xl font-extrabold tracking-tight bg-clip-text text-transparent bg-gradient-to-r from-blue-400 to-emerald-400">
            Air Quality Intelligence
          </h1>
          <p className="text-slate-400 mt-2 flex items-center gap-2 font-medium">
            <Clock className="w-4 h-4" /> Last updated: {new Date(latest.timestamp).toLocaleTimeString()}
          </p>
        </div>
        
        {/* Dynamic Health Badge */}
        <div className={`glass px-6 py-3 rounded-full flex items-center gap-3 border ${aqiStatus.color.replace('text-', 'border-').replace('bg-', 'border-')} shadow-[0_0_15px_rgba(0,0,0,0.2)]`}>
          {primaryAQI <= 50 ? <ShieldCheck className="text-emerald-400 w-6 h-6" /> : <AlertTriangle className={`${aqiStatus.color} w-6 h-6`} />}
          <span className="text-lg font-bold tracking-wide">
            {aqiStatus.label.toUpperCase()}
          </span>
        </div>
      </header>

      {/* Warning Banner */}
      {isCo2Warning && (
        <div className="glass !bg-red-500/20 !border-red-500/50 p-4 rounded-xl flex items-center gap-4 text-red-200 animate-pulse">
          <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
          <div>
            <h3 className="font-bold text-lg">High CO2 Concentration Detected</h3>
            <p className="text-sm">CO2 levels are currently at {latest.co2} ppm. Please open a window or increase ventilation to improve cognitive function and air quality.</p>
          </div>
        </div>
      )}

      {/* Bento Grid Layout */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        
        {/* Main AQI Card (Spans 2 cols, 2 rows) */}
        <div className="glass rounded-3xl p-8 col-span-1 md:col-span-2 row-span-2 flex flex-col justify-center items-center relative overflow-hidden group hover:bg-slate-800/40 transition-all duration-300">
          <div className="absolute top-0 right-0 w-64 h-64 bg-blue-500/10 rounded-full blur-3xl -mr-20 -mt-20 transition-all group-hover:bg-blue-500/20"></div>
          
          <h2 className="text-xl font-semibold text-slate-300 w-full text-left mb-6 flex items-center gap-2">
            <Wind className="w-5 h-5 text-blue-400" /> Overall Air Quality Index
          </h2>
          
          <RadialProgress 
            value={primaryAQI} 
            max={300} 
            label="AQI" 
            colorClass={primaryAQI <= 50 ? "stroke-emerald-400" : primaryAQI <= 100 ? "stroke-yellow-400" : "stroke-red-500"} 
            size={220} 
          />
          
          <p className="text-center mt-6 text-slate-400 text-sm max-w-xs leading-relaxed">
            {aqiStatus.message}
          </p>
        </div>

        {/* CO2 Card */}
        <div className="glass rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-default relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><CloudFog className="w-4 h-4 text-purple-400"/> Carbon Dioxide</h3>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-4xl font-bold tracking-tighter">{latest.co2}</span>
              <span className="text-slate-500 ml-1 text-sm font-semibold">PPM</span>
            </div>
            <RadialProgress value={latest.co2} max={2000} label="" colorClass="stroke-purple-500" size={60} />
          </div>
        </div>

        {/* VOC Card */}
        <div className="glass rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-default relative overflow-hidden">
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><Activity className="w-4 h-4 text-amber-400"/> TVOC</h3>
          </div>
          <div className="flex items-end justify-between">
            <div>
              <span className="text-4xl font-bold tracking-tighter">{latest.voc}</span>
              <span className="text-slate-500 ml-1 text-sm font-semibold">PPB</span>
            </div>
            <RadialProgress value={latest.voc} max={1000} label="" colorClass="stroke-amber-500" size={60} />
          </div>
        </div>

        {/* Temperature Card */}
        <div className="glass rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-default relative overflow-hidden">
           <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-2xl -mr-10 -mt-10"></div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><Thermometer className="w-4 h-4 text-orange-400"/> Temperature</h3>
          </div>
          <div>
            <span className="text-5xl font-bold tracking-tighter">{latest.temperature.toFixed(1)}</span>
            <span className="text-slate-400 ml-1 text-xl font-light">°C</span>
          </div>
        </div>

        {/* Humidity Card */}
        <div className="glass rounded-3xl p-6 flex flex-col justify-between hover:scale-[1.02] transition-transform cursor-default relative overflow-hidden">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-2xl -ml-10 -mb-10"></div>
          <div className="flex justify-between items-start mb-4">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><Droplets className="w-4 h-4 text-cyan-400"/> Humidity</h3>
          </div>
          <div>
            <span className="text-5xl font-bold tracking-tighter">{latest.humidity.toFixed(1)}</span>
            <span className="text-slate-400 ml-1 text-xl font-light">%</span>
          </div>
        </div>

      </div>

      {/* Charts Section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-6">
        
        {/* Particulates Chart */}
        <div className="glass rounded-3xl p-6 h-[350px] flex flex-col">
          <h3 className="text-lg font-semibold text-slate-300 mb-6 flex items-center gap-2">
            <Wind className="w-4 h-4 text-blue-400"/> Particulate Matter Trends
          </h3>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPm25" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPm10" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                  itemStyle={{ color: '#f8fafc' }}
                />
                <Area type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke="#3b82f6" strokeWidth={3} fillOpacity={1} fill="url(#colorPm25)" />
                <Area type="monotone" dataKey="pm10" name="PM10 (µg/m³)" stroke="#8b5cf6" strokeWidth={3} fillOpacity={1} fill="url(#colorPm10)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* CO2 & VOC Chart */}
        <div className="glass rounded-3xl p-6 h-[350px] flex flex-col">
          <h3 className="text-lg font-semibold text-slate-300 mb-6 flex items-center gap-2">
            <CloudFog className="w-4 h-4 text-purple-400"/> Gas Concentration Trends
          </h3>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="left" stroke="#a855f7" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.9)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '12px', backdropFilter: 'blur(8px)' }}
                />
                <Line yAxisId="left" type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#a855f7" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
                <Line yAxisId="right" type="monotone" dataKey="voc" name="VOC (ppb)" stroke="#f59e0b" strokeWidth={3} dot={false} activeDot={{ r: 6 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </main>
  );
}
