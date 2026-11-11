export const normalizeAction = (value) => {
  if (!value) return 'GENERAL_ACTION';
  return String(value).trim().toUpperCase().replace(/\s+/g, '_');
};

export const createStatusMessage = ({ actionType, entityType, propertyName, newStatus, reason, adminName }) => {
  const actor = adminName || 'Admin';
  const subject = propertyName ? ` for ${propertyName}` : '';

  const actionMap = {
    BOOKING_SUBMITTED: `Your booking${subject} has been submitted and is pending admin review.`,
    BOOKING_APPROVED: `Your booking${subject} has been approved by the admin.`,
    BOOKING_REJECTED: `Your booking${subject} was rejected by the admin.`,
    PAYMENT_APPROVED: 'Your payment has been approved by the admin.',
    PAYMENT_REJECTED: 'Your payment was rejected by the admin.',
    RENT_STATUS_UPDATED: `Your rent status${subject} was updated by the admin.`,
    RENT_PAYMENT_CONFIRMED: 'Your rent payment has been confirmed by the admin.',
    MAINTENANCE_APPROVED: 'Your maintenance request has been approved by the admin.',
    MAINTENANCE_REJECTED: 'Your maintenance request has been rejected by the admin.',
    MAINTENANCE_STATUS_CHANGED: 'Your maintenance request status was updated by the admin.',
    MAINTENANCE_RESOLVED: 'Your maintenance request has been resolved by the admin.',
    PROPERTY_APPROVED: 'Your property has been approved by the admin.',
    PROPERTY_REJECTED: 'Your property has been rejected by the admin.',
    PROPERTY_STATUS_CHANGED: 'Your property status was updated by the admin.',
    PROPERTY_PRICE_UPDATED: 'Your property price was updated by the admin.',
    PROPERTY_INFORMATION_UPDATED: 'Your property information was updated by the admin.',
    USER_REQUEST_APPROVED: 'Your request has been approved by the admin.',
    USER_REQUEST_REJECTED: 'Your request has been rejected by the admin.',
    ANNOUNCEMENT: `${actor} sent an important update to you.`,
  };

  const baseMessage = actionMap[normalizeAction(actionType)] || `Your ${entityType ? entityType.toLowerCase() : 'request'} was updated by the admin.`;
  const reasonText = reason ? ` Reason: ${reason}` : '';
  return `${baseMessage}${reasonText}`;
};

export const buildUserNotification = ({
  actionType,
  entityType,
  entityId,
  userId,
  userName,
  adminName,
  propertyName,
  newStatus,
  reason,
  message,
}) => {
  const finalMessage = message || createStatusMessage({ actionType, entityType, propertyName, newStatus, reason, adminName });

  return {
    userId,
    userName,
    actorType: 'admin',
    actorName: adminName || 'Admin',
    entityType: entityType || 'GENERAL',
    entityId: entityId || null,
    actionType: normalizeAction(actionType),
    title: finalMessage.split('.').slice(0, 2).join('.').trim() || 'Admin update',
    message: finalMessage,
    reason: reason || '',
    status: newStatus || 'Updated',
    createdAt: new Date().toISOString(),
    isRead: false,
  };
};
