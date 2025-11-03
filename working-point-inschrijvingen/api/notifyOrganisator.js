const nodemailer = require('nodemailer');

// Create a transporter for sending emails
const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

// Health check endpoint
const healthCheck = (req, res) => {
    if (req.query.ping) {
        return res.status(200).send('Pong');
    }
    res.status(404).send('Not Found');
};

// Notify organizer function
const notifyOrganizer = async (req, res) => {
    const { name, email, registrationDetails } = req.body;

    // Simple honeypot check
    if (req.body.hp) {
        return res.status(400).send('Spam detected');
    }

    const mailOptions = {
        from: process.env.SMTP_FROM,
        to: process.env.ORGANISATOR_EMAIL_DEFAULT,
        subject: 'New Registration Notification',
        text: `You have a new registration from ${name} (${email}). Details: ${JSON.stringify(registrationDetails)}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).send('Notification sent');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Internal Server Error');
    }
};

// Export the functions
module.exports = {
    healthCheck,
    notifyOrganizer,
};