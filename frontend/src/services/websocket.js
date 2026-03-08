import io from 'socket.io-client';
import { useVehicleStore } from '../store/stores';

const SOCKET_URL = process.env.REACT_APP_BACKEND_URL || 'http://localhost:3000';

let socket = null;

export const initializeSocket = () => {
  if (!socket) {
    socket = io(SOCKET_URL, {
      reconnection: true,
      reconnectionDelay: 1000,
      reconnectionDelayMax: 5000,
      reconnectionAttempts: 5
    });

    socket.on('connect', () => {
      console.log('WebSocket connected');
    });

    socket.on('vehicle_update', (data) => {
      useVehicleStore.getState().updateVehicle(data);
    });

    socket.on('alert_triggered', (alert) => {
      useVehicleStore.getState().addAlert(alert);
    });

    socket.on('disconnect', () => {
      console.log('WebSocket disconnected');
    });
  }

  return socket;
};

export const subscribeToVehicle = (vehicleId) => {
  if (socket) {
    socket.emit('subscribe_vehicle', vehicleId);
  }
};

export const getSocket = () => socket;
