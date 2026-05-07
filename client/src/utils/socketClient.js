import io from "socket.io-client";
import { getApiBase } from "../../apiConfig";

let socket = null;

/**
 * Initialize socket connection
 * @param {string} serverUrl - The server URL
 * @param {object} options - Socket connection options
 * @returns {object} Socket instance
 */
export const initSocket = (serverUrl = getApiBase().replace(/\/api\/?$/, ""), options = {}) => {
  if (socket && socket.connected) {
    return socket;
  }

  socket = io(serverUrl, {
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    reconnectionAttempts: 5,
    ...options,
  });

  socket.on("connect", () => {
    console.log("Socket connected:", socket.id);
  });

  socket.on("disconnect", () => {
    console.log("Socket disconnected");
  });

  socket.on("error", (error) => {
    console.error("Socket error:", error);
  });

  return socket;
};

/**
 * Get socket instance
 * @returns {object} Socket instance
 */
export const getSocket = () => {
  if (!socket) {
    return initSocket();
  }
  return socket;
};

/**
 * Join a complaint room for real-time updates
 * @param {string} complaintId - The complaint ID
 */
export const joinComplaintRoom = (complaintId) => {
  if (!socket) {
    return;
  }
  socket.emit("join", `complaint:${complaintId}`);
};

/**
 * Leave a complaint room
 * @param {string} complaintId - The complaint ID
 */
export const leaveComplaintRoom = (complaintId) => {
  if (!socket) {
    return;
  }
  socket.emit("leave", `complaint:${complaintId}`);
};

/**
 * Join passenger room for real-time updates
 * @param {string} passengerId - The passenger ID
 */
export const joinPassengerRoom = (passengerId) => {
  if (!socket) {
    return;
  }
  socket.emit("join", `passenger:${passengerId}`);
};

/**
 * Join officer room for real-time updates
 * @param {string} officerId - The officer ID
 */
export const joinOfficerRoom = (officerId) => {
  if (!socket) {
    return;
  }
  socket.emit("join", `officer:${officerId}`);
};

/**
 * Listen for complaint status changes
 * @param {function} callback - Callback function
 */
export const onComplaintStatusChange = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:status-change", callback);
};

/**
 * Listen for complaint acceptance
 * @param {function} callback - Callback function
 */
export const onComplaintAccepted = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:accepted", callback);
};

/**
 * Listen for complaint replies
 * @param {function} callback - Callback function
 */
export const onComplaintReply = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:reply", callback);
};

/**
 * Listen for complaint escalation
 * @param {function} callback - Callback function
 */
export const onComplaintEscalation = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:escalation", callback);
};

/**
 * Listen for complaint resolution
 * @param {function} callback - Callback function
 */
export const onComplaintResolved = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:resolved", callback);
};

/**
 * Listen for complaint closure
 * @param {function} callback - Callback function
 */
export const onComplaintClosed = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:closed", callback);
};

/**
 * Listen for complaint reassignment
 * @param {function} callback - Callback function
 */
export const onComplaintReassigned = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:reassigned", callback);
};

/**
 * Listen for internal notes
 * @param {function} callback - Callback function
 */
export const onNoteAdded = (callback) => {
  if (!socket) {
    return;
  }
  socket.on("complaint:note-added", callback);
};

/**
 * Disconnect socket
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Emit custom event
 * @param {string} eventName - Event name
 * @param {object} data - Data to emit
 */
export const emitEvent = (eventName, data) => {
  if (!socket) {
    return;
  }
  socket.emit(eventName, data);
};

export default {
  initSocket,
  getSocket,
  joinComplaintRoom,
  leaveComplaintRoom,
  joinPassengerRoom,
  joinOfficerRoom,
  onComplaintStatusChange,
  onComplaintAccepted,
  onComplaintReply,
  onComplaintEscalation,
  onComplaintResolved,
  onComplaintClosed,
  onComplaintReassigned,
  onNoteAdded,
  disconnectSocket,
  emitEvent,
};
