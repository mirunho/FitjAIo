import { useState } from "react";
import GroupSessions from "./pages/GroupSessions";
import PersonalTraining from "./pages/PersonalTraining";
import "./App.css";

type Tab = "group" | "personal";

export default function App() {
  const [tab, setTab] = useState<Tab>("group");

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <h1 className="logo">FitjAIo</h1>
          <nav className="nav">
            <button
              className={`nav-btn${tab === "group" ? " active" : ""}`}
              onClick={() => setTab("group")}
            >
              Zajecia grupowe
            </button>
            <button
              className={`nav-btn${tab === "personal" ? " active" : ""}`}
              onClick={() => setTab("personal")}
            >
              Treningi personalne
            </button>
          </nav>
        </div>
      </header>
      <main className="main">
        {tab === "group" ? <GroupSessions /> : <PersonalTraining />}
      </main>
    </div>
  );
}
