// Socket.io client for real-time updates
import { io } from "https://cdn.socket.io/4.7.5/socket.io.esm.min.js";

// Same backend resolution as api.js
const ORIGIN = (typeof window !== 'undefined' && window.BACKEND_URL)
  ? window.BACKEND_URL.replace(/\/$/, '')
  : ((typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin !== 'null')
      ? window.location.origin
      : 'http://localhost:5000');

const socket = io(ORIGIN);

export default socket;
