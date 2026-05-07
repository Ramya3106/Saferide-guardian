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

  // Broadcast train complaints to all on-duty officers in the relevant duty-unit rooms.
  // This is the Rapido/Uber-style push: every officer in the duty room gets the alert instantly.
  const transportType = payload?.complaint?.transportType;
  if (transportType === "train") {
    const TRAIN_DUTY_UNITS = ["TTR", "TTE", "RPF", "Police"];
    for (const unit of TRAIN_DUTY_UNITS) {
      ioInstance.to(`duty:${unit}`).emit(eventName, payload);
    }
  }

  return true;
};

module.exports = {
  setIo,
  getIo,
  emitSocketEvent,
};