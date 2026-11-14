// Frontend runtime config.
// Leave empty when the backend serves this frontend (http://localhost:5000):
// the pages then talk to their own origin.
// Set it only if the frontend is hosted somewhere else (e.g. Netlify):
//   window.BACKEND_URL = 'https://your-backend.example.com';
window.BACKEND_URL = window.BACKEND_URL || '';
