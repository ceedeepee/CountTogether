import React, { useEffect } from "react";
import ReactDOM from "react-dom/client";
// src/index.tsx (or wherever you import it)
import * as Multisynq from "@multisynq/client";

import { sdk } from "@farcaster/frame-sdk";

interface Scores {
  [groupId: string]: number;
}

// shared state logic
class CountModel extends Multisynq.Model {
  scores: Scores = {};
  
  init(): void {
    super.init({});
    this.scores = {};                          // groupId -> click count
    this.subscribe("group", "click", (data: { groupId: string }) => {
      this.scores[data.groupId] = (this.scores[data.groupId]||0) + 1;
      this.publish("scores","updated", this.scores);
    });
  }
}
// Add type assertion to make TypeScript happy
(CountModel as any).register("CountModel");

// UI glue and event wiring
class CountView extends Multisynq.View {
  model: CountModel;
  groupId: string = "global"; // Default value
  
  constructor(model: CountModel) {
    super(model);
    this.model = model;
    // Use async-await for SDK context
    this.initContext();
    this.subscribe("scores","updated", this.render);
    this.render(this.model.scores);
    document.getElementById("btn")!.onclick = () =>
      this.publish("group","click",{groupId:this.groupId});
  }

  // Add a method to initialize context properly
  async initContext() {
    try {
      const context = await sdk.context;
      // Use type assertion to bypass TypeScript checking on the context shape
      // This is necessary because the SDK's type definitions might not match actual response
      const castData = (context as any)?.cast;
      if (castData?.hash) {
        this.groupId = castData.hash;
      }
    } catch (e) {
      console.error("Failed to get Farcaster context:", e);
    }
  }

  render = (scores: Scores) => {
    const el = document.getElementById("board")!;
    const rows = Object.entries(scores)
      .sort((a,b)=>b[1]-a[1])
      .map(([g,c])=>`<li>${g.slice(0,6)}… : ${c}</li>`)
      .join("");
    el.innerHTML = rows;
  };
}
// Add type assertion to make TypeScript happy
(CountView as any).register("CountView");

// React component that boots the session
function App() {
  useEffect(() => {
    Multisynq.Session.join({
      apiKey: "2r86zJKnHkIahoswFE2W5fsbuOhfnkTKRFqU0OncfI",
      appId: "com.example.countTogether",
      name: "global-count",     // everyone uses same room
      password: "public",        // public = no E2EE
      model: CountModel,
      view: CountView
    });
  }, []);
  return (
    <div style={{padding:20, fontFamily:"sans-serif"}}>
      <h1>Count Together</h1>
      <button id="btn">Click me!</button>
      <h2>Global Leaderboard</h2>
      <ul id="board"></ul>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);
root.render(<App />);
