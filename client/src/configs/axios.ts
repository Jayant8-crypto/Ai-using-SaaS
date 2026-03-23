import axios from "axios";

const api = axios.create({
    baseURL: import.meta.env.VITE_BASEURL || 'http://localhost:5000',
    timeout: 130000, // 130s - matches server 120s timeout
})

export default api