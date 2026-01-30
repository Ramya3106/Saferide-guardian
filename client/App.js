import React from "react";
import { NavigationContainer } from "@react-navigation/native";
import { createNativeStackNavigator } from "@react-navigation/native-stack";
import { createBottomTabNavigator } from "@react-navigation/bottom-tabs";
import { AuthProvider, useAuth } from "./src/context/AuthContext";
import { Text, View, StyleSheet } from "react-native";
// import * as Linking from "expo-linking"; // Disabled for Expo Go compatibility

// Screens
import LoginScreen from "./src/screens/LoginScreen";
import RegisterScreen from "./src/screens/RegisterScreen";
import HomeScreen from "./src/screens/HomeScreen";
import ReportScreen from "./src/screens/ReportScreen";
import MyComplaintsScreen from "./src/screens/MyComplaintsScreen";
import ComplaintDetailScreen from "./src/screens/ComplaintDetailScreen";
import AlertsScreen from "./src/screens/AlertsScreen";
import ProfileScreen from "./src/screens/ProfileScreen";
import QRCodeScannerScreen from "./src/screens/QRCodeScannerScreen";

// Components
import FastNavigationPanel from "./src/components/FastNavigationPanel";

const Stack = createNativeStackNavigator();
const Tab = createBottomTabNavigator();

// Linking config disabled for Expo Go - enable when using dev client
// const linking = {
//   prefixes: [Linking.createURL("/"), "saferide://"],
//   config: {
//     screens: {
//       Login: "login",
//       Register: "register",
//       Main: {
//         screens: {
//           Home: "home",
//           Report: "report",
//           MyComplaints: "my-complaints",
//           Alerts: "alerts",
//           Profile: "profile",
//         },
//       },
//       ComplaintDetail: "complaint/:id",
//     },
//   },
// };

function MainTabs() {
  const { user } = useAuth();
  const isStaff = ["driver", "conductor", "ttr", "rpf", "police"].includes(
    user?.role,
  );

  return (
    <>
      <FastNavigationPanel navigation={null} userRole={user?.role} />
      <Tab.Navigator
        screenOptions={{
          tabBarStyle: { backgroundColor: "#112240", borderTopColor: "#233554" },
          tabBarActiveTintColor: "#64ffda",
          tabBarInactiveTintColor: "#8892b0",
          headerStyle: { backgroundColor: "#112240" },
          headerTintColor: "#ccd6f6",
        }}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ tabBarLabel: "Home", tabBarIcon: () => <Text>🏠</Text> }}
        />
        <Tab.Screen
          name="Report"
          component={ReportScreen}
          options={{ tabBarLabel: "Report", tabBarIcon: () => <Text>📝</Text> }}
        />
        <Tab.Screen
          name="MyComplaints"
          component={MyComplaintsScreen}
          options={{ tabBarLabel: "My Items", tabBarIcon: () => <Text>📦</Text> }}
        />
        {isStaff && (
          <Tab.Screen
            name="Alerts"
            component={AlertsScreen}
            options={{ tabBarLabel: "Alerts", tabBarIcon: () => <Text>🔔</Text> }}
          />
        )}
        <Tab.Screen
          name="Profile"
          component={ProfileScreen}
          options={{ tabBarLabel: "Profile", tabBarIcon: () => <Text>👤</Text> }}
        />
      </Tab.Navigator>
    </>
  );
}

function AppNavigator() {
  const { user, loading } = useAuth();

  if (loading) {
    return null;
  }

  return (
    <Stack.Navigator screenOptions={{ headerShown: false }}>
      {!user ? (
        <>
          <Stack.Screen name="Login" component={LoginScreen} />
          <Stack.Screen name="Register" component={RegisterScreen} />
        </>
      ) : (
        <>
          <Stack.Screen name="Main" component={MainTabs} />
          <Stack.Screen
            name="ComplaintDetail"
            component={ComplaintDetailScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: "#112240" },
              headerTintColor: "#ccd6f6",
              title: "Complaint Details",
            }}
          />
          <Stack.Screen
            name="QRCodeScanner"
            component={QRCodeScannerScreen}
            options={{
              headerShown: true,
              headerStyle: { backgroundColor: "#000" },
              headerTintColor: "#fff",
              title: "Scan QR Code",
            }}
          />
        </>
      )}
    </Stack.Navigator>
  );
}

export default function App() {
  const [error, setError] = React.useState(null);

  React.useEffect(() => {
    const errorHandler = (error, isFatal) => {
      console.error("Global error:", error);
      if (isFatal) {
        setError(error.message || "An error occurred");
      }
    };

    return () => {};
  }, []);

  if (error) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorTitle}>App Error</Text>
        <Text style={styles.errorMessage}>{error}</Text>
        <Text style={styles.errorHint}>Please restart the app</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <NavigationContainer fallback={<Text>Loading...</Text>}>
        <AppNavigator />
      </NavigationContainer>
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    flex: 1,
    backgroundColor: "#0f0f23",
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  errorTitle: {
    color: "#e94560",
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 10,
  },
  errorMessage: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
    marginBottom: 10,
  },
  errorHint: {
    color: "#8b8b8b",
    fontSize: 14,
  },
});
