# 🔍 Kernel Monitor UI

> Ask your Linux kernel what it's doing — in plain English.

A Next.js chat interface for querying live eBPF kernel data via a local AI model. Talks to a self-hosted [kernel-monitor-backend](https://github.com/arthurreira/kernel-monitor-backend) over local network.

![Next.js](https://img.shields.io/badge/Next.js-15-black?style=flat-square)
![TypeScript](https://img.shields.io/badge/TypeScript-5-blue?style=flat-square)
![Tailwind](https://img.shields.io/badge/Tailwind-3-38bdf8?style=flat-square)

## What it does

Type natural language questions about your Linux machine and get AI-powered answers backed by real kernel data:

- *"What is the most active process?"*
- *"What is Docker doing?"*
- *"Is there anything suspicious?"*
- *"Which processes are monitoring memory?"*

## How it works

```
React chat UI (this repo, Mac)
    → HTTP POST to FastAPI backend (ROG/Linux machine)
        → SQLite query (real eBPF kernel events)
            → phi3:mini via Ollama (local AI, no cloud)
                → answer
```

Zero cloud. Zero API costs. Your kernel data never leaves your network.

## Stack

- **Next.js 15** + TypeScript
- **Tailwind CSS**
- Talks to **FastAPI** backend at local network IP

## Getting started

```bash
# Install dependencies
npm install

# Set your Linux machine IP in src/app/page.tsx
const ROG_IP = 'YOUR_LINUX_IP'

# Run
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

> Requires [kernel-monitor-backend](https://github.com/arthurreira/kernel-monitor-backend) running on your Linux machine.

## Related

- [kernel-monitor-backend](https://github.com/arthurreira/kernel-monitor-backend) — eBPF watcher + FastAPI + Ollama