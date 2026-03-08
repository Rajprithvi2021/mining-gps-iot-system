import React, { useState, useEffect } from 'react';

const API_BASE = process.env.REACT_APP_API_BASE_URL || 'http://localhost:5000';

export function VehicleComparison() {
  const [vehicles, setVehicles] = useState([]);
  const [fleetSummary, setFleetSummary] = useState(null);
  const [sortBy, setSortBy] = useState('health_score');
  const [filterStatus, setFilterStatus] = useState('all');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchAnalytics = async () => {
      try {
        setLoading(true);
        const response = await fetch(`${API_BASE}/api/v1/analytics`);
        if (response.ok) {
          const data = await response.json();
          console.log('🔍 Analytics API Response:', data);
          
          if (data.success && data.data) {
            console.log(`✅ Received ${data.data.vehicle_comparison?.length || 0} vehicles from database`);
            setFleetSummary(data.data.fleet_summary);
            setVehicles(data.data.vehicle_comparison || []);
          } else {
            console.error('❌ Invalid response structure:', data);
          }
        } else {
          console.error('❌ API Error:', response.status, await response.text());
        }
      } catch (error) {
        console.error('❌ Error fetching analytics:', error);
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
    
    // Filter by status
    if (filterStatus === 'active') {
      filtered = filtered.filter(v => v.active);
    } else if (filterStatus === 'inactive') {
      filtered = filtered.filter(v => !v.active);
    } else if (filterStatus === 'alert') {
      filtered = filtered.filter(v => v.alerts.total > 0);
    }

    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'health_score':
          return b.health_score - a.health_score;
        case 'efficiency':
          return b.performance.efficiency_rating - a.performance.efficiency_rating;
        case 'fuel':
          return b.performance.fuel_percentage - a.performance.fuel_percentage;
        case 'speed':
          return a.performance.speed_kmh - b.performance.speed_kmh;
        case 'alerts':
          return b.alerts.total - a.alerts.total;
        default:
          return a.id - b.id;
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

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-center h-32">
          <p className="text-gray-500">Loading vehicle analytics...</p>
        </div>
      </div>
    );
  }

  const sortedVehicles = getSortedVehicles();

  return (
    <div className="space-y-6">
      {/* Fleet Summary */}
      {fleetSummary && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
          <div className="bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg p-4 border border-blue-200">
            <p className="text-xs text-blue-600 font-semibold uppercase">Total Vehicles</p>
            <p className="text-3xl font-bold text-blue-900">{fleetSummary.totalVehicles}</p>
            <p className="text-xs text-blue-600 mt-1">{fleetSummary.activeVehicles} active</p>
          </div>

          <div className="bg-gradient-to-br from-green-50 to-green-100 rounded-lg p-4 border border-green-200">
            <p className="text-xs text-green-600 font-semibold uppercase">Avg Efficiency</p>
            <p className="text-3xl font-bold text-green-900">{fleetSummary.avgEfficiency?.toFixed(1)}</p>
            <p className="text-xs text-green-600 mt-1">km/L</p>
          </div>

          <div className="bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg p-4 border border-orange-200">
            <p className="text-xs text-orange-600 font-semibold uppercase">Avg Fuel Level</p>
            <p className="text-3xl font-bold text-orange-900">{fleetSummary.avgFuelLevel?.toFixed(0)}%</p>
            <p className="text-xs text-orange-600 mt-1">of capacity</p>
          </div>

          <div className="bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg p-4 border border-purple-200">
            <p className="text-xs text-purple-600 font-semibold uppercase">Avg Speed</p>
            <p className="text-3xl font-bold text-purple-900">{fleetSummary.avgSpeed?.toFixed(1)}</p>
            <p className="text-xs text-purple-600 mt-1">km/h</p>
          </div>

          <div className="bg-gradient-to-br from-red-50 to-red-100 rounded-lg p-4 border border-red-200">
            <p className="text-xs text-red-600 font-semibold uppercase">Active Alerts</p>
            <p className="text-3xl font-bold text-red-900">
              {fleetSummary.alerts?.unresolved || 0}
            </p>
            <p className="text-xs text-red-600 mt-1">
              {fleetSummary.alerts?.critical || 0} critical
            </p>
          </div>
        </div>
      )}

      {/* Controls */}
      <div className="flex flex-col md:flex-row gap-4 items-center justify-between bg-white rounded-lg p-4 shadow">
        <div className="flex gap-2">
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="health_score">Sort by: Health Score ↓</option>
            <option value="efficiency">Sort by: Efficiency ↓</option>
            <option value="fuel">Sort by: Fuel Level ↓</option>
            <option value="speed">Sort by: Speed ↑</option>
            <option value="alerts">Sort by: Alerts ↓</option>
            <option value="id">Sort by: ID</option>
          </select>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">Show: All Vehicles</option>
            <option value="active">Show: Active Only</option>
            <option value="inactive">Show: Inactive Only</option>
            <option value="alert">Show: With Alerts</option>
          </select>
        </div>

        <p className="text-sm text-gray-600">
          Showing {sortedVehicles.length} of {vehicles.length} vehicles
        </p>
      </div>

      {/* Vehicle Comparison Table */}
      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gradient-to-r from-gray-800 to-gray-900 text-white sticky top-0">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Vehicle</th>
                <th className="px-4 py-3 text-center font-semibold">Status</th>
                <th className="px-4 py-3 text-center font-semibold">Location</th>
                <th className="px-4 py-3 text-center font-semibold">Speed</th>
                <th className="px-4 py-3 text-center font-semibold">Fuel</th>
                <th className="px-4 py-3 text-center font-semibold">Efficiency</th>
                <th className="px-4 py-3 text-center font-semibold">Temp</th>
                <th className="px-4 py-3 text-center font-semibold">Alerts</th>
                <th className="px-4 py-3 text-center font-semibold">Health</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {sortedVehicles.length > 0 ? (
                sortedVehicles.map((vehicle) => (
                  <tr 
                    key={vehicle.id} 
                    className={`hover:bg-gray-50 transition ${vehicle.alerts.critical > 0 ? 'bg-red-50' : ''}`}
                  >
                    <td className="px-4 py-3">
                      <div className="font-semibold text-gray-900">{vehicle.name}</div>
                      <div className="text-xs text-gray-500">{vehicle.type}</div>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-block px-2 py-1 rounded text-xs font-semibold ${getStatusBadge(vehicle.active, vehicle.status)}`}>
                        {vehicle.active ? vehicle.status?.toUpperCase() || 'ACTIVE' : 'INACTIVE'}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center text-xs">
                      <div className="font-mono text-gray-700">
                        {vehicle.location.latitude.toFixed(4)},
                      </div>
                      <div className="font-mono text-gray-700">
                        {vehicle.location.longitude.toFixed(4)}
                      </div>
                      <a
                        href={`https://maps.google.com/?q=${vehicle.location.latitude},${vehicle.location.longitude}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-blue-500 text-xs hover:underline"
                      >
                        📍 Map
                      </a>
                    </td>
                    <td className="px-4 py-3 text-center font-semibold">
                      {vehicle.performance.speed_kmh.toFixed(1)} km/h
                    </td>
                    <td className={`px-4 py-3 text-center font-semibold ${getFuelColor(vehicle.performance.fuel_percentage)}`}>
                      {vehicle.performance.fuel_percentage}%
                    </td>
                    <td className={`px-4 py-3 text-center ${getEfficiencyColor(vehicle.performance.efficiency_rating)}`}>
                      {vehicle.performance.efficiency_rating.toFixed(2)} km/L
                    </td>
                    <td className="px-4 py-3 text-center">
                      {vehicle.performance.temperature_celsius.toFixed(0)}°C
                    </td>
                    <td className="px-4 py-3 text-center">
                      <div className="flex items-center justify-center gap-1">
                        {vehicle.alerts.critical > 0 && (
                          <span className="bg-red-500 text-white px-2 py-1 rounded text-xs font-bold">
                            {vehicle.alerts.critical} 🔴
                          </span>
                        )}
                        {vehicle.alerts.high > 0 && (
                          <span className="bg-orange-500 text-white px-2 py-1 rounded text-xs font-bold">
                            {vehicle.alerts.high} 🟠
                          </span>
                        )}
                        {vehicle.alerts.total === 0 && (
                          <span className="text-green-600 text-xs font-semibold">✓ OK</span>
                        )}
                      </div>
                    </td>
                    <td className={`px-4 py-3 text-center font-bold ${getHealthColor(vehicle.health_score)}`}>
                      <div className={`inline-block px-3 py-1 rounded-full ${getHealthColor(vehicle.health_score)}`}>
                        {vehicle.health_score}
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="9" className="px-4 py-8 text-center text-gray-500">
                    No vehicles found matching your criteria
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Legend */}
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="font-semibold text-gray-900 mb-3">Legend</h3>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-green-600 rounded"></div>
            <span>Healthy (80-100)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-yellow-500 rounded"></div>
            <span>Fair (60-80)</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-4 bg-red-600 rounded"></div>
            <span>Poor (&lt;60)</span>
          </div>
          <div>
            <span className="text-xs text-gray-600">Efficiency: &gt; 9 km/L = Green</span>
          </div>
          <div>
            <span className="text-xs text-gray-600">Fuel: &gt; 60% = Green</span>
          </div>
          <div>
            <span className="text-xs text-gray-600">Speed: &lt; 80 km/h = Normal</span>
          </div>
        </div>
      </div>
    </div>
  );
}

export default VehicleComparison;
