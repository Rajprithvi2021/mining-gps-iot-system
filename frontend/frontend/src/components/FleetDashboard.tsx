/**
 * React Dashboard Frontend
 * =======================
 * Real-time vehicle tracking with Mapbox GL, alerts, and analytics
 */

import React, { useState, useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import { useQuery, useSubscription } from '@apollo/client';
import { gql } from '@apollo/client';

// GraphQL Queries
const GET_VEHICLES = gql`
  query {
    vehicles(limit: 100) {
      id
      vehicleId
      type
      status
      lastLocation {
        latitude
        longitude
      }
      lastUpdate
      speedKmh
      healthScore
    }
  }
`;

const GET_ALERTS = gql`
  query {
    alerts(limit: 50) {
      id
      vehicleId
      severity
      message
      status
      sentAt
    }
  }
`;

const GET_FLEET_STATS = gql`
  query {
    fleetStatistics {
      totalVehicles
      activeVehicles
      totalDistance
      totalAnomalies
      avgFuelEfficiency
    }
  }
`;

const SUBSCRIPTION_VEHICLE_LOCATION = gql`
  subscription OnVehicleLocationUpdated($vehicleId: ID) {
    vehicleLocationUpdated(vehicleId: $vehicleId) {
      id
      vehicleId
      lastLocation {
        latitude
        longitude
      }
      speedKmh
    }
  }
`;

// Styles
const styles = {
  container: {
    display: 'flex',
    height: '100vh',
    fontFamily: 'Inter, sans-serif',
  },
  sidebar: {
    width: '350px',
    backgroundColor: '#f8f9fa',
    borderRight: '1px solid #e0e0e0',
    display: 'flex',
    flexDirection: 'column' as const,
    overflowY: 'auto' as const,
  },
  mapContainer: {
    flex: 1,
  },
  header: {
    padding: '16px',
    borderBottom: '1px solid #e0e0e0',
    backgroundColor: '#fff',
  },
  title: {
    fontSize: '20px',
    fontWeight: 'bold',
    margin: 0,
  },
  statsGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: '12px',
    padding: '12px',
  },
  statCard: {
    backgroundColor: '#fff',
    padding: '12px',
    borderRadius: '6px',
    border: '1px solid #e0e0e0',
  },
  statValue: {
    fontSize: '18px',
    fontWeight: 'bold',
    color: '#0066cc',
  },
  statLabel: {
    fontSize: '12px',
    color: '#666',
    marginTop: '4px',
  },
  alertsSection: {
    padding: '12px',
    flex: 1,
    overflowY: 'auto' as const,
  },
  sectionTitle: {
    fontSize: '14px',
    fontWeight: '600',
    marginBottom: '8px',
    textTransform: 'uppercase' as const,
    color: '#333',
  },
  alertItem: {
    backgroundColor: '#fff',
    padding: '10px',
    marginBottom: '8px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
  },
  alertCritical: {
    borderLeft: '4px solid #ff4444',
    backgroundColor: '#fff5f5',
  },
  alertHigh: {
    borderLeft: '4px solid #ff9800',
    backgroundColor: '#fff8f5',
  },
  alertMedium: {
    borderLeft: '4px solid #ffb800',
    backgroundColor: '#fffaf5',
  },
  alertMessage: {
    fontSize: '12px',
    margin: 0,
    color: '#333',
    fontWeight: '500',
  },
  alertTime: {
    fontSize: '10px',
    color: '#999',
    marginTop: '4px',
  },
  vehicleList: {
    padding: '12px',
    maxHeight: '300px',
    overflowY: 'auto' as const,
  },
  vehicleItem: {
    backgroundColor: '#fff',
    padding: '10px',
    marginBottom: '6px',
    borderRadius: '4px',
    border: '1px solid #e0e0e0',
    cursor: 'pointer',
    transition: 'all 0.2s',
  },
  vehicleActive: {
    borderLeft: '4px solid #00cc44',
  },
  vehicleInactive: {
    borderLeft: '4px solid #ccc',
    opacity: 0.6,
  },
  vehicleName: {
    fontSize: '12px',
    fontWeight: '600',
    margin: 0,
  },
  vehicleStatus: {
    fontSize: '11px',
    color: '#666',
    marginTop: '2px',
  },
  markerCluster: {
    width: '40px',
    height: '40px',
    borderRadius: '50%',
    backgroundColor: '#0066cc',
    color: '#fff',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontWeight: 'bold',
    cursor: 'pointer',
    border: '2px solid #fff',
    boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
  },
};

