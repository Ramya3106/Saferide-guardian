/**
 * Auto-Escalation Service
 * Automatically escalates high-priority complaints if not accepted within timeout
 * Used for Critical and High priority complaints
 */

const Complaint = require("../models/Complaint");
const { shouldAutoEscalate } = require("../utils/priorityCalculator");
const { emitSocketEvent } = require("../utils/socket");
const { logAction } = require("../utils/actionLogger");
const { routeComplaintToActiveOfficers } = require("./complaintRoutingService");

/**
 * Check and escalate complaints that have exceeded timeout
 * Runs periodically (e.g., every 30 seconds for demo)
 */
async function checkAndEscalatePendingComplaints() {
  try {
    // Find Critical and High priority complaints that haven't been accepted
    const pendingHighPriorityComplaints = await Complaint.find({
      priority: { $in: ["Critical", "High"] },
      acceptedAt: null,
      autoEscalated: { $ne: true },
      status: { $nin: ["Recovered", "Closed"] },
      "autoEscalationTimer.startedAt": { $exists: true },
    }).exec();

    console.log(
      `🔍 Auto-escalation check: Found ${pendingHighPriorityComplaints.length} pending high-priority complaints`
    );

    for (const complaint of pendingHighPriorityComplaints) {
      const shouldEscalate = shouldAutoEscalate(
        complaint,
        complaint.autoEscalationTimer?.timeoutMs || 300000
      );

      if (shouldEscalate && !complaint.autoEscalated) {
        console.log(
          `🚨 Auto-escalating complaint ${complaint._id} (${complaint.priority})`
        );

        await escalateComplaint(complaint);
      }
    }
  } catch (error) {
    console.error("Error in auto-escalation check:", error);
  }
}

/**
 * Escalate a single complaint to higher authority
 */
async function escalateComplaint(complaint) {
  try {
    const now = new Date();

    // Determine escalation target based on current role
    let newEscalationLevel = complaint.escalationLevel || "TRAIN_LEVEL";
    let newRole = complaint.assignedRole;

    if (newEscalationLevel === "TRAIN_LEVEL" || !newEscalationLevel) {
      newEscalationLevel = "STATION_LEVEL";
      newRole = "RPF";
    } else if (newEscalationLevel === "STATION_LEVEL") {
      newEscalationLevel = "POLICE_LEVEL";
      newRole = "Police";
    }

    // Update complaint with escalation info
    complaint.autoEscalated = true;
    complaint.autoEscalatedAt = now;
    complaint.escalationLevel = newEscalationLevel;
    complaint.assignedRole = newRole;
    complaint.autoEscalationTimer.escalatedAt = now;

    // Add timeline entry
    complaint.messages.push({
      staffId: "SYSTEM",
      staffName: "AUTO-ESCALATION",
      text: `Complaint auto-escalated from ${
        complaint.assignedRole || "unassigned"
      } to ${newRole} (${newEscalationLevel}) due to no acceptance within timeout`,
      timestamp: now,
    });

    await complaint.save();

    // Route to higher authority officers
    const routingResult = await routeComplaintToActiveOfficers(
      complaint.toObject ? complaint.toObject() : complaint,
      true // Force escalation
    );

    // Emit escalation event
    emitSocketEvent("complaint:auto-escalated", {
      complaintId: String(complaint._id),
      complaint: complaint.toObject ? complaint.toObject() : complaint,
      previousRole: complaint.assignedRole,
      newRole,
      escalationLevel: newEscalationLevel,
      reason: "No acceptance within timeout period",
      notifiedOfficers: routingResult?.notifiedOfficers || [],
    });

    // Log escalation
    await logAction({
      action: "COMPLAINT_AUTO_ESCALATED",
      actorType: "SYSTEM",
      actorId: "AUTO_ESCALATION_ENGINE",
      entityType: "Complaint",
      entityId: String(complaint._id),
      complaintId: complaint.complaintId,
      metadata: {
        priority: complaint.priority,
        previousRole: complaint.assignedRole,
        newRole,
        escalationLevel: newEscalationLevel,
        timeToEscalate:
          now.getTime() -
          new Date(complaint.autoEscalationTimer?.startedAt).getTime(),
        notifiedOfficers: routingResult?.notifiedOfficers?.length || 0,
      },
    });

    console.log(
      `✅ Successfully escalated complaint ${complaint._id} to ${newRole} (${newEscalationLevel})`
    );

    return {
      success: true,
      complaintId: complaint._id,
      newRole,
      escalationLevel: newEscalationLevel,
      notifiedOfficers: routingResult?.notifiedOfficers || [],
    };
  } catch (error) {
    console.error("Error escalating complaint:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

/**
 * Start auto-escalation interval
 * Check every 30 seconds if any complaints need escalation
 */
let escalationIntervalId = null;

function startAutoEscalationService(checkIntervalMs = 30000) {
  if (escalationIntervalId) {
    console.log("⚠️ Auto-escalation service already running");
    return;
  }

  console.log(
    `🚀 Starting auto-escalation service (check every ${checkIntervalMs}ms)`
  );

  escalationIntervalId = setInterval(() => {
    checkAndEscalatePendingComplaints();
  }, checkIntervalMs);

  // Run immediately on startup
  checkAndEscalatePendingComplaints();
}

/**
 * Stop auto-escalation service
 */
function stopAutoEscalationService() {
  if (escalationIntervalId) {
    clearInterval(escalationIntervalId);
    escalationIntervalId = null;
    console.log("🛑 Auto-escalation service stopped");
  }
}

/**
 * Reset escalation timer for a complaint
 * Call this when complaint is accepted to prevent further escalation
 */
async function resetEscalationTimer(complaintId) {
  try {
    const complaint = await Complaint.findById(complaintId);
    if (complaint) {
      complaint.autoEscalationTimer = {
        timeoutMs: 300000,
        startedAt: new Date(),
      };
      await complaint.save();
      return true;
    }
    return false;
  } catch (error) {
    console.error("Error resetting escalation timer:", error);
    return false;
  }
}

module.exports = {
  checkAndEscalatePendingComplaints,
  escalateComplaint,
  startAutoEscalationService,
  stopAutoEscalationService,
  resetEscalationTimer,
};
