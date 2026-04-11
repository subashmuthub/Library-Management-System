/**
 * Email Service for Library Notifications
 * Uses Nodemailer for sending emails
 */

const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
    const hasSmtpCredentials = Boolean(process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS);

    // If SMTP credentials are provided, always prefer them (including development).
    if (hasSmtpCredentials) {
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: Number(process.env.SMTP_PORT) || 587,
            secure: Number(process.env.SMTP_PORT) === 465,
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    }

    // Configure based on environment
    if (process.env.NODE_ENV === 'production') {
        // Production: Use real SMTP settings
        return nodemailer.createTransport({
            host: process.env.SMTP_HOST || 'smtp.gmail.com',
            port: process.env.SMTP_PORT || 587,
            secure: false, // true for 465, false for other ports
            auth: {
                user: process.env.SMTP_USER,
                pass: process.env.SMTP_PASS,
            },
        });
    } else {
        // Development: Log to console
        return nodemailer.createTransport({
            host: 'localhost',
            port: 1025,
            secure: false,
            ignoreTLS: true,
            // Use Ethereal or similar for testing
        });
    }
};

class EmailService {
    /**
     * Send account verification OTP email.
     */
    static async sendOtpEmail(userEmail, userName, otpCode) {
        try {
            const transporter = createTransporter();
            const mailOptions = {
                from: process.env.SMTP_FROM || '"Library System" <noreply@library.com>',
                to: userEmail,
                subject: 'Verify your Smart Library account',
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 640px; margin: 0 auto; padding: 20px;">
                        <h2 style="margin: 0 0 10px; color: #0f172a;">Smart Library Email Verification</h2>
                        <p>Hello ${userName || 'Student'},</p>
                        <p>Use the OTP below to verify your email and activate dashboard access.</p>
                        <div style="font-size: 28px; font-weight: 700; letter-spacing: 8px; color: #0f766e; background: #f0fdfa; border: 1px solid #99f6e4; border-radius: 10px; padding: 14px 18px; text-align: center; margin: 18px 0;">
                            ${otpCode}
                        </div>
                        <p><strong>Validity:</strong> 10 minutes</p>
                        <p>If you did not request this code, you can ignore this email.</p>
                    </div>
                `,
                text: `Hello ${userName || 'Student'},\n\nYour Smart Library verification OTP is: ${otpCode}\nThis OTP is valid for 10 minutes.\n\nIf you did not request this, ignore this email.`,
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`📧 OTP email sent to ${userEmail}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Failed to send OTP email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send reservation ready notification
     */
    static async sendReservationReadyEmail(userEmail, userName, bookTitle, reservationId) {
        try {
            const transporter = createTransporter();

            const mailOptions = {
                from: process.env.SMTP_FROM || '"Library System" <noreply@library.com>',
                to: userEmail,
                subject: 'Your Reserved Book is Now Available!',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #4F46E5; color: white; padding: 20px; text-align: center; }
                            .content { background: #f9f9f9; padding: 30px; }
                            .book-title { font-size: 18px; font-weight: bold; color: #4F46E5; margin: 15px 0; }
                            .button { display: inline-block; padding: 12px 24px; background: #4F46E5; color: white; text-decoration: none; border-radius: 5px; margin: 20px 0; }
                            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>📚 Book Available for Pickup!</h1>
                            </div>
                            <div class="content">
                                <p>Dear ${userName},</p>
                                <p>Great news! The book you reserved is now available for pickup.</p>
                                <div class="book-title">
                                    "${bookTitle}"
                                </div>
                                <p><strong>Reservation ID:</strong> #${reservationId}</p>
                                <p><strong>What's next?</strong></p>
                                <ul>
                                    <li>Visit the library during operating hours</li>
                                    <li>Show your reservation ID at the circulation desk</li>
                                    <li>Collect your book and enjoy reading!</li>
                                </ul>
                                <p style="color: #dc2626; font-weight: bold;">
                                    ⚠️ Please collect your book within 3 days, or your reservation will expire.
                                </p>
                                <center>
                                    <a href="${process.env.FRONTEND_URL || 'http://localhost:5173'}/reservations" class="button">
                                        View My Reservations
                                    </a>
                                </center>
                            </div>
                            <div class="footer">
                                <p>This is an automated message from the Smart Library Automation System.</p>
                                <p>Please do not reply to this email.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `,
                text: `
                    Dear ${userName},

                    Great news! The book you reserved is now available for pickup.

                    Book: "${bookTitle}"
                    Reservation ID: #${reservationId}

                    What's next?
                    - Visit the library during operating hours
                    - Show your reservation ID at the circulation desk
                    - Collect your book and enjoy reading!

                    ⚠️ Please collect your book within 3 days, or your reservation will expire.

                    Visit: ${process.env.FRONTEND_URL || 'http://localhost:5173'}/reservations

                    This is an automated message from the Smart Library Automation System.
                    Please do not reply to this email.
                `
            };

            // Send email
            const info = await transporter.sendMail(mailOptions);
            
            console.log(`📧 Reservation ready email sent to ${userEmail}: ${info.messageId}`);
            
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Failed to send reservation ready email:', error);
            // Don't throw error - email failure shouldn't break the main flow
            return { success: false, error: error.message };
        }
    }

    /**
     * Send overdue book notification
     */
    static async sendOverdueNotification(userEmail, userName, bookTitle, dueDate, fineAmount) {
        try {
            const transporter = createTransporter();

            const mailOptions = {
                from: process.env.SMTP_FROM || '"Library System" <noreply@library.com>',
                to: userEmail,
                subject: 'Overdue Book Notice - Action Required',
                html: `
                    <!DOCTYPE html>
                    <html>
                    <head>
                        <style>
                            body { font-family: Arial, sans-serif; line-height: 1.6; color: #333; }
                            .container { max-width: 600px; margin: 0 auto; padding: 20px; }
                            .header { background: #dc2626; color: white; padding: 20px; text-align: center; }
                            .content { background: #f9f9f9; padding: 30px; }
                            .book-title { font-size: 18px; font-weight: bold; color: #dc2626; margin: 15px 0; }
                            .fine-amount { font-size: 24px; font-weight: bold; color: #dc2626; margin: 20px 0; }
                            .footer { text-align: center; padding: 20px; color: #666; font-size: 12px; }
                        </style>
                    </head>
                    <body>
                        <div class="container">
                            <div class="header">
                                <h1>⚠️ Overdue Book Notice</h1>
                            </div>
                            <div class="content">
                                <p>Dear ${userName},</p>
                                <p>This is a reminder that you have an overdue book.</p>
                                <div class="book-title">
                                    "${bookTitle}"
                                </div>
                                <p><strong>Due Date:</strong> ${dueDate}</p>
                                <div class="fine-amount">
                                    Current Fine: ₹${fineAmount}
                                </div>
                                <p><strong>Please take action:</strong></p>
                                <ul>
                                    <li>Return the book as soon as possible</li>
                                    <li>Pay the accumulated fine</li>
                                    <li>Contact the library if you need assistance</li>
                                </ul>
                            </div>
                            <div class="footer">
                                <p>This is an automated message from the Smart Library Automation System.</p>
                            </div>
                        </div>
                    </body>
                    </html>
                `
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`📧 Overdue notification sent to ${userEmail}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Failed to send overdue notification:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Notify student when waiver/discount decision is processed.
     */
    static async sendFineDecisionEmail(userEmail, userName, fineId, action, amountBefore, amountAfter, reason) {
        try {
            const transporter = createTransporter();

            const mailOptions = {
                from: process.env.SMTP_FROM || '"Library System" <noreply@library.com>',
                to: userEmail,
                subject: action === 'waived' ? 'Fine Waiver Approved' : 'Fine Discount Approved',
                text: `Hi ${userName},\n\nYour fine #${fineId} has been ${action}.\nPrevious amount: ${amountBefore}\nCurrent amount: ${amountAfter}\nReason: ${reason || 'N/A'}\n\nPlease check your student portal for the updated status.`,
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`📧 Fine decision email sent to ${userEmail}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Failed to send fine decision email:', error);
            return { success: false, error: error.message };
        }
    }

    /**
     * Send active user of the month recognition mail.
     */
    static async sendActiveUserAwardEmail(userEmail, userName, payload = {}) {
        try {
            const transporter = createTransporter();
            const {
                monthLabel = 'this month',
                borrowCount = 0,
                visitCount = 0,
                rank = 1,
                studentId = 'N/A',
            } = payload;

            const mailOptions = {
                from: process.env.SMTP_FROM || '"Library System" <noreply@library.com>',
                to: userEmail,
                subject: `Congratulations! Active Library User of ${monthLabel}`,
                text: `Dear ${userName},\n\nCongratulations! You are ranked #${rank} as Active Library User of ${monthLabel}.\nStudent ID: ${studentId}\nBorrow/Return transactions: ${borrowCount}\nLibrary visits: ${visitCount}\n\nThe Central Library appreciates your consistent use of resources.\n\nRegards,\nCentral Library`,
                html: `
                    <div style="font-family: Arial, sans-serif; line-height: 1.6; color: #1f2937; max-width: 680px; margin: 0 auto; border: 1px solid #e5e7eb; border-radius: 10px; overflow: hidden;">
                        <div style="background:#f8fafc; border-bottom:1px solid #e5e7eb; padding:18px 22px;">
                            <h2 style="margin:0; color:#0f172a;">Central Library - Certificate of Recognition</h2>
                        </div>
                        <div style="padding:22px;">
                            <p>Dear <strong>${userName}</strong>,</p>
                            <p>Congratulations! You have been recognized as the <strong>Active Library User of ${monthLabel}</strong>.</p>
                            <ul>
                                <li>Rank: <strong>#${rank}</strong></li>
                                <li>Student ID: <strong>${studentId}</strong></li>
                                <li>Borrow/Return Transactions: <strong>${borrowCount}</strong></li>
                                <li>Library Visits: <strong>${visitCount}</strong></li>
                            </ul>
                            <p>Your disciplined and consistent use of library resources reflects your academic commitment.</p>
                            <p style="margin-top:20px;">Regards,<br/>Central Library</p>
                        </div>
                    </div>
                `,
            };

            const info = await transporter.sendMail(mailOptions);
            console.log(`📧 Active user award mail sent to ${userEmail}: ${info.messageId}`);
            return { success: true, messageId: info.messageId };
        } catch (error) {
            console.error('❌ Failed to send active user award email:', error);
            return { success: false, error: error.message };
        }
    }
}

module.exports = EmailService;
