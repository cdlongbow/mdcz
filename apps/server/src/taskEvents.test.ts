import { describe, expect, it } from "vitest";

import { createTaskEventBus, formatSseEvent, type TaskEventEnvelope } from "./taskEvents";

const task = {
  id: "task-1",
  kind: "scan" as const,
  rootId: "root-1",
  rootDisplayName: "Media",
  status: "queued" as const,
  createdAt: "2026-04-28T00:00:00.000Z",
  updatedAt: "2026-04-28T00:00:00.000Z",
  startedAt: null,
  completedAt: null,
  videoCount: 0,
  directoryCount: 0,
  error: null,
  videos: [],
};

describe("TaskEventBus", () => {
  it("publishes task events to active subscribers", () => {
    const taskEvents = createTaskEventBus();
    const receivedEvents: TaskEventEnvelope[] = [];

    const unsubscribe = taskEvents.subscribe((event) => {
      receivedEvents.push(event);
    });

    const event = taskEvents.publish({ kind: "task", task });

    expect(event).toEqual({
      id: "1",
      event: "task-update",
      data: { kind: "task", task },
    });
    expect(receivedEvents).toEqual([event]);
    expect(taskEvents.listenerCount()).toBe(1);

    unsubscribe();

    taskEvents.publish({ kind: "task", task: { ...task, id: "task-2", status: "running" } });

    expect(receivedEvents).toEqual([event]);
    expect(taskEvents.listenerCount()).toBe(0);
  });

  it("publishes realtime task events on the task-event channel", () => {
    const taskEvents = createTaskEventBus();
    const receivedEvents: TaskEventEnvelope[] = [];
    taskEvents.subscribe((event) => {
      receivedEvents.push(event);
    });

    const event = taskEvents.publishRealtime({
      id: "log-1",
      taskId: "runtime",
      createdAt: "2026-05-06T00:00:00.000Z",
      kind: "log",
      log: {
        id: "log-1",
        taskId: "runtime",
        type: "info",
        message: "ready",
        createdAt: "2026-05-06T00:00:00.000Z",
        source: "runtime",
        level: "INFO",
      },
    });

    expect(event.event).toBe("task-event");
    expect(receivedEvents).toEqual([event]);
  });
});

describe("formatSseEvent", () => {
  it("formats a task event envelope as an SSE message", () => {
    expect(
      formatSseEvent({
        id: "7",
        event: "task-update",
        data: { kind: "task", task },
      }),
    ).toBe(`id: 7\nevent: task-update\ndata: ${JSON.stringify({ kind: "task", task })}\n\n`);
  });

  it("formats a realtime task event envelope as an SSE message", () => {
    const payload = {
      id: "log-1",
      taskId: "runtime",
      createdAt: "2026-05-06T00:00:00.000Z",
      kind: "log" as const,
      log: {
        id: "log-1",
        taskId: "runtime",
        type: "info",
        message: "ready",
        createdAt: "2026-05-06T00:00:00.000Z",
        source: "runtime" as const,
        level: "INFO" as const,
      },
    };

    expect(formatSseEvent({ id: "8", event: "task-event", data: payload })).toBe(
      `id: 8\nevent: task-event\ndata: ${JSON.stringify(payload)}\n\n`,
    );
  });
});