interface Vehicle {
  id: string;
  vehicleId: string;
  type: string;
  status: string;
  lastLocation: {
    latitude: number;
    longitude: number;
  };
  lastUpdate: string;
  speedKmh: number;
  healthScore: number;
}

interface Alert {
  id: string;
  vehicleId: string;
  severity: string;
  message: string;
  status: string;
  sentAt: string;
}

/**
 * Fleet Dashboard Component
 * Main UI for vehicle tracking, real-time updates, alerts
 */
const FleetDashboard: React.FC = () => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<mapboxgl.Map | null>(null);
  const [selectedVehicle, setSelectedVehicle] = useState<Vehicle | null>(null);
  const markersRef = useRef<Map<string, mapboxgl.Marker>>(new Map());

  // Queries
  const { data: vehiclesData, loading: vehiclesLoading } = useQuery(GET_VEHICLES, {
    pollInterval: 5000,
  });

  const { data: alertsData } = useQuery(GET_ALERTS, {
    pollInterval: 10000,
  });

  const { data: statsData } = useQuery(GET_FLEET_STATS, {
    pollInterval: 30000,
  });

  // Subscription for real-time vehicle location updates
  useSubscription(SUBSCRIPTION_VEHICLE_LOCATION, {
    variables: { vehicleId: selectedVehicle?.id },
    skip: !selectedVehicle,
    onData: ({ data }) => {
      if (data.data?.vehicleLocationUpdated) {
        updateVehicleMarker(data.data.vehicleLocationUpdated);
      }
    },
  });

  // Initialize map
  useEffect(() => {
    if (!mapContainer.current) return;

    if (map.current) return;

    mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN || '';

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: 'mapbox://styles/mapbox/outdoors-v12',
      center: [77.2090, 28.6139], // New Delhi
      zoom: 10,
    });

    map.current.addControl(new mapboxgl.NavigationControl());

    return () => {
      // Cleanup handled on unmount
    };
  }, []);

  // Update vehicle markers on map
  useEffect(() => {
    if (!map.current || !vehiclesData?.vehicles) return;

    vehiclesData.vehicles.forEach((vehicle: Vehicle) => {
      const { latitude, longitude } = vehicle.lastLocation;
      const markerId = `vehicle-${vehicle.id}`;

      // Remove old marker if exists
      const oldMarker = markersRef.current.get(markerId);
      if (oldMarker) oldMarker.remove();

      // Create marker element
      const el = document.createElement('div');
      el.style.width = '30px';
      el.style.height = '30px';
      el.style.borderRadius = '50%';
      el.style.backgroundColor = vehicle.status === 'ACTIVE' ? '#0066cc' : '#ccc';
      el.style.border = '2px solid white';
      el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
      el.style.cursor = 'pointer';
      el.innerHTML = `<div style="font-size:10px;color:white;display:flex;align-items:center;justify-content:center;height:100%">${Math.round(vehicle.speedKmh)}</div>`;

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        setSelectedVehicle(vehicle);
      });

      // Create popup
      const popup = new mapboxgl.Popup({ offset: 25 }).setHTML(
        `<div style="font-size:12px">
          <strong>${vehicle.vehicleId}</strong><br/>
          Speed: ${vehicle.speedKmh.toFixed(1)} km/h<br/>
          Status: ${vehicle.status}
        </div>`
      );

      const marker = new mapboxgl.Marker(el)
        .setLngLat([longitude, latitude])
        .setPopup(popup)
        .addTo(map.current!);

      markersRef.current.set(markerId, marker);

      // Highlight selected vehicle
      if (selectedVehicle?.id === vehicle.id) {
        el.style.backgroundColor = '#00cc44';
        el.style.boxShadow = '0 0 0 3px rgba(0,204,68,0.3), 0 2px 4px rgba(0,0,0,0.3)';
      }
    });
  }, [vehiclesData, selectedVehicle]);

  // Handle real-time location updates
  const updateVehicleMarker = (updatedVehicle: Vehicle) => {
    if (!map.current) return;

    const markerId = `vehicle-${updatedVehicle.id}`;
    const marker = markersRef.current.get(markerId);

    if (marker) {
      marker.setLngLat([
        updatedVehicle.lastLocation.longitude,
        updatedVehicle.lastLocation.latitude,
      ]);
    }
  };

  const stats = statsData?.fleetStatistics;
  const alerts = alertsData?.alerts || [];
  const vehicles = vehiclesData?.vehicles || [];

  // Filter alerts by severity for display
  const criticalAlerts = alerts.filter((a) => a.severity === 'CRITICAL');
  const highAlerts = alerts.filter((a) => a.severity === 'HIGH');

  return (
    <div style={styles.container}>
      {/* Sidebar */}
      <div style={styles.sidebar}>
        <div style={styles.header}>
          <h2 style={styles.title}>Fleet Control</h2>
        </div>

        {/* Statistics Grid */}
        {stats && (
          <div style={styles.statsGrid}>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.activeVehicles}</div>
              <div style={styles.statLabel}>Active Vehicles</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.totalDistance.toFixed(0)}</div>
              <div style={styles.statLabel}>Total Distance (km)</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.totalAnomalies}</div>
              <div style={styles.statLabel}>Anomalies</div>
            </div>
            <div style={styles.statCard}>
              <div style={styles.statValue}>{stats.avgFuelEfficiency.toFixed(1)}</div>
              <div style={styles.statLabel}>Avg Efficiency (km/L)</div>
            </div>
          </div>
        )}

        {/* Alerts Section */}
        <div style={styles.alertsSection}>
          <div style={styles.sectionTitle}>
            🚨 Alerts ({criticalAlerts.length + highAlerts.length})
          </div>

          {criticalAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                ...styles.alertItem,
                ...styles.alertCritical,
              }}
            >
              <p style={styles.alertMessage}>🔴 {alert.message}</p>
              <div style={styles.alertTime}>
                {new Date(alert.sentAt).toLocaleTimeString()}
              </div>
            </div>
          ))}

          {highAlerts.map((alert) => (
            <div
              key={alert.id}
              style={{
                ...styles.alertItem,
                ...styles.alertHigh,
              }}
            >
              <p style={styles.alertMessage}>🟠 {alert.message}</p>
              <div style={styles.alertTime}>
                {new Date(alert.sentAt).toLocaleTimeString()}
              </div>
            </div>
          ))}

          {alerts.length === 0 && (
            <p style={{ fontSize: '12px', color: '#999', textAlign: 'center' }}>
              ✅ No active alerts
            </p>
          )}
        </div>

        {/* Vehicles List */}
        <div style={styles.vehicleList}>
          <div style={styles.sectionTitle}>Vehicles ({vehicles.length})</div>
          {vehicles.map((vehicle) => (
            <div
              key={vehicle.id}
              style={{
                ...styles.vehicleItem,
                ...(vehicle.status === 'ACTIVE'
                  ? styles.vehicleActive
                  : styles.vehicleInactive),
                backgroundColor:
                  selectedVehicle?.id === vehicle.id ? '#e8f4ff' : '#fff',
              }}
              onClick={() => setSelectedVehicle(vehicle)}
            >
              <p style={styles.vehicleName}>{vehicle.vehicleId}</p>
              <div style={styles.vehicleStatus}>
                {vehicle.speedKmh.toFixed(1)} km/h • {vehicle.status}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Map */}
      <div ref={mapContainer} style={styles.mapContainer} />
    </div>
  );
};

export default FleetDashboard;
