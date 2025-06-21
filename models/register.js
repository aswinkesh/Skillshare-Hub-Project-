
const mongoose = require('mongoose');

// Create a registration schema/model if not already present
const registrationSchema = new mongoose.Schema({
    user: { type: mongoose.Schema.Types.ObjectId, ref: 'login', required: true },
    course: { type: mongoose.Schema.Types.ObjectId, ref: 'Course', required: true },
    status: { type: Boolean, default: true }, // Registration is active by default
    registeredAt: {   type: Date,
        default: () => {
        const now = new Date();
        // Add 5 hours 30 minutes in milliseconds
        return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    } }
});
module.exports = mongoose.model('Registration', registrationSchema);