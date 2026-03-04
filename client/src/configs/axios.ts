import axios from "axios";

const api = axios.create({
    // support either VITE_API_URL or VITE_BASEURL environment variable
    baseURL: import.meta.env.VITE_BASEURL || 'http://localhost:5000',
})

export default api