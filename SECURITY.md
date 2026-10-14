# Security Best Practices

## 🔐 Security Checklist

This document outlines security measures implemented in TypedDoc and additional recommendations for production deployments.

---

## ✅ Implemented Security Measures

### 1. API Key Protection
- ✅ API keys stored in `.env` file (never in source code)
- ✅ `.env` excluded from git via `.gitignore`
- ✅ `.env.example` provided with placeholder values
- ✅ API keys not exposed to frontend bundle
- ✅ All API calls proxied through backend

### 2. Authentication & Authorization
- ✅ Firebase Authentication required for all API endpoints
- ✅ ID token validation on every request
- ✅ Firestore security rules enforce user ownership
- ✅ Token expiration handled automatically

### 3. Rate Limiting
- ✅ 5 requests per minute per user
- ✅ Memory cleanup prevents leaks
- ✅ Retry-After headers in responses
- ✅ Per-user tracking via Firebase UID

### 4. Input Validation
- ✅ All request bodies validated before processing
- ✅ File type and size validation
- ✅ Message format validation
- ✅ Document type validation

### 5. CORS Configuration
- ✅ Specific origins in production (not wildcard)
- ✅ Credentials support enabled
- ✅ Allowed headers restricted

### 6. Error Handling
- ✅ Generic error messages to clients
- ✅ Detailed errors logged server-side
- ✅ No stack traces exposed in production

---

## 🚨 Critical Actions Required

### Before Going Live

1. **Revoke Exposed API Keys**
   ```bash
   # If you previously committed .env with real keys:
   # 1. Revoke keys at https://console.mistral.ai/
   # 2. Generate new keys
   # 3. Update .env with new keys
   # 4. Remove .env from git history:
   git filter-branch --force --index-filter \
     "git rm --cached --ignore-unmatch .env" \
     --prune-empty --tag-name-filter cat -- --all
   ```

2. **Update CORS Origins**
   Edit `server/server.js`:
   ```javascript
   const corsOptions = {
     origin: [
       'https://yourdomain.com',
       'https://www.yourdomain.com'
     ],
     credentials: true
   };
   ```

3. **Set Production Environment Variables**
   ```env
   NODE_ENV=production
   MISTRAL_API_KEY=your_production_key
   PORT=3001
   ```

4. **Configure Firebase Security Rules**
   ```javascript
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /documents/{documentId} {
         // Only document owner can access
         allow read, write: if request.auth != null 
           && request.auth.uid == resource.data.userId;
         allow create: if request.auth != null;
         
         match /versions/{versionId} {
           allow read, write: if request.auth != null 
             && request.auth.uid == resource.data.userId;
         }
       }
     }
   }
   ```

---

## 🛡️ Additional Recommendations

### Production Environment

1. **Use Environment-Based Secrets Management**
   - Use Render/Heroku/Vercel secret management
   - Never hardcode production secrets
   - Rotate keys regularly (every 90 days)

2. **Enable HTTPS Only**
   ```javascript
   // In server.js
   if (process.env.NODE_ENV === 'production') {
     app.use((req, res, next) => {
       if (req.header('x-forwarded-proto') !== 'https') {
         res.redirect(`https://${req.header('host')}${req.url}`);
       } else {
         next();
       }
     });
   }
   ```

3. **Add Helmet.js for Security Headers**
   ```bash
   npm install helmet
   ```
   ```javascript
   import helmet from 'helmet';
   app.use(helmet());
   ```

4. **Implement Request Size Limits**
   ```javascript
   // Already implemented:
   app.use(express.json({ limit: '50mb' }));
   ```

5. **Add Request Logging (Production)**
   ```bash
   npm install morgan
   ```
   ```javascript
   import morgan from 'morgan';
   if (process.env.NODE_ENV === 'production') {
     app.use(morgan('combined'));
   }
   ```

### Rate Limiting Improvements

**For Production with Multiple Servers:**
```bash
npm install redis express-rate-limit rate-limit-redis
```

```javascript
import rateLimit from 'express-rate-limit';
import RedisStore from 'rate-limit-redis';
import { createClient } from 'redis';

const redisClient = createClient({
  url: process.env.REDIS_URL
});

const limiter = rateLimit({
  store: new RedisStore({
    client: redisClient,
    prefix: 'rl:'
  }),
  windowMs: 60 * 1000,
  max: 5,
  message: { error: 'Too many requests' }
});

