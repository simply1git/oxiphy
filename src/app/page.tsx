'use client';

import { useState, useEffect } from 'react';
import useSWR from 'swr';
import mqtt from 'mqtt';
import { 
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip as RechartsTooltip, ResponsiveContainer, Area, AreaChart 
} from 'recharts';
import { calculateAQI } from '@/lib/aqi';
import { 
  Wind, Droplets, Thermometer, CloudFog, Activity, AlertTriangle, ShieldCheck, Clock
} from 'lucide-react';

const fetcher = (url: string) => fetch(url).then(res => res.json());

// Radial Progress Component
const RadialProgress = ({ value, max, label, colorClass, size = 120, showText = true, glowClass = "" }: { value: number, max: number, label: string, colorClass: string, size?: number, showText?: boolean, glowClass?: string }) => {
  const radius = (size / 2) - (showText ? 10 : 4); 
  const circumference = radius * 2 * Math.PI;
  const safeValue = isNaN(value) ? 0 : Math.min(Math.max(value, 0), max);
  const strokeDashoffset = circumference - (safeValue / max) * circumference;

  return (
    <div className="relative flex flex-col items-center justify-center" style={{ width: size, height: size }}>
      <svg className={`transform -rotate-90 w-full h-full ${glowClass}`}>
        <circle cx={size/2} cy={size/2} r={radius} className="stroke-slate-800 fill-none" strokeWidth={showText ? "8" : "6"} />
        <circle 
          cx={size/2} cy={size/2} r={radius} 
          className={`${colorClass} fill-none transition-all duration-1000 ease-out`} 
          strokeWidth={showText ? "8" : "6"} 
          strokeDasharray={circumference} 
          strokeDashoffset={strokeDashoffset} 
          strokeLinecap="round" 
        />
      </svg>
      {showText && (
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="text-5xl font-extrabold tracking-tighter">{value}</span>
          <span className="text-xs text-slate-400 uppercase tracking-widest mt-1 font-semibold">{label}</span>
        </div>
      )}
    </div>
  );
};

