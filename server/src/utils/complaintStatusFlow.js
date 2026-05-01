/**
 * Complaint Status Flow Definitions
 * Defines valid status transitions and complaint lifecycle states
 */

// Valid complaint statuses (mirrors Complaint model enum)
const COMPLAINT_STATUSES = {
  SUBMITTED: "Submitted",
  REPORTED: "Reported",
  STAFF_NOTIFIED: "Staff Notified",
  ACCEPTED: "Accepted",
  SEEN: "Seen",
  ACKNOWLEDGED: "Acknowledged",
  ITEM_BEING_CHECKED: "Item Being Checked",
  ITEM_FOUND: "Item Found",
  PASSENGER_CONTACTED: "Passenger Contacted",
  READY_FOR_HANDOVER: "Ready for Handover",
  FOUND: "Found",
  IN_VERIFICATION: "In verification",
  SECURED: "Secured",
  MEETING_SCHEDULED: "Meeting Scheduled",
  HANDED_OVER: "Handed over",
  RECOVERED: "Recovered",
  CLOSED: "Closed",
};

// Valid status transitions map
// key: fromStatus, value: array of allowed toStatuses
const VALID_TRANSITIONS = {
  [COMPLAINT_STATUSES.SUBMITTED]: [
    COMPLAINT_STATUSES.REPORTED,
    COMPLAINT_STATUSES.STAFF_NOTIFIED,
    COMPLAINT_STATUSES.ACCEPTED,
  ],
  [COMPLAINT_STATUSES.REPORTED]: [
    COMPLAINT_STATUSES.STAFF_NOTIFIED,
    COMPLAINT_STATUSES.ACCEPTED,
    COMPLAINT_STATUSES.SEEN,
  ],
  [COMPLAINT_STATUSES.STAFF_NOTIFIED]: [
    COMPLAINT_STATUSES.ACCEPTED,
    COMPLAINT_STATUSES.SEEN,
    COMPLAINT_STATUSES.ACKNOWLEDGED,
  ],
  [COMPLAINT_STATUSES.ACCEPTED]: [
    COMPLAINT_STATUSES.SEEN,
    COMPLAINT_STATUSES.ACKNOWLEDGED,
    COMPLAINT_STATUSES.ITEM_BEING_CHECKED,
  ],
  [COMPLAINT_STATUSES.SEEN]: [
    COMPLAINT_STATUSES.ACKNOWLEDGED,
    COMPLAINT_STATUSES.ITEM_BEING_CHECKED,
    COMPLAINT_STATUSES.IN_VERIFICATION,
  ],
  [COMPLAINT_STATUSES.ACKNOWLEDGED]: [
    COMPLAINT_STATUSES.ITEM_BEING_CHECKED,
    COMPLAINT_STATUSES.IN_VERIFICATION,
    COMPLAINT_STATUSES.SECURED,
  ],
  [COMPLAINT_STATUSES.ITEM_BEING_CHECKED]: [
    COMPLAINT_STATUSES.ITEM_FOUND,
    COMPLAINT_STATUSES.IN_VERIFICATION,
    COMPLAINT_STATUSES.SECURED,
  ],
  [COMPLAINT_STATUSES.ITEM_FOUND]: [
    COMPLAINT_STATUSES.PASSENGER_CONTACTED,
    COMPLAINT_STATUSES.MEETING_SCHEDULED,
    COMPLAINT_STATUSES.READY_FOR_HANDOVER,
  ],
  [COMPLAINT_STATUSES.IN_VERIFICATION]: [
    COMPLAINT_STATUSES.SECURED,
    COMPLAINT_STATUSES.FOUND,
  ],
  [COMPLAINT_STATUSES.SECURED]: [
    COMPLAINT_STATUSES.FOUND,
    COMPLAINT_STATUSES.PASSENGER_CONTACTED,
    COMPLAINT_STATUSES.MEETING_SCHEDULED,
  ],
  [COMPLAINT_STATUSES.PASSENGER_CONTACTED]: [
    COMPLAINT_STATUSES.MEETING_SCHEDULED,
    COMPLAINT_STATUSES.READY_FOR_HANDOVER,
  ],
  [COMPLAINT_STATUSES.FOUND]: [
    COMPLAINT_STATUSES.PASSENGER_CONTACTED,
    COMPLAINT_STATUSES.MEETING_SCHEDULED,
    COMPLAINT_STATUSES.READY_FOR_HANDOVER,
  ],
  [COMPLAINT_STATUSES.MEETING_SCHEDULED]: [
    COMPLAINT_STATUSES.READY_FOR_HANDOVER,
    COMPLAINT_STATUSES.HANDED_OVER,
  ],
  [COMPLAINT_STATUSES.READY_FOR_HANDOVER]: [
    COMPLAINT_STATUSES.HANDED_OVER,
    COMPLAINT_STATUSES.RECOVERED,
  ],
  [COMPLAINT_STATUSES.HANDED_OVER]: [
    COMPLAINT_STATUSES.RECOVERED,
    COMPLAINT_STATUSES.CLOSED,
  ],
  [COMPLAINT_STATUSES.RECOVERED]: [
    COMPLAINT_STATUSES.CLOSED,
  ],
  [COMPLAINT_STATUSES.CLOSED]: [], // Terminal state
};