app.use('/api', limiter);
```

### Database Security

1. **Enable Firebase App Check** (prevents API abuse)
   - Go to Firebase Console → App Check
   - Enable for your web app
   - Use reCAPTCHA or custom provider

2. **Regular Backups**
   ```bash
   # Schedule daily Firestore exports
   gcloud firestore export gs://your-backup-bucket
   ```

3. **Monitor Usage**
   - Set up Firebase budget alerts
   - Monitor Mistral API usage
   - Track unusual patterns

### File Upload Security

1. **Validate File Types**
   ```javascript
   const ALLOWED_TYPES = [
     'application/pdf',
     'image/png',
     'image/jpeg',
     'image/webp'
   ];
   
   if (!ALLOWED_TYPES.includes(file.type)) {
     throw new Error('Invalid file type');
   }
   ```

2. **Scan Uploads for Malware** (production)
   - Use VirusTotal API
   - Or integrate with Cloudflare's security scanning

3. **Content Security Policy**
   ```javascript
   app.use(helmet.contentSecurityPolicy({
     directives: {
       defaultSrc: ["'self'"],
       imgSrc: ["'self'", "data:", "blob:"],
       scriptSrc: ["'self'"],
       styleSrc: ["'self'", "'unsafe-inline'"],
       connectSrc: ["'self'", "https://api.mistral.ai", "https://firestore.googleapis.com"]
     }
   }));
   ```

---

## 🔍 Security Monitoring

### Log Important Events
```javascript
// In middleware
console.log({
  timestamp: new Date().toISOString(),
  userId: req.user?.uid,
  action: 'OCR_REQUEST',
  ip: req.ip,
  fileSize: req.body.document?.document_url?.length
});
```

### Set Up Alerts
1. **Mistral API Errors**: Alert on > 10% error rate
2. **Authentication Failures**: Alert on > 50 failed attempts/hour
3. **Rate Limit Hits**: Alert on repeated violations
4. **Unusual File Sizes**: Alert on files > 40MB

### Regular Security Audits
```bash
# Check for vulnerabilities
npm audit

# Auto-fix where possible
npm audit fix

# Update dependencies monthly
npm update
```

---

## 🚫 Common Vulnerabilities to Avoid

### ❌ Don't Do This:

1. **Never log sensitive data**
   ```javascript
   // BAD
   console.log('API Key:', process.env.MISTRAL_API_KEY);
   
   // GOOD
   console.log('API Key configured:', !!process.env.MISTRAL_API_KEY);
   ```

2. **Never trust user input**
   ```javascript
   // BAD
   const query = `SELECT * FROM users WHERE id = ${req.body.id}`;
   
   // GOOD (we use Firestore, but principle applies)
   const userId = String(req.body.id).replace(/[^a-zA-Z0-9]/g, '');
   ```

3. **Never use `eval()` or similar**
   ```javascript
   // BAD
   eval(req.body.code);
   
   // Never needed in this application
   ```

4. **Never expose error details to clients**
   ```javascript
   // BAD
   res.status(500).json({ error: error.stack });
   
   // GOOD
   console.error('Server error:', error);
   res.status(500).json({ error: 'Internal server error' });
   ```

---

## 📞 Incident Response

### If API Key is Compromised:
1. Immediately revoke the key at https://console.mistral.ai/
2. Generate a new key
3. Update production environment variables
4. Monitor usage for suspicious activity
5. Review access logs for unauthorized use

### If Database is Compromised:
1. Immediately update Firestore security rules (deny all)
2. Review audit logs in Firebase Console
3. Identify compromised accounts
4. Force password reset for affected users
5. Restore from last known good backup

### Report Security Issues:
- Email: [Your security email]
- Don't post publicly until fix is deployed
- Allow 90 days for fix before disclosure

---

## ✅ Pre-Deployment Checklist

- [ ] API keys revoked and regenerated
- [ ] .env removed from git history
- [ ] CORS origins updated for production
- [ ] Firebase security rules deployed
- [ ] HTTPS enforced
- [ ] Rate limiting tested
- [ ] Error messages sanitized
- [ ] Monitoring and alerts configured
- [ ] Backup strategy implemented
- [ ] Security headers added (Helmet)
- [ ] Dependencies updated and audited
- [ ] Production environment variables set

---

## 📚 Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Firebase Security Rules Guide](https://firebase.google.com/docs/rules)
- [Mistral AI Security Best Practices](https://docs.mistral.ai/security/)
- [Node.js Security Checklist](https://cheatsheetseries.owasp.org/cheatsheets/Nodejs_Security_Cheat_Sheet.html)
