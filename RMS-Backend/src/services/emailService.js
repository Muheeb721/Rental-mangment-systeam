import nodemailer from 'nodemailer';
import path from 'node:path';
import EmailLog from '../models/EmailLog.js';

const normalizeBoolean = (value) => value === true || value === 'true' || value === 1 || value === '1';
const escapeHtml = (value) => String(value ?? '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
})[character]);

const getTransportConfig = () => {
  const user = process.env.SMTP_USER || '';
  const pass = process.env.SMTP_PASS || '';
  const host = String(process.env.SMTP_HOST || '').trim();
  const configuredPort = Number.parseInt(process.env.SMTP_PORT || '', 10);
  const port = Number.isInteger(configuredPort) && configuredPort > 0 ? configuredPort : 587;
  const secure = normalizeBoolean(process.env.SMTP_SECURE || port === 465);
  const from = getFromAddress();

  if (!host || !user || !pass || !from) {
    return null;
  }

  return {
    host,
    port,
    secure,
    auth: { user, pass },
  };
};

const getFromAddress = () => process.env.MAIL_FROM || '';
const getAdminEmail = () => String(process.env.ADMIN_EMAIL || 'admin@rental.com').trim().toLowerCase();
const getSupportAddress = () => process.env.RMS_SUPPORT_EMAIL || 'support@rms.local';

const buildHtmlTemplate = ({ title, intro, userName, bodyLines = [], footerText = '', highlight = '' }) => {
  const safeName = escapeHtml(userName || 'RMS User');
  const linesHtml = bodyLines
    .map((line) => `<p style="margin:0 0 12px; font-size:14px; line-height:1.6; color:#243244;">${escapeHtml(line)}</p>`)
    .join('');

  return `
    <div style="font-family: Arial, sans-serif; background:#f3f6fb; padding:30px 0; color:#1d2430;">
      <div style="max-width:640px; margin:0 auto; background:#ffffff; border:1px solid #dfe7f1; border-radius:12px; overflow:hidden;">
        <div style="background:linear-gradient(135deg,#0f172a,#1f3a5f); padding:20px 28px; color:#fff;">
          <div style="font-size:26px; font-weight:700; letter-spacing:0.4px;">RMS</div>
          <div style="font-size:12px; letter-spacing:1.5px; text-transform:uppercase; opacity:0.8; margin-top:6px;">Rental Management System</div>
        </div>
        <div style="padding:28px;">
          <h2 style="margin:0 0 12px; font-size:24px; color:#0f172a;">${title}</h2>
          <p style="margin:0 0 20px; font-size:15px; color:#3b485d;">Dear <strong>${safeName}</strong>,</p>
          <p style="margin:0 0 16px; font-size:15px; line-height:1.7; color:#243244;">${intro}</p>
          ${highlight ? `<div style="background:#eef5ff; border-left:4px solid #2d6cdf; padding:12px 14px; margin:18px 0; border-radius:6px; color:#183866; font-weight:600;">${highlight}</div>` : ''}
          ${linesHtml}
          <div style="margin-top:20px; padding-top:18px; border-top:1px solid #e7edf5; color:#475467; font-size:13px; line-height:1.7;">
            If you have any issue regarding your profile, rental booking, payment, or property, please contact RMS support through your RMS account or the support section.
          </div>
        </div>
        <div style="background:#f8fafc; border-top:1px solid #e7edf5; padding:18px 28px; color:#475467; font-size:12px; line-height:1.7;">
          ${footerText || 'Thank you for choosing RMS. We are happy to have you with us.'}
          <div style="margin-top:10px;">Best Regards,<br />RMS Rental Management System</div>
        </div>
      </div>
    </div>
  `;
};

const buildTextVersion = ({ title, intro, userName, bodyLines = [], footerText = '' }) => {
  const lines = [
    `Dear ${userName || 'RMS User'},`,
    '',
    title,
    '',
    intro,
    '',
    ...bodyLines,
    '',
    footerText || 'Thank you for choosing RMS.',
    '',
    'Best Regards,',
    'RMS Rental Management System',
  ];
  return lines.join('\n');
};

