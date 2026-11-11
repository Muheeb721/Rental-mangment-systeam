import mongoose from 'mongoose';

/** router.param handler: responds 404 for ids that are not valid ObjectIds (avoids CastError 500s). */
export const objectIdParam = (label = 'Record') => (req, res, next, value) => {
  if (!mongoose.isValidObjectId(value)) {
    return res.status(404).json({ success: false, message: `${label} not found.` });
  }
  return next();
};
