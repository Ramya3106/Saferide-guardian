import NetInfo from "@react-native-community/netinfo";

class NetworkService {
  constructor() {
    this.isConnected = true;
    this.listeners = [];
    this.unsubscribe = null;
  }

  // Initialize network monitoring
  async initialize() {
    try {
      const state = await NetInfo.fetch();
      this.isConnected = state?.isConnected ?? true;
      console.log("[Network] Initial state:", {
        connected: this.isConnected,
        type: state?.type,
      });

      // Subscribe to network state changes
      if (this.unsubscribe) {
        this.unsubscribe();
      }

      this.unsubscribe = NetInfo.addEventListener((state) => {
        const wasConnected = this.isConnected;
        this.isConnected = state?.isConnected ?? true;

        console.log("[Network] State changed:", {
          connected: this.isConnected,
          type: state?.type,
        });

        // Notify listeners of changes
        if (wasConnected !== this.isConnected) {
          this.notifyListeners(this.isConnected);
        }
      });
    } catch (error) {
      console.error("[Network] Initialization error:", error);
      this.isConnected = true;
    }
  }

  // Check if device is currently connected
  async isNetworkAvailable() {
    try {
      const state = await NetInfo.fetch();
      return state?.isConnected ?? this.isConnected;
    } catch (error) {
      console.error("[Network] Check error:", error);
      return this.isConnected;
    }
  }

  // Subscribe to network changes
  subscribe(callback) {
    this.listeners.push(callback);
    return () => {
      this.listeners = this.listeners.filter((cb) => cb !== callback);
    };
  }

  // Notify all listeners of network changes
  notifyListeners(isConnected) {
    this.listeners.forEach((callback) => {
      try {
        callback(isConnected);
      } catch (error) {
        console.error("[Network] Listener error:", error);
      }
    });
  }

  // Cleanup
  destroy() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    this.listeners = [];
  }
}

export default new NetworkService();
