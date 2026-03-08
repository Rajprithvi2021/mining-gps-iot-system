import React, { useEffect, useState } from 'react';
import mapboxgl from 'mapbox-gl';
import 'mapbox-gl/dist/mapbox-gl.css';

// Set Mapbox token
if (!mapboxgl.accessToken) {
  mapboxgl.accessToken = process.env.REACT_APP_MAPBOX_TOKEN;
}

const API_BASE = 'http://localhost:5000/api/v1';

export const MapContainer = ({ selectedVehicleId, onVehicleSelect }) => {
  const mapContainer = React.useRef(null);
  const map = React.useRef(null);
  const markersRef = React.useRef([]);
  const vehicleDataRef = React.useRef({}); // Store vehicle data for quick lookup
  const [vehicles, setVehicles] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch vehicles from backend
  useEffect(() => {
    const fetchVehicles = async () => {
      try {
        const response = await fetch(`${API_BASE}/vehicles`);
        if (response.ok) {
          const data = await response.json();
          console.log('Vehicles fetched:', data);
          setVehicles(data.data || []);
        } else {
          console.error('Failed to fetch vehicles:', response.status);
        }
      } catch (error) {
        console.error('Error fetching vehicles:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchVehicles();
    const interval = setInterval(fetchVehicles, 5000); // Refresh every 5 seconds
    return () => clearInterval(interval);
  }, []);

  // Initialize map
  useEffect(() => {
    if (map.current) return; // map already initialized
    
    if (!mapContainer.current) {
      console.error('Map container not found');
      return;
    }

    if (!mapboxgl.accessToken) {
      console.error('Mapbox token not set');
      return;
    }

    try {
      map.current = new mapboxgl.Map({
        container: mapContainer.current,
        style: 'mapbox://styles/mapbox/streets-v12',
        center: [74.5, 22.5], // India center (vehicles location) - will be adjusted by fitBounds
        zoom: 10,
        pitch: 0,
        bearing: 0
      });

      map.current.on('load', () => {
        console.log('Map loaded successfully');
        // Add navigation controls
        map.current.addControl(new mapboxgl.NavigationControl(), 'top-right');
      });

      map.current.on('error', (e) => {
        console.error('Mapbox error:', e);
      });
    } catch (error) {
      console.error('Error initializing map:', error);
    }

    return () => {
      // Cleanup markers
      markersRef.current.forEach(marker => marker.remove());
      markersRef.current = [];
      
      // Remove map
      if (map.current) {
        map.current.remove();
        map.current = null;
      }
    };
  }, []);

  // Add vehicle markers
  useEffect(() => {
    if (!map.current || !map.current.isStyleLoaded?.() || vehicles.length === 0) return;

    // Clear existing markers
    markersRef.current.forEach(marker => marker.remove());
    markersRef.current = [];

    console.log('Adding markers for', vehicles.length, 'vehicles');
    console.log('First vehicle sample:', vehicles[0]);

    let bounds = null;
    let markerCount = 0;

    vehicles.forEach(vehicle => {
      // Handle different field names from backend
      const lat = vehicle.current_latitude !== undefined && vehicle.current_latitude !== null 
        ? parseFloat(vehicle.current_latitude)
        : vehicle.latitude !== undefined && vehicle.latitude !== null
        ? parseFloat(vehicle.latitude)
        : null;
      
      const lng = vehicle.current_longitude !== undefined && vehicle.current_longitude !== null 
        ? parseFloat(vehicle.current_longitude)
        : vehicle.longitude !== undefined && vehicle.longitude !== null
        ? parseFloat(vehicle.longitude)
        : null;

      const name = vehicle.name || vehicle.vehicle_name || `Vehicle-${vehicle.id}`;
      const speed = vehicle.current_speed_kmh || vehicle.speed || 0;
      const isSelected = vehicle.id === selectedVehicleId;
      
      // Only add marker if coordinates are valid numbers (not null, not NaN)
      if (lat !== null && lng !== null && !isNaN(lat) && !isNaN(lng)) {
        // Initialize bounds on first valid marker
        if (!bounds) {
          bounds = {
            minLng: lng,
            minLat: lat,
            maxLng: lng,
            maxLat: lat
          };
        } else {
          // Extend bounds to include this marker
          if (lng < bounds.minLng) bounds.minLng = lng;
          if (lat < bounds.minLat) bounds.minLat = lat;
          if (lng > bounds.maxLng) bounds.maxLng = lng;
          if (lat > bounds.maxLat) bounds.maxLat = lat;
        }

        // Create marker element
        const el = document.createElement('div');
        el.className = 'mapbox-marker';
        el.style.width = '40px';
        el.style.height = '40px';
        el.style.borderRadius = '50%';
        el.style.backgroundColor = isSelected ? '#FF4444' : '#00AA00';
        el.style.border = isSelected ? '3px solid #FFFF00' : '2px solid white';
        el.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
        el.style.display = 'flex';
        el.style.alignItems = 'center';
        el.style.justifyContent = 'center';
        el.style.fontSize = '20px';
        el.style.cursor = 'pointer';
        el.innerHTML = '🚗';

        // Create marker
        const marker = new mapboxgl.Marker(el)
          .setLngLat([lng, lat])
          .setPopup(
            new mapboxgl.Popup({ offset: 25, closeButton: true }).setHTML(
              `<div style="padding: 10px; font-family: Arial; min-width: 220px;">
                <strong style="font-size: 14px;">${name}</strong><br/>
                <hr style="margin: 5px 0;"/>
                <div style="font-size: 12px;">
                  <div style="margin-bottom: 5px;"><strong>Speed:</strong> ${speed} km/h</div>
                  <div style="margin-bottom: 5px;"><strong>Latitude:</strong> ${lat.toFixed(4)}</div>
                  <div style="margin-bottom: 5px;"><strong>Longitude:</strong> ${lng.toFixed(4)}</div>
                  <div style="margin-bottom: 5px;"><strong>Fuel:</strong> ${vehicle.fuel || 0}%</div>
                  <div style="margin-bottom: 5px;"><strong>Temperature:</strong> ${vehicle.temp || 0}°C</div>
                  <div style="margin-bottom: 5px;"><strong>Location:</strong> ${vehicle.location || 'N/A'}</div>
                  <div style="margin-bottom: 5px;"><strong>Status:</strong> ${vehicle.status || 'Active'}</div>
                </div>
              </div>`
            )
          )
          .addTo(map.current);

        // Add click event to marker - opens popup and triggers selection
        el.addEventListener('click', (e) => {
          e.stopPropagation();
          marker.togglePopup();
          // Trigger selection callback with full vehicle data
          if (onVehicleSelect) {
            onVehicleSelect(vehicle);
          }
        });

        markersRef.current.push(marker);
        markerCount++;
      } else {
        console.warn(`Vehicle ${name} has invalid coordinates:`, { lat, lng });
      }
    });

    console.log(`Successfully added ${markerCount} markers`);

    // Center map on vehicle bounds if markers were added
    if (bounds && markerCount > 0) {
      const padding = 50; // Padding around the bounds
      const fitBoundsOptions = {
        bounds: [
          [bounds.minLng - 0.05, bounds.minLat - 0.05],
          [bounds.maxLng + 0.05, bounds.maxLat + 0.05]
        ],
        padding: padding,
        maxZoom: 15,
        duration: 1000
      };

      console.log('Fitting bounds to vehicles:', fitBoundsOptions);
      map.current.fitBounds(
        fitBoundsOptions.bounds,
        { 
          padding: fitBoundsOptions.padding,
          maxZoom: fitBoundsOptions.maxZoom,
          duration: fitBoundsOptions.duration
        }
      );
    }

    console.log('Added', markersRef.current.length, 'markers to map');

  }, [vehicles, selectedVehicleId]);

  return (
    <div 
      ref={mapContainer} 
      style={{
        width: '100%',
        height: '100%',
        minHeight: '600px',
        position: 'relative'
      }}
    >
      {loading && (
        <div style={{
          position: 'absolute',
          top: '50%',
          left: '50%',
          transform: 'translate(-50%, -50%)',
          backgroundColor: 'rgba(0,0,0,0.7)',
          color: 'white',
          padding: '20px 30px',
          borderRadius: '8px',
          zIndex: 10,
          fontFamily: 'Arial'
        }}>
          Loading vehicles...
        </div>
      )}
    </div>
  );
};