export const sendEmail = async ({
  to,
  type,
  subject,
  html,
  text,
  bookingId = '',
  userId = '',
  metadata = {},
  dedupeKey = '',
  attachments = [],
}) => {
  const recipient = String(to || '').trim();
  if (!recipient) {
    throw new Error('Missing email recipient');
  }

  const safeDedupeKey = dedupeKey || `${type}:${userId || 'anon'}:${bookingId || 'no-booking'}:${recipient}`;

  const existing = await EmailLog.findOne({ dedupeKey: safeDedupeKey }).lean();
  if (existing && existing.status === 'sent') {
    return { success: true, skipped: true, log: existing, message: 'Duplicate email suppressed.' };
  }

  const log = await EmailLog.create({
    userId: userId || '',
    email: recipient,
    type,
    subject,
    bookingId: bookingId || '',
    status: 'pending',
    sentAt: null,
    error: '',
    metadata,
    dedupeKey: safeDedupeKey,
  });

  try {
    const transportConfig = getTransportConfig();
    if (!transportConfig) {
      console.warn('SMTP is not configured; email was skipped. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS, and MAIL_FROM in the backend .env file.');
      await EmailLog.findByIdAndUpdate(log._id, {
        status: 'skipped',
        error: 'SMTP configuration missing. Email not sent.',
        sentAt: new Date(),
      });
      return { success: false, skipped: true, log, message: 'SMTP configuration missing; email not sent.' };
    }

    const transporter = nodemailer.createTransport(transportConfig);
    await transporter.sendMail({
      from: getFromAddress(),
      to: recipient,
      subject,
      text: text || 'RMS email',
      html: html || '<p>RMS email</p>',
      attachments,
    });

    await EmailLog.findByIdAndUpdate(log._id, {
      status: 'sent',
      sentAt: new Date(),
      error: '',
    });

    return { success: true, skipped: false, log, message: 'Email sent successfully.' };
  } catch (err) {
    const message = err && err.message ? err.message : 'Email delivery failed';
    await EmailLog.findByIdAndUpdate(log._id, {
      status: 'failed',
      error: message,
      sentAt: new Date(),
    });
    return { success: false, skipped: false, log, message };
  }
};

export const sendAdminPasswordResetEmail = async ({ email, otp }) => {
  const subject = 'Your RMS admin password reset code';
  const text = `Your RMS admin password reset code is ${otp}. It expires in 10 minutes. If you did not request this, ignore this email.`;
  const html = `<p>Your RMS admin password reset code is <strong>${otp}</strong>.</p><p>It expires in 10 minutes. If you did not request this, ignore this email.</p>`;
  return sendEmail({
    to: email,
    type: 'ADMIN_PASSWORD_RESET_OTP',
    subject,
    text,
    html,
    dedupeKey: `admin-password-reset:${Date.now()}:${email}`,
  });
};

export const sendAdminBookingSubmittedEmail = async (booking) => {
  const adminEmail = getAdminEmail();
  const rows = {
    'Booking ID': booking._id,
    'Property': booking.propertyTitle || booking.propertyName,
    'Rent': `PKR ${Number(booking.rent || booking.amount || 0).toLocaleString()}`,
    'Booking date': new Date(booking.bookingDate || Date.now()).toISOString(),
    'Move-in date': booking.moveInDate ? new Date(booking.moveInDate).toISOString() : 'Not provided',
    'Status': booking.status || 'Pending',
    'User name': booking.userName,
    'User email': booking.userEmail,
    'User phone': booking.userPhone,
    'CNIC': booking.cnic || 'Not provided',
    'Date of birth': booking.dateOfBirth ? new Date(booking.dateOfBirth).toISOString().slice(0, 10) : 'Not provided',
    'Address': [booking.addressLine1, booking.addressLine2, booking.city, booking.province, booking.country].filter(Boolean).join(', ') || 'Not provided',
    'Employment status': booking.employmentStatus || 'Not provided',
    'Company': booking.companyName || 'Not provided',
    'Job title': booking.jobTitle || 'Not provided',
    'Monthly income': booking.monthlyIncome ? `PKR ${Number(booking.monthlyIncome).toLocaleString()}` : 'Not provided',
    'Occupants': booking.occupants || 1,
    'Reason for renting': booking.reasonForRent || booking.message || 'Not provided',
    'CNIC image': booking.cnicImage || 'Not provided',
    'Profile image': booking.profileImage || 'Not provided',
  };
  const text = ['A new rental booking was submitted.', '', ...Object.entries(rows).map(([label, value]) => `${label}: ${value}`)].join('\n');
  const html = `<h2>New rental booking</h2><table>${Object.entries(rows)
    .map(([label, value]) => `<tr><th align="left">${escapeHtml(label)}</th><td>${escapeHtml(value)}</td></tr>`).join('')}</table>`;
  return sendEmail({
    to: adminEmail,
    type: 'ADMIN_BOOKING_SUBMITTED',
    subject: `New rental booking: ${booking.propertyTitle || booking.propertyName || 'Property'}`,
    text,
    html,
    bookingId: String(booking._id || ''),
    userId: booking.userId,
    metadata: { bookingId: String(booking._id || ''), propertyId: booking.propertyId },
    dedupeKey: `ADMIN_BOOKING_SUBMITTED:${booking._id}`,
  });
};

