const cron = require('node-cron');
const Course = require('./models/course'); // Adjust path as needed

// Check if any course with status=true exists before scheduling the cron job
const checkAndSchedule = async () => {
    const exists = await Course.exists({ status: true });
    if (exists) {
        // Runs every minute
        cron.schedule('* * * * *', async () => {
            const now = new Date().toISOString();
            try {
                await Course.updateMany(
                    { time: { $lt: now }, status: true },
                    { $set: { status: false } }
                );
                console.log('Course statuses updated');
            } catch (err) {
                console.error('Error updating course statuses:', err);
            }
        });
    } else {
        console.log('No courses with status=true found. Cron job not scheduled.');
    }
};

checkAndSchedule();
