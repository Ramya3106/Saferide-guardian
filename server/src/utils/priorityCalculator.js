/**
 * Priority Calculation Engine
 * Determines complaint priority based on multiple factors:
 * - Item value (amount and category)
 * - Security/theft suspicion
 * - Passenger vulnerability (age, gender, disability)
 * - Travel time (night travel risks)
 * - Specific risk indicators
 */

const PRIORITY_LEVELS = {
  LOW: "Low",
  NORMAL: "Normal",
  HIGH: "High",
  CRITICAL: "Critical",
};

/**
 * Calculate priority based on complaint data
 * @param {Object} complaintData - Complaint object or form data
 * @returns {Object} { priority, factors, score }
 */
function calculatePriority(complaintData) {
  if (!complaintData) {
    return {
      priority: PRIORITY_LEVELS.NORMAL,
      factors: {},
      score: 0,
    };
  }

  let priorityScore = 0;
  const factors = {};

  // ====== ITEM VALUE FACTOR (0-40 points) ======
  const itemValue = parseFloat(complaintData.itemValue) || 0;
  let valueCategory = "Low";

  if (itemValue > 0) {
    factors.itemValue = valueCategory;
    factors.itemValueAmount = itemValue;

    if (itemValue <= 500) {
      priorityScore += 5;
      valueCategory = "Low";
    } else if (itemValue <= 2000) {
      priorityScore += 15;
      valueCategory = "Medium";
    } else if (itemValue <= 10000) {
      priorityScore += 25;
      valueCategory = "High";
    } else {
      priorityScore += 40;
      valueCategory = "VeryHigh";
    }
    factors.itemValue = valueCategory;
  }

  // ====== SECURITY SUSPICION FACTOR (0-30 points) ======
  if (complaintData.securitySuspicion === true || 
      complaintData.securitySuspicion === "true" ||
      complaintData.suspiciousActivity === true) {
    priorityScore += 30;
    factors.securitySuspicion = true;
  } else {
    factors.securitySuspicion = false;
  }

  // ====== THEFT INDICATION FACTOR (0-25 points) ======
  if (complaintData.theftIndication === true || 
      complaintData.theftIndication === "true" ||
      complaintData.suspectedTheft === true) {
    priorityScore += 25;
    factors.theftIndication = true;
  } else {
    factors.theftIndication = false;
  }

  // ====== PASSENGER VULNERABILITY FACTOR (0-35 points) ======
  const passengerAge = parseFloat(complaintData.passengerAge);
  const passengerGender = String(complaintData.passengerGender || "").toLowerCase();
  const isDisabled = complaintData.passengerDisability === true || 
                     complaintData.passengerDisability === "true";

  let vulnerabilityType = "Adult";

  // Child (age < 12) - CRITICAL risk
  if (passengerAge > 0 && passengerAge < 12) {
    priorityScore += 35;
    vulnerabilityType = "Child";
  }
  // Senior (age > 60) - HIGH risk
  else if (passengerAge > 0 && passengerAge >= 60) {
    priorityScore += 25;
    vulnerabilityType = "Senior";
  }
  // Woman traveling - Moderate to high risk
  else if (passengerGender === "female" || passengerGender === "woman") {
    priorityScore += 15;
    vulnerabilityType = "Woman";
  }
  // PWD - Person with disability
  else if (isDisabled) {
    priorityScore += 20;
    vulnerabilityType = "PWD";
  }
  // Adult
  else {
    priorityScore += 0;
    vulnerabilityType = "Adult";
  }

  factors.passengerVulnerability = vulnerabilityType;

  // ====== NIGHT TRAVEL FACTOR (0-20 points) ======
  const travelHour = extractHourFromTime(complaintData.complaintTime || complaintData.timestamp);
  const isNightTravel = travelHour >= 22 || travelHour < 5; // 10 PM to 5 AM

  if (isNightTravel) {
    priorityScore += 20;
    factors.nightTravel = true;
  } else {
    factors.nightTravel = false;
  }

  // ====== ITEM TYPE RISK FACTOR (0-20 points) ======
  const itemType = String(complaintData.itemType || complaintData.lostItemType || "").toLowerCase();
  const highRiskItems = [
    "laptop",
    "mobile",
    "phone",
    "tablet",
    "passport",
    "id",
    "visa",
    "wallet",
    "jewelry",
    "camera",
    "electronics",
    "document",
    "government id",
    "credit card",
    "debit card",
    "money",
    "cash",
    "gold",
    "bag with valuables",
  ];

  if (highRiskItems.some((risk) => itemType.includes(risk))) {
    priorityScore += 15;
    factors.itemRisk = "High";
  } else {
    factors.itemRisk = "Normal";
  }

  // ====== COMPLAINT CHANNEL FACTOR (0-5 points) ======
  // If reported through official channel vs app
  if (complaintData.submitAuthority === "Police" ||
      complaintData.submitAuthority === "RPF") {
    priorityScore += 5;
  }

  // ====== DETERMINE PRIORITY LEVEL ======
  let priority;
  if (priorityScore >= 60) {
    priority = PRIORITY_LEVELS.CRITICAL;
  } else if (priorityScore >= 40) {
    priority = PRIORITY_LEVELS.HIGH;
  } else if (priorityScore >= 20) {
    priority = PRIORITY_LEVELS.NORMAL;
  } else {
    priority = PRIORITY_LEVELS.LOW;
  }

  factors.createdAt = new Date();

  return {
    priority,
    factors,
    score: priorityScore,
    breakdown: {
      itemValue: itemValue > 0 ? priorityScore - (priorityScore - factors.itemValueAmount ? 5 : 0) : 0,
      securitySuspicion: factors.securitySuspicion ? 30 : 0,
      theftIndication: factors.theftIndication ? 25 : 0,
      passengerVulnerability: getVulnerabilityScore(vulnerabilityType),
      nightTravel: factors.nightTravel ? 20 : 0,
      itemRisk: factors.itemRisk === "High" ? 15 : 0,
    },
  };
}

