import apiClient from "./apiClient";

export const fetchOfficerComplaints = async ({ officerId, officerRole }) => {
  const response = await apiClient.get(`/complaints/officer/${officerId}`, {
    headers: {
      "X-Duty-Unit": officerRole || "TTR",
    },
  });
  return response.data?.complaints || response.data?.data || response.data || [];
};

export const fetchPassengerAlerts = async ({ staffRole }) => {
  const response = await apiClient.get(`/passenger/live-alerts`, {
    params: { staffRole },
  });
  return response.data?.alerts || response.data?.data?.alerts || [];
};

export const acceptComplaint = async (complaintId, payload = {}, headers = {}) => {
  const response = await apiClient.patch(`/complaints/${complaintId}/staff/accept`, payload, { headers });
  return response.data;
};

export const updateComplaintStatus = async (complaintId, status, payload = {}, headers = {}) => {
  const response = await apiClient.patch(`/complaints/${complaintId}/staff/status`, { status, ...payload }, { headers });
  return response.data;
};

export const updateComplaintReply = async (complaintId, payload = {}, headers = {}) => {
  const response = await apiClient.post(`/complaints/${complaintId}/staff/respond`, payload, { headers });
  return response.data;
};

export const updateComplaintAction = async (complaintId, actionPath, payload = {}, headers = {}) => {
  const method = actionPath === "/respond" ? "post" : "patch";
  const response = await apiClient({
    method,
    url: `/complaints/${complaintId}/staff${actionPath}`,
    data: payload,
    headers,
  });
  return response.data;
};

export const sendPassengerMessage = async (complaintId, text, headers = {}) => {
  const response = await apiClient.post(`/passenger/messages/${complaintId}`, { text }, { headers });
  return response.data;
};

export const fetchDutyStatus = async ({ email, professionalId }) => {
  const response = await apiClient.get(`/auth/duty/status`, {
    params: { email, professionalId },
  });
  return response.data?.attendance || response.data?.data?.attendance || response.data || null;
};

export const updateDutyStatus = async ({ nextOnDuty, email, professionalId, dutyUnit, payload = {}, headers = {} }) => {
  const endpoint = nextOnDuty ? "/auth/duty/check-in" : "/auth/duty/check-out";
  const response = await apiClient.post(endpoint, {
    email,
    professionalId,
    dutyUnit,
    ...payload,
  }, { headers });
  return response.data;
};

export const updateLiveLocation = async (payload = {}, headers = {}) => {
  const response = await apiClient.post(`/auth/duty/location`, payload, { headers });
  return response.data;
};

export const fetchDutyRoster = async () => {
  const response = await apiClient.get(`/auth/duty/roster`);
  return response.data?.officers || response.data?.data?.officers || [];
};