export const sendRentalDetailsEmails = async ({ rental, status, eventType, agreementPath = '' }) => {
  const adminEmail = getAdminEmail();
  const recipientDetails = [
    { email: String(rental.userEmail || rental.email || '').trim(), label: 'user' },
    { email: adminEmail, label: 'admin' },
  ].filter((recipient) => recipient.email);
  const lines = [
    `Request ID: ${rental._id || rental.id || 'N/A'}`,
    `Property: ${rental.propertyTitle || rental.propertyName || 'N/A'}`,
    `Property type: ${rental.propertyType || 'N/A'}`,
    `User: ${rental.userName || rental.fullName || 'N/A'} (${rental.userEmail || rental.email || 'N/A'})`,
    `CNIC: ${rental.cnic || 'Not provided'}`,
    `Phone: ${rental.userPhone || rental.phone || 'N/A'}`,
    `Move-in date: ${rental.moveInDate || rental.preferredMoveInDate ? new Date(rental.moveInDate || rental.preferredMoveInDate).toISOString().slice(0, 10) : 'Not provided'}`,
    `Move-out date: ${rental.rentalEndDate || rental.toDate || rental.endDate ? new Date(rental.rentalEndDate || rental.toDate || rental.endDate).toISOString().slice(0, 10) : 'Not provided'}`,
    `Rental duration: ${rental.rentalDuration || rental.rentalDurationMonths || 'Not provided'}`,
    `Amount: PKR ${Number(rental.rent || rental.monthlyRent || rental.amount || 0).toLocaleString()}`,
    `Status: ${status || rental.applicationStatus || rental.status || 'Pending'}`,
  ];
  const text = [
    `Dear ${rental.userName || rental.fullName || 'RMS User'},`,
    '',
    'Please find the rental request summary below.',
    '',
    ...lines,
    '',
    agreementPath ? 'Your rental agreement is attached to this email.' : '',
    '',
    'Regards,',
    'RMS Rental Management System',
  ].filter(Boolean).join('\n');
  const rows = lines.map((line) => `<p style="margin:0 0 8px;">${escapeHtml(line)}</p>`).join('');
  const html = `
    <div style="font-family:Arial,sans-serif;color:#243244;line-height:1.6;">
      <h2 style="color:#173b67;">Rental request update</h2>
      <p>Dear ${escapeHtml(rental.userName || rental.fullName || 'RMS User')},</p>
      <p>Please find the rental request summary below.</p>
      ${rows}
      ${agreementPath ? '<p>The rental agreement is attached to this email for your records.</p>' : ''}
      <p>Regards,<br />RMS Rental Management System</p>
    </div>
  `;
  const uniqueRecipients = [...new Map(recipientDetails.map((recipient) => [recipient.email.toLowerCase(), recipient])).values()];

  return Promise.all(uniqueRecipients.map((recipient) => sendEmail({
    to: recipient.email,
    userId: String(rental.userId || ''),
    type: 'BOOKING_SUBMITTED',
    subject: `RMS rental update: ${rental.propertyTitle || rental.propertyName || 'Property'} — ${status || rental.status || 'Updated'}`,
    text,
    html,
    attachments: agreementPath ? [{
      filename: path.basename(agreementPath),
      path: agreementPath,
      contentType: 'application/pdf',
    }] : [],
    bookingId: String(rental._id || rental.id || ''),
    metadata: {
      property: rental.propertyTitle || rental.propertyName || '',
      user: rental.userName || rental.fullName || '',
      dates: rental.moveInDate || rental.preferredMoveInDate || '',
      amount: Number(rental.rent || rental.monthlyRent || rental.amount || 0),
      status: status || rental.applicationStatus || rental.status || 'Pending',
      eventType: String(eventType || 'status'),
      recipientRole: recipient.label,
    },
    dedupeKey: `rental-${eventType}-${rental._id || rental.id}-${recipient.email.toLowerCase()}`,
  })));
};

export const createProfileCompletedEmail = ({ userName, userEmail }) => {
  const intro = 'Congratulations and welcome to RMS! Your RMS tenant profile has been successfully completed and your account is now ready for the rental process.';
  const bodyLines = [
    `Your registered email: ${userEmail || 'Not available'}`,
    'You can now log in to your RMS account and continue exploring available rental properties.',
    'Thank you for choosing RMS – Rental Management System.',
    'We are happy to have you with us.',
  ];

  return {
    subject: 'Welcome to RMS – Your Account/Profile Has Been Successfully Created',
    html: buildHtmlTemplate({
      title: 'Welcome to RMS',
      intro,
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS – Rental Management System. We are happy to have you with us.',
      highlight: 'Tenant profile completed successfully',
    }),
    text: buildTextVersion({
      title: 'Welcome to RMS',
      intro,
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS – Rental Management System. We are happy to have you with us.',
    }),
  };
};

