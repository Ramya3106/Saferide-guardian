let ioInstance = null;

const setIo = (io) => {
  ioInstance = io || null;
  return ioInstance;
};

const getIo = () => ioInstance;

const emitSocketEvent = (eventName, payload = {}) => {
  if (!ioInstance || !eventName) {
    return false;
  }

  ioInstance.emit(eventName, payload);

  const complaintId = payload.complaintId || payload?.complaint?._id || payload?.complaint?.complaintId;
  if (complaintId) {
    ioInstance.to(`complaint:${complaintId}`).emit(eventName, payload);
  }

  const passengerId = payload.passengerId || payload?.complaint?.passengerId || payload?.complaint?.passengerEmail;
  if (passengerId) {
    ioInstance.to(`passenger:${passengerId}`).emit(eventName, payload);
  }

  const officerId = payload.officerId || payload?.complaint?.assignedOfficerId;
  if (officerId) {
    ioInstance.to(`officer:${officerId}`).emit(eventName, payload);
  }

  return true;
};

module.exports = {
  setIo,
  getIo,
  emitSocketEvent,
};