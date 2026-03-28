# Gemini API Integration Guide

## Overview

This project now includes integrated support for Google's Gemini AI API with built-in rate limiting and error handling to prevent quota exhaustion.

## Features

✅ **API Key Management** - Secure storage and validation  
✅ **Request Throttling** - Prevents too many requests too quickly  
✅ **Rate Limiting** - Max 30 requests per minute (configurable)  
✅ **Error Handling** - Graceful error messages for invalid keys or rate limits  
✅ **React Context** - Global API key management  
✅ **Custom Hooks** - Easy integration in components  
✅ **UI Components** - Settings dialog and rate limit indicator  

## Setup Instructions

### Step 1: Get Your Gemini API Key

1. Visit [Google AI Studio](https://makersuite.google.com/app/apikey)
2. Click "Create API Key"
3. Copy your API key (starts with `AIzaSy`)

### Step 2: Configure in Application

The application provides a UI-based configuration:

1. Look for the "API Settings" button in the header
2. Click to open the configuration dialog
3. Paste your API key
4. Click "Save & Validate"
5. The app will test the key with a simple request

**The API key is stored in localStorage and encrypted in production environments.**

### Step 3: Using Gemini Features

#### In Chat Components

```tsx
import { ChatWithGemini } from '@/components/ChatWithGemini';

export default function App() {
  return <ChatWithGemini />;
}
```

#### Using the Hook

```tsx
import { useGemini } from '@/hooks/useGemini';

function MyComponent() {
  const { generateContent, loading, error } = useGemini();

  const handleGenerate = async () => {
    try {
      const response = await generateContent('Your prompt here');
      console.log(response);
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <button onClick={handleGenerate} disabled={loading}>
      Generate
    </button>
  );
}
```

#### Using the Service Directly

```tsx
import { geminiService } from '@/services/geminiService';

// Set API key
geminiService.setApiKey(yourApiKey);

// Generate content
const response = await geminiService.generateContent('Your prompt');

// Analyze data
const analysis = await geminiService.analyzeData(data, 'CSV data');
```

## Rate Limiting

### How It Works

The application implements **two levels of rate limiting**:

1. **Request Queue** - Ensures requests are processed sequentially
2. **Throttling** - Enforces minimum 100ms between requests
3. **Minute Limit** - Maximum 30 requests per minute

### Default Settings

```typescript
maxRequestsPerMinute: 30    // Conservative limit
minRequestInterval: 100ms   // Between requests
requestWindow: 60000ms      // 1 minute window
```

### Monitoring Rate Limits

Use the `RateLimitIndicator` component to display status:

```tsx
import { RateLimitIndicator } from '@/components/RateLimitIndicator';

export default function MyApp() {
  return <RateLimitIndicator />;
}
```

Or check programmatically:

```tsx
import { geminiService } from '@/services/geminiService';

console.log(geminiService.getRemainingRequests()); // Number of requests left
console.log(geminiService.isRateLimited());        // Boolean
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "API key not set" | No API key configured | Use API Settings button to add key |
| "Invalid API key format" | Wrong key format | Verify key starts with "AIzaSy" |
| "Rate limit exceeded" | Too many requests | Wait before making more requests |
| "Too many requests (429)" | API quota exceeded | Wait 24 hours or upgrade API plan |
| "Invalid API key (401/403)" | Key is invalid/revoked | Check key and regenerate if needed |

### Handling Errors in Code

```tsx
const { generateContent, error } = useGemini({
  onError: (error) => {
    if (error.message.includes('Rate limit')) {
      // Handle rate limiting
      showWarning('Please wait before making more requests');
    } else if (error.message.includes('Invalid API key')) {
      // Handle invalid key
      redirectToSettings();
    } else {
      // Handle other errors
      showError(error.message);
    }
  },
});
```

## Security Considerations

### Local Storage Warning

⚠️ **Important**: The API key is stored in browser localStorage by default. In **production**:

1. Use encrypted storage
2. Consider moving API calls to a backend server
3. Implement proper authentication
4. Never expose keys in version control

### Best Practices

```tsx
// ✅ DO: Keep keys in environment variables
const apiKey = import.meta.env.VITE_GEMINI_API_KEY;

// ❌ DON'T: Hard-code keys
const apiKey = "<your_gemini_api_key>"; // Never hardcode real keys

// ✅ DO: Use the context provider
import { useApiKey } from '@/context/ApiKeyContext';

// ✅ DO: Validate keys before use
import { validateApiKey } from '@/lib/apiKeyValidation';
const result = validateApiKey(apiKey);
```

## Configuration Options

### Environment Variables

Create `.env.local`:

```env
VITE_GEMINI_API_KEY=<your_gemini_api_key>
VITE_GEMINI_RATE_LIMIT=30
VITE_GEMINI_REQUEST_INTERVAL=100
VITE_GEMINI_DEBUG=false
```

### Modify Rate Limits

Edit `src/services/geminiService.ts`:

```typescript
private maxRequestsPerMinute = 30; // Change this
private minRequestInterval = 100;   // And this
```

## Troubleshooting

### API Key Not Being Saved

```tsx
// Check localStorage
console.log(localStorage.getItem('gemini_api_key'));

// Clear and re-enter
localStorage.removeItem('gemini_api_key');
```

### Requests Getting Throttled

```tsx
// Check rate limit status
import { geminiService } from '@/services/geminiService';
console.log('Remaining:', geminiService.getRemainingRequests());
console.log('Limited:', geminiService.isRateLimited());
```

### CORS Issues

If you see CORS errors, the API calls might need to go through a backend proxy in production.

## Examples

### Data Analysis

```tsx
import { useGemini } from '@/hooks/useGemini';

function DataAnalyzer() {
  const { analyzeData, loading, error } = useGemini();

  const handleAnalyze = async (csvData: string) => {
    try {
      const analysis = await analyzeData(csvData, 'CSV data');
      console.log('Analysis:', analysis);
    } catch (err) {
      console.error('Analysis failed:', err);
    }
  };

  return (
    // Component JSX
  );
}
```

### Chat Interface

```tsx
import { ChatWithGemini } from '@/components/ChatWithGemini';

export default function ChatPage() {
  return <ChatWithGemini />;
}
```

## Support & Resources

- [Google Gemini API Docs](https://ai.google.dev/docs)
- [API Reference](https://ai.google.dev/docs/api_overview)
- [Rate Limits](https://ai.google.dev/docs/rate_limits)
- [Create API Key](https://makersuite.google.com/app/apikey)
