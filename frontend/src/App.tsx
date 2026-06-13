import { useState } from "react";
import GroupSessions from "./pages/GroupSessions";
import PersonalTraining from "./pages/PersonalTraining";
import WomenRegistration from "./pages/WomenRegistration";
import "./App.css";

type Tab = "group" | "personal" | "registration";

export default function App() {
  const [tab, setTab] = useState<Tab>("group");

  return (
    <div className="app">
      <header className="header">
        <div className="header-inner">
          <div className="logo-wrap">
            <h1 className="logo">FitjAIo</h1>
            <span className="logo-sub">klub sportowy dla kobiet</span>
          </div>
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
            <button
              className={`nav-btn${tab === "registration" ? " active" : ""}`}
              onClick={() => setTab("registration")}
            >
              Zapisy
            </button>
          </nav>
        </div>
      </header>
      <main className="main">
        {tab === "group" && <GroupSessions />}
        {tab === "personal" && <PersonalTraining />}
        {tab === "registration" && <WomenRegistration />}
      </main>
    </div>
  );
}
