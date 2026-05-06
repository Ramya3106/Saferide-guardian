# Official Email Field Removal Guide

Complete mapping of all `officialEmail` references in the SafeRide Guardian codebase.

---

## 1. DATABASE MODEL

### File: [server/src/models/User.js](server/src/models/User.js#L79-L85)
**Lines: 79-85**
```javascript
officialEmail: {
  type: String,
  lowercase: true,
  set: encrypt,
  get: decrypt,
},
```
**Action:** Remove this entire field definition from the User schema.

---

## 2. DOCUMENTATION

### File: [SECURITY.md](SECURITY.md#L18)
**Line: 18**
```
- `officialEmail` - Official government email addresses
```
**Action:** Remove this line from the "Professional Users" security documentation.

---

## 3. CLIENT APP - STATE & INITIALIZATION

### File: [client/App.js](client/App.js#L973)
**Line: 973**
```javascript
const [officialEmail, setOfficialEmail] = useState("");
```
**Action:** Remove this state variable declaration.

---

## 4. CLIENT APP - EMAIL SELECTION LOGIC

### File: [client/App.js](client/App.js#L1065)
**Line: 1065**
```javascript
const otpEmail = (isOfficialRole ? officialEmail : email).trim();
```
**Context:**
```javascript
const isOfficialRole = role === "TTR/RPF/Police";
const otpEmail = (isOfficialRole ? officialEmail : email).trim();
```
**Action:** Change to use `email` for all roles:
```javascript
const otpEmail = email.trim();
```

---

## 5. CLIENT APP - VALIDATION FUNCTION

### File: [client/App.js](client/App.js#L1096-L1103)
**Lines: 1096-1103**
```javascript
const isOfficialEmailValid = (selectedRole, emailValue) => {
  const trimmed = emailValue.trim().toLowerCase();
  // Allow any valid email format (temporarily ignoring domain restrictions)
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmed);
};
```
**Action:** Remove this function (domain validation for official emails no longer needed).

---

## 6. CLIENT APP - REGISTRATION FORM VALIDATION

### File: [client/App.js](client/App.js#L1163)
**Line: 1163**
```javascript
isValidEmail(officialEmail) &&
```
**Context:**
```javascript
if (isOfficialRole) {
  return (
    isProfessionalIdValid(role, professionalId) &&
    isValidEmail(officialEmail) &&  // <- Remove this check
    isVerified &&
    pnrRange.trim().length >= 5 &&
    jurisdiction.trim().length >= 3
  );
}
```
**Action:** Remove the `isValidEmail(officialEmail) &&` check from the official role validation.

---

## 7. CLIENT APP - REGISTER FORM DEPENDENCY

### File: [client/App.js](client/App.js#L1237)
**Line: 1237** (in register form dependencies)
```javascript
officialEmail,
```
**Context:**
```javascript
const canSubmit = useMemo(() => {
  // ... other validations
  if (isRegister) {
    if (!baseRegisterReady) {
      return false;
    }
    if (isOfficialRole) {
      return (
        isProfessionalIdValid(role, professionalId) &&
        isValidEmail(officialEmail) &&
        isVerified &&
        pnrRange.trim().length >= 5 &&
        jurisdiction.trim().length >= 3
      );
    }
  }
}, [
  isRegister,
  isVerified,
  isPostLoginOtpStep,
  jurisdiction,
  loginWithOtp,
  name,
  otpEmail,
  officialEmail,  // <- Remove from dependencies
  password,
  ...
]);
```
**Action:** Remove `officialEmail` from the useMemo dependencies.

---

## 8. CLIENT APP - FORM RESET

### File: [client/App.js](client/App.js#L1434)
**Line: 1434**
```javascript
setOfficialEmail("");
```
**Context:**
```javascript
const resetForm = () => {
  setName("");
  setPhone("");
  setEmail("");
  setPassword("");
  setConfirmPassword("");
  setOfficialEmail("");  // <- Remove
  setProfessionalId("");
  setError("");
  // ...
};
```
**Action:** Remove this line from the `resetForm()` function.

---

## 9. CLIENT APP - PROFILE LOADING

### File: [client/App.js](client/App.js#L1599)
**Line: 1599** (occurs twice)
```javascript
setOfficialEmail(profile.officialEmail || profile.email || "");
```
**Context:**
```javascript
const applyUserProfile = (profile = {}) => {
  setName(profile.name || "");
  setPhone(profile.phone || "");
  setEmail(profile.email || "");
  setOfficialEmail(profile.officialEmail || profile.email || "");  // <- Remove
  setProfessionalId(profile.professionalId || "");
  setJurisdiction(profile.jurisdiction || "");
  setPnrRange(profile.pnrRange || "");
};
```
**Action:** Remove this line entirely.

