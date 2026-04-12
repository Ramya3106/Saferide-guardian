# SafeRide Guardian Project Plan

## Project Flow
- Client app starts in the login/register screen.
- User signs up or logs in with email and password.
- OTP is sent to email for verification.
- After login, the user goes to the correct dashboard.
- Passenger, driver, and officer actions are handled from their dashboard screens.
- Server stores user data, login checks, OTP codes, and complaint data.

## Tech Stack
- Frontend: React Native with Expo.
- Backend: Node.js with Express.
- Database: MongoDB with Mongoose.
- Email: Nodemailer for OTP and reset messages.
- Other tools: Axios, bcryptjs, cors, socket.io, qrcode, multer.

## Important Files
- .env: hidden details like database URL, email password, and API secrets.
- package.json: project dependencies and scripts.
- client/App.js: main login, register, OTP, and dashboard flow.
- client/PassengerDashboard.js: passenger complaint and recovery screen.
- client/DriverConductorDashboard.js: driver and conductor screen.
- client/CarAutoDashboard.js: cab and auto driver screen.
- client/PasswordVerification.js: password strength helper for the UI.
- client/apiConfig.js: API base URL setup for the client.
- server/src/index.js: server startup and database connection.
- server/src/app.js: Express app setup and route mounting.
- server/src/routes/auth.js: register, login, OTP, and password reset logic.
- server/src/routes/passenger.js: passenger-related API routes.
- server/src/routes/health.js: backend health check.
- server/src/config/db.js: MongoDB connection setup.
- server/src/models/User.js: user data schema.
- server/src/models/Journey.js: journey details schema.
- server/src/models/Complaint.js: complaint data schema.

## Where Each Part Is Stored
- Frontend UI:
	- Files: client/App.js, client/PassengerDashboard.js, client/DriverConductorDashboard.js, client/CarAutoDashboard.js
	- Content: Screen flow, forms, and dashboard UI
- Frontend helpers:
	- Files: client/PasswordVerification.js, client/apiConfig.js
	- Content: Password checks and API URL config
- Backend API logic:
	- Files: server/src/routes/auth.js, server/src/routes/passenger.js, server/src/routes/health.js
	- Content: Login/register/OTP/reset logic, passenger APIs, health endpoint
- Backend setup:
	- Files: server/src/index.js, server/src/app.js, server/src/config/db.js
	- Content: Server start, middleware/route wiring, DB connection
- Database schemas:
	- Files: server/src/models/User.js, server/src/models/Journey.js, server/src/models/Complaint.js
	- Content: MongoDB document structure
- Security and secrets:
	- Files: .env, SECURITY.md
	- Content: Hidden credentials, security policies and notes
- Main algorithm details:
	- Files: server/src/routes/auth.js, client/App.js
	- Content: OTP generation/validation, reset checks, form/flow validation

## Short Summary
- The client handles the UI.
- The server handles logic and storage.
- Email is used for OTP verification and password reset.