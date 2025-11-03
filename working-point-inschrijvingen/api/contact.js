const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: process.env.SMTP_HOST,
    port: process.env.SMTP_PORT,
    secure: false, // true for 465, false for other ports
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

const honeypotField = 'hp';

const sendEmail = async (req, res) => {
    const { name, email, message, [honeypotField]: honeypot } = req.body;

    // Simple honeypot check
    if (honeypot) {
        return res.status(400).send('Spam detected');
    }

    const mailOptions = {
        from: process.env.SMTP_FROM,
        to: process.env.ORGANISATOR_EMAIL_DEFAULT,
        subject: `Contact Form Submission from ${name}`,
        text: `You have received a new message from ${name} (${email}):\n\n${message}`,
    };

    try {
        await transporter.sendMail(mailOptions);
        res.status(200).send('Email sent successfully');
    } catch (error) {
        console.error('Error sending email:', error);
        res.status(500).send('Error sending email');
    }
};

const healthCheck = (req, res) => {
    res.status(200).send('OK');
};

module.exports = (req, res) => {
    if (req.method === 'POST') {
        sendEmail(req, res);
    } else if (req.method === 'GET' && req.query.ping) {
        healthCheck(req, res);
    } else {
        res.setHeader('Allow', ['POST', 'GET']);
        res.status(405).end(`Method ${req.method} Not Allowed`);
    }
};