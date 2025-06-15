# 🧠 Competitive Programming Analyzer

A full-stack AI-powered platform to **track**, **analyze**, and **interact** with competitive programming data from LeetCode, Codeforces, and CodeChef.

This project combines:
- 🔁 Backend automation for scheduled contest data ingestion
- 📊 Frontend dashboards for insightful visual analytics
- 🧠 A natural language query interface using LLMs and LangGraph

---

## 🚀 Key Features

### 🧩 Backend: Automated Data Pipeline
- Fetches and stores student participation data from **LeetCode**, **Codeforces**, and **CodeChef**.
- Runs a **scheduling logic** (at midnight) to check if a contest ended on that day.
- If yes, schedules a follow-up fetch at an **8-hour offset** to allow for rating updates.
- Data includes contest names, rankings, questions attempted, ratings, etc.
- Designed using **Prisma ORM** and a **PostgreSQL database** (hosted on Neon).

> The backend is structured around a normalized relational schema linking students, contests, and platform-specific participations, with indexing and uniqueness constraints for integrity and performance.

---

### 📊 Frontend: Visual Analytics Dashboard
Built with **Next.js**, **React**, **TailwindCSS**, and **Chart.js**, the UI offers:

- **Executive Summary:** Quick view of average participation, top performers, and contest frequency.
- **Leaderboard:** Sortable rankings based on performance across all contests.
- **Analysis Page:** Line charts for attendance trends and bar charts for performance over time.
- **Filters:** Customize views by department, batch, contest platform, and more.

> The frontend is focused on educators and mentors, helping them monitor engagement, track growth, and support students better.

---

### 🤖 Modal: Natural Language Query Engine
Powered by **LangGraph**, **Ollama (LLaMA 3.2)**, and **Gradio**, this module lets users query the database like:

> “Who has the highest Codeforces rating?”  
> “How many students are from each department?”

#### How it works:
1. User asks a natural language question via a Gradio UI.
2. The question is parsed by an LLM into an SQL query using LangGraph state management.
3. The SQL query is executed on the live Neon PostgreSQL DB using `psycopg2`.
4. The result is translated back into a readable response and displayed in the UI.

---

## ⚙️ Tech Stack

| Layer        | Tech Used                                   |
|--------------|---------------------------------------------|
| Frontend     | Next.js, React, TailwindCSS, Chart.js       |
| Backend      | Node.js, Prisma ORM, PostgreSQL             |
| AI Interface | LangGraph, LLaMA 3.2 (Ollama), Gradio       |
| Database     | Neon PostgreSQL                             |
| Tools        | Node Schedule, dotenv, ts-node, Python      |

---

## 🗓️ Cron & Scheduling Logic

- **Midnight cron job:** Scans for contests that ended "today".
- **Scheduled fetch:** For each contest, schedules a fetch task with an **8-hour delay** to ensure updated ratings.
- Built using `node-cron` and `node-schedule`.

---

## 🧪 Example Questions (Modal)

- "Who participated in the most contests?"
- "Average LeetCode rating of 3rd-year students?"
- "Top 5 students by Codeforces rating?"
- "Which department has the highest average rating?"

---
