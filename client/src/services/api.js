import axios from "axios";

const api = axios.create({
  baseURL: "http://192.168.1.5:5000/api", // Use your machine's IP
  timeout: 10000,
});

export default api;

