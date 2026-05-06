import { configureStore } from "@reduxjs/toolkit";
import authReducer from "./slices/authSlice";
import officerDutyReducer from "./slices/officerDutySlice";
import complaintsReducer from "./slices/complaintsSlice";
import notificationsReducer from "./slices/notificationsSlice";
import liveLocationReducer from "./slices/liveLocationSlice";
import chatReducer from "./slices/chatSlice";
import assignmentsReducer from "./slices/assignmentsSlice";

const store = configureStore({
  reducer: {
    auth: authReducer,
    officerDuty: officerDutyReducer,
    complaints: complaintsReducer,
    notifications: notificationsReducer,
    liveLocation: liveLocationReducer,
    chat: chatReducer,
    assignments: assignmentsReducer,
  },
});

export default store;
