import React from "react";
import { Pressable, Text, TextInput, View } from "react-native";

const DutyStatusCard = ({
  onDuty,
  syncing,
  dutyTrain,
  dutyRoute,
  dutyStation,
  dutyShift,
  onChangeTrain,
  onChangeRoute,
  onChangeStation,
  onChangeShift,
  onCheckIn,
  onCheckOut,
  attendance,
}) => {
  return (
    <View className="bg-white rounded-2xl p-4 gap-3 shadow-md border-0 border-slate-300">
      <View className="flex-row justify-between items-center">
        <Text className="text-lg font-extrabold text-slate-900 tracking-tight">Duty Status</Text>
        <Text className={`px-3 py-1.5 rounded-full text-[11px] font-bold tracking-wider ${onDuty ? 'bg-emerald-100 text-emerald-800' : 'bg-red-100 text-red-900'}`}>
          {onDuty ? "ON DUTY" : "OFF DUTY"}
        </Text>
      </View>

      <View className="gap-2.5">
        <TextInput
          className="border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 text-sm font-medium shadow-sm"
          placeholder="Enter assigned train number"
          placeholderTextColor="#64748B"
          value={dutyTrain}
          onChangeText={onChangeTrain}
        />
        <TextInput
          className="border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 text-sm font-medium shadow-sm"
          placeholder="Enter assigned route"
          placeholderTextColor="#64748B"
          value={dutyRoute}
          onChangeText={onChangeRoute}
        />
        <TextInput
          className="border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 text-sm font-medium shadow-sm"
          placeholder="Enter assigned station"
          placeholderTextColor="#64748B"
          value={dutyStation}
          onChangeText={onChangeStation}
        />
        <TextInput
          className="border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 text-sm font-medium shadow-sm"
          placeholder="Enter duty shift time"
          placeholderTextColor="#64748B"
          value={dutyShift}
          onChangeText={onChangeShift}
        />
      </View>

      <View className="flex-row gap-2.5">
        {(() => {
          const checkInDisabled = Boolean(syncing) || Boolean(onDuty);
          const checkOutDisabled = Boolean(syncing) || !Boolean(onDuty);
          return (
            <>
              <Pressable
                className={`flex-1 py-3 rounded-xl items-center shadow-sm ${checkInDisabled ? 'bg-slate-300 shadow-none' : 'bg-emerald-500 active:shadow-md active:opacity-90'}`}
                disabled={checkInDisabled}
                accessibilityState={{ disabled: checkInDisabled }}
                onPress={onCheckIn}
              >
                <Text className={`font-extrabold text-sm tracking-wide ${checkInDisabled ? 'text-slate-400' : 'text-white'}`}>
                  Check-In
                </Text>
              </Pressable>

              <Pressable
                className={`flex-1 py-3 rounded-xl items-center shadow-sm ${checkOutDisabled ? 'bg-slate-300 shadow-none' : 'bg-red-500 active:shadow-md active:opacity-90'}`}
                disabled={checkOutDisabled}
                accessibilityState={{ disabled: checkOutDisabled }}
                onPress={onCheckOut}
              >
                <Text className={`font-extrabold text-sm tracking-wide ${checkOutDisabled ? 'text-slate-400' : 'text-white'}`}>
                  Check-Out
                </Text>
              </Pressable>
            </>
          );
        })()}
      </View>

      <Text className="text-xs text-slate-500 leading-relaxed">Session: {attendance?.status || (onDuty ? "ACTIVE" : "INACTIVE")}</Text>
      <Text className="text-xs text-slate-500 leading-relaxed">
        In: {attendance?.checkInTime ? new Date(attendance.checkInTime).toLocaleString() : "--"}
      </Text>
      <Text className="text-xs text-slate-500 leading-relaxed">
        Out: {attendance?.checkOutTime ? new Date(attendance.checkOutTime).toLocaleString() : "--"}
      </Text>
    </View>
  );
};

export default DutyStatusCard;
