import React from 'react';

export const AlertPanel = ({ alerts }) => {
  const getAlertColor = (severity) => {
    switch (severity) {
      case 'critical': return 'bg-red-100 border-l-4 border-red-500';
      case 'high': return 'bg-orange-100 border-l-4 border-orange-500';
      case 'medium': return 'bg-yellow-100 border-l-4 border-yellow-500';
      default: return 'bg-blue-100 border-l-4 border-blue-500';
    }
  };

  return (
    <div className="bg-white p-6 rounded-lg shadow max-h-96 overflow-y-auto">
      <h2 className="text-xl font-bold mb-4">Active Alerts</h2>
      {alerts && alerts.length === 0 ? (
        <p className="text-gray-500">No alerts</p>
      ) : (
        <div className="space-y-3">
          {alerts?.slice(0, 10).map(alert => (
            <div key={alert.id} className={`p-3 rounded ${getAlertColor(alert.severity)}`}>
              <div className="font-semibold text-sm">{alert.alert_type}</div>
              <div className="text-xs text-gray-600">{alert.description}</div>
              <div className="text-xs text-gray-500 mt-1">{new Date(alert.timestamp).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};
