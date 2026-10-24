# PropertyIQ AI — Pakistan Real Estate Platform

**AI-Powered Real Estate Discovery, Project Inventory, Investment Intelligence & Evidence-Based Verification**

Master repository for PropertyIQ AI tailored specifically for the Pakistani property ecosystem (Lahore, Islamabad/Rawalpindi, Karachi).

---

## 🏗️ Architecture Overview

The system is architected as a modular monolith for the core application with an independent Python AI microservice and multi-channel frontends.

```
PropertyIQ/
├── apps/
│   ├── web/                     # Next.js 15 (TypeScript, Tailwind CSS, App Router)
│   └── mobile/                  # React Native + Expo (Field Ops & Discovery)
├── services/
│   ├── api/                     # ASP.NET Core LTS Web API (C#, EF Core)
│   │   ├── PropertyIQ.slnx
│   │   ├── src/
│   │   │   ├── PropertyIQ.Domain/         # Clean POCO domain models & Pakistan rules
│   │   │   ├── PropertyIQ.Application/    # DTOs, interfaces, validation
│   │   │   ├── PropertyIQ.Infrastructure/ # EF Core, PostgreSQL, JWT Auth, Storage
│   │   │   └── PropertyIQ.Api/            # REST API, Serilog, Swagger/OpenAPI
│   │   └── tests/
│   │       └── PropertyIQ.UnitTests/      # xUnit tests for domain and auth
│   └── ai/                      # Python 3.13 FastAPI AI Service (Search & Scenarios)
├── docker-compose.yml           # Local container orchestration
└── start-dev.ps1                # One-click local development runner
```

---

## 🇵🇰 Pakistan Market Data Principles

1. **Exact Currency:** All financial values (`Price`, `Amounts`, `Installments`, `Fees`) use exact `decimal(18,2)` with currency explicitly stored as `"PKR"`.
2. **Local Land Measurement Units:** Structured support for `Marla`, `Kanal`, `SqYards`, `SqFt`, and `Acres`.
3. **Structured Hierarchy:** `Developer Org → Project → Phase → Block/Tower → Inventory Unit`.
4. **Concurrency-Safe Inventory:** Row versions protect units from double reservation (`Available`, `Reserved`, `Booked`, `Sold`).
5. **Installment Schedules:** Automated generation and tracking of booking, down payments, periodic installments, and possession payments.
6. **Transparent Due Diligence:** Evidence-backed verification (basic document audit, physical inspection, official records inquiry) with explicit limitations—never claiming 100% legal title guarantees.

---

## 🚀 Quick Start (Local Development)

### Prerequisites
- .NET 10 SDK
- Node.js 22+ & npm
- Python 3.13+
- PostgreSQL 16+
- [Ollama](https://ollama.com) (optional but recommended for hybrid NL search) with `qwen2.5:7b`

### Run with PowerShell
```powershell
.\start-dev.ps1
```

`start-dev.ps1` brings services up in order: Postgres → **Ollama** → AI (FastAPI) → API → Web. If Ollama is installed but not running, the script starts `ollama serve`. Without Ollama, the AI service still runs and falls back to the rule parser.

### Access Services
- **Web App:** [http://localhost:3000](http://localhost:3000)
- **API Swagger Documentation:** [http://localhost:5000/swagger](http://localhost:5000/swagger)
- **AI Microservice Docs:** [http://localhost:8000/docs](http://localhost:8000/docs) (falls back to `:8001` / `:8002` if busy)
- **Ollama:** [http://127.0.0.1:11434](http://127.0.0.1:11434)
- **Parse ops log:** `services/ai/logs/search-parser.jsonl`

### Pre-Seeded Test Credentials
| Role | Email | Password |
|---|---|---|
| Super Admin | `admin@propertyiq.pk` | `Admin@12345` |
| Developer | `developer@skylinedev.pk` | `Developer@12345` |
| Agent | `agent@lahoreproperties.pk` | `Agent@12345` |
| Specialist | `specialist@propertyiq.pk` | `Specialist@12345` |
| Customer / Buyer | `buyer@gmail.com` | `Buyer@12345` |
