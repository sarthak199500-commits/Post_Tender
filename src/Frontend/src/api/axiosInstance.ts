import axios from 'axios';
import { getToken } from './authStorage';

// YARP API Gateway URL. Override with VITE_API_URL in a .env file if needed.
// All gateway routes are published under "/api" (see PostTenderSystem.Gateway
// appsettings.json), so every relative call site in this app omits that
// prefix and relies on it being added here.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5249';

// Gateway host without the /api prefix — for static file links (uploads, media)
// that are hrefs rather than API calls.
export const GATEWAY_BASE = BASE_URL;

const axiosInstance = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to attach the JWT token to every request
axiosInstance.interceptors.request.use(
    (config) => {
        // Reads both stores — "Remember Me" decides which one holds the session.
        const token = getToken();
        if (token) {
            config.headers.Authorization = `Bearer ${token}`;
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

export default axiosInstance;
