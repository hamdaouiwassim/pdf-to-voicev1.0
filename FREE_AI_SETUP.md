# Free AI Alternatives Setup Guide

## Overview

This guide explains how to set up free alternatives to Google Gemini API for the QA endpoint to avoid rate limits.

## 🆓 Free AI Services Available

### 1. **Groq API** (Recommended - Fast & Free)
- **Free Tier:** 14,400 requests/day
- **Speed:** Very fast (up to 300 tokens/sec)
- **Models:** Llama 3.1, Mixtral, Gemma
- **Setup:**
  1. Sign up at https://console.groq.com
  2. Get your free API key
  3. Add to `.env`: `GROQ_API_KEY=your_key_here`

### 2. **Hugging Face Inference API** (Free)
- **Free Tier:** Unlimited for open models
- **Models:** Mistral, Llama, many others
- **Setup:**
  1. Sign up at https://huggingface.co
  2. Get token at https://huggingface.co/settings/tokens
  3. Add to `.env`: `HUGGINGFACE_API_KEY=your_token_here`

### 3. **Microsoft Edge TTS** (Free TTS)
- **Free:** Completely free, no API key needed
- **Quality:** High quality neural voices
- **Setup:**
  ```bash
  npm install edge-tts
  ```

## 📦 Installation

### Step 1: Install Edge TTS Package
```bash
npm install edge-tts
```

### Step 2: Configure Environment Variables

Add to your `.env` file:

```env
# Enable free AI services (set to 'false' to use Google Gemini)
USE_FREE_AI=true

# Groq API (Recommended - Fast & Free)
GROQ_API_KEY=your_groq_api_key_here
GROQ_MODEL=llama-3.1-8b-instant

# Hugging Face (Alternative)
HUGGINGFACE_API_KEY=your_hf_token_here
HF_MODEL=mistralai/Mistral-7B-Instruct-v0.2

# Provider priority (comma-separated)
FREE_AI_PROVIDER=groq,huggingface
```

### Step 3: Get API Keys

#### Groq API (Easiest - Recommended)
1. Go to https://console.groq.com
2. Sign up with Google/GitHub
3. Navigate to API Keys
4. Create a new API key
5. Copy and add to `.env`

#### Hugging Face (Alternative)
1. Go to https://huggingface.co
2. Sign up for free account
3. Go to Settings → Access Tokens
4. Create a new token with "Read" permission
5. Copy and add to `.env`

## 🚀 Usage

The QA endpoint will automatically:
1. Try free AI services first (if enabled)
2. Fall back to Google Gemini if free services fail
3. Use Edge TTS for audio (free alternative)

### Request Example
```javascript
POST /api/qa
{
  "question": "What is artificial intelligence?",
  "useFreeAI": true  // Optional, defaults to true
}
```

### Response
```json
{
  "answer": "Artificial intelligence (AI) is...",
  "audioUrl": "/api/audio/qa-uuid-here",
  "provider": "free"  // or "google" if using Gemini
}
```

## ⚙️ Configuration Options

### Use Only Free Services
```env
USE_FREE_AI=true
```

### Use Only Google Gemini
```env
USE_FREE_AI=false
```

### Provider Priority
```env
FREE_AI_PROVIDER=groq,huggingface
```
This tries Groq first, then Hugging Face if Groq fails.

## 🔧 Troubleshooting

### "MODULE_NOT_FOUND: edge-tts"
```bash
npm install edge-tts
```

### "GROQ_API_KEY not set"
1. Get free API key from https://console.groq.com
2. Add to `.env` file

### "All free AI providers failed"
- Check your API keys are correct
- Verify internet connection
- Check if rate limits are reached
- System will automatically fall back to Google Gemini

### Rate Limits

**Groq:**
- Free tier: 14,400 requests/day
- Resets daily

**Hugging Face:**
- Varies by model
- Some models have no limits

**Edge TTS:**
- No rate limits (completely free)

## 💡 Benefits of Free Alternatives

1. **No Rate Limits** (Edge TTS)
2. **High Daily Limits** (Groq: 14k/day)
3. **Fast Response Times** (Groq is very fast)
4. **Cost Savings** - Reduce dependency on paid APIs
5. **Fallback Options** - Multiple providers ensure reliability

## 📊 Comparison

| Service | Free Tier | Speed | Quality | Setup Difficulty |
|---------|-----------|-------|---------|------------------|
| Groq | 14k/day | ⚡⚡⚡ Very Fast | ⭐⭐⭐⭐ High | ⭐ Easy |
| Hugging Face | Unlimited | ⚡⚡ Medium | ⭐⭐⭐ Good | ⭐⭐ Medium |
| Edge TTS | Unlimited | ⚡⚡⚡ Fast | ⭐⭐⭐⭐ High | ⭐ Easy |
| Google Gemini | Paid | ⚡⚡ Medium | ⭐⭐⭐⭐⭐ Excellent | ⭐ Easy |

## 🎯 Recommended Setup

1. **Primary:** Groq API (fast, free, reliable)
2. **Fallback:** Hugging Face (unlimited for some models)
3. **TTS:** Edge TTS (completely free, high quality)
4. **Emergency:** Google Gemini (if all free services fail)

## 📝 Notes

- Free services may have slight quality differences
- Groq is recommended for best balance of speed/quality/free
- Edge TTS supports 100+ languages
- All services include automatic fallback to Google Gemini

## 🔗 Useful Links

- Groq Console: https://console.groq.com
- Hugging Face: https://huggingface.co
- Edge TTS Docs: https://github.com/rany2/edge-tts
- Edge TTS Voices: https://speech.platform.bing.com/consumer/speech/synthesize/readaloud/voices/list

