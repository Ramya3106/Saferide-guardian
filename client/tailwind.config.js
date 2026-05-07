/** @type {import('tailwindcss').Config} */
module.exports = {
  // Keep scanning focused on app source files to avoid parsing generated scripts.
  content: [
    "./App.{js,jsx,ts,tsx}",
    "./index.{js,jsx,ts,tsx}",
    "./PassengerDashboard.{js,jsx,ts,tsx}",
    "./CarAutoDashboard.{js,jsx,ts,tsx}",
    "./DriverConductorDashboard.{js,jsx,ts,tsx}",
    "./PasswordVerification.{js,jsx,ts,tsx}",
    "./src/**/*.{js,jsx,ts,tsx}",
  ],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {},
  },
  plugins: [],
};
