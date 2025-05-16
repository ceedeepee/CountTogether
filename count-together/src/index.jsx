import React, { useEffect, useState } from "react";
import ReactDOM from "react-dom/client";
import * as Multisynq from "@multisynq/client";
import { sdk } from "@farcaster/frame-sdk";

// Custom event handler to bridge Multisynq and React
const eventBus = {
  callbacks: {},
  subscribe: function(event, callback) {
    if (!this.callbacks[event]) this.callbacks[event] = [];
    this.callbacks[event].push(callback);
    return { event, callback };
  },
  publish: function(event, data) {
    if (!this.callbacks[event]) return;
    this.callbacks[event].forEach(callback => callback(data));
  },
  unsubscribe: function(subscription) {
    const { event, callback } = subscription;
    if (!this.callbacks[event]) return;
    this.callbacks[event] = this.callbacks[event].filter(cb => cb !== callback);
  }
};

// Define the model following the Croquet pattern
class ScoreModel extends Multisynq.Model {
  init() {
    this.scores = {};
    this.subscribe(this.id, "increment", this.increment);
  }

  increment(groupId) {
    this.scores[groupId] = (this.scores[groupId] || 0) + 1;
    this.publish("scoresUpdated", this.scores);
  }
}
ScoreModel.register("ScoreModel");

// View class that connects the model to our event bus
class ScoreView extends Multisynq.View {
  constructor(model) {
    super(model);
    this.model = model;
    
    // Subscribe to model events and forward to our event bus
    this.subscribe(this.model.id, "scoresUpdated", scores => {
      eventBus.publish("scoresUpdated", scores);
    });
    
    // Initialize with current scores if available
    if (this.model.scores) {
      eventBus.publish("scoresUpdated", this.model.scores);
    }
  }
}

// React component
function App() {
  const [scores, setScores] = useState({});
  const [session, setSession] = useState(null);
  const [groupId, setGroupId] = useState("global");

  // Initialize the session
  useEffect(() => {
    console.log("Setting up Multisynq connection");
    
    // Use a direct Multisynq join with model and view
    Multisynq.Session.join({
      apiKey: "2r86zJKnHkIahoswFE2W5fsbuOhfnkTKRFqU0OncfI",
      appId: "com.example.countTogether",
      name: "global-count",
      password: "public",
      model: ScoreModel,
      view: ScoreView
    }).then(sessionInstance => {
      console.log("Session joined successfully", sessionInstance);
      setSession(sessionInstance);
      
      // Get Farcaster context if available
      sdk.context.then(context => {
        if (context?.cast?.hash) {
          setGroupId(context.cast.hash);
          console.log("Farcaster context set groupId to:", context.cast.hash);
        }
      }).catch(e => {
        console.error("Failed to get Farcaster context:", e);
      });

      // Subscribe to our event bus instead of directly to the session
      const subscription = eventBus.subscribe("scoresUpdated", updatedScores => {
        console.log("Received score update:", updatedScores);
        setScores(updatedScores);
      });
      
      return () => {
        console.log("Cleaning up session");
        eventBus.unsubscribe(subscription);
        try {
          sessionInstance.leave();
        } catch (e) {
          console.error("Error during cleanup:", e);
        }
      };
    }).catch(error => {
      console.error("Session join error:", error);
    });
  }, []);

  // Handle button click
  const handleClick = () => {
    if (!session) {
      console.error("Session not initialized yet");
      return;
    }
    
    console.log("Button clicked, sending update with groupId:", groupId);
    
    // Publish increment event to the model
    session.publish(session.id, "increment", groupId);
  };

  // Render the leaderboard
  const renderLeaderboard = () => {
    if (Object.keys(scores).length === 0) {
      return <li>No scores yet</li>;
    }
    
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