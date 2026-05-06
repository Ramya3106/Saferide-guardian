import React from "react";
import { ScrollView, Text, View } from "react-native";

const DutyHistoryScreen = ({ history }) => {
  return (
    <View className="gap-3">
      <Text className="text-lg font-extrabold text-slate-900 tracking-tight">Duty History Screen</Text>
      <ScrollView contentContainerStyle={{ gap: 10, paddingBottom: 12 }}>
        {history.length === 0 ? (
          <View className="p-4 bg-slate-50 border border-slate-200 rounded-2xl">
            <Text className="text-slate-500 text-sm">No duty attendance history available.</Text>
          </View>
        ) : (
          history.map((entry, index) => (
            <View key={entry._id || `${entry.checkInTime}-${index}`} className="bg-white rounded-2xl p-3.5 gap-1.5 shadow-sm">
              <Text className="text-slate-500 text-xs font-medium">Status: {entry.dutyStatus || entry.status || "INACTIVE"}</Text>
              <Text className="text-slate-500 text-xs font-medium">Train: {entry.assignedTrain || "--"}</Text>
              <Text className="text-slate-500 text-xs font-medium">Route: {entry.assignedRoute || "--"}</Text>
              <Text className="text-slate-500 text-xs font-medium">Station: {entry.assignedStation || "--"}</Text>
              <Text className="text-slate-500 text-xs font-medium">Check-In: {entry.checkInTime ? new Date(entry.checkInTime).toLocaleString() : "--"}</Text>
              <Text className="text-slate-500 text-xs font-medium">Check-Out: {entry.checkOutTime ? new Date(entry.checkOutTime).toLocaleString() : "--"}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
};

export default DutyHistoryScreen;
