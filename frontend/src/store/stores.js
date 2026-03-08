import create from 'zustand';

export const useVehicleStore = create((set) => ({
  vehicles: [],
  alerts: [],
  selectedVehicle: null,
  loading: false,
  
  setVehicles: (vehicles) => set({ vehicles }),
  updateVehicle: (vehicle) => set((state) => ({
    vehicles: state.vehicles.map(v => v.id === vehicle.id ? vehicle : v)
  })),
  
  setAlerts: (alerts) => set({ alerts }),
  addAlert: (alert) => set((state) => ({
    alerts: [alert, ...state.alerts].slice(0, 100)
  })),
  
  setSelectedVehicle: (vehicle) => set({ selectedVehicle: vehicle }),
  setLoading: (loading) => set({ loading })
}));

export const useMapStore = create((set) => ({
  center: [114.5, -25.5], // Western Australia coordinates
  zoom: 10,
  
  setCenter: (center) => set({ center }),
  setZoom: (zoom) => set({ zoom })
}));

export const useFilterStore = create((set) => ({
  alertType: 'all',
  timeRange: 'today',
  
  setAlertType: (type) => set({ alertType: type }),
  setTimeRange: (range) => set({ timeRange: range })
}));
