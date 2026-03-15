import { useState } from "react";
import s from "./FaqSection.module.css";

const FAQ_ITEMS = [
    {
        category: "Data & Privacy",
        q: "Where is my data saved?",
        a: "DevNotes is incredibly strict about privacy. There are absolutely no cloud servers watching you. Your entire workspace is saved as a single JSON file directly inside the `DevNotes/` folder precisely where you installed the application on your computer. Your data never leaves your hard drive.",
    },
    {
        category: "Data & Privacy",
        q: "How do I backup my workspace?",
        a: "Because your entire app state is just a single local `.json` file, backup is effortless. Just go to Settings → Data -> Backup / Restore. The app will generate a timestamped snapshot of your exact status. You can store these anywhere. Turn on Auto Backup to have DevNotes automatically rotate through historical snapshots for you every time you save.",
    },
    {
        category: "Syncing & Cloud",
        q: "Can I sync projects across multiple computers?",
        a: "Yes! While DevNotes has no central server, it can abuse GitHub's 'Secret Gist' infrastructure to shuttle encrypted data between your laptops. Go to Settings → GitHub Sync, generate a free Personal Access Token, and DevNotes will silently save your latest `data.json` to a hidden Gist on GitHub. Just paste that same token into DevNotes on your other computer, and they'll stay perfectly mirrored.",
    },
    {
        category: "AI Agent",
        q: "How does the AI Assistant work?",
        a: "DevNotes contains a unique, agentic framework that doesn't just chat—it can actively press buttons and mutate your workspace. Ask the AI to 'Create a project called Website Refactor with 5 tasks' and it will instantly build the structure for you. You are in complete control of the AI; it only takes action when you explicitly instruct it.",
    },
    {
        category: "AI Agent",
        q: "Why do I need my own API keys?",
        a: "Because DevNotes has no subscription fee and no central server! To talk to advanced AI models like LLaMA 3 or Google Gemini, you simply feed the app your own free API keys from Groq or Google. You deal directly with the AI providers, cutting out the middleman entirely.",
    },
    {
        category: "Pro Navigation",
        q: "What is the Quick Capture menu?",
        a: "If you have an epiphany while working in another app, press `Ctrl+Shift+Space`. DevNotes will spawn a tiny floating window where you can instantly type out a Note, Task, or Todo. Hit enter, and it will immediately insert the item into your active DevNotes project without breaking your flow.",
    },
    {
        category: "Pro Navigation",
        q: "What are the global hotkeys?",
        a: "You can toggle the entire DevNotes window from anywhere on your computer using `Ctrl+Shift+D`. Inside the app, use `Ctrl+1` through `Ctrl+9` to instantly jump between the Dashboard, Plan, Notes, Mind Map, and other tabs. See the full list in Settings → Hotkeys.",
    },
    {
        category: "Tools & Tabs",
        q: "What is the Pomodoro tab?",
        a: "A focus timer built on the Pomodoro technique. Start a 25-minute 'Focus' block, and the app will track your session in the background. When time's up, it logs the session to your project history and prompts you to take a 5-minute break.",
    },
    {
        category: "Tools & Tabs",
        q: "What is the Gantt tab?",
        a: "A timeline that visually plots all of your tasks in chronological order based on their due dates. Use it to forecast when major milestones will happen and spot bottlenecks in your project timeline.",
    },
    {
        category: "Tools & Tabs",
        q: "What is the Standup tab?",
        a: "A tool originally built for team scrums, adapted for solo devs. At the end of the day, use the Standup logger to answer three questions: What did I do today? What am I doing tomorrow? Am I blocked? Over time, this generates an awesome historical log of your momentum.",
    },
    {
        category: "Tools & Tabs",
        q: "What is the Decisions (ADR) tab?",
        a: "Architecture Decision Records. Whenever you face a crossroads (e.g., 'Should I use React or Vue?', 'Postgres or SQLite?'), log it here. Write down your options, your criteria, and the final outcome you picked. Months later, when you wonder why you made a weird architectural choice, your ADRs will explain the exact context you were in.",
    },
];

export default function FaqSection() {
    const [openIndex, setOpenIndex] = useState<number | null>(null);

    // Group FAQ items by Category
    const groupedFAQs = FAQ_ITEMS.reduce((acc, item) => {
        if (!acc[item.category]) acc[item.category] = [];
        acc[item.category].push(item);
        return acc;
    }, {} as Record<string, typeof FAQ_ITEMS>);

    return (
        <div className={s.root}>
            <h2 className={s.title}>FREQUENTLY ASKED QUESTIONS</h2>
            <p className={s.desc} style={{ marginBottom: "2em" }}>
                Everything you need to know about DevNotes, its local-first architecture,
                and taking full advantage of the workspace tools.
            </p>

            {Object.entries(groupedFAQs).map(([category, items]) => (
                <div key={category} className={s.categoryGroup}>
                    <h3 className={s.categoryTitle}>{category}</h3>

                    <div className={s.accordion}>
                        {items.map((item) => {
                            const globalIndex = FAQ_ITEMS.indexOf(item);
                            const isOpen = openIndex === globalIndex;
                            return (
                                <div key={item.q} className={`${s.item} ${isOpen ? s.itemOpen : ""}`}>
                                    <button
                                        className={s.questionBtn}
                                        onClick={() => setOpenIndex(isOpen ? null : globalIndex)}
                                    >
                                        <span className={s.qText}>{item.q}</span>
                                        <span className={s.chevron}>{isOpen ? "−" : "+"}</span>
                                    </button>
                                    {isOpen && (
                                        <div className={s.answer}>
                                            {item.a}
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>
            ))}
        </div>
    );
}
