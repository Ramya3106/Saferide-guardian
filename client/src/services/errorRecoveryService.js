/**
 * ErrorRecoveryService
 * Handles error recovery, retries, and fallback mechanisms
 */

class ErrorRecoveryService {
  constructor() {
    this.retryStrategies = {
      network: {
        maxRetries: 5,
        backoffMultiplier: 2,
        initialDelay: 1000,
      },
      server: {
        maxRetries: 3,
        backoffMultiplier: 1.5,
        initialDelay: 2000,
      },
      validation: {
        maxRetries: 0,
        backoffMultiplier: 1,
        initialDelay: 0,
      },
    };
  }

  /**
   * Execute function with automatic retry logic
   * @param {Function} fn - Function to execute
   * @param {string} errorType - Type of error (network, server, validation)
   * @param {Function} onRetry - Callback for retry attempts
   * @returns {Promise}
   */
  async executeWithRetry(fn, errorType = "network", onRetry) {
    const strategy = this.retryStrategies[errorType] || this.retryStrategies.network;
    let lastError;

    for (let attempt = 1; attempt <= strategy.maxRetries + 1; attempt++) {
      try {
        console.log(`[Recovery] Attempt ${attempt} of ${strategy.maxRetries + 1}`);
        return await fn();
      } catch (error) {
        lastError = error;

        if (attempt <= strategy.maxRetries) {
          const delay =
            strategy.initialDelay *
            Math.pow(strategy.backoffMultiplier, attempt - 1);

          console.warn(
            `[Recovery] Attempt ${attempt} failed. Retrying in ${delay}ms...`,
            error.message,
          );

          if (onRetry) {
            onRetry(attempt, error, delay);
          }

          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    console.error(
      `[Recovery] All retries failed (${strategy.maxRetries + 1} attempts)`,
    );
    throw lastError;
  }

  /**
   * Determine error type and provide recovery suggestion
   * @param {Error} error - The error object
   * @returns {Object} Recovery info
   */
  analyzeError(error) {
    let type = "unknown";
    let suggestion = "Please try again later.";
    let recoverable = false;

    if (!error.response) {
      // Network error
      type = "network";
      suggestion =
        "Check your internet connection and try again. The app will retry automatically.";
      recoverable = true;
    } else if (error.response.status >= 500) {
      // Server error
      type = "server";
      suggestion = "Server error. Please try again in a moment.";
      recoverable = true;
    } else if (error.response.status === 401) {
      // Auth error
      type = "authentication";
      suggestion = "Please log in again.";
      recoverable = true;
    } else if (error.response.status === 404) {
      // Not found
      type = "notFound";
      suggestion = "Resource not found. It may have been deleted.";
      recoverable = false;
    } else if (error.response.status >= 400) {
      // Validation/client error
      type = "validation";
      suggestion =
        error.response.data?.error || "Please check your input and try again.";
      recoverable = false;
    }

    return {
      type,
      suggestion,
      recoverable,
      originalError: error.message,
    };
  }

  /**
   * Create fallback response when primary operation fails
   * @param {string} operation - Type of operation
   * @param {any} defaultData - Default data to return
   * @returns {Object} Fallback response
   */
  createFallbackResponse(operation, defaultData) {
    console.log(`[Recovery] Using fallback for: ${operation}`);

    const fallbacks = {
      fetchComplaints: () => ({
        data: defaultData || [],
        cached: true,
        message: "Showing cached data. Connect to update.",
      }),
      fetchComplaint: () => ({
        data: defaultData || null,
        cached: true,
        message: "Cached data. Sync pending.",
      }),
      submitComplaint: () => ({
        queued: true,
        message: "Complaint queued. Will submit when connection restores.",
      }),
    };

    return (fallbacks[operation] || (() => ({ offline: true })))();
  }

  /**
   * Check if error is recoverable
   * @param {Error} error
   * @returns {boolean}
   */
  isRecoverable(error) {
    const analysis = this.analyzeError(error);
    return analysis.recoverable;
  }

  /**
   * Get user-friendly error message
   * @param {Error} error
   * @returns {string}
   */
  getUserMessage(error) {
    const analysis = this.analyzeError(error);
    return analysis.suggestion;
  }
}

export default new ErrorRecoveryService();
