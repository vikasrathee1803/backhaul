"use client";
import { useEffect, useRef, useState, useCallback } from "react";

export type GraphEvent = {
  event_type:
    | "node_started"
    | "node_completed"
    | "node_failed"
    | "decision_made"
    | "escalation"
    | "cost_update"
    | "run_completed"
    | "run_failed";
  node_name: string | null;
  timestamp: string;
  data: Record<string, unknown>;
  cost_delta_usd: number;
  total_cost_usd: number;
};

type StreamState = "idle" | "connecting" | "streaming" | "completed" | "error";

export function useGraphStream(runId: string | null) {
  const [events, setEvents] = useState<GraphEvent[]>([]);
  const [streamState, setStreamState] = useState<StreamState>("idle");
  const [totalCost, setTotalCost] = useState(0);
  const esRef = useRef<EventSource | null>(null);

  const connect = useCallback(() => {
    if (!runId) return;
    esRef.current?.close();
    setStreamState("connecting");
    setEvents([]);

    const es = new EventSource(`/api/graph/stream?runId=${runId}`);
    esRef.current = es;

    es.onopen = () => setStreamState("streaming");

    es.onmessage = (e: MessageEvent<string>) => {
      const event = JSON.parse(e.data) as GraphEvent;
      setEvents((prev) => [...prev, event]);
      setTotalCost(event.total_cost_usd);
      if (event.event_type === "run_completed" || event.event_type === "run_failed") {
        setStreamState("completed");
        es.close();
      }
    };

    es.onerror = () => {
      setStreamState("error");
      es.close();
    };

    return () => { es.close(); };
  }, [runId]);

  useEffect(() => {
    return connect();
  }, [connect]);

  return { events, streamState, totalCost, reconnect: connect };
}
