import axios from 'axios';

const getApiBaseUrl = () => {
    const configuredUrl = import.meta.env.VITE_API_URL;
    if (configuredUrl) return configuredUrl;

    const { protocol, hostname } = window.location;
    const isLocalHost = ['localhost', '127.0.0.1', '0.0.0.0'].includes(hostname);
    const isPrivateNetwork =
        /^10\./.test(hostname) ||
        /^192\.168\./.test(hostname) ||
        /^172\.(1[6-9]|2\d|3[0-1])\./.test(hostname);

    if (isLocalHost || isPrivateNetwork) {
        return `${protocol}//${hostname === '0.0.0.0' ? 'localhost' : hostname}:4000/api`;
    }

    return 'https://campuscore-5thv.onrender.com/api';
};

// Create an Axios instance with a base URL
const api = axios.create({
    baseURL: getApiBaseUrl(),
    headers: {
        'Content-Type': 'application/json',
    },
});

// Add a request interceptor (optional, good for debugging or auth tokens)
api.interceptors.request.use(
    (config) => {
        const publicAuthPaths = [
            '/auth/login',
            '/auth/register-company-admin',
            '/auth/institutions-public',
            '/auth/batches-public'
        ];
        const isPublicAuthRequest = publicAuthPaths.some(path =>
            String(config.url || '').startsWith(path)
        );

        if (isPublicAuthRequest) {
            return config;
        }

        const token = localStorage.getItem('token');
        if (token) {
            config.headers['x-auth-token'] = token;
        }

        // Check if Company Admin is "viewing" a specific college
        const viewingId = localStorage.getItem('viewingInstitutionId');
        if (viewingId) {
            config.headers['x-institution-id'] = viewingId;
        } else {
            // Get institution from logged-in user details
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    if (user.institutionId) {
                        config.headers['x-institution-id'] = user.institutionId;
                    }
                } catch (e) {
                    console.error('Error parsing user from localStorage', e);
                }
            } else {
                const envId = import.meta.env.VITE_INSTITUTION_ID;
                if (envId) {
                    config.headers['x-institution-id'] = envId;
                }
            }
        }
        return config;
    },
    (error) => {
        return Promise.reject(error);
    }
);

api.interceptors.response.use(
    (response) => {
        return response;
    },
    (error) => {
        const publicAuthPaths = [
            '/auth/login',
            '/auth/register-company-admin',
            '/auth/institutions-public',
            '/auth/batches-public'
        ];
        const isPublicAuthRequest = publicAuthPaths.some(path =>
            String(error.config?.url || '').startsWith(path)
        );

        // Handle common errors (401, 403, 500) centrally if needed
        if (error.response && error.response.status === 401 && !isPublicAuthRequest) {
            console.error('Unauthorized - Token expired or invalid. Logging out.');
            localStorage.removeItem('token');
            localStorage.removeItem('user');
            localStorage.removeItem('viewingInstitutionId');
            localStorage.removeItem('viewingInstitutionName');
            window.location.reload();
        } else if (error.response && error.response.status === 403 && error.response.data && error.response.data.profileCompleted === false) {
            console.error('Forbidden - Profile completion required.');
            const userStr = localStorage.getItem('user');
            if (userStr) {
                try {
                    const user = JSON.parse(userStr);
                    user.profileCompleted = false;
                    localStorage.setItem('user', JSON.stringify(user));
                } catch (e) {
                    console.error('Error updating profileCompleted on 403', e);
                }
            }
            window.location.reload();
        } else if (error.code === 'ERR_NETWORK') {
            console.error('Network Error: Server might be down or CORS issue.');
        }
        return Promise.reject(error);
    }
);

export default api;
