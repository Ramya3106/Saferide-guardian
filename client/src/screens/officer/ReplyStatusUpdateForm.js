import React, { useMemo, useState } from "react";
import { Pressable, Text, TextInput, View } from "react-native";

const STATUS_OPTIONS = [
  "Seen",
  "Acknowledged",
  "Item Being Checked",
  "Item Found",
  "Passenger Contacted",
  "Ready for Handover",
  "Closed",
];

const ReplyStatusUpdateForm = ({ complaint, onSubmitReply, onSubmitStatus, sending }) => {
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState("Item Being Checked");

  const canReply = useMemo(() => message.trim().length > 2 && complaint, [message, complaint]);
  const canUpdate = useMemo(() => status.trim().length > 0 && complaint, [status, complaint]);

  if (!complaint) {
    return (
      <View className="bg-white rounded-2xl p-4 gap-3 shadow-sm">
        <Text className="text-lg font-extrabold text-slate-900 tracking-tight">Reply / Status Update Form</Text>
        <Text className="text-xs text-slate-500">Select a complaint first.</Text>
      </View>
    );
  }

  return (
    <View className="bg-white rounded-2xl p-4 gap-3 shadow-sm">
      <Text className="text-lg font-extrabold text-slate-900 tracking-tight">Reply / Status Update Form</Text>
      <Text className="text-xs text-slate-500">Complaint: {complaint.id}</Text>

      <TextInput
        className="border border-slate-200 rounded-xl px-3 py-2.5 bg-slate-50 text-slate-900 text-sm min-h-[100px]"
        style={{ textAlignVertical: "top" }}
        value={message}
        onChangeText={setMessage}
        placeholder="Write reply for passenger"
        placeholderTextColor="#64748B"
        multiline
      />

      <View className="flex-row flex-wrap gap-2">
        {STATUS_OPTIONS.map((option) => {
          const selected = option === status;
          return (
            <Pressable
              key={option}
              onPress={() => setStatus(option)}
              className={`border rounded-full px-3 py-2 ${selected ? 'border-blue-500 bg-blue-50' : 'border-slate-200 bg-slate-50'}`}
            >
              <Text className={`text-xs ${selected ? 'text-blue-500 font-extrabold' : 'text-slate-500 font-semibold'}`}>{option}</Text>
            </Pressable>
          );
        })}
      </View>

      <View className="flex-row gap-2.5">
        <Pressable
          className={`flex-1 py-3 rounded-xl items-center shadow-sm ${(!canReply || sending) ? 'bg-slate-300' : 'bg-blue-500'}`}
          onPress={() => {
            if (!canReply || sending) return;
            onSubmitReply(message.trim(), status);
            setMessage("");
          }}
        >
          <Text className="text-white font-bold text-xs">{sending ? "Sending..." : "Send Reply"}</Text>
        </Pressable>

        <Pressable
          className={`flex-1 py-3 rounded-xl items-center shadow-sm ${(!canUpdate || sending) ? 'bg-slate-300' : 'bg-emerald-500'}`}
          onPress={() => {
            if (!canUpdate || sending) return;
            onSubmitStatus(status);
          }}
        >
          <Text className="text-white font-bold text-xs">{sending ? "Updating..." : "Update Status"}</Text>
        </Pressable>
      </View>
    </View>
  );
};

export default ReplyStatusUpdateForm;
