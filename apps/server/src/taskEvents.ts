import type { TaskRealtimeEventDto, WebTaskUpdateDto } from "@mdcz/shared/serverDtos";

export type TaskUpdatePayload = WebTaskUpdateDto;
export type TaskRealtimePayload = TaskRealtimeEventDto;
export type TaskEventPayload = TaskRealtimePayload | TaskUpdatePayload;
export type TaskSseEventName = "task-event" | "task-update";

export interface TaskEventEnvelope {
  id: string;
  event: TaskSseEventName;
  data: TaskEventPayload;
}

type TaskEventListener = (event: TaskEventEnvelope) => void;

export class TaskEventBus {
  readonly #listeners = new Set<TaskEventListener>();
  #nextEventId = 1;

  subscribe(listener: TaskEventListener): () => void {
    this.#listeners.add(listener);
    return () => {
      this.#listeners.delete(listener);
    };
  }

  publish(payload: TaskUpdatePayload): TaskEventEnvelope {
    return this.publishEnvelope("task-update", payload);
  }

  publishRealtime(payload: TaskRealtimePayload): TaskEventEnvelope {
    return this.publishEnvelope("task-event", payload);
  }

  private publishEnvelope(eventName: TaskSseEventName, payload: TaskEventPayload): TaskEventEnvelope {
    const event: TaskEventEnvelope = {
      id: String(this.#nextEventId),
      event: eventName,
      data: payload,
    };

    this.#nextEventId += 1;

    for (const listener of this.#listeners) {
      listener(event);
    }

    return event;
  }

  listenerCount(): number {
    return this.#listeners.size;
  }
}

export const createTaskEventBus = (): TaskEventBus => new TaskEventBus();

export const formatSseEvent = (event: TaskEventEnvelope): string => {
  const data = JSON.stringify(event.data);
  return `id: ${event.id}\nevent: ${event.event}\ndata: ${data}\n\n`;
};
