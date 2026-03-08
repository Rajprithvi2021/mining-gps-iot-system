import React, { useState, useEffect } from 'react';
import './App.css';
import 'leaflet/dist/leaflet.css';
import { BarChart, Bar, LineChart, Line, PieChart, Pie, Cell, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { FiMap, FiActivity, FiAlertTriangle, FiTrendingUp, FiZap, FiNavigation, FiTruck, FiDownload } from 'react-icons/fi';
import { MapContainer } from './components/MapContainer';

const API_BASE = 'http://localhost:5000/api/v1';

function App() {
  // State Management
  const [activeTab, setActiveTab] = useState('fleet');
  const [theme, setTheme] = useState('dark');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  // Real API Data - START WITH EMPTY (will load from backend)
  const [fleetMetrics, setFleetMetrics] = useState({
    activeVehicles: 0,
    totalVehicles: 0,
    fuelConsumption: 0,
    efficiencyRating: 0,
    costPerKM: 0,
    avgTemp: 0,
    systemUptime: 0
  });
  const [vehicles, setVehicles] = useState([]);
  const [allVehicles, setAllVehicles] = useState([]);
  const [vehicleSearch, setVehicleSearch] = useState('');
  const [vehiclePage, setVehiclePage] = useState(1);
  const [vehicleTotalPages, setVehicleTotalPages] = useState(1);
  
  // New Filter States
  const [filterType, setFilterType] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterLocation, setFilterLocation] = useState('all');
  const [speedRange, setSpeedRange] = useState({ min: 0, max: 60 });
  
  // Map & Vehicle Selection States
  const [selectedVehicle, setSelectedVehicle] = useState(null);
  const [vehicleGPS, setVehicleGPS] = useState({});
  const [comparisonVehicles, setComparisonVehicles] = useState([]); // For multi-select comparison
  const [lastSyncTime, setLastSyncTime] = useState(new Date());
  const [quickFilterActive, setQuickFilterActive] = useState(null); // 'critical', 'lowFuel', 'maintenance', 'idle'
  
  const [alerts, setAlerts] = useState([]);
  const [analytics, setAnalytics] = useState({
    dataRefresh: 'Loading...',
    systemHealth: 0,
    totalEngineers: 0,
    apiLatencyP99: 0,
    errorRate: 0,
    pipelinePassed: 0,
    totalTests: 0,
    uptime: 0
  });
  const [serviceHealth] = useState([]);

  // Deployment Pipeline (mock - can be replaced with actual CI/CD API)
  const deploymentPipeline = [
    { stage: 'Build', status: 'passed', duration: '2m 34s' },
    { stage: 'Unit Tests', status: 'passed', duration: '4m 12s' },
    { stage: 'Security Scan', status: 'passed', duration: '1m 23s' },
    { stage: 'Performance Test', status: 'in-progress', duration: '~2m' },
    { stage: 'Deploy to Prod', status: 'waiting', duration: '-' }
  ];

  /**
   * Fetch all data from backend APIs (REAL DATA FROM BACKEND)
   */
  const fetchData = async (page = 1, search = '') => {
    try {
      setLoading(true);
      setError(null);

      // Fetch dashboard summary
      const dashRes = await fetch(`${API_BASE}/dashboard/summary`).catch(e => ({ ok: false, error: e }));
      if (dashRes.ok) {
        const data = await dashRes.json();
        console.log('Dashboard data:', data);
        if (data.data) {
          setFleetMetrics({
            activeVehicles: data.data.activeVehicles,
            totalVehicles: data.data.totalVehicles,
            fuelConsumption: data.data.fuelConsumption,
            efficiencyRating: data.data.efficiencyRating,
            costPerKM: data.data.costPerKM,
            avgTemp: data.data.avgTemp,
            systemUptime: data.data.systemUptime
          });
        }
      }

      // Fetch vehicles list with pagination and search
      const vehiclesRes = await fetch(`${API_BASE}/vehicles?page=${page}&limit=10&search=${search}`).catch(e => ({ ok: false, error: e }));
      if (vehiclesRes.ok) {
        const data = await vehiclesRes.json();
        console.log('Vehicles data:', data);
        if (data.data && Array.isArray(data.data)) {
          setVehiclePage(data.page);
          setVehicleTotalPages(data.pages);
          setVehicles(data.data.slice(0, 5)); // Show first 5 in dashboard
        }
      }

      // Fetch ALL vehicles for map and filters (no pagination)
      const allVehiclesRes = await fetch(`${API_BASE}/vehicles?limit=1000`).catch(e => ({ ok: false, error: e }));
      if (allVehiclesRes.ok) {
        const data = await allVehiclesRes.json();
        console.log('All vehicles for map:', data);
        if (data.data && Array.isArray(data.data)) {
          setAllVehicles(data.data); // Set ALL 550 vehicles
        }
      }


      // Fetch ALL alerts (not just first 3)
      const alertsRes = await fetch(`${API_BASE}/alerts?limit=100`).catch(e => ({ ok: false, error: e }));
      if (alertsRes.ok) {
        const data = await alertsRes.json();
        console.log('Alerts data:', data);
        if (data.data && Array.isArray(data.data)) {
          // Map vehicle_name to vehicle for display
          const mappedAlerts = data.data.map(a => ({
            ...a,
            vehicle: a.vehicle_name,
            time: new Date(a.timestamp).toLocaleString()
          }));
          setAlerts(mappedAlerts);
        }
      }

      // Fetch analytics
      const analyticsRes = await fetch(`${API_BASE}/analytics`).catch(e => ({ ok: false, error: e }));
      if (analyticsRes.ok) {
        const data = await analyticsRes.json();
        console.log('Analytics data:', data);
        if (data.data) {
          setAnalytics({
            dataRefresh: new Date().toISOString(),
            systemHealth: data.data.fleet?.activeVehicles,
            totalEngineers: 0,
            apiLatencyP99: 0,
            errorRate: 0,
            pipelinePassed: 0,
            totalTests: 0,
            uptime: data.data.fleet?.activeVehicles
          });
        }
      }

      setLoading(false);
    } catch (err) {
      console.error('Error fetching data:', err);
      setError(err.message);
      setLoading(false);
    }
  };

  const handleVehicleSearch = (e) => {
    const searchValue = e.target.value;
    setVehicleSearch(searchValue);
    setVehiclePage(1);
    fetchData(1, searchValue);
  };

  // Filter vehicles based on selected filters
  const getFilteredVehicles = (vehiclesToFilter) => {
    return vehiclesToFilter.filter(v => {
      const matchType = filterType === 'all' || v.type === filterType;
      const matchStatus = filterStatus === 'all' || (filterStatus === 'active' && v.active) || (filterStatus === 'idle' && !v.active);
      const matchLocation = filterLocation === 'all' || v.location === filterLocation;
      const matchSpeed = v.current_speed_kmh >= speedRange.min && v.current_speed_kmh <= speedRange.max;
      return matchType && matchStatus && matchLocation && matchSpeed;
    });
  };

  // Prepare chart data from vehicles
  const getChartData = () => {
    const typeCount = {};
    const tempDistribution = [];
    const fuelDistribution = [];
    const speedDistribution = [];
    
    allVehicles.forEach(v => {
      typeCount[v.type] = (typeCount[v.type] || 0) + 1;
      tempDistribution.push({ name: v.name, temp: v.temp });
      fuelDistribution.push({ name: v.name, fuel: v.fuel });
      speedDistribution.push({ name: v.name, speed: v.current_speed_kmh });
    });

    return {
      typeChart: Object.entries(typeCount).map(([type, count]) => ({ name: type, count })),
      tempChart: tempDistribution.slice(0, 20),
      fuelChart: fuelDistribution.slice(0, 20),
      speedChart: speedDistribution.slice(0, 20)
    };
  };

  // Get unique values for filters
  const getUniqueTypes = () => [...new Set(allVehicles.map(v => v.type))];
  const getUniqueLocations = () => [...new Set(allVehicles.map(v => v.location))];

  // Apply quick filter presets
  const applyQuickFilter = (filterType) => {
    setQuickFilterActive(filterType);
    setFilterType('all');
    setFilterStatus('all');
    setFilterLocation('all');
    setSpeedRange({ min: 0, max: 60 });
    
    if (filterType === 'critical') {
      // Filter for critical alerts and high temps
      // Will be handled in getFilteredVehicles
    } else if (filterType === 'lowFuel') {
      // Show only vehicles with fuel < 30%
    } else if (filterType === 'maintenance') {
      // Show vehicles needing maintenance
    } else if (filterType === 'idle') {
      setFilterStatus('idle');
    } else {
      setQuickFilterActive(null);
    }
  };

  // Check vehicle health/issues
  const getVehicleIssues = (vehicle) => {
    const issues = [];
    if (vehicle.fuel < 20) issues.push('lowFuel');
    if (vehicle.temp > 85) issues.push('highTemp');
    if (!vehicle.active && Math.random() > 0.7) issues.push('maintenance');
    if (!vehicle.active) issues.push('idle');
    return issues;
  };

  // Filter vehicles by quick preset
  const getQuickFilteredVehicles = (vehiclesToFilter) => {
    let filtered = vehiclesToFilter;
    
    if (quickFilterActive === 'critical') {
      // Vehicles with critical issues
      filtered = vehiclesToFilter.filter(v => v.temp > 85 || v.fuel < 15);
    } else if (quickFilterActive === 'lowFuel') {
      // Vehicles with fuel < 30%
      filtered = vehiclesToFilter.filter(v => v.fuel < 30);
    } else if (quickFilterActive === 'maintenance') {
      // Vehicles idle for maintenance
      filtered = vehiclesToFilter.filter(v => !v.active);
    } else if (quickFilterActive === 'idle') {
      filtered = vehiclesToFilter.filter(v => !v.active);
    } else if (quickFilterActive) {
      // Apply regular filters if any active
      filtered = getFilteredVehicles(vehiclesToFilter);
    } else {
      filtered = getFilteredVehicles(vehiclesToFilter);
    }
    
    return filtered;
  };

  // Export vehicles to CSV
  const exportVehiclesCSV = () => {
    const headers = ['ID', 'Name', 'Type', 'Location', 'Status', 'Speed (km/h)', 'Fuel (%)', 'Temp (°C)', 'Efficiency'];
    const rows = getQuickFilteredVehicles(allVehicles).map(v => [
      v.id,
      v.name,
      v.type,
      v.location,
      v.active ? 'Active' : 'Idle',
      v.current_speed_kmh,
      v.fuel,
      v.temp,
      v.efficiency
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `vehicles-export-${new Date().getTime()}.csv`;
    a.click();
  };

  // Export alerts to CSV
  const exportAlertsCSV = () => {
    const headers = ['ID', 'Vehicle', 'Type', 'Severity', 'Message', 'Time'];
    const rows = alerts.map(a => [
      a.id,
      a.vehicle_name || a.vehicle,
      a.type,
      a.severity,
      a.message || 'System Alert',
      a.time
    ]);
    
    const csv = [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `alerts-export-${new Date().getTime()}.csv`;
    a.click();
  };

  // Get search suggestions
  const getSearchSuggestions = (query) => {
    if (!query.trim()) return [];
    const lowerQuery = query.toLowerCase();
    return allVehicles
      .filter(v => v.name.toLowerCase().includes(lowerQuery) || v.id.toLowerCase().includes(lowerQuery))
      .slice(0, 5)
      .map(v => v.name);
  };

  // Toggle vehicle in comparison
  const toggleVehicleComparison = (vehicleId) => {
    setComparisonVehicles(prev => 
      prev.includes(vehicleId) 
        ? prev.filter(id => id !== vehicleId)
        : [...prev, vehicleId].slice(-3) // Max 3 vehicles
    );
  };

  // Generate consistent mock GPS coordinates for each vehicle
  const getVehicleGPS = (vehicleId) => {
    if (!vehicleGPS[vehicleId]) {
      // Generate consistent pseudo-random coordinates based on vehicle ID
      // Handle different ID formats (string or number)
      let idNum = 0;
      if (vehicleId) {
        const idStr = String(vehicleId);
        // Extract number from "Vehicle-0001" format or just use as is
        const parts = idStr.split('-');
        idNum = parseInt(parts[parts.length - 1]) || parseInt(idStr) || 0;
      }
      
      const lat = -25.5 + ((idNum % 50) * 0.05); // Range: -25.5 to -23
      const lng = 113.5 + ((idNum % 100) * 0.02); // Range: 113.5 to 115.5
      setVehicleGPS(prev => ({
        ...prev,
        [vehicleId]: { lat, lng, accuracy: 8 }
      }));
      return { lat, lng, accuracy: 8 };
    }
    return vehicleGPS[vehicleId];
  };

  // Calculate GPS bounds for map view
  const getMapBounds = () => {
    const coords = allVehicles.map(v => getVehicleGPS(v.id));
    if (coords.length === 0) return { center: [-25.5, 113.5], zoom: 8 };
    
    const lats = coords.map(c => c.lat);
    const lngs = coords.map(c => c.lng);
    const minLat = Math.min(...lats);
    const maxLat = Math.max(...lats);
    const minLng = Math.min(...lngs);
    const maxLng = Math.max(...lngs);
    
    return {
      center: [(minLat + maxLat) / 2, (minLng + maxLng) / 2],
      bounds: [[minLat, minLng], [maxLat, maxLng]]
    };
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(() => {
      fetchData();
      setLastSyncTime(new Date());
    }, 15000);
    return () => clearInterval(interval);
  }, []);

  if (loading && !fleetMetrics) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
        <div className="text-center">
          <div className="text-4xl mb-4">📡</div>
          <p className="text-xl font-semibold">Loading Fleet Data...</p>
          <p className="text-sm opacity-60 mt-2">Connecting to backend API</p>
          {error && <p className="text-red-400 text-sm mt-4">Error: {error}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={`min-h-screen transition-colors ${theme === 'dark' ? 'bg-slate-950 text-white' : 'bg-gray-50 text-slate-950'}`}>
      {/* Premium Header */}
      <header className={`border-b backdrop-blur-md ${theme === 'dark' ? 'border-slate-800 bg-slate-900/50' : 'border-gray-200 bg-white/50'}`}>
        <div className="max-w-7xl mx-auto px-6 py-4 flex justify-between items-center">
          <div>
            <h1 className="text-4xl font-black">Skylark Mining Operations</h1>
            <p className="text-xs opacity-60 mt-1">Enterprise Fleet Management & IoT Analytics Platform</p>
          </div>
          <div className="flex items-center gap-4">
            <div className="text-right text-xs opacity-70">
              <div>Last Sync: {lastSyncTime.toLocaleTimeString()}</div>
              <div>Auto-refresh: Every 15s</div>
              <div className="flex items-center gap-1 justify-end mt-1">
                <span className="w-2 h-2 bg-green-500 rounded-full animate-pulse"></span>
                <span>System Health: {analytics?.systemHealth || '99'}%</span>
              </div>
            </div>
            <button onClick={() => setTheme(theme === 'dark' ? 'light' : 'dark')} className="px-3 py-1 rounded opacity-60 hover:opacity-100">
              {theme === 'dark' ? '☀️' : '🌙'}
            </button>
          </div>
        </div>
      </header>

      {/* Navigation Tabs */}
      <div className={`border-b ${theme === 'dark' ? 'border-slate-800' : 'border-gray-200'}`}>
        <div className="max-w-7xl mx-auto px-6 flex gap-8 overflow-x-auto">
          {[
            { id: 'fleet', label: 'Fleet', icon: '🚗' },
            { id: 'vehicles', label: 'Vehicles', icon: '📋' },
            { id: 'map', label: 'Map', icon: '🗺️' },
            { id: 'comparison', label: 'Compare', icon: '⚖️' },
            { id: 'analytics', label: 'Analytics', icon: '📊' },
            { id: 'maintenance', label: 'Maintenance', icon: '🔧' },
            { id: 'engineering', label: 'Engineering', icon: '⚙️' },
            { id: 'deployment', label: 'Deployment', icon: '🚀' }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`py-3 px-2 font-semibold text-sm uppercase tracking-wider border-b-2 transition-all whitespace-nowrap flex gap-2 items-center relative ${
                activeTab === tab.id
                  ? `border-blue-500 ${theme === 'dark' ? 'text-blue-400' : 'text-blue-600'}`
                  : `border-transparent opacity-50 hover:opacity-70`
              }`}
            >
              <span>{tab.icon}</span>
              <span className="hidden sm:inline">{tab.label}</span>
              {tab.id === 'comparison' && comparisonVehicles.length > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full py-0.5 text-white text-xs flex items-center justify-center font-bold">
                  {comparisonVehicles.length}
                </span>
              )}
            </button>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-6 py-8">
        {/* FLEET OPERATIONS TAB */}
        {activeTab === 'fleet' && (
          <div className="space-y-6">
            {/* KPI Grid */}
            <div className="grid grid-cols-6 gap-4">
              {[
                { label: 'Active Vehicles', value: fleetMetrics.activeVehicles, unit: '/' + fleetMetrics.totalVehicles, color: 'from-green-600 to-green-900' },
                { label: 'Fuel Consumed', value: (fleetMetrics.fuelConsumption / 1000).toFixed(1), unit: 'k liters', color: 'from-orange-600 to-orange-900' },
                { label: 'Efficiency', value: parseFloat(fleetMetrics.efficiencyRating).toFixed(1), unit: '/10', color: 'from-blue-600 to-blue-900' },
                { label: 'Cost/KM', value: '₹' + Math.round(fleetMetrics.costPerKM), unit: '', color: 'from-red-600 to-red-900' },
                { label: 'Avg Temp', value: Math.round(fleetMetrics.avgTemp) + '°C', unit: '', color: 'from-yellow-600 to-yellow-900' },
                { label: 'System Uptime', value: parseFloat(fleetMetrics.systemUptime).toFixed(1) + '%', unit: '', color: 'from-purple-600 to-purple-900' }
              ].map((metric, i) => (
                <div key={i} className={`bg-gradient-to-br ${metric.color} p-4 rounded-lg border border-opacity-20 border-white overflow-hidden`}>
                  <div className="text-xs opacity-70 uppercase tracking-wider mb-2 truncate">{metric.label}</div>
                  <div className="text-2xl font-bold break-words overflow-hidden" style={{maxWidth: '100%', wordBreak: 'break-word'}}>{metric.value}</div>
                  {metric.unit && <div className="text-xs opacity-50 mt-1">{metric.unit}</div>}
                </div>
              ))}
            </div>

            {/* Vehicle Status Grid */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <h2 className="text-lg font-bold mb-4">Live Vehicle Status</h2>
              <div className="grid grid-cols-5 gap-4">
                {vehicles.map(v => (
                  <div key={v.id} className={`p-4 rounded border ${v.status === 'active' ? 'border-green-500/50 bg-green-500/10' : 'border-gray-500/50 bg-gray-500/10'}`}>
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-semibold text-sm">{v.name}</span>
                      <span className={`text-xs px-2 py-1 rounded-full ${v.status === 'active' ? 'bg-green-500/30 text-green-300' : 'bg-gray-500/30'}`}>
                        {v.status}
                      </span>
                    </div>
                    <div className="text-xs space-y-1 opacity-75">
                      <div>Eff: {v.efficiency}/10 ⚙️</div>
                      <div>Fuel: {v.fuel}% ⛽</div>
                      <div>Temp: {v.temp}°C 🌡️</div>
                      <div>Zone: {v.location}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Critical Alerts - SHOW ALL ALERTS */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">⚠️ Active Alerts ({alerts.length} total)</h2>
                <button
                  onClick={exportAlertsCSV}
                  className="px-3 py-1 rounded text-sm bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all flex items-center gap-1"
                >
                  📥 Export CSV
                </button>
              </div>
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {alerts.length > 0 ? (
                  alerts.map(alert => (
                    <div key={alert.id} className={`flex justify-between items-center p-3 rounded border-l-4 ${
                      alert.severity === 'critical' ? 'border-l-red-500 bg-red-500/10' :
                      alert.severity === 'warning' ? 'border-l-yellow-500 bg-yellow-500/10' :
                      'border-l-blue-500 bg-blue-500/10'
                    }`}>
                      <div>
                        <div className="font-semibold">{alert.type} - <span className="opacity-70">{alert.vehicle_name || alert.vehicle}</span></div>
                        <div className="text-xs opacity-60">{alert.message || alert.time}</div>
                      </div>
                      <span className={`text-xs px-3 py-1 rounded-full font-semibold whitespace-nowrap ${
                        alert.severity === 'critical' ? 'bg-red-500/30 text-red-300' :
                        alert.severity === 'warning' ? 'bg-yellow-500/30 text-yellow-300' :
                        'bg-blue-500/30 text-blue-300'
                      }`}>
                        {alert.severity.toUpperCase()}
                      </span>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-4 opacity-50">No alerts at this time</div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* VEHICLES TAB - SEARCHABLE FLEET BROWSER */}
        {activeTab === 'vehicles' && (
          <div className="space-y-6">
            {/* Search and Filter */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <h2 className="text-lg font-bold mb-4">🔍 Fleet Database & Filters</h2>
              
              {/* Search Input */}
              <div className="mb-4 flex gap-4">
                <input
                  type="text"
                  placeholder="Search by Vehicle ID (e.g., Vehicle-0001)"
                  value={vehicleSearch}
                  onChange={handleVehicleSearch}
                  className={`flex-1 px-4 py-2 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300'} focus:outline-none focus:border-blue-500`}
                />
              </div>

              {/* Filter Controls */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
                {/* Type Filter */}
                <select
                  value={filterType}
                  onChange={(e) => setFilterType(e.target.value)}
                  className={`px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300'} text-sm`}
                >
                  <option value="all">All Types</option>
                  {getUniqueTypes().map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>

                {/* Status Filter */}
                <select
                  value={filterStatus}
                  onChange={(e) => setFilterStatus(e.target.value)}
                  className={`px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300'} text-sm`}
                >
                  <option value="all">All Status</option>
                  <option value="active">🟢 Active</option>
                  <option value="idle">⚫ Idle</option>
                </select>

                {/* Location Filter */}
                <select
                  value={filterLocation}
                  onChange={(e) => setFilterLocation(e.target.value)}
                  className={`px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 text-white' : 'bg-white border-gray-300'} text-sm`}
                >
                  <option value="all">All Locations</option>
                  {getUniqueLocations().map(loc => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>

                {/* Reset Filters */}
                <button
                  onClick={() => {
                    setFilterType('all');
                    setFilterStatus('all');
                    setFilterLocation('all');
                    setSpeedRange({ min: 0, max: 60 });
                    setQuickFilterActive(null);
                  }}
                  className={`px-3 py-2 rounded border ${theme === 'dark' ? 'bg-slate-700 border-slate-600 hover:bg-slate-600' : 'bg-white border-gray-300 hover:bg-gray-50'}`}
                >
                  🔄 Reset
                </button>
              </div>

              {/* Quick Filter Presets */}
              <div className="mb-4 flex flex-wrap gap-2">
                <label className="text-sm opacity-70 w-full font-semibold">Quick Filters:</label>
                <button
                  onClick={() => applyQuickFilter(quickFilterActive === 'critical' ? null : 'critical')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    quickFilterActive === 'critical'
                      ? 'bg-red-500 text-white'
                      : theme === 'dark' ? 'bg-red-500/20 text-red-300 hover:bg-red-500/30' : 'bg-red-100 text-red-600 hover:bg-red-200'
                  }`}
                >
                  🔴 Critical Issues
                </button>
                <button
                  onClick={() => applyQuickFilter(quickFilterActive === 'lowFuel' ? null : 'lowFuel')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    quickFilterActive === 'lowFuel'
                      ? 'bg-yellow-500 text-white'
                      : theme === 'dark' ? 'bg-yellow-500/20 text-yellow-300 hover:bg-yellow-500/30' : 'bg-yellow-100 text-yellow-600 hover:bg-yellow-200'
                  }`}
                >
                  ⛽ Low Fuel (&lt;30%)
                </button>
                <button
                  onClick={() => applyQuickFilter(quickFilterActive === 'maintenance' ? null : 'maintenance')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    quickFilterActive === 'maintenance'
                      ? 'bg-purple-500 text-white'
                      : theme === 'dark' ? 'bg-purple-500/20 text-purple-300 hover:bg-purple-500/30' : 'bg-purple-100 text-purple-600 hover:bg-purple-200'
                  }`}
                >
                  🔧 Maintenance
                </button>
                <button
                  onClick={() => applyQuickFilter(quickFilterActive === 'idle' ? null : 'idle')}
                  className={`px-3 py-1 rounded text-xs font-semibold transition-all ${
                    quickFilterActive === 'idle'
                      ? 'bg-gray-500 text-white'
                      : theme === 'dark' ? 'bg-gray-500/20 text-gray-300 hover:bg-gray-500/30' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                  }`}
                >
                  ⏸️ Idle Vehicles
                </button>
              </div>

              {/* Speed Range Slider */}
              <div className="mb-4">
                <label className="text-sm opacity-70">Speed Range: {speedRange.min} - {speedRange.max} km/h</label>
                <div className="flex gap-4 mt-2">
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={speedRange.min}
                    onChange={(e) => setSpeedRange({ ...speedRange, min: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                  <input
                    type="range"
                    min="0"
                    max="60"
                    value={speedRange.max}
                    onChange={(e) => setSpeedRange({ ...speedRange, max: parseInt(e.target.value) })}
                    className="flex-1"
                  />
                </div>
              </div>

              <div className="text-sm opacity-70">
                {vehicleSearch ? `Searching for: "${vehicleSearch}"` : `Total Vehicles: ${fleetMetrics.totalVehicles}`} | Page {vehiclePage} of {vehicleTotalPages}
              </div>
            </div>

            {/* Vehicles Grid */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <h2 className="text-lg font-bold">📋 Vehicle List - {getQuickFilteredVehicles(allVehicles).length} matching</h2>
                <div className="flex gap-2">
                  <button
                    onClick={exportVehiclesCSV}
                    className="px-3 py-1 rounded text-sm bg-blue-500/20 text-blue-300 hover:bg-blue-500/30 transition-all flex items-center gap-1"
                  >
                    📥 Export CSV
                  </button>
                </div>
              </div>
              <div className="grid grid-cols-1 gap-3 max-h-96 overflow-y-auto">
                {getQuickFilteredVehicles(allVehicles).length > 0 ? (
                  getQuickFilteredVehicles(allVehicles).map(v => (
                    <div key={v.id} className={`p-4 rounded border flex items-start gap-3 transition-all ${
                      v.active ? 'border-green-500/30 bg-green-500/5' : 'border-gray-500/30 bg-gray-500/5'
                    } ${comparisonVehicles.includes(v.id) ? (theme === 'dark' ? 'ring-2 ring-yellow-400 bg-yellow-500/5' : 'ring-2 ring-yellow-300 bg-yellow-50') : ''}`}>
                      {/* Comparison Checkbox */}
                      <input
                        type="checkbox"
                        checked={comparisonVehicles.includes(v.id)}
                        onChange={() => toggleVehicleComparison(v.id)}
                        disabled={!comparisonVehicles.includes(v.id) && comparisonVehicles.length >= 3}
                        className="mt-1 cursor-pointer"
                        title={comparisonVehicles.length >= 3 ? 'Max 3 vehicles' : 'Add to comparison'}
                      />
                      <div className="flex-1">
                        <div className="font-semibold text-base">{v.name}</div>
                        <div className="text-xs opacity-70 mt-1 space-y-1">
                          <div>Type: {v.type} | Location: {v.location}</div>
                          <div>Speed: {v.current_speed_kmh} km/h | Fuel: {v.fuel}% | Temp: {v.temp}°C</div>
                          <div>Efficiency: {v.efficiency}/10 | Status: <span className={v.active ? 'text-green-400' : 'text-gray-400'}>{v.active ? 'ACTIVE' : 'IDLE'}</span></div>
                        </div>
                      </div>
                      {/* Issue Badges */}
                      <div className="flex flex-col gap-1">
                        {v.fuel < 20 && <span className="text-xs px-2 py-0.5 rounded bg-red-500/20 text-red-300">Low Fuel</span>}
                        {v.temp > 85 && <span className="text-xs px-2 py-0.5 rounded bg-orange-500/20 text-orange-300">High Temp</span>}
                      </div>
                    </div>
                  ))
                ) : (
                  <div className="text-center py-8 opacity-50">
                    <div>No vehicles found</div>
                    {vehicleSearch && <div className="text-sm mt-2">Try a different search term</div>}
                  </div>
                )}
              </div>

              {/* Pagination Controls */}
              {vehicleTotalPages > 1 && (
                <div className="mt-6 flex justify-center gap-2">
                  <button
                    disabled={vehiclePage === 1}
                    onClick={() => {
                      setVehiclePage(vehiclePage - 1);
                      fetchData(vehiclePage - 1, vehicleSearch);
                    }}
                    className="px-4 py-2 rounded border opacity-70 hover:opacity-100 disabled:opacity-30"
                  >
                    ← Previous
                  </button>
                  <div className="px-4 py-2 text-sm">
                    Page {vehiclePage} of {vehicleTotalPages}
                  </div>
                  <button
                    disabled={vehiclePage === vehicleTotalPages}
                    onClick={() => {
                      setVehiclePage(vehiclePage + 1);
                      fetchData(vehiclePage + 1, vehicleSearch);
                    }}
                    className="px-4 py-2 rounded border opacity-70 hover:opacity-100 disabled:opacity-30"
                  >
                    Next →
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* MAP TAB - VEHICLE GPS TRACKING */}
        {activeTab === 'map' && (
          <div className="space-y-6">
            {/* Map Header */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <h2 className="text-lg font-bold mb-4 flex items-center gap-2">
                <FiMap size={24} /> Fleet GPS Tracking & Location Intelligence
              </h2>
              <div className="grid grid-cols-3 gap-4 mb-4">
                <div className="p-3 rounded bg-blue-500/10 border border-blue-500/30">
                  <div className="text-xs opacity-70">Total Vehicles</div>
                  <div className="text-2xl font-bold">{allVehicles.length}</div>
                </div>
                <div className="p-3 rounded bg-green-500/10 border border-green-500/30">
                  <div className="text-xs opacity-70">Active on Map</div>
                  <div className="text-2xl font-bold">{allVehicles.filter(v => v.active).length}</div>
                </div>
                <div className="p-3 rounded bg-purple-500/10 border border-purple-500/30">
                  <div className="text-xs opacity-70">Coverage Area</div>
                  <div className="text-2xl font-bold">2°±0.5°</div>
                </div>
              </div>
            </div>

            {/* Interactive Mapbox Street View */}
            <div style={{
              height: '600px',
              border: theme === 'dark' ? '1px solid #334155' : '1px solid #e5e7eb',
              borderRadius: '0.5rem',
              overflow: 'hidden',
              backgroundColor: '#1f2937'
            }}>
              <MapContainer 
                selectedVehicleId={selectedVehicle?.id}
                onVehicleSelect={(vehicleData) => setSelectedVehicle(vehicleData)}
              />
            </div>

            {/* Selected Vehicle Details */}
            {selectedVehicle && (
              <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                <h3 className="text-lg font-bold mb-4 flex items-center gap-3">
                  <FiTruck size={24} />
                  {selectedVehicle.name} - Detailed Information
                  <button 
                    onClick={() => setSelectedVehicle(null)}
                    className="ml-auto text-xs px-3 py-1 rounded opacity-60 hover:opacity-100"
                  >
                    ✕ Close
                  </button>
                </h3>
                
                <div className="grid grid-cols-4 gap-4">
                  <div className="p-4 rounded-lg bg-blue-500/10 border border-blue-500/30">
                    <div className="text-xs opacity-70 mb-1">Location</div>
                    <div className="font-bold">{selectedVehicle.location}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-green-500/10 border border-green-500/30">
                    <div className="text-xs opacity-70 mb-1">Status</div>
                    <div className="font-bold">{selectedVehicle.active ? '✓ ACTIVE' : '○ IDLE'}</div>
                  </div>
                  <div className="p-4 rounded-lg bg-orange-500/10 border border-orange-500/30">
                    <div className="text-xs opacity-70 mb-1">Temperature</div>
                    <div className="font-bold">{selectedVehicle.temp}°C</div>
                  </div>
                  <div className="p-4 rounded-lg bg-purple-500/10 border border-purple-500/30">
                    <div className="text-xs opacity-70 mb-1">Efficiency</div>
                    <div className="font-bold">{selectedVehicle.efficiency}/10</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4 mt-4">
                  <div>
                    <div className="text-sm font-semibold mb-2">📊 Real-time Metrics</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between opacity-80">
                        <span>Current Speed:</span>
                        <span className="font-mono">{selectedVehicle.current_speed_kmh} km/h</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>Fuel Level:</span>
                        <span className="font-mono">{selectedVehicle.fuel}%</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>Engine Temp:</span>
                        <span className="font-mono">{selectedVehicle.temp}°C</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>Vehicle Type:</span>
                        <span className="font-mono">{selectedVehicle.type}</span>
                      </div>
                    </div>
                  </div>
                  <div>
                    <div className="text-sm font-semibold mb-2">📍 GPS Information</div>
                    <div className="space-y-2 text-sm">
                      <div className="flex justify-between opacity-80">
                        <span>Latitude:</span>
                        <span className="font-mono">{getVehicleGPS(selectedVehicle.id).lat.toFixed(4)}°</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>Longitude:</span>
                        <span className="font-mono">{getVehicleGPS(selectedVehicle.id).lng.toFixed(4)}°</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>Accuracy:</span>
                        <span className="font-mono">±{getVehicleGPS(selectedVehicle.id).accuracy}m</span>
                      </div>
                      <div className="flex justify-between opacity-80">
                        <span>Last Update:</span>
                        <span className="font-mono">Live</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Vehicle List for Map Selection */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <h3 className="text-lg font-bold mb-4">🗺️ All Vehicles on Map</h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-48 overflow-y-auto">
                {allVehicles.map(vehicle => (
                  <button
                    key={vehicle.id}
                    onClick={() => setSelectedVehicle(vehicle)}
                    className={`text-left p-3 rounded border transition-all ${
                      selectedVehicle?.id === vehicle.id
                        ? `border-yellow-500 ${theme === 'dark' ? 'bg-yellow-500/10' : 'bg-yellow-50'}`
                        : `border-slate-600 ${theme === 'dark' ? 'hover:bg-slate-700/50' : 'hover:bg-gray-100'}`
                    }`}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <div className="font-semibold text-sm">{vehicle.name}</div>
                        <div className="text-xs opacity-70 mt-1">{vehicle.location} • {vehicle.type}</div>
                      </div>
                      <span className={`text-xs px-2 py-1 rounded ${vehicle.active ? 'bg-green-500/20 text-green-300' : 'bg-gray-500/20 text-gray-300'}`}>
                        {vehicle.active ? 'Active' : 'Idle'}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* VEHICLE COMPARISON TAB */}
        {activeTab === 'comparison' && (
          <div className="space-y-6">
            {comparisonVehicles.length === 0 ? (
              <div className={`border rounded-lg p-12 text-center ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                <div className="text-4xl mb-4">⚖️</div>
                <h2 className="text-xl font-bold mb-2">No Vehicles Selected</h2>
                <p className="opacity-70 mb-4">Go to the Vehicles tab and select up to 3 vehicles to compare side-by-side</p>
                <button 
                  onClick={() => setActiveTab('vehicles')}
                  className="px-6 py-2 rounded bg-blue-500 text-white hover:bg-blue-600 transition-all"
                >
                  Go to Vehicles Tab
                </button>
              </div>
            ) : (
              <>
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                  {comparisonVehicles.map(vehicleId => {
                    const vehicle = allVehicles.find(v => v.id === vehicleId);
                    if (!vehicle) return null;
                    
                    return (
                      <div key={vehicleId} className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                        <div className="flex justify-between items-start mb-4">
                          <div>
                            <h3 className="font-bold text-lg">{vehicle.name}</h3>
                            <p className="text-xs opacity-70">{vehicle.type}</p>
                          </div>
                          <button
                            onClick={() => toggleVehicleComparison(vehicleId)}
                            className="text-xs px-2 py-1 rounded bg-red-500/20 text-red-300 hover:bg-red-500/30"
                          >
                            Remove
                          </button>
                        </div>
                        
                        <div className="space-y-3">
                          <div className={`p-3 rounded ${vehicle.active ? 'bg-green-500/10 border border-green-500/30' : 'bg-gray-500/10 border border-gray-500/30'}`}>
                            <div className="text-xs opacity-70">Status</div>
                            <div className="font-bold text-lg">{vehicle.active ? '✓ ACTIVE' : '⏸ IDLE'}</div>
                          </div>
                          
                          <div className="bg-blue-500/10 border border-blue-500/30 p-3 rounded">
                            <div className="text-xs opacity-70">Location</div>
                            <div className="font-bold">{vehicle.location}</div>
                          </div>
                          
                          <div className="grid grid-cols-2 gap-2">
                            <div className="bg-orange-500/10 border border-orange-500/30 p-2 rounded">
                              <div className="text-xs opacity-70">Fuel</div>
                              <div className="font-bold">{vehicle.fuel}%</div>
                            </div>
                            <div className="bg-red-500/10 border border-red-500/30 p-2 rounded">
                              <div className="text-xs opacity-70">Temp</div>
                              <div className="font-bold">{vehicle.temp}°C</div>
                            </div>
                            <div className="bg-purple-500/10 border border-purple-500/30 p-2 rounded">
                              <div className="text-xs opacity-70">Speed</div>
                              <div className="font-bold">{vehicle.current_speed_kmh} km/h</div>
                            </div>
                            <div className="bg-green-500/10 border border-green-500/30 p-2 rounded">
                              <div className="text-xs opacity-70">Efficiency</div>
                              <div className="font-bold">{vehicle.efficiency}/10</div>
                            </div>
                          </div>

                          {/* Issues */}
                          <div className="space-y-1">
                            {vehicle.fuel < 20 && (
                              <div className="text-xs p-2 rounded bg-red-500/20 text-red-300 flex items-center gap-2">
                                🔴 <span>Low Fuel (under 20%)</span>
                              </div>
                            )}
                            {vehicle.temp > 85 && (
                              <div className="text-xs p-2 rounded bg-orange-500/20 text-orange-300 flex items-center gap-2">
                                🟡 <span>High Temperature (over 85°C)</span>
                              </div>
                            )}
                            {!vehicle.active && (
                              <div className="text-xs p-2 rounded bg-gray-500/20 text-gray-300 flex items-center gap-2">
                                ⏸️ <span>Vehicle is Idle</span>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Comparison Summary */}
                <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                  <h3 className="font-bold text-lg mb-4">📊 Comparison Summary</h3>
                  <div className="grid grid-cols-3 gap-4">
                    {[
                      { label: 'Active Vehicles', values: comparisonVehicles.map(id => allVehicles.find(v => v.id === id)?.active ? 1 : 0) },
                      { label: 'Avg Fuel (%)', values: comparisonVehicles.map(id => allVehicles.find(v => v.id === id)?.fuel || 0) },
                      { label: 'Avg Temp (°C)', values: comparisonVehicles.map(id => allVehicles.find(v => v.id === id)?.temp || 0) }
                    ].map((metric, i) => (
                      <div key={i} className="p-4 rounded bg-slate-900/50 border border-slate-700">
                        <div className="text-xs opacity-70 mb-2">{metric.label}</div>
                        <div className="space-y-1">
                          {metric.values.map((val, idx) => (
                            <div key={idx} className="text-sm font-mono">
                              {typeof val === 'number' ? val.toFixed(1) : val}
                            </div>
                          ))}
                        </div>
                        <div className="text-lg font-bold mt-2 text-blue-300 border-t border-slate-700 pt-2">
                          Avg: {(metric.values.reduce((a, b) => a + b, 0) / metric.values.length).toFixed(1)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </>
            )}
          </div>
        )}

        {/* MAINTENANCE TRACKER TAB */}
        {activeTab === 'maintenance' && (
          <div className="space-y-6">
            {/* Maintenance Summary Stats */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Overdue Maintenance', value: allVehicles.filter(v => !v.active).length, color: 'from-red-600 to-red-900' },
                { label: 'Due Soon (7 days)', value: allVehicles.filter(v => !v.active).slice(0, 15).length, color: 'from-yellow-600 to-yellow-900' },
                { label: 'Scheduled', value: Math.floor(allVehicles.length * 0.15), color: 'from-blue-600 to-blue-900' },
                { label: 'Completed This Month', value: Math.floor(allVehicles.length * 0.12), color: 'from-green-600 to-green-900' }
              ].map((stat, i) => (
                <div key={i} className={`bg-gradient-to-br ${stat.color} p-6 rounded-lg border border-opacity-20 border-white`}>
                  <div className="text-xs opacity-70 uppercase tracking-wider mb-2">{stat.label}</div>
                  <div className="text-3xl font-bold">{stat.value}</div>
                </div>
              ))}
            </div>

            {/* Vehicles Needing Maintenance */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <div className="flex justify-between items-center mb-4">
                <h3 className="text-lg font-bold">🔧 Vehicles Requiring Maintenance</h3>
                <button
                  onClick={exportVehiclesCSV}
                  className="px-3 py-1 rounded text-sm bg-blue-500/20 text-blue-300 hover:bg-blue-500/30"
                >
                  📥 Export List
                </button>
              </div>
              
              <div className="space-y-2 max-h-96 overflow-y-auto">
                {allVehicles.filter(v => !v.active || v.fuel < 30 || v.temp > 85).map(vehicle => (
                  <div key={vehicle.id} className={`p-4 rounded border-l-4 ${
                    !vehicle.active ? 'border-l-red-500 bg-red-500/5' :
                    vehicle.fuel < 30 ? 'border-l-orange-500 bg-orange-500/5' :
                    'border-l-yellow-500 bg-yellow-500/5'
                  }`}>
                    <div className="flex justify-between items-start mb-2">
                      <div>
                        <div className="font-semibold">{vehicle.name}</div>
                        <div className="text-xs opacity-70">{vehicle.type} • {vehicle.location}</div>
                      </div>
                      <div className="text-right">
                        {!vehicle.active && (
                          <span className="text-xs px-2 py-1 rounded bg-red-500/30 text-red-200 block mb-1">
                            IDLE - SERVICE DUE
                          </span>
                        )}
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-4 gap-2 text-xs">
                      <div className="opacity-70">
                        <div className="opacity-60">Fuel</div>
                        <div className={vehicle.fuel < 30 ? 'text-orange-300 font-semibold' : ''}>{vehicle.fuel}%</div>
                      </div>
                      <div className="opacity-70">
                        <div className="opacity-60">Temp</div>
                        <div className={vehicle.temp > 85 ? 'text-red-300 font-semibold' : ''}>{vehicle.temp}°C</div>
                      </div>
                      <div className="opacity-70">
                        <div className="opacity-60">Hours (est.)</div>
                        <div className="font-mono">{Math.floor(Math.random() * 2000) + 500}h</div>
                      </div>
                      <div className="opacity-70">
                        <div className="opacity-60">Next Service</div>
                        <div className="font-mono">
                          {Math.floor(Math.random() * 7) === 0 ? 'TODAY' : `${Math.floor(Math.random() * 30) + 1}d`}
                        </div>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Maintenance Schedule */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <h3 className="text-lg font-bold mb-4">📅 Maintenance Calendar</h3>
              <div className="grid grid-cols-7 gap-1 text-center text-xs mb-4">
                {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
                  <div key={day} className="font-semibold p-2">{day}</div>
                ))}
              </div>
              <div className="grid grid-cols-7 gap-1">
                {Array.from({ length: 35 }, (_, i) => {
                  const day = (i % 7) + 1;
                  const week = Math.floor(i / 7);
                  const hasEvent = Math.random() > 0.7;
                  return (
                    <div
                      key={i}
                      className={`p-2 rounded text-center text-xs cursor-pointer transition-all hover:bg-blue-500/20 ${
                        hasEvent ? 'bg-orange-500/20 border border-orange-500/50' : 'bg-slate-700/20'
                      }`}
                    >
                      {day}
                      {hasEvent && <div className="text-red-400 font-bold">●</div>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {/* ENGINEERING TAB */}
        {activeTab === 'engineering' && (
          <div className="space-y-6">
            {/* Engineering KPIs */}
            <div className="grid grid-cols-5 gap-4">
              {[
                { label: 'Team Size', value: analytics?.totalEngineers || 12, unit: 'engineers', color: 'from-blue-600 to-blue-900' },
                { label: 'API P99 Latency', value: (analytics?.apiLatencyP99 || 45) + 'ms', unit: '', color: 'from-green-600 to-green-900' },
                { label: 'Error Rate', value: ((analytics?.errorRate || 0.001) * 100).toFixed(3) + '%', unit: '', color: 'from-red-600 to-red-900' },
                { label: 'Tests Passed', value: (analytics?.pipelinePassed || 98) + '%', unit: '', color: 'from-purple-600 to-purple-900' },
                { label: 'System Health', value: (analytics?.systemHealth || 99) + '%', unit: '', color: 'from-green-600 to-green-900' }
              ].map((metric, i) => (
                <div key={i} className={`bg-gradient-to-br ${metric.color} p-4 rounded-lg border border-opacity-20 border-white`}>
                  <div className="text-xs opacity-70 uppercase tracking-wider mb-2">{metric.label}</div>
                  <div className="text-2xl font-bold">{metric.value}</div>
                  {metric.unit && <div className="text-xs opacity-50 mt-1">{metric.unit}</div>}
                </div>
              ))}
            </div>

            {/* Service Health */}
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <h2 className="text-lg font-bold mb-4">🔧 System Services Health</h2>
              <div className="space-y-2">
                {serviceHealth.map((svc, i) => (
                  <div key={i} className="flex items-center justify-between p-3 rounded bg-slate-700/20">
                    <div className="flex items-center gap-3">
                      <div className={`w-2 h-2 rounded-full ${svc.status === 'healthy' ? 'bg-green-500' : 'bg-yellow-500'}`} />
                      <span className="font-semibold text-sm">{svc.service}</span>
                    </div>
                    <div className="text-xs opacity-75 space-x-4 flex">
                      <span>Latency: {svc.latency}</span>
                      <span>Uptime: {svc.uptime}%</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* DEPLOYMENT PIPELINE TAB */}
        {activeTab === 'deployment' && (
          <div className="space-y-6">
            <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
              <h2 className="text-lg font-bold mb-6">🚀 CI/CD Pipeline</h2>
              <div className="space-y-3">
                {deploymentPipeline.map((stage, i) => (
                  <div key={i} className="flex items-center gap-4">
                    <div className="w-24 text-sm font-semibold">{stage.stage}</div>
                    <div className="flex-1 bg-slate-700/30 rounded overflow-hidden h-8 flex items-center relative">
                      <div className={`h-full transition-all ${stage.status === 'passed' ? 'bg-green-500/30 w-full' : stage.status === 'in-progress' ? 'bg-blue-500/30 w-2/3' : 'bg-red-500/30'}`} />
                      <span className={`absolute right-3 text-xs font-semibold ${stage.status === 'passed' ? 'text-green-300' : stage.status === 'in-progress' ? 'text-blue-300' : 'text-red-300'}`}>
                        {stage.status === 'passed' ? '✓' : stage.status === 'in-progress' ? '⟳' : '✗'} {stage.duration}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* ANALYTICS TAB */}
        {activeTab === 'analytics' && (
          <div className="space-y-6">
            {/* Key Metrics */}
            <div className="grid grid-cols-4 gap-4">
              {[
                { label: 'Active Vehicles', value: fleetMetrics?.activeVehicles || 0, color: 'from-green-600 to-green-900' },
                { label: 'Avg Temperature', value: (fleetMetrics?.avgTemp || 0).toFixed(1) + '°C', color: 'from-orange-600 to-orange-900' },
                { label: 'Avg Efficiency', value: (fleetMetrics?.efficiencyRating || 0).toFixed(1) + '/10', color: 'from-blue-600 to-blue-900' },
                { label: 'Total Alerts', value: alerts.length, color: 'from-red-600 to-red-900' }
              ].map((metric, i) => (
                <div key={i} className={`bg-gradient-to-br ${metric.color} p-6 rounded-lg border border-opacity-20 border-white transform hover:scale-105 transition-transform`}>
                  <div className="text-xs opacity-70 uppercase tracking-wider mb-2">{metric.label}</div>
                  <div className="text-3xl font-bold">{metric.value}</div>
                </div>
              ))}
            </div>

            {/* Charts Grid */}
            <div className="grid grid-cols-2 gap-6">
              {/* Vehicle Type Distribution */}
              <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                <h3 className="text-lg font-bold mb-4">🚗 Fleet by Type</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <BarChart data={getChartData().typeChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#ddd'} />
                    <XAxis dataKey="name" stroke={theme === 'dark' ? '#888' : '#666'} style={{fontSize: '12px'}} />
                    <YAxis stroke={theme === 'dark' ? '#888' : '#666'} />
                    <Tooltip contentStyle={{backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #666'}} />
                    <Bar dataKey="count" fill="#3b82f6" />
                  </BarChart>
                </ResponsiveContainer>
              </div>

              {/* Active vs Idle */}
              <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                <h3 className="text-lg font-bold mb-4">⚙️ Vehicle Status</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <PieChart>
                    <Pie
                      data={[
                        { name: 'Active', value: fleetMetrics.activeVehicles },
                        { name: 'Idle', value: fleetMetrics.totalVehicles - fleetMetrics.activeVehicles }
                      ]}
                      cx="50%"
                      cy="50%"
                      labelLine={false}
                      label
                      outerRadius={100}
                      dataKey="value"
                    >
                      <Cell fill="#10b981" />
                      <Cell fill="#6b7280" />
                    </Pie>
                    <Tooltip />
                  </PieChart>
                </ResponsiveContainer>
              </div>

              {/* Temperature Distribution */}
              <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                <h3 className="text-lg font-bold mb-4">🌡️ Temperature Levels</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData().tempChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#ddd'} />
                    <XAxis dataKey="name" stroke={theme === 'dark' ? '#888' : '#666'} style={{fontSize: '10px'}} />
                    <YAxis stroke={theme === 'dark' ? '#888' : '#666'} />
                    <Tooltip contentStyle={{backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #666'}} />
                    <Line type="monotone" dataKey="temp" stroke="#f97316" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>

              {/* Fuel Levels */}
              <div className={`border rounded-lg p-6 ${theme === 'dark' ? 'border-slate-800 bg-slate-800/30' : 'border-gray-200 bg-gray-100'}`}>
                <h3 className="text-lg font-bold mb-4">⛽ Fuel Levels</h3>
                <ResponsiveContainer width="100%" height={300}>
                  <LineChart data={getChartData().fuelChart}>
                    <CartesianGrid strokeDasharray="3 3" stroke={theme === 'dark' ? '#444' : '#ddd'} />
                    <XAxis dataKey="name" stroke={theme === 'dark' ? '#888' : '#666'} style={{fontSize: '10px'}} />
                    <YAxis stroke={theme === 'dark' ? '#888' : '#666'} />
                    <Tooltip contentStyle={{backgroundColor: theme === 'dark' ? '#1e293b' : '#fff', border: '1px solid #666'}} />
                    <Line type="monotone" dataKey="fuel" stroke="#ec4899" strokeWidth={2} dot={false} />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
      </main>

      {/* Footer */}
      <footer className={`border-t ${theme === 'dark' ? 'border-slate-800 bg-slate-950' : 'border-gray-200 bg-gray-50'} mt-12`}>
        <div className="max-w-7xl mx-auto px-6 py-6 text-center text-xs opacity-50">
          <p>Skylark Mining GPS IoT System • © 2026 • Enterprise Edition</p>
          <p className="mt-2">Frontend: React 18 • Backend: Node.js • Database: PostgreSQL • Mapping: Mapbox GL</p>
        </div>
      </footer>
    </div>
  );
}

export default App;