---

## 10. CLIENT APP - LOGIN OTP INITIATION

### File: [client/App.js](client/App.js#L1626)
**Line: 1626**
```javascript
? profile.officialEmail || profile.email || ""
```
**Context:**
```javascript
const initiatePostLoginOtp = async (profile = {}, inferredRole = "") => {
  const resolvedEmail = (
    isOfficialRole
      ? profile.officialEmail || profile.email || ""  // <- Change
      : profile.email || email
  )
    .trim()
    .toLowerCase();
```
**Action:** Change to:
```javascript
const resolvedEmail = (profile.email || email).trim().toLowerCase();
```

---

## 11. CLIENT APP - RESOLVED EMAIL ASSIGNMENT

### File: [client/App.js](client/App.js#L1638)
**Line: 1638**
```javascript
setOfficialEmail(resolvedEmail);
```
**Context:**
```javascript
if (isOfficialRole) {
  setOfficialEmail(resolvedEmail);  // <- Remove
} else {
  setEmail(resolvedEmail);
}
```
**Action:** Remove the entire `if (isOfficialRole)` block, keep only:
```javascript
setEmail(resolvedEmail);
```

---

## 12. CLIENT APP - REGISTRATION SUBMIT

### File: [client/App.js](client/App.js#L1715)
**Line: 1715** (occurs twice)
```javascript
const registeredOfficialEmail = officialEmail.trim().toLowerCase();
```
**Action:** Remove this variable declaration.

---

## 13. CLIENT APP - REGISTRATION PAYLOAD

### File: [client/App.js](client/App.js#L1731)
**Line: 1731** (occurs twice)
```javascript
officialEmail: officialEmail.trim().toLowerCase(),
```
**Context:**
```javascript
await axios.post(`${API_BASE}/auth/register`, {
  role,
  name: name.trim(),
  phone: phone.trim(),
  email: email.trim().toLowerCase(),
  officialEmail: officialEmail.trim().toLowerCase(),  // <- Remove
  professionalId: professionalId.trim(),
  password: password.trim(),
  // ...
});
```
**Action:** Remove this field from the registration payload.

---

## 14. CLIENT APP - AFTER REGISTRATION

### File: [client/App.js](client/App.js#L1757)
**Line: 1757** (occurs twice)
```javascript
setOfficialEmail(registeredOfficialEmail);
```
**Context:**
```javascript
if (isOfficialRole) {
  setProfessionalId(registeredProfessionalId);
  setOfficialEmail(registeredOfficialEmail);  // <- Remove
  setError("Registration submitted. Admin approval takes up to 24 hours.");
  return;
}
```
**Action:** Remove this line.

---

## 15. CLIENT APP - LOGIN POST-OTP EMAIL RESOLUTION

### File: [client/App.js](client/App.js#L1799)
**Line: 1799**
```javascript
setOfficialEmail(profile.email || email.trim().toLowerCase());
```
**Context:**
```javascript
if (inferredRole) {
  setSpecificRole(inferredRole);
  setShowRoleSelection(false);
  setIsAuthenticated(true);
  setOfficialEmail(profile.email || email.trim().toLowerCase());  // <- Remove
  return;
}
```
**Action:** Remove this line.

---

## 16. CLIENT APP - PASSWORD RESET: SEND CODE

### File: [client/App.js](client/App.js#L1955)
**Line: 1955**
```javascript
const trimmedEmail = officialEmail.trim().toLowerCase();
```
**Context:**
```javascript
const handleSendResetCode = async () => {
  const trimmedEmail = officialEmail.trim().toLowerCase();  // <- Change
  const trimmedProfessionalId = professionalId.trim();
```
**Action:** Change to:
```javascript
const trimmedEmail = email.trim().toLowerCase();
```

---

## 17. CLIENT APP - SEND RESET CODE VALIDATION

### File: [client/App.js](client/App.js#L1971)
**Line: 1971** (occurs twice)
```javascript
if (!isOfficialEmailValid(role, officialEmail)) {
```
**Action:** Remove this entire validation block (the function itself can be removed).

---

## 18. CLIENT APP - SEND RESET CODE PAYLOAD

