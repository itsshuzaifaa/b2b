# B2B LINK - Global B2B Marketplace Platform

**B2B LINK** is a full-featured, modern B2B wholesale marketplace platform built with **Next.js 16**, **React 19**, **Supabase**, and **Resend**. It seamlessly connects verified buyers and sellers worldwide with instant RFQs, custom quotations, real-time messaging, WTB (Want-To-Buy) broadcast matching, and a comprehensive site administration suite.

---

## 🚀 Tech Stack

- **Framework**: [Next.js 16 (App Router with Turbopack)](https://nextjs.org/)
- **Frontend**: React 19, Tailwind CSS v4, Lucide React
- **Database & Auth**: [Supabase](https://supabase.com/) (PostgreSQL with Row Level Security)
- **Transactional Email**: [Resend](https://resend.com/)
- **Deployment**: [Vercel](https://vercel.com/)

---

## 📋 Features

- 🏬 **Verified Marketplace**: Browse verified wholesale listings with tier pricing, MOQ, and detailed specs.
- 💬 **Direct Inquiries & Messaging**: Buyers can inquiry directly about products and negotiate terms.
- 📋 **WTB (Want-To-Buy) Broadcast Requests**: Buyers post purchase demands; verified sellers receive matches.
- 📄 **Quotation Management**: Generate, review, accept, or decline formal B2B price quotations.
- 🛡️ **Role-Based Portals**:
  - **Buyer Portal**: Saved quotes, inquiries, and request tracking.
  - **Seller Portal**: Product catalog management, quotes dispatcher, lead tracking.
  - **Site Administration (`/site-admin`)**: User vetting, member tier management, broadcasts, and audit logs.
- ✉️ **Email Dispatching**: Automated email notifications for verification codes, password resets, and quotations via Resend.

---

## 🛠️ Environment Variables Setup

Copy `.env.example` to `.env.local`:

```bash
cp .env.example .env.local
```

Configure the following variables in your `.env.local` (and in your **Vercel Project Settings > Environment Variables**):

| Variable | Description |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Your Supabase Project URL (`https://xyz.supabase.co`) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Your Supabase Project Public/Anon API Key |
| `SUPABASE_SERVICE_ROLE_KEY` | Your Supabase Project Service Role Key (for admin API actions) |
| `RESEND_API_KEY` | Your API Key from [Resend](https://resend.com/) |
| `RESEND_FROM_EMAIL` | Verified sender email address (e.g., `B2B LINK <notifications@yourdomain.com>`) |
| `NEXT_PUBLIC_APP_URL` | Application root URL (`http://localhost:3000` for local, production domain on Vercel) |

---

## 💻 Local Development

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Run development server**:
   ```bash
   npm run dev
   ```

3. **Production build check**:
   ```bash
   npm run build
   ```

---

## 🚢 Deploying to GitHub & Vercel

### Step 1: Push to GitHub
1. Create a repository on GitHub (e.g. `https://github.com/<your-username>/b2b-link`).
2. Push your code:
   ```bash
   git branch -M main
   git push -u origin main
   ```

### Step 2: Deploy on Vercel
1. Log in to [Vercel](https://vercel.com/).
2. Click **"Add New"** > **"Project"**.
3. Import your **`b2b-link`** repository from GitHub.
4. In the **Environment Variables** section, add:
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `RESEND_API_KEY`
   - `RESEND_FROM_EMAIL`
   - `NEXT_PUBLIC_APP_URL` (Set to `https://your-project.vercel.app`)
5. Click **Deploy**. Vercel will build and deploy your application automatically on every git push!
