import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import * as Multisynq from "@multisynq/client";
import { sdk } from "@farcaster/frame-sdk";

// Properly define the model class following Croquet patterns
class CountModel extends Multisynq.Model {
  init() {
    this.scores = {};
    this.subscribe(this.sessionId, "incrementScore", this.incrementScore);
  }

  incrementScore(groupId) {
    this.scores[groupId] = (this.scores[groupId] || 0) + 1;
    this.publish("scoresUpdated", this.scores);
  }
}
// Register using the static method at the class level
Multisynq.Model.register("CountModel", CountModel);

class CountView extends Multisynq.View {
  constructor(model) {
    super(model);
    this.model = model;
    // React component will handle subscriptions directly
  }
}
// Register the view
Multisynq.View.register("CountView", CountView);

// Main React component
function App() {
  const [scores, setScores] = useState({});
  const [session, setSession] = useState(null);
  const [groupId, setGroupId] = useState("global");

  // Initialize the session
  useEffect(() => {
    console.log("Setting up direct Multisynq connection");
    
    // First initialize the Multisynq Model system
    // This prevents "Model class not registered" errors
    const initPromise = Multisynq.Session.join({
      apiKey: "2r86zJKnHkIahoswFE2W5fsbuOhfnkTKRFqU0OncfI",
      appId: "com.example.countTogether",
      name: "global-count",
      password: "public",
      model: CountModel,
      view: CountView
    });
    
    let cleanup = null;
    
    initPromise.then(async sessionInstance => {
      console.log("Session joined successfully:", sessionInstance);
      setSession(sessionInstance);
      
      // Get Farcaster context if available
      try {
        const context = await sdk.context;
        if (context?.cast?.hash) {
          setGroupId(context.cast.hash);
          console.log("Farcaster context set groupId to:", context.cast.hash);
        }
      } catch (e) {
        console.error("Failed to get Farcaster context:", e);
      }

      // Listen for score updates
      const subscription = sessionInstance.subscribe(sessionInstance.id, "scoresUpdated", updatedScores => {
        console.log("Received score update:", updatedScores);
        setScores(updatedScores);
      });

      // Get initial scores from the model
      if (sessionInstance.vm && sessionInstance.vm.models) {
        const models = Object.values(sessionInstance.vm.models);
        for (const model of models) {
          if (model.scores) {
            console.log("Found existing scores:", model.scores);
            setScores(model.scores);
            break;
          }
        }
      }
      
      // Setup cleanup
      cleanup = () => {
        console.log("Cleaning up session");
        sessionInstance.unsubscribe(subscription);
        sessionInstance.leave();
      };
    }).catch(error => {
      console.error("Session join error:", error);
    });
    
    return () => {
      if (cleanup) cleanup();
    };
  }, []);

  // Handle button click
  const handleClick = () => {
    if (!session) {
      console.error("Session not initialized yet");
      return;
    }
    
    console.log("Button clicked, sending update with groupId:", groupId);
    
    // Publish to the model to increment score
    session.publish(session.id, "incrementScore", groupId);
  };

  // Render the leaderboard
  const renderLeaderboard = () => {
    return Object.entries(scores)
      .sort((a, b) => b[1] - a[1])
      .map(([group, count], index) => (
        <li key={index}>{group.slice(0, 6)}… : {count}</li>
      ));
  };

  return (
    <div style={{ padding: 20, fontFamily: "sans-serif" }}>
      <h1>Count Together</h1>
      <button 
        id="btn" 
        onClick={handleClick}
        style={{ 
          padding: '10px 20px', 
          fontSize: '16px', 
          cursor: 'pointer',
          backgroundColor: '#4CAF50',
          color: 'white',
          border: 'none',
          borderRadius: '4px'
        }}
      >
        Click me!
      </button>
      <h2>Global Leaderboard</h2>
      <ul id="board">
        {renderLeaderboard()}
      </ul>
      <div style={{ marginTop: '20px', fontSize: '14px' }}>
        Your Group ID: {groupId}
      </div>
    </div>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(<App />); 