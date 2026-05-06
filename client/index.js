import React from "react";
import { registerRootComponent } from "expo";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import "./global.css";
import App from "./App";
import store from "./src/store";

const Root = () => (
  <Provider store={store}>
    <SafeAreaProvider>
      <App />
    </SafeAreaProvider>
  </Provider>
);

registerRootComponent(Root);
