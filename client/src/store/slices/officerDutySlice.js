import { createAsyncThunk, createSlice } from "@reduxjs/toolkit";
import { fetchDutyRoster, fetchDutyStatus, updateDutyStatus } from "../../services/complaintService";

export const loadOfficerDuty = createAsyncThunk("officerDuty/load", async ({ email, professionalId } = {}) => {
  const attendance = await fetchDutyStatus({ email, professionalId });
  return attendance;
});

export const loadDutyRoster = createAsyncThunk("officerDuty/roster", async () => {
  return fetchDutyRoster();
});

export const syncOfficerDuty = createAsyncThunk("officerDuty/sync", async (payload) => {
  return updateDutyStatus(payload);
});

const initialState = {
  attendance: null,
  roster: [],
  status: "idle",
  error: null,
  onDuty: false,
};

const officerDutySlice = createSlice({
  name: "officerDuty",
  initialState,
  reducers: {
    setDutyAttendance: (state, action) => {
      state.attendance = action.payload || null;
      state.onDuty = Boolean(action.payload?.onDuty || action.payload?.status === "ACTIVE");
    },
    setOnDuty: (state, action) => {
      state.onDuty = Boolean(action.payload);
    },
    clearDutyState: () => initialState,
  },
  extraReducers: (builder) => {
    builder
      .addCase(loadOfficerDuty.pending, (state) => {
        state.status = "loading";
        state.error = null;
      })
      .addCase(loadOfficerDuty.fulfilled, (state, action) => {
        state.status = "succeeded";
        state.attendance = action.payload || null;
        state.onDuty = Boolean(action.payload?.onDuty || action.payload?.status === "ACTIVE");
      })
      .addCase(loadOfficerDuty.rejected, (state, action) => {
        state.status = "failed";
        state.error = action.error?.message || "Unable to load duty status";
      })
      .addCase(loadDutyRoster.fulfilled, (state, action) => {
        state.roster = Array.isArray(action.payload) ? action.payload : [];
      })
      .addCase(syncOfficerDuty.fulfilled, (state, action) => {
        state.attendance = action.payload?.attendance || state.attendance;
        state.onDuty = Boolean(action.payload?.onDuty ?? state.onDuty);
      });
  },
});

export const { setDutyAttendance, setOnDuty, clearDutyState } = officerDutySlice.actions;
export const selectOfficerDuty = (state) => state.officerDuty;
export default officerDutySlice.reducer;