/**
 * Get vulnerability score based on type
 */
function getVulnerabilityScore(vulnerabilityType) {
  const scores = {
    Child: 35,
    Senior: 25,
    Woman: 15,
    PWD: 20,
    Adult: 0,
  };
  return scores[vulnerabilityType] || 0;
}

/**
 * Extract hour from time object or string
 */
function extractHourFromTime(timeData) {
  try {
    if (!timeData) return 12; // Default to noon

    let date;
    if (typeof timeData === "string") {
      date = new Date(timeData);
    } else if (timeData instanceof Date) {
      date = timeData;
    } else {
      return 12;
    }

    if (isNaN(date.getTime())) {
      return 12;
    }

    return date.getHours();
  } catch (error) {
    console.error("Error extracting hour from time:", error);
    return 12;
  }
}

/**
 * Get priority color for UI display
 */
function getPriorityColor(priority) {
  const colors = {
    [PRIORITY_LEVELS.LOW]: "#10B981", // Green
    [PRIORITY_LEVELS.NORMAL]: "#3B82F6", // Blue
    [PRIORITY_LEVELS.HIGH]: "#F59E0B", // Amber
    [PRIORITY_LEVELS.CRITICAL]: "#EF4444", // Red
  };
  return colors[priority] || colors[PRIORITY_LEVELS.NORMAL];
}

/**
 * Get priority badge icon
 */
function getPriorityIcon(priority) {
  const icons = {
    [PRIORITY_LEVELS.LOW]: "✓",
    [PRIORITY_LEVELS.NORMAL]: "●",
    [PRIORITY_LEVELS.HIGH]: "⚠",
    [PRIORITY_LEVELS.CRITICAL]: "🔴",
  };
  return icons[priority] || "●";
}

/**
 * Get priority label with styling
 */
function getPriorityLabel(priority) {
  const labels = {
    [PRIORITY_LEVELS.LOW]: "Low Priority",
    [PRIORITY_LEVELS.NORMAL]: "Normal Priority",
    [PRIORITY_LEVELS.HIGH]: "High Priority",
    [PRIORITY_LEVELS.CRITICAL]: "CRITICAL PRIORITY",
  };
  return labels[priority] || "Unknown";
}

/**
 * Sort complaints by priority (Critical first)
 */
function sortByPriority(complaints) {
  const priorityOrder = {
    [PRIORITY_LEVELS.CRITICAL]: 0,
    [PRIORITY_LEVELS.HIGH]: 1,
    [PRIORITY_LEVELS.NORMAL]: 2,
    [PRIORITY_LEVELS.LOW]: 3,
  };

  return complaints.sort((a, b) => {
    const priorityA = priorityOrder[a.priority] ?? 99;
    const priorityB = priorityOrder[b.priority] ?? 99;

    if (priorityA !== priorityB) {
      return priorityA - priorityB;
    }

    // Secondary sort: newer first
    const dateA = new Date(a.createdAt || a.timestamp).getTime();
    const dateB = new Date(b.createdAt || b.timestamp).getTime();
    return dateB - dateA;
  });
}

/**
 * Check if complaint should be auto-escalated
 * @param {Object} complaint - Complaint document
 * @param {Number} timeoutMs - Timeout in milliseconds (default 5 minutes)
 * @returns {Boolean} True if should escalate
 */
function shouldAutoEscalate(complaint, timeoutMs = 300000) {
  if (!complaint || complaint.autoEscalated || complaint.acceptedAt) {
    return false;
  }

  if (!complaint.autoEscalationTimer?.startedAt) {
    return false;
  }

  const timeElapsed =
    Date.now() - new Date(complaint.autoEscalationTimer.startedAt).getTime();
  return timeElapsed >= timeoutMs;
}

/**
 * Get reason for priority as human-readable string
 */
function getPriorityReason(factors) {
  if (!factors) return "No factors determined";

  const reasons = [];

  if (factors.securitySuspicion) {
    reasons.push("Security suspicion detected");
  }

  if (factors.theftIndication) {
    reasons.push("Possible theft indicated");
  }

  if (factors.itemValue && factors.itemValueAmount) {
    if (factors.itemValueAmount > 10000) {
      reasons.push("Very high value item (₹" + factors.itemValueAmount + ")");
    } else if (factors.itemValueAmount > 2000) {
      reasons.push("High value item (₹" + factors.itemValueAmount + ")");
    }
  }

  if (factors.passengerVulnerability && factors.passengerVulnerability !== "Adult") {
    reasons.push(
      `Vulnerable passenger: ${factors.passengerVulnerability}`
    );
  }

  if (factors.nightTravel) {
    reasons.push("Night travel (high-risk period)");
  }

  if (factors.itemRisk === "High") {
    reasons.push("High-risk item (electronics, documents, valuables)");
  }

  return reasons.length > 0
    ? reasons.join(", ")
    : "Standard priority assignment";
}

module.exports = {
  calculatePriority,
  getPriorityColor,
  getPriorityIcon,
  getPriorityLabel,
  sortByPriority,
  shouldAutoEscalate,
  getPriorityReason,
  PRIORITY_LEVELS,
};
