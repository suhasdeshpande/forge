import { useEffect, useMemo, useRef, useState } from "react";

import "./App.css";

const defaultPrompt = "Generate Hello World React app";

export type PipelineEvent =
  | { type: "pipeline_start"; state: unknown }
  | { type: "step_start"; step: string; state: unknown }
  | { type: "step_event"; step: string; event: unknown }
  | { type: "step_end"; step: string; state: unknown }
  | { type: "pipeline_end"; state: unknown };

type StreamedEvent = { id: number; payload: PipelineEvent };

type StreamStatus = "idle" | "streaming" | "done" | "error";

function parseEvent(data: string): PipelineEvent | null {
  try {
    const parsed = JSON.parse(data) as PipelineEvent;
    if (typeof parsed === "object" && parsed !== null && "type" in parsed) {
      return parsed;
    }
  } catch (error) {
    console.warn("Failed to parse event", error);
  }
  return null;
}

export default function Home() {
  const [prompt, setPrompt] = useState(defaultPrompt);
  const [events, setEvents] = useState<StreamedEvent[]>([]);
  const [status, setStatus] = useState<StreamStatus>("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const sourceRef = useRef<EventSource | null>(null);
  const endpoint =
    import.meta.env.VITE_PIPELINE_ENDPOINT ?? "http://localhost:8787/generate";

  useEffect(() => {
    return () => {
      sourceRef.current?.close();
    };
  }, []);

  const latestState = useMemo(() => {
    const endState = [...events]
      .reverse()
      .find((event) => event.payload.type === "pipeline_end");

    if (endState?.payload.type === "pipeline_end") {
      return endState.payload.state;
    }
    return null;
  }, [events]);

  function startStream() {
    sourceRef.current?.close();
    setEvents([]);
    setErrorMessage(null);
    setStatus("streaming");

    const url = `${endpoint}?prompt=${encodeURIComponent(prompt)}`;
    const eventSource = new EventSource(url);

    eventSource.addEventListener("pipeline", (event) => {
      const parsed = parseEvent((event as MessageEvent).data);
      if (!parsed) {
        setStatus("error");
        setErrorMessage("Unable to parse pipeline event payload");
        return;
      }

      setEvents((prev) => [...prev, { id: prev.length + 1, payload: parsed }]);

      if (parsed.type === "pipeline_end") {
        setStatus("done");
      }
    });

    eventSource.addEventListener("done", () => {
      setStatus((prev) => (prev === "error" ? prev : "done"));
      eventSource.close();
      sourceRef.current = null;
    });

    eventSource.onerror = () => {
      setStatus("error");
      setErrorMessage(
        "Connection dropped. Is the Hono SSE server running on port 8787?"
      );
      eventSource.close();
      sourceRef.current = null;
    };

    sourceRef.current = eventSource;
  }

  return (
    <section className="panel">
      <div className="controls">
        <label className="label">Prompt</label>
        <div className="input-row">
          <input
            className="text-input"
            value={prompt}
            onChange={(event) => setPrompt(event.target.value)}
            placeholder="Describe the app you want"
          />
          <button
            className="primary"
            onClick={startStream}
            disabled={status === "streaming"}
          >
            {status === "streaming" ? "Streaming..." : "Stream pipeline"}
          </button>
        </div>
        <p className="hint">
          The client listens to the SSE endpoint exposed by the Hono example at
          <code>{endpoint}</code> and renders Forge pipeline events as they
          arrive.
        </p>
      </div>

      {errorMessage ? (
        <div className="error">{errorMessage}</div>
      ) : (
        <div className="grid">
          <div className="card">
            <div className="card-header">
              <h3>Events</h3>
              <span className={`status status-${status}`}>{status}</span>
            </div>
            <div className="events">
              {events.length === 0 ? (
                <p className="empty">Press "Stream pipeline" to begin.</p>
              ) : (
                events.map((entry) => (
                  <article className="event" key={entry.id}>
                    <div className="event-meta">
                      <span className="event-id">#{entry.id}</span>
                      <span className="event-type">{entry.payload.type}</span>
                      {"step" in entry.payload && entry.payload.step ? (
                        <span className="event-step">{entry.payload.step}</span>
                      ) : null}
                    </div>
                    <pre className="event-body">
                      {JSON.stringify(entry.payload, null, 2)}
                    </pre>
                  </article>
                ))
              )}
            </div>
          </div>

          <div className="card">
            <div className="card-header">
              <h3>Latest pipeline state</h3>
            </div>
            <div className="event-body">
              {latestState ? (
                <pre>{JSON.stringify(latestState, null, 2)}</pre>
              ) : (
                <p className="empty">Awaiting completion…</p>
              )}
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
