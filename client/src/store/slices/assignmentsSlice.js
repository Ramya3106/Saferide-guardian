import { createSlice } from "@reduxjs/toolkit";

const initialState = {
  items: [],
  selectedAssignmentId: null,
  status: "idle",
};

const assignmentsSlice = createSlice({
  name: "assignments",
  initialState,
  reducers: {
    setAssignments: (state, action) => {
      state.items = Array.isArray(action.payload) ? action.payload : [];
    },
    setSelectedAssignment: (state, action) => {
      state.selectedAssignmentId = action.payload || null;
    },
    upsertAssignment: (state, action) => {
      const payload = action.payload;
      if (!payload?.id && !payload?._id) return;
      const assignmentId = payload.id || payload._id;
      const index = state.items.findIndex((item) => (item.id || item._id) === assignmentId);
      if (index === -1) {
        state.items.unshift({ ...payload, id: assignmentId });
      } else {
        state.items[index] = { ...state.items[index], ...payload, id: assignmentId };
      }
    },
    clearAssignments: (state) => {
      state.items = [];
      state.selectedAssignmentId = null;
      state.status = "idle";
    },
  },
});

export const { setAssignments, setSelectedAssignment, upsertAssignment, clearAssignments } = assignmentsSlice.actions;
export const selectAssignments = (state) => state.assignments;
export default assignmentsSlice.reducer;
