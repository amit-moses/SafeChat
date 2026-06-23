# AmitMagen SafeChat

A real-time safe messaging platform for kids and teens, featuring an on-device AI toxicity detector and an empathetic AI counselor powered by Google Gemini.

## Overview

AmitMagen SafeChat is a full-stack React chat application that intercepts harmful messages before they are sent, using a custom-trained DistilBERT model running entirely in the browser via WebAssembly. When a toxic message is detected, the user is redirected to **Sage** — an AI counselor that helps them process their feelings constructively.

## How It Works

### 1. Toxicity Detection (On-Device AI)

A DistilBERT model was fine-tuned on the [`google/civil_comments`](https://huggingface.co/datasets/google/civil_comments) dataset to classify messages as safe or toxic. The model was exported to ONNX format and runs directly in the browser using `onnxruntime-web` and WebAssembly — no server call is made for classification, ensuring low latency and privacy.

When a user types a message and hits send, the text is tokenized using a custom JavaScript WordPiece tokenizer and passed through the ONNX model. If the toxicity probability exceeds 50%, the message is blocked before reaching Firestore.

### 2. Sage — AI Counselor

When a message is blocked, the user is automatically redirected to a private wellness chat with **Sage**, an empathetic AI counselor built on Google Gemini 2.5 Flash. Sage guides the user through understanding their emotions, validates their feelings without judgment, and helps them find healthier ways to express themselves. The full conversation history is maintained for multi-turn context. Gemini is only invoked when a toxic message is detected — never at startup.

### 3. Real-Time Chat

The chat system is built on Firebase Firestore with real-time listeners, supporting direct messages and group chats, typing indicators, message reactions, read receipts, and online status.

## Tech Stack

| Layer | Technology |
| --- | --- |
| Frontend | React + Vite |
| AI (toxicity) | DistilBERT → ONNX → onnxruntime-web (WebAssembly) |
| AI (counselor) | Google Gemini 2.5 Flash API |
| Database | Firebase Firestore |
| Auth | Firebase Authentication (email/password + Google) |
| Deployment | Vercel (frontend + serverless API) |
| Model training | Python, HuggingFace Transformers, Google Colab (T4 GPU) |

## Model Training

The toxicity classifier was trained in [`public/model/toxicity_classifier.ipynb`](public/model/toxicity_classifier.ipynb) using:

- **Base model:** `distilbert-base-uncased` (66M parameters)
- **Dataset:** `google/civil_comments` — 230,000 samples total (180,000 used for training)
- **Labels:** Binary — *toxic* if any of 7 toxicity dimensions exceeds 0.5
- **Training:** 6 epochs, weighted cross-entropy loss to handle class imbalance, best checkpoint selected by F1 score
- **Export:** Converted to ONNX via HuggingFace Optimum for browser inference

The exported model artifacts (`model.onnx`, tokenizer, and config) live alongside the notebook in [`public/model/`](public/model/) and are loaded at runtime by the browser. The `.onnx` weights are tracked with Git LFS.

## Architecture

```
User types message
        ↓
DistilBERT ONNX (browser / WebAssembly)
        ↓
   toxic? ──NO──→ Firestore → delivered to chat
        │
       YES
        ↓
 Message blocked
        ↓
 Redirect to Sage (/counselor)
        ↓
 Gemini 2.5 Flash (Vercel serverless function)
        ↓
 Sage counsels the user
        ↓
 User returns to chat when ready
```

## Getting Started

```bash
# Install dependencies
npm install

# Run the dev server
npm run dev

# Build for production
npm run build
```

Copy `.env.example` to `.env` and fill in your Firebase credentials. The `GEMINI_API_KEY` is server-side only and should be configured as a Vercel environment variable, never committed.

## Environment Variables

```
VITE_FIREBASE_API_KEY
VITE_FIREBASE_AUTH_DOMAIN
VITE_FIREBASE_PROJECT_ID
VITE_FIREBASE_STORAGE_BUCKET
VITE_FIREBASE_MESSAGING_SENDER_ID
VITE_FIREBASE_APP_ID
VITE_FIREBASE_MEASUREMENT_ID
GEMINI_API_KEY
```
