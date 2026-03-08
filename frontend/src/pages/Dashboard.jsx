import React, { useState, useEffect } from 'react';
import { useWebSocket } from '../hooks/useWebSocket';
import { fetchVehicles, fetchAlerts } from '../services/api';
import FleetDashboard from '../components/FleetDashboard';
import '../styles/Dashboard.css';

/**
 * Main Dashboard Page
 * Displays real-time vehicle tracking and alerts
 */
function DashboardPage() {
    const [vehicles, setVehicles] = useState([]);
    const [alerts, setAlerts] = useState([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(null);

    // WebSocket connection for real-time updates
    const wsData = useWebSocket(process.env.REACT_APP_API_URL);

    // Load initial data
    useEffect(() => {
        loadDashboardData();
    }, []);

    // Update data when WebSocket receives new info
    useEffect(() => {
        if (wsData) {
            if (wsData.type === 'vehicle_update') {
                setVehicles(prev => updateVehicleList(prev, wsData.data));
            } else if (wsData.type === 'alert_created') {
                setAlerts(prev => [wsData.data, ...prev]);
            }
        }
    }, [wsData]);

    const loadDashboardData = async () => {
        try {
            setLoading(true);
            const [vehiclesData, alertsData] = await Promise.all([
                fetchVehicles(),
                fetchAlerts()
            ]);
            setVehicles(vehiclesData);
            setAlerts(alertsData);
        } catch (err) {
            setError(err.message);
            console.error('Failed to load dashboard:', err);
        } finally {
            setLoading(false);
        }
    };

    const updateVehicleList = (currentVehicles, updatedVehicle) => {
        return currentVehicles.map(v =>
            v.id === updatedVehicle.id ? updatedVehicle : v
        );
    };

    if (loading) {
        return <div className="loading">Loading dashboard...</div>;
    }

    if (error) {
        return <div className="error">Error: {error}</div>;
    }

    return (
        <div className="dashboard-page">
            <header className="dashboard-header">
                <h1>Skylark Drones - Fleet Monitoring</h1>
                <div className="fleet-stats">
                    <div className="stat">
                        <span className="label">Active Vehicles</span>
                        <span className="value">{vehicles.length}</span>
                    </div>
                    <div className="stat">
                        <span className="label">Active Alerts</span>
                        <span className="value">{alerts.filter(a => !a.resolved_at).length}</span>
                    </div>
                </div>
            </header>

            <main className="dashboard-main">
                <FleetDashboard vehicles={vehicles} alerts={alerts} />
            </main>

            <footer className="dashboard-footer">
                <p>Last updated: {new Date().toLocaleTimeString()}</p>
            </footer>
        </div>
    );
}

export default DashboardPage;
