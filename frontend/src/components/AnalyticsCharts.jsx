import React, { useState, useEffect } from 'react';
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, PieChart, Pie, Cell } from 'recharts';
import { api } from '../api';

export function FuelTrendChart({ vehicleId, timeRange = '7days' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get('/analytics/fuel', {
          params: { timeRange, vehicleId }
        });
        
        // Transform data for recharts
        const chartData = response.data.analytics.map(item => ({
          date: new Date(item.started_at).toLocaleDateString(),
          consumption: parseFloat(item.avg_consumption),
          trips: item.trip_count,
          cost: Math.round(item.total_cost)
        }));
        
        setData(chartData);
      } catch (error) {
        console.error('Error fetching fuel data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange, vehicleId]);

  if (loading) return <div className="p-4">Loading fuel trends...</div>;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Fuel Consumption Trend ({timeRange})</h3>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis yAxisId="left" label={{ value: 'L/km', angle: -90, position: 'insideLeft' }} />
          <YAxis yAxisId="right" orientation="right" label={{ value: 'Cost (₹)', angle: 90, position: 'insideRight' }} />
          <Tooltip formatter={(value) => value.toFixed(3)} />
          <Legend />
          <Line yAxisId="left" type="monotone" dataKey="consumption" stroke="#8884d8" name="Consumption (L/km)" />
          <Line yAxisId="right" type="monotone" dataKey="cost" stroke="#82ca9d" name="Cost (₹)" />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DriverScorecard({ driverId, timeRange = '30days' }) {
  const [performance, setPerformance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/analytics/driver/${driverId}`, {
          params: { timeRange }
        });
        setPerformance(response.data);
      } catch (error) {
        console.error('Error fetching driver data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [driverId, timeRange]);

  if (loading) return <div className="p-4">Loading driver performance...</div>;
  if (!performance) return <div className="p-4">No data available</div>;

  const scores = [
    { name: 'Fuel Efficiency', score: performance.fuel_efficiency_score, color: '#8884d8' },
    { name: 'Idle Efficiency', score: performance.idle_efficiency_score, color: '#82ca9d' },
    { name: 'Safety Score', score: performance.safety_score, color: '#ffc658' },
    { name: 'Overall Score', score: performance.overall_score, color: '#ff7c7c' }
  ];

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Driver Performance ({driverId})</h3>
      <div className="grid grid-cols-2 gap-4 mb-4">
        {scores.map((s) => (
          <div key={s.name} className="p-3 border rounded-lg">
            <p className="text-sm text-gray-600">{s.name}</p>
            <p className="text-2xl font-bold" style={{ color: s.color }}>
              {s.score.toFixed(1)}
            </p>
            <div className="w-full bg-gray-300 rounded h-2 mt-2">
              <div
                className="bg-gradient-to-r h-2 rounded"
                style={{
                  width: `${s.score}%`,
                  background: `linear-gradient(90deg, ${s.color}, ${s.color}80)`
                }}
              />
            </div>
          </div>
        ))}
      </div>
      <div className="mt-4 text-sm text-gray-600">
        <p>Trips: {performance.total_trips}</p>
        <p>Avg Consumption: {performance.avg_fuel_consumption?.toFixed(3)} L/km</p>
        <p>Total Cost: ₹{Math.round(performance.total_cost)}</p>
      </div>
    </div>
  );
}

export function MaintenanceAlertList() {
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get('/analytics/maintenance');
        setVehicles(response.data.vehicles_needing_service || []);
      } catch (error) {
        console.error('Error fetching maintenance data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading) return <div className="p-4">Loading maintenance data...</div>;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Vehicles Needing Maintenance</h3>
      {vehicles.length === 0 ? (
        <p className="text-gray-500">No maintenance alerts</p>
      ) : (
        <div className="space-y-3">
          {vehicles.map((v, idx) => (
            <div key={idx} className={`p-3 rounded-lg border-l-4 ${
              v.urgency === 'URGENT' ? 'border-red-500 bg-red-50' :
              v.urgency === 'SOON' ? 'border-yellow-500 bg-yellow-50' :
              'border-blue-500 bg-blue-50'
            }`}>
              <div className="flex justify-between items-start">
                <div>
                  <p className="font-semibold">{v.vehicle_name}</p>
                  <p className="text-sm text-gray-600">{v.vehicle_id}</p>
                </div>
                <span className={`text-xs font-bold px-2 py-1 rounded ${
                  v.urgency === 'URGENT' ? 'bg-red-200 text-red-800' :
                  v.urgency === 'SOON' ? 'bg-yellow-200 text-yellow-800' :
                  'bg-blue-200 text-blue-800'
                }`}>
                  {v.urgency}
                </span>
              </div>
              <div className="mt-2 text-sm">
                <p>Total km: {v.total_km}</p>
                <p>Current L/km: {v.current_l_per_km?.toFixed(3)}</p>
                {v.degradation_percent && (
                  <p className="text-red-600">Degradation: {v.degradation_percent}%</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function CostBreakdownChart({ tripId }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get(`/analytics/trip/${tripId}`);
        
        const chartData = [
          { name: 'Base Consumption', value: response.data.base_fuel_cost, fill: '#8884d8' },
          { name: 'Acceleration', value: response.data.acceleration_fuel_cost, fill: '#82ca9d' },
          { name: 'Distance', value: response.data.distance_fuel_cost, fill: '#ffc658' },
          { name: 'Idle', value: response.data.idle_fuel_cost, fill: '#ff7c7c' }
        ];
        
        setData(chartData);
      } catch (error) {
        console.error('Error fetching trip data:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [tripId]);

  if (loading) return <div className="p-4">Loading trip breakdown...</div>;
  if (!data) return <div className="p-4">No data available</div>;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Cost Breakdown</h3>
      <ResponsiveContainer width="100%" height={300}>
        <PieChart>
          <Pie
            data={data}
            cx="50%"
            cy="50%"
            labelLine={false}
            label={({ name, value }) => `${name}: ₹${value}`}
            outerRadius={80}
            fill="#8884d8"
            dataKey="value"
          >
            {data.map((entry, index) => (
              <Cell key={`cell-${index}`} fill={entry.fill} />
            ))}
          </Pie>
          <Tooltip formatter={(value) => `₹${value}`} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function AlertTrendChart({ timeRange = '7days' }) {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        const response = await api.get('/analytics/alerts/trends', {
          params: { days: timeRange === '7days' ? 7 : 30 }
        });
        
        // Group by date
        const grouped = {};
        response.data.trends.forEach(t => {
          const date = t.date;
          if (!grouped[date]) {
            grouped[date] = { date, critical: 0, high: 0, medium: 0, low: 0 };
          }
          grouped[date][t.severity] += t.count;
        });
        
        setData(Object.values(grouped));
      } catch (error) {
        console.error('Error fetching alert trends:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [timeRange]);

  if (loading) return <div className="p-4">Loading alert trends...</div>;

  return (
    <div className="bg-white p-4 rounded-lg shadow">
      <h3 className="text-lg font-semibold mb-4">Alert Trends ({timeRange})</h3>
      <ResponsiveContainer width="100%" height={300}>
        <BarChart data={data}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="date" />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="critical" fill="#ff7c7c" name="Critical" />
          <Bar dataKey="high" fill="#ffc658" name="High" />
          <Bar dataKey="medium" fill="#82ca9d" name="Medium" />
          <Bar dataKey="low" fill="#8884d8" name="Low" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
