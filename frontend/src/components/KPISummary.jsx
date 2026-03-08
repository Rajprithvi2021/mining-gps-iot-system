import React from 'react';

export const KPISummary = ({ summary }) => {
  return (
    <div className="grid grid-cols-1 md:grid-cols-4 gap-4 p-4">
      <div className="bg-blue-500 text-white p-6 rounded-lg shadow">
        <div className="text-2xl font-bold">{summary?.vehicles_active || 0}</div>
        <div className="text-sm">Active Vehicles</div>
      </div>
      
      <div className="bg-yellow-500 text-white p-6 rounded-lg shadow">
        <div className="text-2xl font-bold">{summary?.vehicles_idle || 0}</div>
        <div className="text-sm">Idle Vehicles</div>
      </div>
      
      <div className="bg-green-500 text-white p-6 rounded-lg shadow">
        <div className="text-2xl font-bold">{summary?.fuel_consumed_today_liters?.toFixed(1) || 0}L</div>
        <div className="text-sm">Fuel Consumed Today</div>
      </div>
      
      <div className="bg-red-500 text-white p-6 rounded-lg shadow">
        <div className="text-2xl font-bold">{summary?.alerts_today || 0}</div>
        <div className="text-sm">Active Alerts</div>
      </div>
    </div>
  );
};
