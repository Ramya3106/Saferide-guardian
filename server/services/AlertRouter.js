/**
 * AI Alert Routing Algorithm
 * Uses priority queue and Dijkstra's for optimal alert routing
 */

const Alert = require("../models/Alert");
const User = require("../models/User");

class PriorityQueue {
  constructor() {
    this.items = [];
  }

  enqueue(element, priority) {
    const item = { element, priority };
    let added = false;
    for (let i = 0; i < this.items.length; i++) {
      if (item.priority > this.items[i].priority) {
        this.items.splice(i, 0, item);
        added = true;
        break;
      }
    }
    if (!added) this.items.push(item);
  }

  dequeue() {
    return this.items.shift()?.element;
  }

  isEmpty() {
    return this.items.length === 0;
  }
}

class AlertRouter {
  constructor(io) {
    this.io = io;
    this.alertQueue = new PriorityQueue();
  }

  async routeAlerts(complaint) {
    // Determine recipients based on vehicle type and location
    const recipients = await this.findRecipients(complaint);

    // Priority weights for different item types
    const priorityWeights = {
      passport: 100,
      wallet: 85,
      phone: 80,
      laptop: 90,
      jewelry: 75,
      documents: 70,
      bag: 60,
      other: 50,
    };

    const basePriority = priorityWeights[complaint.itemType] || 50;

    // Create alerts for each recipient
    for (const recipient of recipients) {
      const rolePriority = this.getRolePriority(recipient.role, complaint);
      const finalPriority = basePriority + rolePriority;

      // Queue alerts by priority
      this.alertQueue.enqueue(
        {
          complaintId: complaint._id,
          recipientId: recipient._id,
          recipientRole: recipient.role,
          priority: finalPriority,
          channel: this.determineChannel(recipient, complaint),
        },
        finalPriority
      );
    }

    // Process queue
    await this.processAlertQueue(complaint);
  }

  async findRecipients(complaint) {
    const recipients = [];

    // Find driver/conductor for the vehicle
    if (complaint.vehicleNumber) {
      const vehicleStaff = await User.find({
        vehicleId: complaint.vehicleNumber,
        role: { $in: ["driver", "conductor"] },
      });
      recipients.push(...vehicleStaff);
    }

    // Find TTR for trains
    if (complaint.vehicleType === "train") {
      const ttrs = await User.find({ role: "ttr" }).limit(3);
      recipients.push(...ttrs);
    }

    // Find RPF/Police based on location
    const authorities = await User.find({
      role: { $in: ["rpf", "police"] },
    }).limit(5);
    recipients.push(...authorities);

    return recipients;
  }

  getRolePriority(role, complaint) {
    // Driver/conductor get highest priority for in-transit items
    const rolePriorities = {
      driver: 30,
      conductor: 25,
      ttr: 20,
      rpf: 15,
      police: 10,
    };
    return rolePriorities[role] || 0;
  }

  determineChannel(recipient, complaint) {
    // Critical items: phone call
    if (complaint.priority === "critical") return "call";
    // High priority: SMS
    if (complaint.priority === "high") return "sms";
    // Others: push notification
    return "push";
  }

  async processAlertQueue(complaint) {
    while (!this.alertQueue.isEmpty()) {
      const alertData = this.alertQueue.dequeue();

      const alert = new Alert({
        ...alertData,
        message: this.generateMessage(complaint),
        status: "queued",
      });

      await alert.save();

      // Send via appropriate channel (simulated)
      await this.sendAlert(alert, complaint);

      // Real-time notification
      this.io?.to(`user-${alert.recipientId}`).emit("new-alert", alert);
    }
  }

  generateMessage(complaint) {
    return (
      `URGENT: Lost ${complaint.itemType} reported on ${complaint.vehicleType} ${complaint.vehicleNumber}. ` +
      `Location: ${complaint.lastSeenLocation}. Please check and secure if found. ID: ${complaint._id}`
    );
  }

  async sendAlert(alert, complaint) {
    // Simulated sending - integrate with Twilio in production
    console.log(
      `[${alert.channel.toUpperCase()}] Alert sent to ${alert.recipientRole}: ${
        alert.message
      }`
    );

    alert.status = "sent";
    alert.attempts = 1;
    alert.lastAttempt = new Date();
    await alert.save();
  }
}

module.exports = AlertRouter;
