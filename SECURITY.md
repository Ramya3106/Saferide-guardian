# SafeRide Guardian - Security Documentation

## Overview
This document outlines the security measures implemented in SafeRide Guardian to protect sensitive user data, especially for professional users (TTR/RPF/Police officers).

---

## Database Security

### Encrypted Fields
The following sensitive fields are encrypted at rest using AES-256-CBC encryption:

#### All Users:
- `phone` - Phone numbers are encrypted to prevent unauthorized access

#### Professional Users (TTR/RPF/Police):
- `professionalId` - Professional identification numbers
- `officialEmail` - Official government email addresses
- `pnrRange` - PNR range assignments (highly sensitive)
- `jurisdiction` - Jurisdiction information

#### Staff Users (Driver/Conductor, Cab/Auto):
- `vehicleNumber` - Vehicle registration numbers

#### Passengers:
- `travelNumber` - Travel ticket/pass numbers

### Password Security
- Passwords are hashed using bcrypt with salt rounds (10)
- Password field is excluded from queries by default (`select: false`)
- Passwords are never returned in API responses
- Password reset tokens are temporary and expire after use

### Encryption Implementation
- Algorithm: AES-256-CBC
- Key: 256-bit encryption key stored in environment variable
- IV: Random 16-byte initialization vector per encryption
- Format: `iv:encryptedData` (hex encoded)

---

## Environment Variables

### Required Security Variables

```env
# Database connection
MONGO_URI=mongodb://127.0.0.1:27017/saferide

# Email service (for OTP verification)
EMAIL_USER=your-email@gmail.com
EMAIL_PASS=your-app-password

# Encryption key (CRITICAL - Keep secret!)
ENCRYPTION_KEY=<64-character-hex-string>
```

### Generating Encryption Key

Run this command to generate a secure encryption key:
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Copy the output and set it as `ENCRYPTION_KEY` in your `.env` file.

---

## API Security

### Authentication
- Email verification required for passenger registration
- Professional ID validation for official roles
- OTP-based login option for all users
- Password-based login with bcrypt verification

### Authorization
- Role-based access control (RBAC)
- Approval workflow for professional users
- Status checks before granting access

### Data Access
- Sensitive fields are automatically decrypted when accessed
- Password field never included in responses
- `toSafeObject()` method removes sensitive fields before sending to client

---

## Best Practices

### For Developers:
1. Never log sensitive data (passwords, professional IDs, etc.)
2. Always use `.select('+password')` when password verification is needed
3. Use `user.toSafeObject()` before sending user data to client
4. Keep `ENCRYPTION_KEY` secret and never commit to version control
5. Rotate encryption keys periodically in production

### For Deployment:
1. Use strong, unique encryption keys for each environment
2. Store encryption keys in secure secret management systems
3. Enable MongoDB encryption at rest
4. Use TLS/SSL for database connections
5. Implement rate limiting on authentication endpoints
6. Enable CORS with specific origins only
7. Use HTTPS for all API communications

### For Database:
1. Regular backups with encrypted storage
2. Access control with minimal privileges
3. Audit logging for sensitive operations
4. Network isolation for database servers

---

## Compliance

### Data Protection:
- Personal data encrypted at rest
- Professional credentials protected with AES-256
- Password reset tokens expire after 10 minutes
- Maximum 5 attempts for OTP/reset codes

### Audit Trail:
- Timestamps on all user records (`createdAt`, `updatedAt`)
- Approval status tracking for professional users
- Password reset request logging

---

## Security Checklist

- [x] Passwords hashed with bcrypt
- [x] Sensitive fields encrypted with AES-256
- [x] Password field excluded from queries by default
- [x] OTP verification for email and password reset
- [x] Professional ID validation
- [x] Official email domain validation
- [x] Approval workflow for professional users
- [x] Rate limiting on verification codes
- [x] Secure password reset flow
- [x] Database indexes for performance
- [x] Environment variable configuration

---

## Incident Response

If you suspect a security breach:
1. Immediately rotate the `ENCRYPTION_KEY`
2. Force password reset for all affected users
3. Review audit logs for suspicious activity
4. Notify affected users
5. Update security measures as needed

---

## Contact

For security concerns or to report vulnerabilities, please contact the development team immediately.

**Note:** This is a development/educational project. For production deployment, additional security measures should be implemented including:
- JWT token authentication
- API rate limiting
- DDoS protection
- Security headers (helmet.js)
- Input sanitization
- SQL injection prevention
- XSS protection
- CSRF tokens
- Security monitoring and alerting
