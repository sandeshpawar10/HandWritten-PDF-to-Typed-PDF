# TypedDoc: Handwritten Notes to Digital Markdown

TypedDoc is an AI-powered web application that converts handwritten notes, assignments, and scanned PDFs into clean, beautifully formatted Markdown with proper LaTeX math rendering.

Unlike traditional OCR tools that scramble equations and code blocks, TypedDoc uses a dual-AI pipeline powered by **Mistral AI** to intelligently reconstruct complex algorithms, formulas, and layouts with context-aware corrections.

---

## ✨ Features

- **AI-Powered OCR**: Mistral OCR accurately extracts handwritten text, diagrams, and math from PDFs and images
- **Intelligent Post-Processing**: Mistral Large acts as a Computer Science proofreader:
  - Autocorrects OCR typos (e.g., `scarf` → `scanf`, `Trautable` → `Tractable`)
  - Fixes code syntax and restores proper indentation
  - Mathematically reconstructs scrambled equations using context
- **Live Rendering**: Real-time Markdown and LaTeX preview with KaTeX support
- **Cloud Storage**: Secure Firebase Authentication and Firestore document sync
- **Professional Exports**: Download as styled PDFs or DOCX files
- **Modern UI**: Responsive interface with smooth animations

---

## 🛠️ Tech Stack

### Frontend
- React 19 with Vite
- Tailwind CSS v4
- KaTeX (LaTeX math rendering)
- Firebase SDK (Auth & Firestore)
- Motion (animations)

### Backend
- Node.js & Express
- Mistral AI API (OCR & Chat)
- Firebase Admin (authentication)
- Rate limiting & CORS protection

---

## 🚀 Quick Start

### Prerequisites
- Node.js ≥ 18.0.0
- npm ≥ 9.0.0
- Mistral AI API key ([Get one here](https://console.mistral.ai/))
- Firebase project ([Setup guide](https://firebase.google.com/))

### 1. Clone & Install
```bash
git clone https://github.com/sandeshpawar10/HandWritten-PDF-to-Typed-PDF.git
cd HandWritten-PDF-to-Typed-PDF
npm install
```

### 2. Configure Environment Variables
Copy the example environment file:
```bash
cp .env.example .env
```

Edit `.env` and add your Mistral API key:
```env
MISTRAL_API_KEY=your_actual_mistral_api_key_here
PORT=3001
```

### 3. Configure Firebase

#### Frontend Configuration
Create or update `firebase-applet-config.json` with your Firebase project credentials:
```json
{
  "projectId": "your-project-id",
  "appId": "your-app-id",
  "apiKey": "your-api-key",
  "authDomain": "your-project.firebaseapp.com",
  "firestoreDatabaseId": "your-database-id",
  "storageBucket": "your-project.firebasestorage.app",
  "messagingSenderId": "your-sender-id"
}
```

#### Firestore Security Rules
Set up these Firestore rules in your Firebase console:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /documents/{documentId} {
      allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
      allow create: if request.auth != null;
      
      match /versions/{versionId} {
        allow read, write: if request.auth != null && request.auth.uid == resource.data.userId;
        allow create: if request.auth != null;
      }
    }
  }
}
```

#### Authentication Setup
1. Go to Firebase Console → Authentication → Sign-in method
2. Enable Google sign-in provider
3. Add your domain to Authorized domains (e.g., `localhost`, `yourdomain.com`)

#### Service Account Setup (Recommended for Production)
1. Go to Firebase Console → Project Settings → Service Accounts
2. Click "Generate New Private Key"
3. Download the JSON file
4. Copy the entire JSON content as a single line
5. Add to environment variables as `FIREBASE_SERVICE_ACCOUNT`

**Why this is important:** Using a service account ensures reliable authentication even if Google's public key endpoints have temporary outages.

### 4. Run Development Server
Start both frontend and backend:
```bash
npm run dev:all
```

The app will be available at:
- Frontend: `http://localhost:3000`
- Backend: `http://localhost:3001`
- Health check: `http://localhost:3001/health`

---

## 📁 Project Structure

```
typed-document-v2/
├── src/                      # Frontend React application
│   ├── components/           # React components
│   ├── services/            # API services (Firebase, Mistral)
│   ├── hooks/               # Custom React hooks
│   └── lib/                 # Utilities and Firebase config
├── server/                   # Backend Express server
│   ├── routes/              # API routes
│   ├── controllers/         # Request handlers
│   ├── middleware/          # Auth & rate limiting
│   └── services/            # Mistral AI integration
├── .env.example             # Environment variables template
└── package.json             # Dependencies
```

---

## 🔒 Security Notes

**IMPORTANT**: Never commit your `.env` file or API keys to version control!

- The `.gitignore` file excludes `.env` files by default
- API keys should only exist on the backend server
- Frontend communicates with backend via `/api` proxy endpoints
- Rate limiting: 5 requests per minute per user
- Firebase authentication required for all API calls

---

## 🐛 Troubleshooting

### "MISTRAL_API_KEY is not configured"
- Ensure you've copied `.env.example` to `.env`
- Add your actual Mistral API key (not the placeholder)
- Restart the server after changing `.env`

### "Firebase Auth Error: Domain not authorized"
- Add your domain to Firebase Console → Authentication → Authorized domains
- For local development, add `localhost`

### Port Already in Use
Change the port in `.env`:
```env
PORT=3002
```

### Rate Limit Errors
- Default limit: 5 requests per minute
- Adjust in `server/middleware/rateLimit.js` if needed
- Consider Redis for production deployments

---

## 🚢 Deployment

### Render.com (Recommended)
1. Create a new Web Service
2. Connect your GitHub repository
3. Set environment variables:
   - `MISTRAL_API_KEY`
   - `NODE_ENV=production`
4. Build command: `npm install && npm run build`
5. Start command: `npm run server`

### Environment-Specific Settings

**Production Environment Variables:**
```env
NODE_ENV=production
MISTRAL_API_KEY=your_production_key
FRONTEND_URL=https://your-frontend-domain.com
FIREBASE_SERVICE_ACCOUNT={"type":"service_account",...}
PORT=3001
```

**Render Deployment:**
- The `RENDER_EXTERNAL_URL` is automatically provided by Render
- Set `FRONTEND_URL` if your frontend is on a different domain
- If frontend and backend are on the same Render service, no FRONTEND_URL needed

---

## 📊 Cost Considerations

- Mistral OCR: ~$0.10 per page (varies by complexity)
- Mistral Large: ~$0.02 per 1K tokens
- Firebase: Free tier available (pay-as-you-go after limits)
- Recommended: Set up billing alerts in Mistral Console

---

## 🤝 Contributing

Contributions welcome! Please:
1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License.

## 👨‍💻 Author

**Sandesh Pawar**  
GitHub: [sandeshpawar10](https://github.com/sandeshpawar10)

---

## 🙏 Acknowledgments

- [Mistral AI](https://mistral.ai/) for OCR and language models
- [Firebase](https://firebase.google.com/) for authentication and database
- [KaTeX](https://katex.org/) for math rendering
