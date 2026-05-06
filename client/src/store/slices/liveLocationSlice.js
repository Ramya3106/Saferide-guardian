import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  current: null,
  mode: "mock",
  status: "inactive",
  history: [],
};

const liveLocationSlice = createSlice({
  name: "liveLocation",
  initialState,
  reducers: {
    setLiveLocation: (state, action) => {
      state.current = action.payload || null;
      state.mode = action.payload?.mode || state.mode;
      state.status = action.payload ? "active" : "inactive";
      if (action.payload) {
        state.history.unshift({ ...action.payload, recordedAt: new Date().toISOString() });
        state.history = state.history.slice(0, 25);
      }
    },
    clearLiveLocation: () => initialState,
  },
});

export const { setLiveLocation, clearLiveLocation } = liveLocationSlice.actions;
export const selectLiveLocation = (state) => state.liveLocation;
export default liveLocationSlice.reducer;
