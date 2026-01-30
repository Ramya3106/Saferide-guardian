import axios from "axios";

const api = axios.create({
  baseURL: "http://10.144.132.242:5000/api", // Use your machine's IP
  timeout: 10000,
});

export default api;