export default function Home() {
  // SWR fetches historical data from the database
  const { data: telemetryData, error, isLoading } = useSWR('/api/telemetry?limit=20', fetcher, {
    revalidateOnFocus: true,
  });

  const [mounted, setMounted] = useState(false);
  const [liveData, setLiveData] = useState<any[]>([]);
  const [mqttStatus, setMqttStatus] = useState<'connecting' | 'connected' | 'disconnected'>('connecting');

  useEffect(() => {
    setMounted(true);
    
    // Connect to EMQX Public MQTT Broker via Secure WebSockets
    const client = mqtt.connect('wss://broker.emqx.io:8084/mqtt');

    client.on('connect', () => {
      console.log('Connected to MQTT broker');
      setMqttStatus('connected');
      client.subscribe('oxiphy/telemetry/live');
    });

    client.on('message', (topic, message) => {
      try {
        const data = JSON.parse(message.toString());
        // Append an ISO timestamp if the ESP32 didn't provide one
        if (!data.timestamp) data.timestamp = new Date().toISOString();
        
        // Unshift the new live data into our state, keeping max 20 records
        setLiveData(prev => [data, ...prev].slice(0, 20));
      } catch (err) {
        console.error("MQTT parsing error", err);
      }
    });

    client.on('close', () => {
      setMqttStatus('disconnected');
    });

    return () => {
      client.end();
    };
  }, []);

  if (!mounted) return null;

  if (isLoading && liveData.length === 0) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-950 text-white">
        <div className="flex flex-col items-center space-y-6">
          <div className="relative w-24 h-24">
            <div className="absolute inset-0 rounded-full border-t-2 border-blue-500 animate-spin"></div>
            <div className="absolute inset-2 rounded-full border-r-2 border-emerald-400 animate-spin opacity-70" style={{ animationDirection: 'reverse', animationDuration: '1.5s' }}></div>
            <Activity className="absolute inset-0 m-auto w-8 h-8 text-blue-400 animate-pulse" />
          </div>
          <h2 className="text-xl font-medium tracking-[0.2em] text-slate-400 animate-pulse">CALIBRATING SENSORS</h2>
        </div>
      </div>
    );
  }

  // Combine live MQTT data with historical SWR data
  const displayData = liveData.length > 0 
    ? [...liveData, ...(telemetryData || [])].slice(0, 20) 
    : (telemetryData || []);

  const latest = displayData[0] || {
    pm25: 0, pm10: 0, voc: 0, temperature: 0, humidity: 0, co2: 0, timestamp: new Date().toISOString()
  };

  const aqiData = calculateAQI(latest.pm25, latest.pm10);
  const primaryAQI = aqiData.aqi;
  
  // Setup AQI Styling
  let aqiGlow = "drop-shadow-[0_0_15px_rgba(52,211,153,0.6)]";
  let aqiStroke = "stroke-emerald-400";
  let aqiTextColor = "text-emerald-400";
  
  if (primaryAQI > 100) {
    aqiGlow = "drop-shadow-[0_0_15px_rgba(239,68,68,0.6)]";
    aqiStroke = "stroke-red-500";
    aqiTextColor = "text-red-500";
  } else if (primaryAQI > 50) {
    aqiGlow = "drop-shadow-[0_0_15px_rgba(250,204,21,0.6)]";
    aqiStroke = "stroke-yellow-400";
    aqiTextColor = "text-yellow-400";
  }

  const aqiStatus = { 
    label: aqiData.level, 
    color: aqiTextColor, 
    message: `Current air quality is ${aqiData.level.toLowerCase()}.` 
  };
  
  const chartData = [...displayData].reverse().map(item => ({
    ...item,
    time: new Date(item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  }));

  const isCo2Warning = latest.co2 > 1000;

  return (
    <main className="min-h-screen p-4 md:p-8 text-slate-100 max-w-7xl mx-auto space-y-8 font-sans">
      
      <header className="flex flex-col md:flex-row justify-between items-start md:items-center mb-10 gap-6">
        <div>
          <h1 className="text-4xl md:text-6xl font-extrabold tracking-tighter bg-clip-text text-transparent bg-gradient-to-r from-blue-400 via-indigo-400 to-emerald-400 pb-2">
            Air Quality Intelligence
          </h1>
          <div className="text-slate-400 mt-2 flex items-center gap-4 font-medium text-sm md:text-base">
            <span className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-slate-500" /> 
              {mqttStatus === 'connected' ? 'Live (MQTT WebSockets)' : 'Historical Database'}
            </span>
            <span className="flex items-center gap-2">
              <span className={`w-2 h-2 rounded-full ${mqttStatus === 'connected' ? 'bg-green-500 animate-pulse' : 'bg-red-500'}`}></span>
              {mqttStatus === 'connected' ? 'Connected' : 'Reconnecting...'}
            </span>
          </div>
        </div>
        
        <div className={`glass px-8 py-4 rounded-full flex items-center gap-3 border ${aqiTextColor.replace('text-', 'border-')} shadow-[0_0_30px_rgba(0,0,0,0.3)] hover:scale-105 transition-transform duration-300 cursor-default`}>
          {primaryAQI <= 50 ? <ShieldCheck className="text-emerald-400 w-7 h-7 drop-shadow-[0_0_10px_rgba(52,211,153,0.8)]" /> : <AlertTriangle className={`${aqiTextColor} w-7 h-7`} />}
          <span className={`text-xl font-bold tracking-widest uppercase ${aqiTextColor}`}>
            {aqiStatus.label}
          </span>
        </div>
      </header>

      {isCo2Warning && (
        <div className="glass !bg-red-950/40 !border-red-500/50 p-5 rounded-2xl flex items-center gap-5 text-red-200 shadow-[0_0_40px_rgba(239,68,68,0.2)]">
          <div className="p-3 bg-red-500/20 rounded-full animate-pulse">
            <AlertTriangle className="w-8 h-8 text-red-400 flex-shrink-0" />
          </div>
          <div>
            <h3 className="font-bold text-xl tracking-tight">High CO2 Concentration Detected</h3>
            <p className="text-sm md:text-base mt-1 text-red-300/80">CO2 levels are currently at <span className="font-bold text-red-400">{latest.co2} ppm</span>. Please open a window or increase ventilation to improve cognitive function and air quality.</p>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-4 gap-6">
        
        <div className="glass rounded-[2rem] p-10 col-span-1 md:col-span-2 row-span-2 flex flex-col justify-center items-center relative overflow-hidden group hover:bg-slate-800/60 transition-all duration-500 cursor-default shadow-2xl">
          <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-blue-500/5 rounded-full blur-[80px] -mr-40 -mt-40 transition-all group-hover:bg-blue-500/10"></div>
          
          <h2 className="text-xl font-medium tracking-wide text-slate-300 w-full text-left mb-8 flex items-center gap-3">
            <Wind className="w-6 h-6 text-blue-400" /> Overall Air Quality Index
          </h2>
          
          <div className="my-4">
            <RadialProgress 
              value={primaryAQI} 
              max={300} 
              label="AQI" 
              colorClass={aqiStroke} 
              glowClass={aqiGlow}
              size={260} 
            />
          </div>
          
          <p className="text-center mt-10 text-slate-400 text-base md:text-lg max-w-sm leading-relaxed font-medium">
            {aqiStatus.message}
          </p>
        </div>

        <div className="glass rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.03] hover:-translate-y-1 hover:bg-slate-800/50 transition-all duration-300 cursor-default relative overflow-hidden group">
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-purple-500/10 rounded-full blur-2xl group-hover:bg-purple-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-6 z-10">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><CloudFog className="w-5 h-5 text-purple-400"/> Carbon Dioxide</h3>
            <RadialProgress value={latest.co2} max={2000} label="" colorClass="stroke-purple-500" size={40} showText={false} />
          </div>
          <div className="flex items-baseline gap-2 z-10">
            <span className="text-5xl font-extrabold tracking-tighter text-white drop-shadow-md">{latest.co2}</span>
            <span className="text-purple-400/80 text-sm font-bold tracking-widest">PPM</span>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.03] hover:-translate-y-1 hover:bg-slate-800/50 transition-all duration-300 cursor-default relative overflow-hidden group">
          <div className="absolute -bottom-10 -right-10 w-32 h-32 bg-amber-500/10 rounded-full blur-2xl group-hover:bg-amber-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-6 z-10">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><Activity className="w-5 h-5 text-amber-400"/> TVOC</h3>
            <RadialProgress value={latest.voc} max={1000} label="" colorClass="stroke-amber-500" size={40} showText={false} />
          </div>
          <div className="flex items-baseline gap-2 z-10">
            <span className="text-5xl font-extrabold tracking-tighter text-white drop-shadow-md">{latest.voc}</span>
            <span className="text-amber-400/80 text-sm font-bold tracking-widest">PPB</span>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.03] hover:-translate-y-1 hover:bg-slate-800/50 transition-all duration-300 cursor-default relative overflow-hidden group">
           <div className="absolute top-0 right-0 w-32 h-32 bg-orange-500/10 rounded-full blur-3xl -mr-10 -mt-10 group-hover:bg-orange-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-8 z-10">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><Thermometer className="w-5 h-5 text-orange-400"/> Temperature</h3>
          </div>
          <div className="flex items-start z-10">
            <span className="text-6xl font-extrabold tracking-tighter text-white drop-shadow-md">{latest.temperature.toFixed(1)}</span>
            <span className="text-orange-400 ml-1 text-2xl font-medium mt-1">°C</span>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 flex flex-col justify-between hover:scale-[1.03] hover:-translate-y-1 hover:bg-slate-800/50 transition-all duration-300 cursor-default relative overflow-hidden group">
          <div className="absolute bottom-0 left-0 w-32 h-32 bg-cyan-500/10 rounded-full blur-3xl -ml-10 -mb-10 group-hover:bg-cyan-500/20 transition-all"></div>
          <div className="flex justify-between items-start mb-8 z-10">
            <h3 className="text-slate-400 font-medium flex items-center gap-2"><Droplets className="w-5 h-5 text-cyan-400"/> Humidity</h3>
          </div>
          <div className="flex items-start z-10">
            <span className="text-6xl font-extrabold tracking-tighter text-white drop-shadow-md">{latest.humidity.toFixed(1)}</span>
            <span className="text-cyan-400 ml-1 text-2xl font-medium mt-1">%</span>
          </div>
        </div>

      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mt-8">
        
        <div className="glass rounded-3xl p-8 h-[400px] flex flex-col group hover:bg-slate-800/40 transition-colors duration-500">
          <h3 className="text-xl font-medium text-slate-300 mb-8 flex items-center gap-2">
            <Wind className="w-5 h-5 text-blue-400"/> Particulate Matter Trends
          </h3>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={chartData} margin={{ top: 5, right: 0, left: -20, bottom: 0 }}>
                <defs>
                  <linearGradient id="colorPm25" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#3b82f6" stopOpacity={0}/>
                  </linearGradient>
                  <linearGradient id="colorPm10" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4}/>
                    <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', backdropFilter: 'blur(12px)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                  itemStyle={{ color: '#f8fafc', fontWeight: 500 }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                />
                <Area type="monotone" dataKey="pm25" name="PM2.5 (µg/m³)" stroke="#3b82f6" strokeWidth={4} fillOpacity={1} fill="url(#colorPm25)" activeDot={{ r: 8, fill: '#3b82f6', stroke: '#0f172a', strokeWidth: 2 }} />
                <Area type="monotone" dataKey="pm10" name="PM10 (µg/m³)" stroke="#8b5cf6" strokeWidth={4} fillOpacity={1} fill="url(#colorPm10)" activeDot={{ r: 8, fill: '#8b5cf6', stroke: '#0f172a', strokeWidth: 2 }} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="glass rounded-3xl p-8 h-[400px] flex flex-col group hover:bg-slate-800/40 transition-colors duration-500">
          <h3 className="text-xl font-medium text-slate-300 mb-8 flex items-center gap-2">
            <CloudFog className="w-5 h-5 text-purple-400"/> Gas Concentration Trends
          </h3>
          <div className="flex-1 w-full h-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 5, right: 0, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#334155" vertical={false} opacity={0.5} />
                <XAxis dataKey="time" stroke="#64748b" fontSize={12} tickLine={false} axisLine={false} minTickGap={40} />
                <YAxis yAxisId="left" stroke="#a855f7" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis yAxisId="right" orientation="right" stroke="#f59e0b" fontSize={12} tickLine={false} axisLine={false} />
                <RechartsTooltip 
                  contentStyle={{ backgroundColor: 'rgba(15, 23, 42, 0.95)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px', backdropFilter: 'blur(12px)', boxShadow: '0 10px 40px rgba(0,0,0,0.5)' }}
                  itemStyle={{ fontWeight: 500 }}
                  labelStyle={{ color: '#94a3b8', marginBottom: '8px' }}
                />
                <Line yAxisId="left" type="monotone" dataKey="co2" name="CO2 (ppm)" stroke="#a855f7" strokeWidth={4} dot={false} activeDot={{ r: 8, fill: '#a855f7', stroke: '#0f172a', strokeWidth: 2 }} />
                <Line yAxisId="right" type="monotone" dataKey="voc" name="VOC (ppb)" stroke="#f59e0b" strokeWidth={4} dot={false} activeDot={{ r: 8, fill: '#f59e0b', stroke: '#0f172a', strokeWidth: 2 }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

      </div>
    </main>
  );
}
