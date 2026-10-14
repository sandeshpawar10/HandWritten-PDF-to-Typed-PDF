# API Documentation

## Base URL
- **Development**: `http://localhost:3001`
- **Production**: Your deployed backend URL

## Authentication
All API endpoints require Firebase ID token authentication.

**Headers:**
```
Authorization: Bearer <firebase-id-token>
Content-Type: application/json
```

---

## Endpoints

### Health Check

**GET** `/health`

Check if the server is running.

**Response:**
```json
{
  "status": "ok",
  "timestamp": "2026-10-11T05:15:06.206Z",
  "uptime": 123.456
}
```

---

### OCR Processing

**POST** `/api/ocr`

Extract text from images or PDF documents using Mistral OCR.

**Request Body:**
```json
{
  "model": "mistral-ocr-latest",
  "document": {
    "type": "document_url",
    "document_url": "data:application/pdf;base64,<base64-encoded-pdf>"
  },
  "include_image_base64": true
}
```

**Parameters:**
- `model` (string, required): OCR model to use ("mistral-ocr-latest")
- `document` (object, required):
  - `type` (string): "document_url" for PDFs, "image_url" for images
  - `document_url` or `image_url` (string): Base64-encoded data URL
- `include_image_base64` (boolean, optional): Include extracted images in response

**Response:**
```json
{
  "pages": [
    {
      "markdown": "# Extracted content...",
      "images": [
        {
          "id": "img_123",
          "image_base64": "data:image/jpeg;base64,..."
        }
      ]
    }
  ]
}
```

**Rate Limit:** 5 requests per minute per user

**Errors:**
- `400`: Invalid request (missing required fields, invalid document type)
- `401`: Unauthorized (missing or invalid Firebase token)
- `429`: Rate limit exceeded
- `503`: Mistral API unavailable

---

### Chat Completion (Post-Processing)

**POST** `/api/chat`

Process OCR output with Mistral Large for intelligent formatting.

**Request Body:**
```json
{
  "model": "mistral-large-latest",
  "max_tokens": 8192,
  "messages": [
    {
      "role": "system",
      "content": "System prompt for formatting instructions..."
    },
    {
      "role": "user",
      "content": "Raw OCR text to format..."
    }
  ]
}
```

**Parameters:**
- `model` (string, required): Chat model to use ("mistral-large-latest")
- `max_tokens` (number, optional): Maximum tokens in response (default: 8192)
- `messages` (array, required): Array of message objects with:
  - `role` (string): "system", "user", or "assistant"
  - `content` (string): Message content

**Response:**
```json
{
  "choices": [
    {
      "message": {
        "role": "assistant",
        "content": "Formatted markdown output..."
      }
    }
  ]
}
```

**Rate Limit:** 5 requests per minute per user

**Errors:**
- `400`: Invalid request (invalid message format, missing fields)
- `401`: Unauthorized (missing or invalid Firebase token)
- `429`: Rate limit exceeded
- `503`: Mistral API unavailable

---

## Rate Limiting

All API endpoints are rate-limited to **5 requests per minute per authenticated user**.

**Rate Limit Headers:**
```
X-RateLimit-Limit: 5
X-RateLimit-Remaining: 3
X-RateLimit-Reset: 2026-10-11T05:16:06.206Z
```

**Rate Limit Response (429):**
```json
{
  "error": "Too Many Requests. Please wait before trying again.",
  "retryAfter": 45,
  "limit": 5,
  "remaining": 0
}
```

---

## Error Responses

All errors follow this format:
```json
{
  "error": "Error message description"
}
```

**Common Status Codes:**
- `400`: Bad Request - Invalid input
- `401`: Unauthorized - Missing/invalid authentication
- `429`: Too Many Requests - Rate limit exceeded
- `500`: Internal Server Error - Server-side error
- `503`: Service Unavailable - External API unavailable

---

## Frontend Integration

### Example: Convert Handwritten PDF

```javascript
import { auth } from './lib/firebase';

async function convertPDF(file) {
  // Get Firebase ID token
  const token = await auth.currentUser.getIdToken();
  
  // Convert file to base64
  const base64 = await fileToBase64(file);
  
  // Step 1: OCR
  const ocrResponse = await fetch('/api/ocr', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: 'mistral-ocr-latest',
      document: {
        type: 'document_url',
        document_url: `data:application/pdf;base64,${base64}`
      },
      include_image_base64: true
    })
  });
  
  const ocrData = await ocrResponse.json();
  const rawMarkdown = ocrData.pages.map(p => p.markdown).join('\n\n');
  
  // Step 2: Post-process with chat
  const chatResponse = await fetch('/api/chat', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
      model: 'mistral-large-latest',
      max_tokens: 8192,
      messages: [
        { role: 'system', content: 'Format this OCR output...' },
        { role: 'user', content: rawMarkdown }
      ]
    })
  });
  
  const chatData = await chatResponse.json();
  return chatData.choices[0].message.content;
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = () => resolve(reader.result.split(',')[1]);
    reader.onerror = reject;
  });
}
```

---

## Security

### Authentication
- Firebase ID tokens verified on every request
- Tokens expire after 1 hour (automatically refreshed by Firebase SDK)
- Backend validates token signature and expiration

### CORS
Production CORS is restricted to specific domains. Update in `server/server.js`:
```javascript
const corsOptions = {
  origin: ['https://yourdomain.com'],
  credentials: true
};
```

### Input Validation
- All request bodies validated before processing
- File size limited to 50MB
- Invalid data returns 400 error with descriptive message

### Rate Limiting
- Per-user rate limiting prevents abuse
- Automatically cleans up old entries to prevent memory leaks
- Returns retry-after timing in 429 responses

---

## Best Practices

1. **Handle Rate Limits**: Implement exponential backoff for 429 responses
2. **Token Refresh**: Firebase SDK auto-refreshes tokens before expiration
3. **Error Handling**: Always handle 401 errors by re-authenticating user
4. **File Size**: Validate file size client-side before uploading
5. **Progress Updates**: Use chunked processing for large documents
6. **Cost Management**: Monitor Mistral API usage to control costs

---

## Support

For issues or questions:
- GitHub Issues: [github.com/sandeshpawar10/HandWritten-PDF-to-Typed-PDF/issues](https://github.com/sandeshpawar10/HandWritten-PDF-to-Typed-PDF/issues)
- Email: Contact repository owner
