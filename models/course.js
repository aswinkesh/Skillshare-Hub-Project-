const mongoose = require('mongoose');
const { duplexPair } = require('nodemailer/lib/xoauth2');

const courseSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User', // Reference to the user who created the course
        required: true
    },
    title: {
        type: String,
        required: true
    },
    poster: {
        type: String, // Store the filename or URL of the uploaded poster image
        required: true
    },
    description: {
        type: String,
        required: true
    },
    isavailable: {
        type: Number,
        required: true,
    },
    date: {
        type: String,
        required: true
    },
    time: {
        type: String,
        required: true
    },
    amount: {
        type: Number,
        required: true
    },
    duration: {
        type: String,
        required: true
    },
    createdAt: {
         type: Date,
        default: () => {
        const now = new Date();
        // Add 5 hours 30 minutes in milliseconds
        return new Date(now.getTime() + (5.5 * 60 * 60 * 1000));
    }
    },
    status:{
        type: Boolean,
        default: true // Course is active by default
    }

});

module.exports = mongoose.model('Course', courseSchema);