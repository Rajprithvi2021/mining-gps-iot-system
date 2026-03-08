import React, { useState, useEffect } from 'react';
import { BarChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';
const COLORS = ['#10b981', '#f59e0b', '#ef4444', '#3b82f6'];

export function VehicleComparison() {
  const [vehicles, setVehicles] = useState([]);
  const [fleetSummary, setFleetSummary] = useState(null);
  const [sortBy, setSortBy] = useState('health_score');
  const [filterStatus, setFilterStatus] = useState('all');
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [tabView, setTabView] = useState('dashboard'); // dashboard, comparison, analysis, trends
  const [selectedVehicleForTrends, setSelectedVehicleForTrends] = useState(1);
  const [vehicleHistory, setVehicleHistory] = useState([]);
  const itemsPerPage = 20; // Show 20 vehicles per page instead of 550

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/analytics`);
        if (response.ok) {
          const data = await response.json();
          
          if (data.success && data.data?.vehicle_comparison) {
            setFleetSummary(data.data.fleet_summary);
            setVehicles(data.data.vehicle_comparison || []);
            setCurrentPage(1);
          }
        }
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAnalytics();
    // Refresh every 10 seconds
    const interval = setInterval(fetchAnalytics, 10000);
    return () => clearInterval(interval);
  }, []);

  const getSortedVehicles = () => {
    let filtered = vehicles;
    
    if (filterStatus === 'active') {
      filtered = filtered.filter(v => v.active);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(v => !v.active);
    } else if (filterStatus === 'alert') {
      filtered = filtered.filter(v => v.alerts.total > 0);
    }

    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'health_score': return b.health_score - a.health_score;
        case 'efficiency': return b.performance.efficiency_rating - a.performance.efficiency_rating;
        case 'fuel': return b.performance.fuel_percentage - a.performance.fuel_percentage;
        case 'speed': return a.performance.speed_kmh - b.performance.speed_kmh;
        case 'alerts': return b.alerts.total - a.alerts.total;
        default: return a.id - b.id;
      }
    });
  };

  const getHealthColor = (score) => {
    if (score >= 80) return 'bg-green-100 text-green-800';
    if (score >= 60) return 'bg-yellow-100 text-yellow-800';
    return 'bg-red-100 text-red-800';
  };

  const getEfficiencyColor = (efficiency) => {
    if (efficiency >= 9) return 'text-green-600 font-bold';
    if (efficiency >= 7) return 'text-blue-600';
    return 'text-red-600 font-bold';
  };

  const getFuelColor = (fuel) => {
    if (fuel >= 60) return 'text-green-600';
    if (fuel >= 30) return 'text-orange-600';
    return 'text-red-600 font-bold';
  };

  const getStatusBadge = (active, status) => {
    if (!active) return 'bg-gray-200 text-gray-800';
    if (status === 'moving') return 'bg-green-200 text-green-800';
    if (status === 'idle') return 'bg-yellow-200 text-yellow-800';
    return 'bg-blue-200 text-blue-800';
  };

  // Analytics calculations for charts
  const healthDistribution = [
    { name: 'Healthy (80-100)', value: vehicles.filter(v => v.health_score >= 80).length },
    { name: 'Fair (60-80)', value: vehicles.filter(v => v.health_score >= 60 && v.health_score < 80).length },
    { name: 'Poor (<60)', value: vehicles.filter(v => v.health_score < 60).length }
  ];

  const topVehicles = [...vehicles].sort((a, b) => b.health_score - a.health_score).slice(0, 5);
  const bottomVehicles = [...vehicles].sort((a, b) => a.health_score - b.health_score).slice(0, 5);

  // Generate historical trend data for selected vehicle
  const generateVehicleHistory = (vehicleId) => {
    const vehicle = vehicles.find(v => v.id === vehicleId);
    if (!vehicle) return [];

    const now = new Date();
    const history = [];

    for (let i = 11; i >= 0; i--) {
      const time = new Date(now.getTime() - i * 5 * 60000); // 5-minute intervals
      const variance = Math.random() * 0.15; // 15% variance

      history.push({
        time: time.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
        timestamp: time.getTime(),
        fuel: Math.max(0, vehicle.performance.fuel_percentage - ((11 - i) * 1.5) - variance * 5),
        speed: Math.max(0, vehicle.performance.speed_kmh + (Math.random() - 0.5) * 20),
        temperature: vehicle.performance.temperature + (Math.random() - 0.5) * 3,
        efficiency: Math.max(0, vehicle.performance.efficiency_rating + (Math.random() - 0.5) * 1),
        health: Math.min(100, vehicle.health_score + (Math.random() - 0.5) * 5)
      });
    }
    return history;
  };

  // Update vehicle trends when selected vehicle changes
  useEffect(() => {
    const trendData = generateVehicleHistory(selectedVehicleForTrends);
    setVehicleHistory(trendData);
  }, [vehicles, selectedVehicleForTrends]);

  const sortedVehicles = getSortedVehicles();
  const paginatedVehicles = sortedVehicles.slice(
    (currentPage - 1) * itemsPerPage,
    currentPage * itemsPerPage
  );
  const totalPages = Math.ceil(sortedVehicles.length / itemsPerPage);

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <p className="text-gray-500 animate-pulse">📊 Loading analytics...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Tab Navigation */}
      <div className="flex gap-2 bg-white rounded-lg shadow-md p-3 sticky top-0 z-10 border-b-4 border-blue-600">
        <button
          onClick={() => setTabView('dashboard')}
          className={`px-4 py-2 rounded font-semibold transition ${
            tabView === 'dashboard'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📊 Dashboard
        </button>
        <button
          onClick={() => setTabView('comparison')}
          className={`px-4 py-2 rounded font-semibold transition ${
            tabView === 'comparison'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📋 Comparison
        </button>
        <button
          onClick={() => setTabView('analysis')}
          className={`px-4 py-2 rounded font-semibold transition ${
            tabView === 'analysis'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📈 Analysis
        </button>
        <button
          onClick={() => setTabView('trends')}
          className={`px-4 py-2 rounded font-semibold transition ${
            tabView === 'trends'
              ? 'bg-blue-600 text-white shadow-lg'
              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
          }`}
        >
          📉 Vehicle Trends
        </button>
      </div>

      {/* DASHBOARD VIEW */}
      {tabView === 'dashboard' && (
        <div className="space-y-6">
          {/* Fleet Summary Cards */}
          {fleetSummary && (
            <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
              <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200 shadow hover:shadow-lg transition">
                <p className="text-xs text-blue-600 font-semibold uppercase">Total Vehicles</p>
                <p className="text-3xl font-bold text-blue-900">{fleetSummary.totalVehicles}</p>
                <p className="text-xs text-blue-600 mt-1">{fleetSummary.activeVehicles} active</p>
              </div>
              <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200 shadow hover:shadow-lg transition">
                <p className="text-xs text-green-600 font-semibold uppercase">Avg Efficiency</p>
                <p className="text-3xl font-bold text-green-900">{fleetSummary.avgEfficiency?.toFixed(1)}</p>
                <p className="text-xs text-green-600 mt-1">km/L</p>
              </div>
              <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200 shadow hover:shadow-lg transition">
                <p className="text-xs text-orange-600 font-semibold uppercase">Avg Fuel</p>
                <p className="text-3xl font-bold text-orange-900">{fleetSummary.avgFuelLevel?.toFixed(0)}%</p>
                <p className="text-xs text-orange-600 mt-1">of capacity</p>
              </div>
              <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200 shadow hover:shadow-lg transition">
                <p className="text-xs text-purple-600 font-semibold uppercase">Avg Speed</p>
                <p className="text-3xl font-bold text-purple-900">{fleetSummary.avgSpeed?.toFixed(1)}</p>
                <p className="text-xs text-purple-600 mt-1">km/h</p>
              </div>
              <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200 shadow hover:shadow-lg transition">
                <p className="text-xs text-red-600 font-semibold uppercase">Active Alerts</p>
                <p className="text-3xl font-bold text-red-900">{fleetSummary.alerts?.unresolved || 0}</p>
                <p className="text-xs text-red-600 mt-1">{fleetSummary.alerts?.critical || 0} critical</p>
              </div>
            </div>
          )}

          {/* Charts Row */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Health Distribution Pie Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🎯 Fleet Health Distribution</h3>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={healthDistribution}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, value }) => `${name}: ${value}`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {COLORS.map((color, index) => (
                      <Cell key={`cell-${index}`} fill={color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>

            {/* Performance Metrics Bar Chart */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚙️ Average Performance Metrics</h3>
              <ResponsiveContainer width="100%" height={300}>
                <BarChart
                  data={[
                    {
                      name: 'Fleet Avg',
                      Efficiency: fleetSummary?.avgEfficiency || 0,
                      Fuel: fleetSummary?.avgFuelLevel || 0,
                      Speed: Math.min(fleetSummary?.avgSpeed || 0, 100)
                    }
                  ]}
                >
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Bar dataKey="Efficiency" fill="#10b981" />
                  <Bar dataKey="Fuel" fill="#f59e0b" />
                  <Bar dataKey="Speed" fill="#3b82f6" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Top & Bottom Performers */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Top Performers */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">🏆 Top 5 Performers</h3>
              <div className="space-y-3">
                {topVehicles.map((vehicle, idx) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-3 bg-green-50 rounded border-l-4 border-green-500">
                    <div>
                      <p className="font-semibold text-gray-900">#{idx + 1} {vehicle.name}</p>
                      <p className="text-xs text-gray-600">{vehicle.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-green-600">{vehicle.health_score}</p>
                      <p className="text-xs text-gray-600">Health Score</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Bottom Performers */}
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">⚠️ Bottom 5 Performers</h3>
              <div className="space-y-3">
                {bottomVehicles.map((vehicle, idx) => (
                  <div key={vehicle.id} className="flex items-center justify-between p-3 bg-red-50 rounded border-l-4 border-red-500">
                    <div>
                      <p className="font-semibold text-gray-900">#{idx + 1} {vehicle.name}</p>
                      <p className="text-xs text-gray-600">{vehicle.type}</p>
                    </div>
                    <div className="text-right">
                      <p className="text-lg font-bold text-red-600">{vehicle.health_score}</p>
                      <p className="text-xs text-gray-600">Health Score</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* COMPARISON VIEW */}
      {tabView === 'comparison' && (
        <div className="space-y-4">
          {/* Controls - Fixed positioning to prevent overlap */}
          <div className="bg-white rounded-lg shadow-md p-5 border-2 border-gray-300 relative z-20">
            <div className="flex flex-col md:flex-row gap-6 items-stretch md:items-center justify-between flex-wrap">
              <div className="flex gap-6 flex-wrap items-center">
                <div className="flex items-center gap-3 bg-blue-100 px-4 py-3 rounded-lg border-2 border-blue-500">
                  <label className="text-sm font-bold text-blue-900 whitespace-nowrap">📊 Sort by:</label>
                  <select
                    value={sortBy}
                    onChange={(e) => setSortBy(e.target.value)}
                    className="px-4 py-2 border-2 border-blue-600 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-blue-700 bg-white text-gray-900 cursor-pointer hover:border-blue-700 hover:shadow-md transition min-w-[200px] appearance-none"
                  >
                    <option value="health_score">Health Score ↓</option>
                    <option value="efficiency">Efficiency ↓</option>
                    <option value="fuel">Fuel Level ↓</option>
                    <option value="speed">Speed ↑</option>
                    <option value="alerts">Alerts ↓</option>
                  </select>
                </div>

                <div className="flex items-center gap-3 bg-green-100 px-4 py-3 rounded-lg border-2 border-green-500">
                  <label className="text-sm font-bold text-green-900 whitespace-nowrap">🔍 Filter:</label>
                  <select
                    value={filterStatus}
                    onChange={(e) => setFilterStatus(e.target.value)}
                    className="px-4 py-2 border-2 border-green-600 rounded-lg text-sm font-semibold focus:outline-none focus:ring-2 focus:ring-green-700 bg-white text-gray-900 cursor-pointer hover:border-green-700 hover:shadow-md transition min-w-[200px] appearance-none"
                  >
                    <option value="all">All Vehicles</option>
                    <option value="active">Active Only</option>
                    <option value="inactive">Inactive Only</option>
                    <option value="alert">With Alerts</option>
                  </select>
                </div>
              </div>

              <div className="text-sm font-semibold text-gray-700 bg-blue-100 px-4 py-3 rounded-lg border-2 border-blue-400">
                {sortedVehicles.length} vehicles • Page {currentPage} of {totalPages}
              </div>
            </div>
          </div>

          {/* Vehicle Table */}
          <div className="bg-white rounded-lg shadow overflow-visible">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-sm table-auto">
                <thead className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0">
                  <tr>
                    <th className="px-6 py-4 text-left font-semibold whitespace-nowrap">Vehicle</th>
                    <th className="px-6 py-4 text-center font-semibold whitespace-nowrap">Status</th>
                    <th className="px-6 py-4 text-center font-semibold whitespace-nowrap">Speed</th>
                    <th className="px-6 py-4 text-center font-semibold whitespace-nowrap">Fuel</th>
                    <th className="px-6 py-4 text-center font-semibold whitespace-nowrap">Efficiency</th>
                    <th className="px-6 py-4 text-center font-semibold whitespace-nowrap">Temp</th>
                    <th className="px-6 py-4 text-center font-semibold whitespace-nowrap">Alerts</th>
                    <th className="px-6 py-4 text-center font-semibold whitespace-nowrap">Health</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-200">
                  {paginatedVehicles.length > 0 ? (
                    paginatedVehicles.map((v) => (
                      <tr key={v.id} className={`hover:bg-gray-100 transition border-b border-gray-100 ${v.alerts.critical > 0 ? 'bg-red-50' : ''}`}>
                        <td className="px-6 py-4">
                          <div className="font-semibold text-gray-900">{v.name}</div>
                          <div className="text-xs text-gray-500">{v.type}</div>
                        </td>
                        <td className="px-6 py-4 text-center">
                          <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold ${getStatusBadge(v.active, v.status)}`}>
                            {v.active ? v.status?.toUpperCase() : 'INACTIVE'}
                          </span>
                        </td>
                        <td className="px-6 py-4 text-center font-bold text-gray-900">{v.performance.speed_kmh.toFixed(1)} km/h</td>
                        <td className={`px-6 py-4 text-center font-bold ${getFuelColor(v.performance.fuel_percentage)}`}>
                          {v.performance.fuel_percentage}%
                        </td>
                        <td className={`px-6 py-4 text-center font-bold ${getEfficiencyColor(v.performance.efficiency_rating)}`}>
                          {v.performance.efficiency_rating.toFixed(2)} km/L
                        </td>
                        <td className="px-6 py-4 text-center font-semibold text-gray-900">{v.performance.temperature_celsius.toFixed(0)}°C</td>
                        <td className="px-6 py-4 text-center">
                          {v.alerts.critical > 0 && <span className="text-red-600 font-bold">{v.alerts.critical} 🔴</span>}
                          {v.alerts.high > 0 && <span className="text-orange-600 font-bold ml-2">{v.alerts.high} 🟠</span>}
                          {v.alerts.total === 0 && <span className="text-green-600 font-semibold">✓ OK</span>}
                        </td>
                        <td className={`px-6 py-4 text-center font-bold`}>
                          <div className={`inline-block px-4 py-2 rounded-lg font-bold ${getHealthColor(v.health_score)}`}>
                            {v.health_score}
                          </div>
                        </td>
                      </tr>
                    ))
                  ) : (
                    <tr>
                      <td colSpan="8" className="px-6 py-12 text-center text-gray-500 font-semibold">No vehicles found</td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-center gap-1 bg-white rounded-lg p-4 shadow">
              {/* First & Previous */}
              <button
                onClick={() => setCurrentPage(1)}
                disabled={currentPage === 1}
                title="First page"
                className="px-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ⟨⟨
              </button>
              <button
                onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                disabled={currentPage === 1}
                className="px-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ⟨ Prev
              </button>

              {/* Page Numbers - Smart Range */}
              {(() => {
                const pages = [];
                const start = Math.max(1, currentPage - 3);
                const end = Math.min(totalPages, currentPage + 3);

                if (start > 1) {
                  pages.push(
                    <button key={1} onClick={() => setCurrentPage(1)} className="px-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-blue-50 transition">1</button>
                  );
                  if (start > 2) pages.push(<span key="dot1" className="px-2 text-gray-400">…</span>);
                }

                for (let i = start; i <= end; i++) {
                  pages.push(
                    <button
                      key={i}
                      onClick={() => setCurrentPage(i)}
                      className={`px-3 py-2 rounded-lg font-semibold transition ${
                        currentPage === i
                          ? 'bg-blue-600 text-white shadow-lg'
                          : 'border border-gray-300 text-gray-700 hover:bg-blue-50'
                      }`}
                    >
                      {i}
                    </button>
                  );
                }

                if (end < totalPages) {
                  if (end < totalPages - 1) pages.push(<span key="dot2" className="px-2 text-gray-400">…</span>);
                  pages.push(
                    <button key={totalPages} onClick={() => setCurrentPage(totalPages)} className="px-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-blue-50 transition">{totalPages}</button>
                  );
                }

                return pages;
              })()}

              {/* Next & Last */}
              <button
                onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                Next ⟩
              </button>
              <button
                onClick={() => setCurrentPage(totalPages)}
                disabled={currentPage === totalPages}
                title="Last page"
                className="px-3 py-2 border border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-blue-50 disabled:opacity-30 disabled:cursor-not-allowed transition"
              >
                ⟩⟩
              </button>

              {/* Current Page Info */}
              <div className="ml-4 px-3 py-2 bg-blue-50 rounded-lg text-sm font-semibold text-blue-700 border border-blue-200">
                Page {currentPage} of {totalPages}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ANALYSIS VIEW */}
      {tabView === 'analysis' && (
        <div className="space-y-6">
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <h3 className="font-semibold text-blue-900">📊 Fleet Analysis Insights</h3>
            <ul className="text-sm text-blue-800 mt-2 space-y-1 list-disc list-inside">
              <li><strong>{vehicles.filter(v => v.active).length}</strong> vehicles are currently active</li>
              <li><strong>{vehicles.filter(v => v.alerts.critical > 0).length}</strong> vehicles have critical alerts</li>
              <li><strong>{vehicles.filter(v => v.health_score >= 80).length}</strong> vehicles are in excellent condition</li>
              <li>Average fleet efficiency is <strong>{fleetSummary?.avgEfficiency?.toFixed(1)} km/L</strong></li>
              <li>Fleet is running at <strong>{(Math.round((fleetSummary?.avgFuelLevel || 0) / 10) * 10)}%</strong> average fuel capacity</li>
            </ul>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">🔧 Maintenance Health</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Vehicles Requiring Maintenance</p>
                  <p className="text-2xl font-bold text-orange-600">{vehicles.filter(v => v.health_score < 60).length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Vehicles in Good Condition</p>
                  <p className="text-2xl font-bold text-green-600">{vehicles.filter(v => v.health_score >= 80).length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">⚡ Operational Status</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Moving Vehicles</p>
                  <p className="text-2xl font-bold text-blue-600">{vehicles.filter(v => v.status === 'moving').length}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Idle Vehicles</p>
                  <p className="text-2xl font-bold text-yellow-600">{vehicles.filter(v => v.status === 'idle').length}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-lg shadow p-6">
              <h3 className="font-semibold text-gray-900 mb-4">📍 Location Distribution</h3>
              <div className="space-y-3">
                <div>
                  <p className="text-sm text-gray-600">Avg Latitude</p>
                  <p className="text-lg font-mono">{(vehicles.reduce((sum, v) => sum + v.location.latitude, 0) / vehicles.length).toFixed(4)}</p>
                </div>
                <div>
                  <p className="text-sm text-gray-600">Avg Longitude</p>
                  <p className="text-lg font-mono">{(vehicles.reduce((sum, v) => sum + v.location.longitude, 0) / vehicles.length).toFixed(4)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* VEHICLE TRENDS VIEW */}
      {tabView === 'trends' && (
        <div className="space-y-6">
          {/* Vehicle Selector */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <label className="block text-lg font-semibold mb-4">📊 Select Vehicle for Trend Analysis</label>
            <div className="grid grid-cols-5 gap-2">
              {vehicles.slice(0, 20).map(v => (
                <button
                  key={v.id}
                  onClick={() => setSelectedVehicleForTrends(v.id)}
                  className={`p-3 rounded-lg font-semibold transition ${
                    selectedVehicleForTrends === v.id
                      ? 'bg-blue-600 text-white shadow-lg'
                      : 'bg-gray-200 hover:bg-gray-300 text-gray-800'
                  }`}
                >
                  {v.name}
                </button>
              ))}
            </div>
            {vehicles.find(v => v.id === selectedVehicleForTrends) && (
              <div className="mt-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
                <p className="text-sm text-blue-900">
                  <strong>Vehicle {selectedVehicleForTrends}</strong> - Last 60 minutes of data (5-minute intervals)
                </p>
              </div>
            )}
          </div>

          {/* Fuel Level Trend */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">⛽ Fuel Level Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vehicleHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Fuel %', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value.toFixed(1)}%`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="fuel" 
                  stroke="#f59e0b" 
                  name="Fuel %" 
                  dot={{ r: 4 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Speed Trend */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">🚗 Speed Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vehicleHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Speed (km/h)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value.toFixed(1)} km/h`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="speed" 
                  stroke="#3b82f6" 
                  name="Speed (km/h)" 
                  dot={{ r: 4 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Temperature Trend */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">🌡️ Temperature Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vehicleHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Temperature (°C)', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value.toFixed(1)}°C`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="temperature" 
                  stroke="#ef4444" 
                  name="Temperature (°C)" 
                  dot={{ r: 4 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Efficiency Trend */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">⚡ Efficiency Rating Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vehicleHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Efficiency Rating', angle: -90, position: 'insideLeft' }} />
                <Tooltip formatter={(value) => `${value.toFixed(2)}`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="efficiency" 
                  stroke="#10b981" 
                  name="Efficiency Rating" 
                  dot={{ r: 4 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Health Score Trend */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">💚 Health Score Trend</h3>
            <ResponsiveContainer width="100%" height={300}>
              <LineChart data={vehicleHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Health Score', angle: -90, position: 'insideLeft' }} domain={[0, 100]} />
                <Tooltip formatter={(value) => `${value.toFixed(1)}`} />
                <Legend />
                <Line 
                  type="monotone" 
                  dataKey="health" 
                  stroke="#8b5cf6" 
                  name="Health Score" 
                  dot={{ r: 4 }}
                  strokeWidth={2}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Multi-Metric Comparison */}
          <div className="bg-white rounded-lg shadow-md p-6">
            <h3 className="text-lg font-bold mb-4">📊 All Metrics Combined</h3>
            <ResponsiveContainer width="100%" height={400}>
              <LineChart data={vehicleHistory}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="time" />
                <YAxis label={{ value: 'Values', angle: -90, position: 'insideLeft' }} />
                <Tooltip />
                <Legend />
                <Line type="monotone" dataKey="fuel" stroke="#f59e0b" name="Fuel %" strokeWidth={2} />
                <Line type="monotone" dataKey="speed" stroke="#3b82f6" name="Speed km/h" strokeWidth={2} />
                <Line type="monotone" dataKey="temperature" stroke="#ef4444" name="Temp °C" strokeWidth={2} />
                <Line type="monotone" dataKey="efficiency" stroke="#10b981" name="Efficiency" strokeWidth={2} />
              </LineChart>
            </ResponsiveContainer>
          </div>

          {/* Insights */}
          <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg shadow-md p-6 border border-purple-200">
            <h3 className="text-lg font-bold mb-3 text-purple-900">💡 Trend Insights</h3>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <p className="text-sm text-purple-700 font-semibold">Fuel Consumption Rate</p>
                <p className="text-2xl font-bold text-orange-600">
                  {vehicleHistory.length > 1 
                    ? ((vehicleHistory[0].fuel - vehicleHistory[vehicleHistory.length - 1].fuel) / (vehicleHistory.length - 1)).toFixed(2)
                    : '0.00'} %/interval
                </p>
              </div>
              <div>
                <p className="text-sm text-purple-700 font-semibold">Average Speed</p>
                <p className="text-2xl font-bold text-blue-600">
                  {vehicleHistory.length > 0
                    ? (vehicleHistory.reduce((sum, h) => sum + h.speed, 0) / vehicleHistory.length).toFixed(1)
                    : '0'} km/h
                </p>
              </div>
              <div>
                <p className="text-sm text-purple-700 font-semibold">Temperature Range</p>
                <p className="text-2xl font-bold text-red-600">
                  {vehicleHistory.length > 0
                    ? `${Math.min(...vehicleHistory.map(h => h.temperature)).toFixed(1)}°C - ${Math.max(...vehicleHistory.map(h => h.temperature)).toFixed(1)}°C`
                    : 'N/A'
                  }
                </p>
              </div>
              <div>
                <p className="text-sm text-purple-700 font-semibold">Avg Health Score</p>
                <p className="text-2xl font-bold text-purple-600">
                  {vehicleHistory.length > 0
                    ? (vehicleHistory.reduce((sum, h) => sum + h.health, 0) / vehicleHistory.length).toFixed(1)
                    : '0'}
                </p>
              </div>
            </div>
          </div>
        </div>
      )}

      <p className="text-xs text-gray-500 text-center">Last updated: {new Date().toLocaleTimeString()} • Auto-refresh every 10 seconds</p>
    </div>
  );
}

export default VehicleComparison;
