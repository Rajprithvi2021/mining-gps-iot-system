import React, { useState, useEffect } from 'react';
import { vehicleAPI } from '../services/api';
import { useVehicleStore } from '../store/stores';

export const VehiclePanel = ({ selectedVehicleId }) => {
  const [vehicleDetails, setVehicleDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const { vehicles } = useVehicleStore();

  useEffect(() => {
    if (selectedVehicleId) {
      setLoading(true);
      vehicleAPI.getById(selectedVehicleId)
        .then(response => {
          setVehicleDetails(response.data.vehicle);
        })
        .catch(error => console.error('Error fetching vehicle details:', error))
        .finally(() => setLoading(false));
    }
  }, [selectedVehicleId]);

  if (loading) return <div className="p-4">Loading...</div>;
  if (!vehicleDetails) return <div className="p-4">Select a vehicle</div>;

  return (
    <div className="bg-white p-6 rounded-lg shadow">
      <h2 className="text-xl font-bold mb-4">{vehicleDetails.name}</h2>
      <table className="w-full text-sm">
        <tbody>
          <tr className="border-b">
            <td className="py-2 font-semibold">Type:</td>
            <td>{vehicleDetails.type}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-semibold">Driver:</td>
            <td>{vehicleDetails.driver_name || 'N/A'}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-semibold">Current Speed:</td>
            <td>{vehicleDetails.current_speed_kmh} km/h</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-semibold">Position:</td>
            <td>{vehicleDetails.current_latitude?.toFixed(4)}, {vehicleDetails.current_longitude?.toFixed(4)}</td>
          </tr>
          <tr className="border-b">
            <td className="py-2 font-semibold">Last Update:</td>
            <td>{new Date(vehicleDetails.last_gps_update).toLocaleString()}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};
