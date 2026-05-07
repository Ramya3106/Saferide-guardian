import React, { useCallback, useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Text, TouchableOpacity, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import axios from "axios";
import { getApiBase } from "../../apiConfig";

const API_BASE = getApiBase();

const fmtTime = (value) => {
  if (!value) return "Pending";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Pending";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

export default function LiveTrackingPanel({
  complaintId,
  title = "Live Location Tracking",
  emptyMessage = "Live location will appear once staff shares it.",
}) {
  const [tracking, setTracking] = useState(null);
  const [loading, setLoading] = useState(false);

  const loadTracking = useCallback(async () => {
    if (!complaintId) {
      setTracking(null);
      return;
    }

    setLoading(true);
    try {
      const response = await axios.get(`${API_BASE}/complaints/${complaintId}/location`);
      setTracking(response.data?.data || response.data || null);
    } catch {
      setTracking(null);
    } finally {
      setLoading(false);
    }
  }, [complaintId]);

  useEffect(() => {
    loadTracking();
    if (!complaintId) {
      return undefined;
    }

    const timer = setInterval(loadTracking, 15000);
    return () => clearInterval(timer);
  }, [complaintId, loadTracking]);

  const officerLocations = useMemo(
    () => (Array.isArray(tracking?.officerLocations) ? tracking.officerLocations : []),
    [tracking],
  );
  const bestEstimate = useMemo(
    () => officerLocations.find((item) => item?.etaMin != null) || officerLocations[0] || null,
    [officerLocations],
  );
  const sharedLocation = tracking?.sharedLocation || null;
  const updatedAt =
    sharedLocation?.sharedAt ||
    sharedLocation?.timestamp ||
    bestEstimate?.recordedAt ||
    null;

  return (
    <View className="bg-white rounded-2xl p-4 mb-4 border border-slate-200">
      <View className="flex-row items-center justify-between mb-3">
        <View className="flex-row items-center gap-2 flex-1">
          <Ionicons name="locate" size={18} color="#2563EB" />
          <Text className="text-[15px] font-bold text-slate-900">{title}</Text>
        </View>
        <TouchableOpacity
          className="bg-blue-50 border border-blue-200 rounded-full px-3 py-1.5"
          onPress={loadTracking}
          disabled={loading}
        >
          {loading ? (
            <ActivityIndicator size="small" color="#2563EB" />
          ) : (
            <Text className="text-[11px] font-semibold text-blue-700">Refresh</Text>
          )}
        </TouchableOpacity>
      </View>

      <Text className="text-[12px] text-slate-500 mb-3">
        Status: {tracking?.status || "Submitted"} {tracking?.staffEta ? `• ETA ${tracking.staffEta}` : ""}
      </Text>

      {sharedLocation ? (
        <View className="bg-blue-50 rounded-xl border border-blue-100 px-3 py-3 mb-3">
          <Text className="text-[12px] font-bold text-blue-900">Latest shared location</Text>
          <Text className="text-[12px] text-blue-800 mt-1">
            {Number(sharedLocation.latitude).toFixed(4)}, {Number(sharedLocation.longitude).toFixed(4)}
          </Text>
          <Text className="text-[11px] text-blue-700 mt-1">Updated: {fmtTime(updatedAt)}</Text>
        </View>
      ) : null}

      {bestEstimate ? (
        <View className="bg-emerald-50 rounded-xl border border-emerald-100 px-3 py-3 mb-3">
          <Text className="text-[12px] font-bold text-emerald-900">
            Closest staff ETA: {bestEstimate.etaMin != null ? `${bestEstimate.etaMin} min` : "Tracking"}
          </Text>
          <Text className="text-[11px] text-emerald-700 mt-1">
            Distance: {bestEstimate.distanceKm != null ? `${bestEstimate.distanceKm.toFixed(1)} km` : "Unknown"}
          </Text>
        </View>
      ) : null}

      {tracking?.staffResponseStatus ? (
        <Text className="text-[12px] text-slate-700 mb-2">Officer update: {tracking.staffResponseStatus}</Text>
      ) : null}

      {!sharedLocation && !bestEstimate ? (
        <Text className="text-[12px] text-slate-500">{emptyMessage}</Text>
      ) : null}
    </View>
  );
}