### File: [client/App.js](client/App.js#L1987)
**Line: 1987**
```javascript
officialEmail: trimmedEmail,
```
**Context:**
```javascript
const { data } = await axios.post(`${API_BASE}/auth/forgot-password`, {
  role,
  professionalId: trimmedProfessionalId,
  officialEmail: trimmedEmail,  // <- Remove
});
```
**Action:** Remove this field from the payload.

---

## 19. CLIENT APP - PASSWORD RESET: RESEND CODE

### File: [client/App.js](client/App.js#L2006)
**Line: 2006**
```javascript
const trimmedEmail = officialEmail.trim().toLowerCase();
```
**Action:** Change to `email` (same as #16).

---

## 20. CLIENT APP - RESEND CODE VALIDATION

### File: [client/App.js](client/App.js#L2019)
**Line: 2019** (occurs twice)
```javascript
if (!isOfficialEmailValid(role, officialEmail)) {
```
**Action:** Remove this validation block (same as #17).

---

## 21. CLIENT APP - RESEND CODE PAYLOAD

### File: [client/App.js](client/App.js#L2035)
**Line: 2035**
```javascript
officialEmail: trimmedEmail,
```
**Action:** Remove from payload (same as #18).

---

## 22. CLIENT APP - VERIFY RESET CODE PAYLOAD

### File: [client/App.js](client/App.js#L2064)
**Line: 2064** (occurs twice)
```javascript
officialEmail: officialEmail.trim().toLowerCase(),
```
**Context:**
```javascript
const payload = {
  officialEmail: officialEmail.trim().toLowerCase(),  // <- Remove
  resetCode: resetCode.trim(),
};
```
**Action:** Remove this field from the payload.

---

## 23. CLIENT APP - RESET PASSWORD PAYLOAD

### File: [client/App.js](client/App.js#L2114)
**Line: 2114** (occurs twice)
```javascript
officialEmail: officialEmail.trim().toLowerCase(),
```
**Context:**
```javascript
const payload = {
  officialEmail: officialEmail.trim().toLowerCase(),  // <- Remove
  resetCode: resetCode.trim(),
  newPassword: newPassword.trim(),
};
```
**Action:** Remove this field from the payload.

---

## 24. CLIENT APP - CONSOLE LOG

### File: [client/App.js](client/App.js#L2119)
**Line: 2119**
```javascript
console.log("Resetting password with:", { email: payload.officialEmail, ...
```
**Action:** Change to `email: trimmedEmail` or similar.

---

## 25. CLIENT APP - CLEANUP AFTER RESET

### File: [client/App.js](client/App.js#L2136)
**Line: 2136**
```javascript
setOfficialEmail("");
```
**Context:**
```javascript
setTimeout(() => {
  setForgotPasswordMode(false);
  setResetResendCountdown(0);
  setResetSuccess(false);
  setResetCode("");
  setNewPassword("");
  setConfirmNewPassword("");
  setIsResetCodeSent(false);
  setIsResetCodeVerified(false);
  setOfficialEmail("");  // <- Remove
  setProfessionalId("");
}, 2000);
```
**Action:** Remove this line.

---

## 26. CLIENT APP - DASHBOARD DISPLAY (TTR)

### File: [client/App.js](client/App.js#L2815)
**Line: 2815**
```javascript
const displayEmail = officialEmail.trim() || "Not set";
```
**Context:**
```javascript
const renderTtrDashboard = () => {
  const displayName = name.trim() || "Officer";
  const displayEmail = officialEmail.trim() || "Not set";  // <- Change
```
**Action:** Change to `email.trim()` or `"Not set"`.

---

## 27. CLIENT APP - DASHBOARD DISPLAY (RPF)

### File: [client/App.js](client/App.js#L3056)
**Line: 3056**
```javascript
const displayEmail = officialEmail.trim() || "Not set";
```
**Action:** Same as #26.

---

## 28. CLIENT APP - DASHBOARD DISPLAY (POLICE)

### File: [client/App.js](client/App.js#L3223)
**Line: 3223**
```javascript
const displayEmail = officialEmail.trim() || "Not set";
```
**Action:** Same as #26.

---

## 29. CLIENT APP - DASHBOARD PROPS

### File: [client/App.js](client/App.js#L3485)
**Line: 3485**
```javascript
officerEmail: (officialEmail || email).trim(),
```
**Context:**
```javascript
const sharedProps = {
  officerEmail: (officialEmail || email).trim(),  // <- Simplify
  professionalId: professionalId.trim(),
  staffName: name.trim(),
  // ...
};
```
**Action:** Change to:
```javascript
officerEmail: email.trim(),
```

---

## 30. CLIENT APP - REGISTRATION FORM INPUT

### File: [client/App.js](client/App.js#L3927-L3928)
**Lines: 3927-3928**
```javascript
value={officialEmail}
onChangeText={setOfficialEmail}
```
**Context:**
```javascript
{isRegister && isOfficialRole && (
  <View style={styles.inputGroup}>
    <Text style={styles.label}>{requiredLabel("Official email")}</Text>
    <TextInput
      style={[styles.input, isVerified && styles.inputDisabled]}
      placeholder={`name@${getOfficialDomain(role)}`}
      placeholderTextColor="#94A3B8"
      value={officialEmail}            // <- Remove input
      onChangeText={setOfficialEmail}   // <- Remove input
      autoCapitalize="none"
      keyboardType="email-address"
      editable={!isVerified}
    />
```
**Action:** Remove the entire TextInput component for official email registration (for official roles, use the regular email field).

---

## 31. CLIENT APP - FORM RESET IN REGISTRATION

### File: [client/App.js](client/App.js#L4112)
**Line: 4112**
```javascript
setOfficialEmail("");
```
**Action:** Remove this line from form reset.

---

## 32. CLIENT APP - PASSWORD RESET FORM INPUT

### File: [client/App.js](client/App.js#L4160-L4161)
**Lines: 4160-4161**
```javascript
value={officialEmail}
onChangeText={setOfficialEmail}
```
**Context:**
```javascript
<View style={styles.inputGroup}>
  <Text style={styles.label}>
    {requiredLabel(`${getOfficialDomain(role)} Email`)}
  </Text>
  <TextInput
    style={styles.input}
    placeholder={`name@${getOfficialDomain(role)}`}
    placeholderTextColor="#94A3B8"
    value={officialEmail}            // <- Change to email
    onChangeText={setOfficialEmail}   // <- Change to setEmail
    autoCapitalize="none"
    keyboardType="email-address"
  />
```
**Action:** Change to:
```javascript
value={email}
onChangeText={setEmail}
```

---

## 33. CLIENT APP - PASSWORD RESET VALIDATION

### File: [client/App.js](client/App.js#L4174)
**Line: 4174**
```javascript
officialEmail.trim().length < 5 ||
```
**Action:** Change to `email.trim().length < 5`.

---

## 34. CLIENT APP - PASSWORD RESET DISABLE CHECK

### File: [client/App.js](client/App.js#L4181)
**Line: 4181**
```javascript
officialEmail.trim().length < 5 ||
```
**Action:** Change to `email.trim().length < 5`.

---

## SERVER ROUTES

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L132)
**Line: 132** - VALIDATION FUNCTION
```javascript
const isValidOfficialEmail = (role, emailValue) => {
```
**Action:** Remove this entire function (domain validation no longer needed).

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L359)
**Line: 359**
```javascript
return [user.email, user.officialEmail].some(
```
**Context:**
```javascript
const hasMatchingEmail = (user, emailValue) => {
  return [user.email, user.officialEmail].some(  // <- Remove officialEmail
    (userEmail) => userEmail?.toLowerCase() === emailValue?.toLowerCase(),
  );
};
```
**Action:** Change to:
```javascript
return user.email?.toLowerCase() === emailValue?.toLowerCase();
```

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L560)
**Line: 560** (occurs twice) - REGISTRATION ROUTE
```javascript
const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
```
**Action:** Remove this variable extraction.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L568)
**Line: 568**
```javascript
if (!isValidEmail(officialEmail)) {
```
**Action:** Remove this validation.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L574)
**Line: 574**
```javascript
email = officialEmail;
```
**Context:**
```javascript
if (isOfficialRole(role)) {
  if (!isValidProfessionalId(role, professionalId)) {
    return res.status(400).json({ message: "Invalid professional ID format." });
  }
  if (!isValidEmail(officialEmail)) {  // <- Remove
    return res.status(400).json({ message: "Enter a valid email." });
  }
  if (!req.body?.isVerified) {
    return res.status(400).json({ message: "Email not verified." });
  }
  email = officialEmail;  // <- Remove (use regular email)
}
```
**Action:** Remove the officialEmail assignment, use regular `email` field.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L610)
**Line: 610** (occurs twice) - REGISTRATION RESPONSE
```javascript
officialEmail: officialEmail || undefined,
```
**Context:**
```javascript
const user = await User.create({
  name,
  phone,
  email,
  professionalId,
  officialEmail: officialEmail || undefined,  // <- Remove
  role,
  // ...
});
```
**Action:** Remove this field from user creation.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L704)
**Line: 704** - LOGIN VALIDATION
```javascript
if (!isValidOfficialEmail(role, email)) {
```
**Action:** Remove this validation (function will be deleted).

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1043)
**Line: 1043** (occurs twice) - VERIFY RESET CODE
```javascript
const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
```
**Action:** Change to `email` since all users will use the same field.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1046)
**Line: 1046**
```javascript
console.log("Verify reset code request:", { officialEmail, resetCode });
```
**Action:** Update log to use `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1048)
**Line: 1048**
```javascript
if (!isValidEmail(officialEmail) || resetCode.length !== 6) {
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1055)
**Line: 1055**
```javascript
const record = resetPasswordStore.get(officialEmail);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1067)
**Line: 1067**
```javascript
resetPasswordStore.delete(officialEmail);
```
**Action:** Change to `email` (multiple instances).

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1075)
**Line: 1075**
```javascript
resetPasswordStore.delete(officialEmail);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1086)
**Line: 1086**
```javascript
resetPasswordStore.set(officialEmail, record);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1238)
**Line: 1238** (occurs twice) - FORGOT PASSWORD
```javascript
const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1252)
**Line: 1252** (occurs twice)
```javascript
if (!isValidOfficialEmail(role, officialEmail)) {
```
**Action:** Remove this validation.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1260)
**Line: 1260**
```javascript
if (user && !hasMatchingEmail(user, officialEmail)) {
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1282)
**Line: 1282**
```javascript
console.log("Storing reset code:", { officialEmail, resetCode, ...
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1284)
**Line: 1284**
```javascript
resetPasswordStore.set(officialEmail, {
```
**Action:** Change to `email` (multiple instances).

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1296)
**Line: 1296**
```javascript
to: officialEmail,
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1313)
**Line: 1313**
```javascript
console.log(`✅ Password reset code sent to ${officialEmail}`);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1318)
**Line: 1318**
```javascript
console.log(`📤 Password reset code queued for ${officialEmail}`);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1331)
**Line: 1331** (occurs twice) - RESET PASSWORD
```javascript
const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1335)
**Line: 1335**
```javascript
console.log("Reset password request:", { officialEmail, resetCode: ...
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1337)
**Line: 1337**
```javascript
if (!isValidEmail(officialEmail) || resetCode.length !== 6) {
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1349)
**Line: 1349**
```javascript
const record = resetPasswordStore.get(officialEmail);
```
**Action:** Change to `email` (multiple instances).

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1360)
**Line: 1360**
```javascript
resetPasswordStore.delete(officialEmail);
```
**Action:** Change to `email` (multiple instances).

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1375)
**Line: 1375**
```javascript
resetPasswordStore.delete(officialEmail);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1388)
**Line: 1388**
```javascript
resetPasswordStore.delete(officialEmail);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1390)
**Line: 1390**
```javascript
console.log(`✅ Password reset successful for: ${officialEmail}`);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1404)
**Line: 1404** (occurs twice) - RESET PASSWORD OTP
```javascript
const officialEmail = (req.body?.officialEmail || "").trim().toLowerCase();
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1408)
**Line: 1408**
```javascript
if (!isValidEmail(officialEmail) || otpCode.length !== 6) {
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1421)
**Line: 1421**
```javascript
const result = consumeVerificationCode(officialEmail, otpCode);
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1427)
**Line: 1427**
```javascript
const user = await findUserByEmail(officialEmail, {
```
**Action:** Change to `email`.

---

### File: [server/src/routes/auth.js](server/src/routes/auth.js#L1442)
**Line: 1442**
```javascript
console.log(`✅ Password reset successful via OTP for: ${officialEmail}`);
```
**Action:** Change to `email`.

---

## SUMMARY OF CHANGES

### Files to Modify:
1. **[server/src/models/User.js](server/src/models/User.js)** - Remove officialEmail schema field
2. **[SECURITY.md](SECURITY.md)** - Remove documentation reference
3. **[client/App.js](client/App.js)** - Remove state, functions, form inputs, and replace field references with `email`
4. **[server/src/routes/auth.js](server/src/routes/auth.js)** - Remove validation function, update all routes to use `email` instead of `officialEmail`

### Change Categories:
- **Delete:** Functions, state variables, schema fields
- **Replace:** Field references `officialEmail` → `email`
- **Simplify:** Conditional logic that special-cased official roles
- **Remove:** Form inputs, validation checks, payload fields

