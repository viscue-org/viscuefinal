# Supabase Authentication & Extension OAuth 2.1 Setup Guide

This guide details the exact dashboard configuration required for the Viscue web application and Chrome extension OAuth 2.1 authentication flow.

---

## 1. Authentication Configuration

In the [Supabase Dashboard](https://supabase.com/dashboard):
Navigate to **Authentication > Configuration > URL Configuration**:

### Site URL
* Set to your production Vercel site URL:
  ```
  https://viscue.com (or https://your-project.vercel.app)
  ```
* For local development:
  ```
  http://localhost:3000
  ```

### Redirect URLs Allowlist
Under **Redirect URLs**, add the exact authorized redirect URLs (never use open wildcards):
* `https://viscue.com/auth/callback`
* `https://viscue.com/connect`
* `http://localhost:3000/auth/callback`
* `http://localhost:3000/connect`
* `https://<YOUR_CHROME_EXTENSION_ID>.chromiumapp.org/oauth`
* `https://<YOUR_CHROME_EXTENSION_ID>.chromiumapp.org/`

---

## 2. Email Provider Configuration

Under **Authentication > Providers > Email**:
* **Enable Email Provider**: `ON`
* **Confirm email**: `ON` (enforces email verification before account activation)
* **Secure email change**: `ON`
* **Mailer OTP Expiry**: `3600` seconds (1 hour)

---

## 3. Google OAuth Provider

Under **Authentication > Providers > Google**:
* **Enable Sign in with Google**: `ON`
* **Client ID**: Input your Google Cloud OAuth 2.0 Web Client ID
* **Client Secret**: Input your Google Cloud OAuth 2.0 Client Secret
* **Authorized Redirect URI in Google Cloud Console**:
  Copy the Callback URL from Supabase (e.g. `https://vqqaxhzqaehjdpoefrjc.supabase.co/auth/v1/callback`) and paste it into Google Cloud credentials.

---

## 4. Supabase OAuth 2.1 Server for Chrome Extension

Under **Authentication > OAuth 2.1 Server**:
* **Enable OAuth 2.1 Server**: `ON`
* **Register Client**:
  * **Client Name**: `Viscue Chrome Extension`
  * **Client ID**: `viscue-extension`
  * **Client Type**: `Public` (PKCE enabled, no client secret required)
  * **Redirect URIs**:
    `https://<YOUR_CHROME_EXTENSION_ID>.chromiumapp.org/oauth`
  * **Authorization Path**: Custom `/connect` page on your Next.js application.

---

## 5. Security & Session Hygiene

Under **Authentication > Security**:
* **Enable Refresh Token Rotation**: `ON`
* **Detect Reuse of Refresh Tokens**: `ON` (immediately revokes family upon reuse)
* **JWT Expiry limit**: `3600` seconds (1 hour)
* **Refresh Token Expiry**: `30` days
