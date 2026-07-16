import axios from 'axios';

// YARP API Gateway URL. Override with VITE_API_URL in a .env file if needed.
// All gateway routes are published under "/api" (see PostTenderSystem.Gateway
// appsettings.json), so every relative call site in this app omits that
// prefix and relies on it being added here.
const BASE_URL = import.meta.env.VITE_API_URL ?? 'http://localhost:5249';

const axiosInstance = axios.create({
    baseURL: `${BASE_URL}/api`,
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor to attach the JWT token to every request
axiosInstance.interceptors.request.use(
    (config) => {
        const token = localStorage.getItem('token');
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
