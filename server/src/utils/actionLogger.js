const ActionLog = require("../models/ActionLog");

const logAction = async ({
  action,
  actorType = "SYSTEM",
  actorId = null,
  actorRole = null,
  entityType = null,
  entityId = null,
  complaintId = null,
  metadata = null,
}) => {
  try {
    await ActionLog.create({
      action,
      actorType,
      actorId,
      actorRole,
      entityType,
      entityId,
      complaintId,
      metadata,
    });
  } catch (error) {
    // Logging should never block primary business flow.
    console.error("Action log write failed:", error.message);
  }
};

module.exports = {
  logAction,
};
