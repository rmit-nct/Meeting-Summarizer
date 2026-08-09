// Runs a module's Zod schema against the request body before controller logic
// runs. Usage: router.post('/', validate(meetingValidator.create), meetingController.create)
export function validate(schema) {
  return (req, res, next) => {
    if (!schema) return next(); // TODO: remove once every route passes a real schema.
    const result = schema.safeParse(req.body);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'validation_failed', message: 'Validation failed', details: result.error.flatten() },
      });
    }
    req.body = result.data;
    next();
  };
}

// Same as validate(), but against req.params — for routes like /:id/process
// that carry no body. Usage:
// router.post('/:id/process', validateParams(processingValidator.meetingIdParam), processingController.process)
export function validateParams(schema) {
  return (req, res, next) => {
    if (!schema) return next();
    const result = schema.safeParse(req.params);
    if (!result.success) {
      return res.status(400).json({
        success: false,
        error: { code: 'validation_failed', message: 'Validation failed', details: result.error.flatten() },
      });
    }
    req.params = result.data;
    next();
  };
}
