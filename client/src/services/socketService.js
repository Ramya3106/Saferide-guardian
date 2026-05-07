import { initSocket, getSocket, disconnectSocket } from "../utils/socketClient";

export const socketService = {
  connect: (serverUrl, options = {}) => initSocket(serverUrl, options),
  get: () => getSocket(),
  disconnect: () => disconnectSocket(),
  joinComplaint: (complaintId) => getSocket()?.emit("join", `complaint:${complaintId}`),
  leaveComplaint: (complaintId) => getSocket()?.emit("leave", `complaint:${complaintId}`),
  joinPassenger: (passengerId) => getSocket()?.emit("join", `passenger:${passengerId}`),
  joinOfficer: (officerId) => getSocket()?.emit("join", `officer:${officerId}`),
  leaveOfficer: (officerId) => getSocket()?.emit("leave", `officer:${officerId}`),
  // Join the duty-unit broadcast room so all on-duty officers of the same unit
  // receive new train complaints instantly (Rapido/Uber-style pool dispatch)
  joinDuty: (dutyUnit) => getSocket()?.emit("join:duty", dutyUnit),
  leaveDuty: (dutyUnit) => getSocket()?.emit("leave:duty", dutyUnit),
  on: (eventName, callback) => getSocket()?.on(eventName, callback),
  off: (eventName, callback) => getSocket()?.off(eventName, callback),
  emit: (eventName, payload) => getSocket()?.emit(eventName, payload),
};

export default socketService;