export const createBookingSubmittedEmail = ({ userName, userEmail, propertyName, propertyType, location, monthlyRent, moveInDate, rentalDuration, bookingId, bookingStatus, bookingDate }) => {
  const bodyLines = [
    `Property: ${propertyName || 'N/A'}`,
    `Property Type: ${propertyType || 'N/A'}`,
    `Location: ${location || 'N/A'}`,
    `Monthly Rent: ${monthlyRent ? `PKR ${Number(monthlyRent).toLocaleString()}` : 'N/A'}`,
    `Move-in Date: ${moveInDate || 'N/A'}`,
    `Rental Duration: ${rentalDuration || 'N/A'}`,
    `Booking ID: ${bookingId || 'N/A'}`,
    `Current Status: ${bookingStatus || 'Pending Confirmation'}`,
    `Booking Date: ${bookingDate || new Date().toISOString().slice(0, 10)}`,
    `Support: ${getSupportAddress()}`,
  ];

  return {
    subject: 'Congratulations! Your Rental Booking Has Been Successfully Submitted – RMS',
    html: buildHtmlTemplate({
      title: 'Booking Submitted Successfully',
      intro: 'We are delighted to inform you that your rental booking request has been successfully submitted on the RMS Rental Management System.',
      userName,
      bodyLines: [
        `Your registered email: ${userEmail || 'Not available'}`,
        ...bodyLines,
      ],
      footerText: 'Thank you for choosing RMS. We truly appreciate your trust in our Rental Management System.',
      highlight: 'Booking Status: Pending Confirmation',
    }),
    text: buildTextVersion({
      title: 'Congratulations! Your Rental Booking Has Been Successfully Submitted – RMS',
      intro: 'We are delighted to inform you that your rental booking request has been successfully submitted on the RMS Rental Management System.',
      userName,
      bodyLines: [
        `Your registered email: ${userEmail || 'Not available'}`,
        ...bodyLines,
      ],
      footerText: 'Thank you for choosing RMS. We truly appreciate your trust in our Rental Management System.',
    }),
  };

};

export const createSaleInterestSubmittedEmail = ({ userName, userEmail, propertyName, propertyType, preferredMoveInDate, submissionId }) => {
  const intro = 'Your buying-interest form has been successfully submitted to the RMS Rental Management System.';
  const bodyLines = [
    `Your registered email: ${userEmail || 'Not available'}`,
    `Property: ${propertyName || 'N/A'}`,
    `Property Type: ${propertyType || 'N/A'}`,
    `Preferred Move-in Date: ${preferredMoveInDate || 'N/A'}`,
    `Submission ID: ${submissionId || 'N/A'}`,
    'Our team will review your request and contact you shortly.',
  ];

  return {
    subject: 'Your Buying Interest Was Submitted Successfully – RMS',
    html: buildHtmlTemplate({
      title: 'Buying Interest Submitted',
      intro,
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS. We will be in touch regarding your property interest.',
      highlight: 'Submission received successfully',
    }),
    text: buildTextVersion({ title: 'Buying Interest Submitted', intro, userName, bodyLines }),
  };
};

export const sendSaleInterestSubmittedEmail = async ({ userName, userEmail, userId, propertyName, propertyType, preferredMoveInDate, submissionId }) => {
  const template = createSaleInterestSubmittedEmail({
    userName,
    userEmail,
    propertyName,
    propertyType,
    preferredMoveInDate,
    submissionId,
  });
  return sendEmail({
    to: userEmail,
    type: 'sale_interest_submitted',
    subject: template.subject,
    html: template.html,
    text: template.text,
    userId,
    metadata: { propertyName, propertyType, submissionId },
    dedupeKey: `sale-interest-submitted:${submissionId}:${userEmail}`,
  });
};

