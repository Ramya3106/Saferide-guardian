import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { acceptComplaint, fetchOfficerComplaints, updateComplaintAction } from "../../services/complaintService";

export const loadOfficerComplaints = createAsyncThunk(
  "complaints/loadOfficer",
  async ({ officerId, officerRole } = {}) => fetchOfficerComplaints({ officerId, officerRole }),
);

export const acceptComplaintThunk = createAsyncThunk(
  "complaints/accept",
  async ({ complaintId, payload, headers } = {}) => acceptComplaint(complaintId, payload, headers),
);

export const runComplaintAction = createAsyncThunk(
  "complaints/action",
  async ({ complaintId, actionPath, payload, headers } = {}) => updateComplaintAction(complaintId, actionPath, payload, headers),
);

const initialState = {
  items: [],
  selectedComplaintId: null,
  status: "idle",
  error: null,
  lastUpdatedAt: null,
};

const complaintsSlice = createSlice({
  name: "complaints",
  initialState,
  reducers: {
    setComplaints: (state, action) => {
      state.items = Array.isArray(action.payload) ? action.payload : [];
      state.lastUpdatedAt = new Date().toISOString();
    },
    upsertComplaint: (state, action) => {
      const payload = action.payload;
      if (!payload?.id && !payload?._id) return;
      const complaintId = payload.id || payload._id;
      const index = state.items.findIndex((item) => (item.id || item._id) === complaintId);
      if (index === -1) {
        state.items.unshift({ ...payload, id: complaintId });
      } else {
        state.items[index] = { ...state.items[index], ...payload, id: complaintId };
      }
      state.lastUpdatedAt = new Date().toISOString();
    },
    selectComplaint: (state, action) => {
      state.selectedComplaintId = action.payload || null;
    },
    clearComplaints: (state) => {
      state.items = [];
      state.selectedComplaintId = null;
      state.status = "idle";
      state.error = null;
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadOfficerComplaints.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadOfficerComplaints.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.items = Array.isArray(action.payload) ? action.payload : [];
        state.lastUpdatedAt = new Date().toISOString();
      })
      .addCase(loadOfficerComplaints.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Unable to load complaints";
      })
      .addCase(acceptComplaintThunk.fulfilled, (state, action) => {
        const payload = action.payload?.complaint || action.payload || {};
        const complaintId = payload.id || payload._id;
        const index = state.items.findIndex((item) => (item.id || item._id) === complaintId);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...payload, id: complaintId };
        }
      })
      .addCase(runComplaintAction.fulfilled, (state, action) => {
        const payload = action.payload?.complaint || action.payload || {};
        const complaintId = payload.id || payload._id;
        const index = state.items.findIndex((item) => (item.id || item._id) === complaintId);
        if (index !== -1) {
          state.items[index] = { ...state.items[index], ...payload, id: complaintId };
        }
      });
  },
});

export const { setComplaints, upsertComplaint, selectComplaint, clearComplaints } = complaintsSlice.actions;
export const selectComplaints = (state) => state.complaints;
export default complaintsSlice.reducer;
