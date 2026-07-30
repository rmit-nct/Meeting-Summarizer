// Subscribes to the pipeline's domain events and turns them into status
// transitions + socket progress emission. See ARCHITECTURE.md §4.
export function register(rt) {
  // TODO: eventBus.on('transcript:created', ...) -> markTranscribed, emit meeting:progress
  // TODO: eventBus.on('summary:created', ...)    -> markCompleted, emit meeting:completed
  // TODO: eventBus.on('pipeline:failed', ...)     -> markFailed, emit meeting:failed
}