/**
 * Check if a status transition is valid
 * @param {string} fromStatus - Current complaint status
 * @param {string} toStatus - Desired complaint status
 * @returns {boolean} - True if transition is valid
 */
const isValidStatusTransition = (fromStatus, toStatus) => {
  if (fromStatus === toStatus) {
    return true; // Idempotent: same status is always allowed
  }
  return (VALID_TRANSITIONS[fromStatus] || []).includes(toStatus);
};

/**
 * Get array of valid next statuses for current status
 * @param {string} currentStatus - Current complaint status
 * @returns {array} - Array of valid next statuses
 */
const getValidNextStatuses = (currentStatus) => {
  return VALID_TRANSITIONS[currentStatus] || [];
};

/**
 * Check if a complaint is in a terminal state (no further transitions possible)
 * @param {string} status - Complaint status
 * @returns {boolean} - True if status is terminal
 */
const isTerminalStatus = (status) => {
  return status === COMPLAINT_STATUSES.CLOSED;
};

/**
 * Check if a complaint is in an active state (still being handled)
 * @param {string} status - Complaint status
 * @returns {boolean} - True if status is active
 */
const isActiveStatus = (status) => {
  return !isTerminalStatus(status);
};

/**
 * Get human-readable status description
 * @param {string} status - Complaint status
 * @returns {string} - Readable description
 */
const getStatusDescription = (status) => {
  const descriptions = {
    [COMPLAINT_STATUSES.SUBMITTED]: "Complaint submitted, awaiting staff notification",
    [COMPLAINT_STATUSES.REPORTED]: "Complaint reported to authorities",
    [COMPLAINT_STATUSES.STAFF_NOTIFIED]: "Staff has been notified about the complaint",
    [COMPLAINT_STATUSES.ACCEPTED]: "Complaint accepted by duty officer",
    [COMPLAINT_STATUSES.SEEN]: "Officer has seen and reviewed the complaint",
    [COMPLAINT_STATUSES.ACKNOWLEDGED]: "Officer has acknowledged receipt of complaint",
    [COMPLAINT_STATUSES.ITEM_BEING_CHECKED]: "Item location is being verified",
    [COMPLAINT_STATUSES.ITEM_FOUND]: "Item has been located",
    [COMPLAINT_STATUSES.IN_VERIFICATION]: "Item identity is being verified",
    [COMPLAINT_STATUSES.SECURED]: "Item has been secured for handover",
    [COMPLAINT_STATUSES.PASSENGER_CONTACTED]: "Passenger has been contacted for confirmation",
    [COMPLAINT_STATUSES.FOUND]: "Item confirmed to be the lost item",
    [COMPLAINT_STATUSES.MEETING_SCHEDULED]: "Handover meeting scheduled with passenger",
    [COMPLAINT_STATUSES.READY_FOR_HANDOVER]: "Ready for handover at scheduled location/time",
    [COMPLAINT_STATUSES.HANDED_OVER]: "Item handed over to passenger",
    [COMPLAINT_STATUSES.RECOVERED]: "Complaint successfully resolved - item recovered",
    [COMPLAINT_STATUSES.CLOSED]: "Complaint closed - no further action required",
  };
  return descriptions[status] || "Unknown status";
};

module.exports = {
  COMPLAINT_STATUSES,
  VALID_TRANSITIONS,
  isValidStatusTransition,
  getValidNextStatuses,
  isTerminalStatus,
  isActiveStatus,
  getStatusDescription,
};
