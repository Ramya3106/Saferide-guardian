import NetInfo from "@react-native-community/netinfo";

class NetworkService {
  constructor() {
    this.isConnected = true;
    this.listeners = [];
  }

  // Initialize network monitoring
  async initialize() {
    try {
      const state = await NetInfo.fetch();
      this.isConnected = state.isConnected;
      console.log("[Network] Initial state:", state);

      // Subscribe to network state changes
      this.unsubscribe = NetInfo.addEventListener((state) => {
        const wasConnected = this.isConnected;
        this.isConnected = state.isConnected;

        console.log("[Network] State changed:", {
          isConnected: state.isConnected,
          type: state.type,
          details: state.details,
        });

        // Notify listeners of changes
        if (wasConnected !== state.isConnected) {
          this.notifyListeners(state.isConnected);
        }
      });
    } catch (error) {
      console.error("[Network] Initialization error:", error);
    }
  }

  // Check if device is currently connected
  async isNetworkAvailable() {
    try {
      const state = await NetInfo.fetch();
      return state.isConnected;
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
    }
    this.listeners = [];
  }
}

export default new NetworkService();
