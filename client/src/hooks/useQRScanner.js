import { useState, useCallback } from "react";

/**
 * Hook for managing QR code scanning
 * @returns {Object} Hook state and methods
 */
export const useQRScanner = () => {
  const [isScanning, setIsScanning] = useState(false);
  const [lastScannedData, setLastScannedData] = useState(null);
  const [scanHistory, setScanHistory] = useState([]);

  const handleScan = useCallback((data) => {
    if (!data) return;

    setLastScannedData(data);
    setScanHistory((prev) => [
      { data, timestamp: new Date().toISOString() },
      ...prev,
    ]);
  }, []);

  const clearHistory = useCallback(() => {
    setScanHistory([]);
    setLastScannedData(null);
  }, []);

  const removeFromHistory = useCallback((index) => {
    setScanHistory((prev) => prev.filter((_, i) => i !== index));
  }, []);

  return {
    isScanning,
    setIsScanning,
    lastScannedData,
    scanHistory,
    handleScan,
    clearHistory,
    removeFromHistory,
  };
};