export const createBookingApprovedEmail = ({ userName, propertyName, location, monthlyRent, moveInDate, bookingId, status }) => {
  const bodyLines = [
    `Property: ${propertyName || 'N/A'}`,
    `Location: ${location || 'N/A'}`,
    `Monthly Rent: ${monthlyRent ? `PKR ${Number(monthlyRent).toLocaleString()}` : 'N/A'}`,
    `Move-in Date: ${moveInDate || 'N/A'}`,
    `Booking ID: ${bookingId || 'N/A'}`,
    `Status: ${status || 'Approved'}`,
    `Support: ${getSupportAddress()}`,
  ];

  return {
    subject: 'RMS – Your Rental Booking Has Been Approved 🎉',
    html: buildHtmlTemplate({
      title: 'Booking Approved',
      intro: 'Congratulations! Your rental booking for the selected property has been approved by the RMS management team.',
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS. If you have any questions or face any issue regarding your rental, please contact us through your RMS account or support.',
      highlight: 'Status: Approved',
    }),
    text: buildTextVersion({
      title: 'RMS – Your Rental Booking Has Been Approved 🎉',
      intro: 'Congratulations! Your rental booking for the selected property has been approved by the RMS management team.',
      userName,
      bodyLines,
      footerText: 'Thank you for choosing RMS. If you have any questions or face any issue regarding your rental, please contact us through your RMS account or support.',
    }),
  };
};

export const createBookingRejectedEmail = ({ userName, propertyName, bookingId, reason }) => {
  const bodyLines = [
    `Property: ${propertyName || 'N/A'}`,
    `Booking ID: ${bookingId || 'N/A'}`,
    `Rejection Reason: ${reason || 'No reason provided.'}`,
    'If you have any questions, please contact RMS support through your account or support section.',
    `Support: ${getSupportAddress()}`,
  ];

  return {
    subject: 'RMS – Update Regarding Your Rental Booking',
    html: buildHtmlTemplate({
      title: 'Rental Booking Update',
      intro: 'We would like to inform you that your rental booking request has been reviewed by the RMS management team and has not been approved at this time.',
      userName,
      bodyLines,
      footerText: 'Thank you for your understanding. If you would like to discuss your rental options, please contact RMS support.',
      highlight: 'Status: Rejected',
    }),
    text: buildTextVersion({
      title: 'RMS – Update Regarding Your Rental Booking',
      intro: 'We would like to inform you that your rental booking request has been reviewed by the RMS management team and has not been approved at this time.',
      userName,
      bodyLines,
      footerText: 'Thank you for your understanding. If you would like to discuss your rental options, please contact RMS support.',
    }),
  };
};

export const sendProfileCompletedEmail = async ({ userName, userEmail, userId }) => {
  const template = createProfileCompletedEmail({ userName, userEmail });
  return sendEmail({
    to: userEmail,
    userId,
    type: 'PROFILE_COMPLETED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    metadata: { userName, userEmail },
    dedupeKey: `PROFILE_COMPLETED:${userId || userEmail}`,
  });
};

export const sendBookingSubmittedEmail = async ({
  userName,
  userEmail,
  userId,
  bookingId,
  propertyName,
  propertyType,
  location,
  monthlyRent,
  moveInDate,
  rentalDuration,
  bookingStatus,
  bookingDate,
}) => {
  const template = createBookingSubmittedEmail({
    userName,
    userEmail,
    propertyName,
    propertyType,
    location,
    monthlyRent,
    moveInDate,
    rentalDuration,
    bookingId,
    bookingStatus,
    bookingDate,
  });

  return sendEmail({
    to: userEmail,
    userId,
    type: 'BOOKING_SUBMITTED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    bookingId,
    metadata: { propertyName, propertyType, location, monthlyRent, moveInDate, rentalDuration, bookingStatus },
    dedupeKey: `BOOKING_SUBMITTED:${bookingId || userId || userEmail}`,
  });
};

export const sendBookingApprovedEmail = async ({ userName, userEmail, userId, bookingId, propertyName, location, monthlyRent, moveInDate, status }) => {
  const template = createBookingApprovedEmail({ userName, propertyName, location, monthlyRent, moveInDate, bookingId, status });
  return sendEmail({
    to: userEmail,
    userId,
    type: 'BOOKING_APPROVED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    bookingId,
    metadata: { propertyName, location, monthlyRent, moveInDate, bookingId },
    dedupeKey: `BOOKING_APPROVED:${bookingId || userId || userEmail}`,
  });
};

export const sendBookingRejectedEmail = async ({ userName, userEmail, userId, bookingId, propertyName, reason }) => {
  const template = createBookingRejectedEmail({ userName, propertyName, bookingId, reason });
  return sendEmail({
    to: userEmail,
    userId,
    type: 'BOOKING_REJECTED',
    subject: template.subject,
    html: template.html,
    text: template.text,
    bookingId,
    metadata: { propertyName, bookingId, reason },
    dedupeKey: `BOOKING_REJECTED:${bookingId || userId || userEmail}`,
  });
};
