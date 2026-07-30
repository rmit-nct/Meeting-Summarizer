import { EventEmitter } from 'node:events';

// The in-process event bus for cross-module, fire-and-forget side effects.
// See ARCHITECTURE.md §2.1 and §4. Replace with a durable queue later if this
// ever needs to scale beyond one process — no module code should have to change.
class EventBus extends EventEmitter {}

export const eventBus = new EventBus();
