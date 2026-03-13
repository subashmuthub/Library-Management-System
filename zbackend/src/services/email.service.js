/**
 * Email Service for Library Notifications
 * Uses Nodemailer for sending emails
 */

const nodemailer = require('nodemailer');

// Create email transporter
const createTransporter = () => {
    // Configure based on environment
    if (process.env.NODE_ENV === 'production') {
        // Production: Use real SMTP settings
        return nodemailer.createTransporter({
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
        return nodemailer.createTransporter({
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
}

module.exports = EmailService;
