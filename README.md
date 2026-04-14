**OpenSilk** is a system built to run and manage AI workers. It turns complex AI "thinking" into reliable actions by separating the user interface, the system manager, and the AI brains.

---

## The Three Main Parts

OpenSilk is divided into three distinct layers to ensure that the system is fast, organized, and easy to maintain.

| Component                           | Responsibility                                                                                                                     | Technology |
| :---------------------------------- | :--------------------------------------------------------------------------------------------------------------------------------- | :--------- |
| **The Dashboard** (`opensilk-web`)  | This is the **Front Door**. It is a website where you type in goals, give orders, and watch the AI work in real-time.              | **Vite**   |
| **The Hub** (`opensilk-server`)     | This is the **Middleman**. It moves data between the website and the AI workers, making sure every command is delivered instantly. | **Rust**   |
| **The Workers** (`opensilk-agents`) | These are the **Brains**. They run the AI logic to either follow a fixed plan or figure out a problem on the fly.                  | **Python** |

---

## Folder Structure

The project is organized so that every part has its own dedicated space while staying connected in one main folder.

```text
opensilk/
├── opensilk-web/          # The website files (Vite)
│   ├── src/               # The screens you see
│   └── public/            # Icons and images
├── opensilk-server/       # The central hub (Rust)
│   ├── src/               # The code that moves data
│   ├── migrations/        # Setup for the permanent database
│   └── Cargo.toml         # Settings for the Rust hub
├── opensilk-agents/       # The AI brains (Python)
│   ├── workflows/         # Fixed, step-by-step plans
│   ├── loops/             # Thinking agents that solve problems
│   └── main.py            # The starting point for workers
├── docker-compose.yml     # The master switch to start the whole system
└── README.md              # Main project guide
```

---

## Storage and Memory

To keep the system running smoothly without losing work, OpenSilk uses two specialized storage tools.

### 1. Redis 8 (Quick Memory)
Think of this as the **"Active Notepad"** on a worker's desk.
* **Its Job:** It stores information that is needed *right now*.
* **Why:** It is incredibly fast. When an AI agent is in the middle of a task, it uses Redis to remember its very last step without any lag.

### 2. Postgres 18 (Permanent Storage)
Think of this as the **"Filing Cabinet"** in the back office.
* **Its Job:** It stores the history of every task ever completed.
* **Why:** It provides a safe, long-term record. You can look back at Postgres months later to see exactly how a job was finished.

---

## How the System Works

1.  **The Order:** You type a task into the **Dashboard**.
2.  **The Hand-off:** The **Hub** (Rust) saves the task in **Postgres** and tells a **Worker** (Python) to start.
3.  **The Work:** The Worker starts thinking. It uses **Redis** to store its current progress so it doesn't get confused.
4.  **The Update:** As the Worker finishes each step, it sends a note back to the Hub, which immediately shows the progress on your Dashboard.
5.  **The Finish:** When the job is done, the final result is saved in **Postgres** forever.