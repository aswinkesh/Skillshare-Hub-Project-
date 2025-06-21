const express = require ('express');
const jwt=require('jsonwebtoken');
const bcryptjs=require('bcryptjs');
const {login}=require('../../../models/login');
const {token}=require('../../../models/token');
const isUser = require('../../../controllers/middlewares').isUser; //if curly then .isuser is not required
const {Otp} = require('../../../models/otp');
const {sendTextEmail} = require('../../../controllers/email');
 //if curly then .isadmin is not required

const pdfMake = require('pdfmake');



const Registration = require('../../../models/register'); // Assuming you have a registration model
const router = express();

const fs = require('fs');
const path = require('path');

const multer = require('multer');
const Course = require('../../../models/course');
const { isUserOrAdmin } = require('../../../controllers/middlewares');

// Multer setup
const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/'); // Make sure this folder exists
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });



// Route to add a course
router.post('/v1/user/addcourse', isUser, upload.single('poster'), async (req, res) => {
    try {
        const { title, description, isavailable, date, time, amount, duration } = req.body;
        if (!req.file || !title || !description || !isavailable || !date || !time || !amount || !duration) {
            return res.status(400).json({
                status: false,
                message: 'All fields including poster are required'
            });
        }
        
        const existingCourse = await Course.findOne({
            user: req.user._id,
            title: title,
            date: date,
            time: time,
            duration: duration,
            status: true // Ensure we only check active courses
        });
        if (existingCourse) {
            return res.status(400).json({
                status: false,
                message: 'A course with the same title, date, and time already exists for this user'
            });
        }


        const course = new Course({
            user: req.user._id,
            title,
            poster: req.file.filename,  
            description,
            isavailable,
            date,
            time,
            duration,
            amount
        });

        await course.save();

        // Send course details as a styled HTML email (without poster)
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background: #f9f9f9;">
            <h2 style="color: #2e7d32;">Course Added Successfully</h2>
            <p style="font-size: 16px;">Your course has been added successfully. Here are the details:</p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                <td style="padding: 8px; font-weight: bold;">Title:</td>
                <td style="padding: 8px;">${title}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Description:</td>
                <td style="padding: 8px;">${description}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Is Available:</td>
                <td style="padding: 8px;">${isavailable}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Date:</td>
                <td style="padding: 8px;">${date}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Time:</td>
                <td style="padding: 8px;">${time}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Duration:</td>
                <td style="padding: 8px;">${duration}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Amount:</td>
                <td style="padding: 8px;">${amount}</td>
                </tr>
            </table>
            </div>
        `;
        await sendTextEmail(
            req.user.email, 
            'Course Added Successfully',
            undefined,
            htmlContent,
             [
        {
            filename: req.file.originalname, // or req.file.filename
            content: fs.readFileSync(path.join(__dirname, '../../../uploads', req.file.filename)),
            contentType: req.file.mimetype
        }
    ]
        );
        
        res.status(201).json({
            status: true,
            message: 'Course added successfully',
            data: course
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});
// Route for user to register in a course using courseId as a URL parameter
router.post('/v1/user/registercourse/:courseId', isUser, async (req, res) => {
    try {
        const { courseId } = req.params;
        if (!courseId) {
            return res.status(400).json({
                status: false,
                message: 'Course ID is required'
            });
        }

        // Check if course exists
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                status: false,
                message: 'Course not found'
            });
        }
         isavailable = course.isavailable;
        if (isavailable <= 0) {
            return res.status(400).json({
                status: false,
                message: 'Course is not available for registration'
            });
        }
        
         // Check if already registered
        const alreadyRegistered = await Registration.findOne({ user: req.user._id, course: courseId , status: true });
        if (alreadyRegistered) {
            return res.status(400).json({
                status: false,
                message: 'You are already registered for this course'
            });
        }

        // Register user for the course
        const registration = new Registration({
            user: req.user._id,
            course: courseId,
           
        });
           
        await registration.save();

        // Decrease isavailable count for the course
        course.isavailable = course.isavailable - 1;
        await course.save();

        // Send registration confirmation email with course details
        const htmlContent = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background: #f9f9f9;">
            <h2 style="color: #1976d2;">Course Enrollment Successful</h2>
            <p style="font-size: 16px;">You have successfully enrolled in the following course:</p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                <td style="padding: 8px; font-weight: bold;">Title:</td>
                <td style="padding: 8px;">${course.title}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Description:</td>
                <td style="padding: 8px;">${course.description}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Date:</td>
                <td style="padding: 8px;">${course.date}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Time:</td>
                <td style="padding: 8px;">${course.time}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Duration:</td>
                <td style="padding: 8px;">${course.duration}</td>
                </tr>
                <tr>
                <td style="padding: 8px; font-weight: bold;">Amount:</td>
                <td style="padding: 8px;">${course.amount}</td>
                </tr>
            </table>
            <p style="margin-top: 20px; font-size: 15px;">Thank you for enrolling!</p>
            </div>
        `;
        await sendTextEmail(
            req.user.email,
            'Course Enrollment Successful',
            undefined,
            htmlContent
        );

        const courseCreator = await login.findById(course.user);
if (courseCreator && courseCreator.email) {
    // Get registering user's details
    const registeringUser = await login.findById(req.user._id);

    const creatorHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background: #f9f9f9;">
            <h2 style="color: #d32f2f;">New Registration for Your Course</h2>
            <p style="font-size: 16px;">A new user has registered for your course:</p>
            <table style="width: 100%; border-collapse: collapse;">
                <tr>
                    <td style="padding: 8px; font-weight: bold;">Course Title:</td>
                    <td style="padding: 8px;">${course.title}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: bold;">Registered User:</td>
                    <td style="padding: 8px;">${registeringUser.name || registeringUser.email}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: bold;">User Email:</td>
                    <td style="padding: 8px;">${registeringUser.email}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: bold;">User Phone:</td>
                    <td style="padding: 8px;">${registeringUser.phoneno || 'N/A'}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: bold;">Date:</td>
                    <td style="padding: 8px;">${course.date}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: bold;">Time:</td>
                    <td style="padding: 8px;">${course.time}</td>
                </tr>
                <tr>
                    <td style="padding: 8px; font-weight: bold;">Duration:</td>
                    <td style="padding: 8px;">${course.duration}</td>
                </tr>
            </table>
            <p style="margin-top: 20px; font-size: 15px;">Keep up the great work!</p>
        </div>
    `;
    await sendTextEmail(
        courseCreator.email,
        'New Registration in Your Course',
        undefined,
        creatorHtml
    );
}
       

        res.status(201).json({
            status: true,
            message: 'Registered for course successfully',
            data: registration
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});


router.post('/v1/user/cancelregistration/:courseId', isUser, async (req, res) => {
    try {
        const { courseId } = req.params;
        if (!courseId) {
            return res.status(400).json({
                status: false,
                message: 'Course ID is required'
            });
        }

        // Find registration
    const registration = await Registration.findOne({ user: req.user._id, course: courseId, status: true });
    if (!registration) {
        return res.status(404).json({
            status: false,
            message: 'You are not registered for this course'
        });
    }

    // Mark the registration as cancelled (status: false)
    registration.status = false;
    await registration.save();

    // Increase isavailable count for the course
    const course = await Course.findById(courseId);
    if (course) 
    {
        course.isavailable = Number(course.isavailable) + 1;
        await course.save();
    }

        // Send cancellation email to user
        const userHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background: #f9f9f9;">
                <h2 style="color: #d32f2f;">Course Registration Cancelled</h2>
                <p style="font-size: 16px;">You have successfully cancelled your registration for the following course:</p>
                <table style="width: 100%; border-collapse: collapse;">
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Title:</td>
                        <td style="padding: 8px;">${course ? course.title : 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Date:</td>
                        <td style="padding: 8px;">${course ? course.date : 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Time:</td>
                        <td style="padding: 8px;">${course ? course.time : 'N/A'}</td>
                    </tr>
                    <tr>
                        <td style="padding: 8px; font-weight: bold;">Duration:</td>
                        <td style="padding: 8px;">${course ? course.duration : 'N/A'}</td>
                    </tr>
                </table>
                <p style="margin-top: 20px; font-size: 15px;">If this was a mistake, you can register again if seats are available.</p>
            </div>
        `;
        await sendTextEmail(
            req.user.email,
            'Course Registration Cancelled',
            undefined,
            userHtml
        );

        // Send cancellation email to course creator
        if (course && course.user) {
            const courseCreator = await login.findById(course.user);
            if (courseCreator && courseCreator.email) {
                const cancellingUser = await login.findById(req.user._id);
                const creatorHtml = `
                    <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; border: 1px solid #e0e0e0; border-radius: 8px; padding: 24px; background: #f9f9f9;">
                        <h2 style="color: #d32f2f;">Registration Cancelled for Your Course</h2>
                        <p style="font-size: 16px;">A user has cancelled their registration for your course:</p>
                        <table style="width: 100%; border-collapse: collapse;">
                            <tr>
                                <td style="padding: 8px; font-weight: bold;">Course Title:</td>
                                <td style="padding: 8px;">${course.title}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; font-weight: bold;">User:</td>
                                <td style="padding: 8px;">${cancellingUser.name || cancellingUser.email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; font-weight: bold;">User Email:</td>
                                <td style="padding: 8px;">${cancellingUser.email}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; font-weight: bold;">User Phone:</td>
                                <td style="padding: 8px;">${cancellingUser.phoneno || 'N/A'}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; font-weight: bold;">Date:</td>
                                <td style="padding: 8px;">${course.date}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; font-weight: bold;">Time:</td>
                                <td style="padding: 8px;">${course.time}</td>
                            </tr>
                            <tr>
                                <td style="padding: 8px; font-weight: bold;">Duration:</td>
                                <td style="padding: 8px;">${course.duration}</td>
                            </tr>
                        </table>
                        <p style="margin-top: 20px; font-size: 15px;">You may now have an available seat for another user.</p>
                    </div>
                `;
                await sendTextEmail(
                    courseCreator.email,
                    'Registration Cancelled in Your Course',
                    undefined,
                    creatorHtml
                );
            }
        }

        res.status(200).json({
            status: true,
            message: 'Registration cancelled successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/user/mycourse/:courseId', isUserOrAdmin, async (req, res) => {
    try {
        const { courseId } = req.params;
        if (!courseId) {
            return res.status(400).json({
                status: false,
                message: 'Course ID is required'
            });
        }

        // Find the course and ensure the requesting user is the creator
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                status: false,
                message: 'Course not found'
            });
        }
         // Allow only creator or admin to view
        if (
            String(course.user) !== String(req.user._id) &&
            !(req.user.isAdmin === true || req.user.role === 'admin')
        ) {
            return res.status(403).json({
                status: false,
                message: 'You are not authorized to view this course'
            });
        }

        // Count registered students (current registrations)
        const registeredCount = await Registration.countDocuments({ course: courseId, status: true });
        const cancelledRegistrations = await Registration.countDocuments({ course: courseId, status: false });

        // Fetch details of registered students (status: true)
        const registeredRegistrations = await Registration.find({ course: courseId, status: true }).populate({
            path: 'user',
            select: 'name email phoneno'
        });

        // Map to get array of user details
        const registeredStudentsDetails = registeredRegistrations.map(reg => ({
            name: reg.user.name,
            email: reg.user.email,
            phoneno: reg.user.phoneno
        }));
    const creator = await login.findById(course.user, 'name email phoneno');

        res.status(200).json({
            status: true,
            message: 'Course details fetched successfully',
            data: {
                course,
                registeredStudents: registeredCount,
                registeredStudentsDetails,
                noofcancelled: cancelledRegistrations,
                creator: {
                    name: creator.name,
                    email: creator.email,
                    phoneno: creator.phoneno
                }
                
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.put('/v1/user/updatecourse/:courseId', isUserOrAdmin, upload.single('poster'), async (req, res) => {
    try {
        const { courseId } = req.params;
        const { title, description, isavailable, date, time, amount, duration } = req.body;

        if (!courseId) {
            return res.status(400).json({
                status: false,
                message: 'Course ID is required'
            });
        }

        // Find the course and ensure the requesting user is the creator
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                status: false,
                message: 'Course not found'
            });
        }
         // Allow only creator or admin to update
        if (
            String(course.user) !== String(req.user._id) &&
            !(req.user.isAdmin === true || req.user.role === 'admin')
        ) {
            return res.status(403).json({
                status: false,
                message: 'You are not authorized to update this course'
            });
        }

        // Update course details
        if (title !== undefined) course.title = title; 
        if (description !== undefined) course.description = description;
        if (isavailable !== undefined) course.isavailable = isavailable;
        if (date !== undefined) course.date = date;
        if (time !== undefined) course.time = time;
        if (amount !== undefined) course.amount = amount;
        if (duration !== undefined) course.duration = duration;
        if (req.file) course.poster = req.file.filename;

        await course.save();

        res.status(200).json({
            status: true,
            message: 'Course updated successfully',
            data: course
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.delete('/v1/user/deletecourse/:courseId', isUserOrAdmin, async (req, res) => {
    try {
        const { courseId } = req.params;
        if (!courseId) {
            return res.status(400).json({
                status: false,
                message: 'Course ID is required'
            });
        }

        // Find the course
        const course = await Course.findById(courseId);
        if (!course) {
            return res.status(404).json({
                status: false,
                message: 'Course not found'
            });
        }

        // Allow only creator or admin to delete
        if (
            String(course.user) !== String(req.user._id) &&
            !(req.user.isAdmin === true || req.user.role === 'admin')
        ) {
            return res.status(403).json({
                status: false,
                message: 'You are not authorized to delete this course'
            });
        }

        // Mark the course as deleted (set status to false)
        course.status = false;
        await course.save();

        // Optionally, mark all registrations as cancelled for this course
        await Registration.updateMany(
            { course: courseId, status: true },
            { $set: { status: false } }
        );

        res.status(200).json({
            status: true,
            message: 'Course deleted successfully'
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

module.exports = router;