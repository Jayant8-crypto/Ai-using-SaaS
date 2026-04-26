# 🚀 AI SaaS Prototype – Image + Video Generation

> ⚠️ This is a prototype built for learning system design and cybersecurity concepts. Not production-ready.
---

## 📌 Overview

An AI-powered SaaS prototype that:
- Combines a **model image + product image**
- Generates a new AI image
- Converts the output into a short video

This project focuses not just on building features, but on understanding **how real-world systems are designed and secured**.

---

## ⚙️ Features

- 🖼️ AI Image Generation (multi-input)
- 🎬 Image → Video conversion
- 🔐 Authentication & session handling
- 🔄 Webhook-based processing
- 📊 Error monitoring & logging
- ☁️ Cloud deployment ready

---

## 🧩 Tech Stack

| Category        | Technology |
|----------------|-----------|
| Language       | TypeScript |
| Auth           | Clerk |
| Database       | Neon (PostgreSQL) |
| ORM            | Prisma |
| Monitoring     | Sentry |
| Deployment     | Vercel, Render |

---

## 🏗️ Architecture (High-Level)

Client → API → Webhooks → AI Processing → Database → Response  

Focus areas:
- Secure authentication flow  
- Event-driven backend  
- Observability & monitoring  

---

## 🎓 Learning Approach

Built by learning through videos and applying concepts hands-on.  
Each feature was implemented and adapted—not just copied.

---

## 🔐 Cybersecurity Insights

This project is also a practical cybersecurity learning system.

Explored:
- Session security & authentication flows  
- Webhook validation & trust boundaries  
- API misuse prevention  
- Logging & anomaly detection  
- Designing with an **“assume breach” mindset**  

---

## ⚠️ Current Status

- Prototype stage  
- AI API pipeline temporarily disabled  
- Under refactoring for reliability & cost control  

---

## 🚀 What's Next

- Thinking like an attacker  
- Building like a defender  

---

## 📦 Setup & Installation

```bash
# Clone repo
git clone https://github.com/your-username/your-repo-name.git

# Go to project
cd your-repo-name

# Install dependencies
npm install

# Setup environment variables
cp .env.example .env

# Run dev server
npm run dev
