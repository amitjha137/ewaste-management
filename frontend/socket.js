// Socket.io client for real-time updates

// Backend URL
const ORIGIN = (
    window.BACKEND_URL
        ? window.BACKEND_URL.replace(/\/$/, '')
        : 'https://ewaste-backend-14z2.onrender.com'
);

// Load Socket.IO client directly from our backend
function loadSocketIO() {
    return new Promise((resolve, reject) => {

        // Already loaded?
        if (window.io) {
            resolve(window.io);
            return;
        }

        const script = document.createElement('script');

        script.src = `${ORIGIN}/socket.io/socket.io.js`;

        script.onload = () => {
            if (window.io) {
                resolve(window.io);
            } else {
                reject(new Error('Socket.IO client not available'));
            }
        };

        script.onerror = () => {
            reject(new Error('Failed to load Socket.IO client'));
        };

        document.head.appendChild(script);
    });
}

// Connect to backend
const ioClient = await loadSocketIO();

const socket = ioClient(ORIGIN);

export default socket;