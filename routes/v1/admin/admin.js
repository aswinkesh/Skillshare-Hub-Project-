const express = require ('express');
const jwt=require('jsonwebtoken');
const bcryptjs=require('bcryptjs');
const {login}=require('../../../models/login');
const {token}=require('../../../models/token');
const isAdmin = require('../../../controllers/middlewares').isAdmin; //if curly then .isadmin is not required
const isUser = require('../../../controllers/middlewares').isUser; //if curly then .isuser is not required
const {Otp} = require('../../../models/otp');
const {sendTextEmail} = require('../../../controllers/email');

require('dotenv').config(); // Load environment variables from .env file
// const ExcelJS = require('exceljs');


const randomstring = require('randomstring');

const router = express();

router.post(
    '/v1/admin/register', async(req,res)=>{
        try
        {
            const { name,email,phoneno,password} = req.body;
            if(!name || !email || !phoneno || !password)
            {
                return res.status(400).json({
                    status:false,
                    message: 'All fields are required',
                    
                })
            }
            if(name.length < 2 || name.length > 30){
                return res.status(400).json({
                    status:false,
                    message: 'Name must be between 2 and 30 characters',
                })
            }
            if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
                return res.status(400).json({
                    status: false,
                    message: 'Name can only contain alphabets and single spaces between first, middle, and last names',
                });
            }


            if(/^\S+@\S+\.\S+$/.test(email) === false)
            {
                return res.status(400).json({
                    status:false,
                    message: 'Invalid email format',
                })
            }

            if (!email.endsWith('.com') && !email.endsWith('.in')) {
                return res.status(400).json({
                    status: false,
                    message: 'Only .com and .in email addresses are allowed',
                });
            }

        const existingInactiveUser = await login.findOne({ email: email, status: false });
        if (existingInactiveUser) {
            await login.deleteMany({ email: email, status: false });
        } 

         

            const existingUser = await login.findOne({ email: email ,status: true }); //status:true means only active users
            if (existingUser) {
                return res.status(400).json({
                    status: false,
                    message: 'User with this email already exists',
                });
            }




            const existingadmin = await login.findOne({ role: 'admin' });
        if (existingadmin && email === existingadmin.email) {
            return res.status(409).json({
                status: false,
                message: 'Admin user already exists'
            });
        }
        if(!/^\d{10}$/.test(phoneno))
        {
            return res.status(400).json({
                status:false,
                message: 'Invalid phone number format',
            })
            }
            if(phoneno === "1234567890") {
                return res.status(400).json({
                    status:false,
                    message: 'Phone number cannot be 1234567890',
                })
            }
            if (/[^0-9]/.test(phoneno)) {
                return res.status(400).json({
                    status: false,
                    message: 'Phone number cannot contain special characters',
                });
            }
            const existingUser2 = await login.findOne({ phoneno: phoneno ,status: true }); //status:true means only active users
            if (existingUser2) {
                return res.status(400).json({
                    status: false,
                    message: 'User with this phone number already exists',
                });
            }

            // if(role !== 'admin' && role !== 'user')
            // {
            //     return res.status(400).json({
            //         status:false,
            //         message: 'Invalid role',
            //     })
            // }

            

        if (password.length < 8 || 
            !/[A-Z]/.test(password) || 
            !/[a-z]/.test(password) || 
            !/[0-9]/.test(password) || 
            !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return res.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
            });
        }
       

            const hashedpassword = await bcryptjs.hash(password, 10); //10 is the salt rounds,it means how many times the password will be hashed

            if (email === process.env.ADMIN_EMAIL) { // Replace with your admin email
                const newUser = new login({
                    email,
                    password: hashedpassword,
                    name,
                    role: 'admin', // Set role to admin for this specific email
                    phoneno,
                    status: true // Admin is active immediately
                });
                await newUser.save();
                return res.status(201).json({
                    status: true,
                    message: 'Admin registered successfully.'
                });
            }

            // Only send OTP for non-admin users
            const otp = randomstring.generate({ length: 4, charset: 'numeric' });
            const expiresat = new Date(Date.now() + 5 * 60 * 1000); // OTP expires in 5 minutes
            await Otp.findOneAndUpdate(
                { email },
                { otp: otp, expiresat },
                { upsert: true, new: true }
            );
            await sendTextEmail(email, 'OTP Verification Email', `Your OTP is: ${otp}`);
            res.status(200).json({ status: true, message: 'OTP email sent successfully', otp });


            if (email !== process.env.ADMIN_EMAIL) { // Replace with your admin email
                const newUser = new login({
                    name: name,
                    email: email,
                    phoneno: phoneno,
                    password: hashedpassword,
                    role: 'user', // Set role to user for all other emails
                    status: false // Initially set status to false until OTP verification
                });

                await newUser.save(); // Save the new user to the database
            }
            res.status(201).json({
                status:true,
                message: 'User registered successfully',
            })
        }
        catch(er) 
        {
            console.error(er); 
            res.status(500).json({
                status:false,
                message: 'Internal Server Error',
            })
        }
    }
)


router.post('/v1/admin/verify-otp', async (req, res) => {
    try {
        const { email, otp } = req.body;
        const otpRecord = await Otp.findOne({ email, otp });

        if (!email || !otp) {
            return res.status(400).json({ status: false, message: 'Email and OTP are required' });
        }
        if (/^\S+@\S+\.\S+$/.test(email) === false) {
            return res.status(400).json({ status: false, message: 'Invalid email format' });
        }

        if (!otpRecord || otpRecord.expiresat < new Date()) {
            return res.status(400).json({ status: false, message: 'Invalid or expired OTP' });
        }

        // Activate user
        const user = await login.findOne({ email });
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
        user.status = true;
        await user.save();

        const adminUser = await login.findOne({ role: 'admin' });
        if (adminUser && adminUser.email) {
            const notifyHtml = `
                <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; border: 1px solid #eee; border-radius: 8px; padding: 24px; background: #fafbfc;">
                    <h2 style="color: #2d8cf0;">New User Registered</h2>
                    <p style="font-size: 16px; color: #333;">A new user has completed registration and verified their email.</p>
                    <div style="margin: 16px 0;">
                        <strong>Email:</strong> ${user.email}<br>
                        <strong>Name:</strong> ${user.name}<br>
                        <strong>Phone:</strong> ${user.phoneno}
                    </div>
                    <p style="font-size: 12px; color: #bbb;">This is an automated notification.</p>
                </div>
            `;
            await sendTextEmail(
                adminUser.email,
                'New User Registered',
                `A new user has registered: ${user.email}`,
                notifyHtml
            );
        }

        // Generate JWT
        const jwtToken = jwt.sign(
            { userId: user._id, role: user.role },
            'your_secret_key',
            { expiresIn: '1h' }
        );

        // Save token in database
        const newToken = new token({
            loginid: user._id,
            token: jwtToken
        });

        await newToken.save();

        // Remove OTP record
        await Otp.deleteOne({ email });

        res.status(200).json({ status: true, message: 'Account activated. You can now log in.' });
    } catch (error) {
        console.error('Error during OTP verification:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
});




router.post('/v1/admin/login', async(req,res)=>{
    try
    {
        const { email, password } = req.body;
        if (!email || !password) {
            return res.status(400).json({
                status: false,
                message: 'Email and password are required',
            });
        }

        if (/^\S+@\S+\.\S+$/.test(email) === false) {
            return res.status(400).json({
                status: false,
                message: 'Invalid email format',
            });
        }
        if (password.length < 8 ||
            !/[A-Z]/.test(password) ||
            !/[a-z]/.test(password) ||
            !/[0-9]/.test(password) ||
            !/[!@#$%^&*(),.?":{}|<>]/.test(password)) {
            return res.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters long and include uppercase, lowercase, number, and special character',
            });
        }

        const user = await login.findOne({ email: email });
        if (!user) {
            return res.status(401).json({
                status: false,
                message: 'Invalid email or password',
            });
        }

        const isPasswordValid = await bcryptjs.compare(password, user.password);
        if (!isPasswordValid) {
            return res.status(401).json({
                status: false,
                message: 'Invalid email or password',
            });
        }

        // Generate JWT
        const jwtToken = jwt.sign(
            { userId: user._id, role: user.role },
            'your_secret_key',
            { expiresIn: '1h' }
        );

        // Save token in database
        const newToken = new token({
            loginid: user._id,
            token: jwtToken
        });

        await newToken.save();

        res.status(200).json({
            status: true,
            message: 'Login successful',
            token: jwtToken,
            role: user.role
        });
    }
    catch (er) 
    {
        console.error(er); 
        res.status(500).json({
            status:false,
            message: 'Internal Server Error',
        })
    }
})


router.post('/v1/user/forget-password', async (req, res) => {
    try {
        const { email } = req.body;
        if (!email) {
            return res.status(400).json({
                status: false,
                message: 'Email is required'
            });
        }

        const user = await login.findOne({ email });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        // Generate OTP
        const otpCode = randomstring.generate({
            length: 4,
            charset: 'numeric'
        });
        const expiresAt = new Date(Date.now() + 5 * 60 * 1000); // 5 minutes

        // Save OTP to DB
        await Otp.findOneAndUpdate(
            { email },
            { otp: otpCode, expiresAt },
            { upsert: true, new: true }
        );

        const otpHtml = `
            <div style="font-family: Arial, sans-serif; max-width: 400px; margin: auto; border: 1px solid #eee; border-radius: 8px; padding: 24px; background: #fafbfc;">
                <h2 style="color: #2d8cf0;">Password Reset OTP</h2>
                <p style="font-size: 16px; color: #333;">Use the following OTP to reset your password:</p>
                <div style="font-size: 32px; font-weight: bold; color: #2d8cf0; letter-spacing: 8px; margin: 16px 0;">${otpCode}</div>
                <p style="font-size: 14px; color: #888;">This OTP will expire in 5 minutes.</p>
                <hr style="border: none; border-top: 1px solid #eee; margin: 24px 0;">
                <p style="font-size: 12px; color: #bbb;">If you did not request this, please ignore this email.</p>
            </div>
        `;

        await sendTextEmail(
            email,
            'Password Reset OTP',
            `Your OTP for password reset is: ${otpCode}`,
            otpHtml
        );

        res.status(200).json({
            status: true,
            message: 'OTP sent to email. Please use it to reset your password.'
        });
    } catch (error) {
        console.error('Error during password reset request:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

// Route to reset password using OTP
router.post('/v1/user/reset-password', async (req, res) => {
    try {
        const { email, otp, password } = req.body;
        if (!email || !otp || !password) {
            return res.status(400).json({
                status: false,
                message: 'Email, OTP, and new password are required'
            });
        }

        const otpRecord = await Otp.findOne({ email, otp });
        if (!otpRecord || otpRecord.expiresat < new Date()) {
            return res.status(400).json({
                status: false,
                message: 'Invalid or expired OTP'
            });
        }

        if (password.length < 8) {
            return res.status(400).json({
                status: false,
                message: 'Password must be at least 8 characters long'
            });
        }
        if (!/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
            return res.status(400).json({
                status: false,
                message: 'Password must contain uppercase, lowercase letters, and a number'
            });
        }

        const user = await login.findOne({ email });
        if (!user) {
            return res.status(404).json({
                status: false,
                message: 'User not found'
            });
        }

        user.password = await bcryptjs.hash(password, 10);
        await user.save();

        // Remove OTP record
        await Otp.deleteOne({ email });

        res.status(200).json({
            status: true,
            message: 'Password reset successful. You can now log in with your new password.'
        });
    } catch (error) {
        console.error('Error during password reset:', error);
        res.status(500).json({
            status: false,
            message: 'Internal server error'
        });
    }
});

router.get('/v1/user/profile', isUser, async (req, res) => {
    try {
        // req.user is set by isUser middleware
        const user = await login.findById(req.user._id).select('-password');
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
        res.status(200).json({
            status: true,
            profile: {
                name: user.name,
                email: user.email,
                phoneno: user.phoneno
            }
        });
    } catch (error) {
        console.error('Error fetching user profile:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
});

router.put('/v1/user/profile', isUser, async (req, res) => {
    try {
        const { name, phoneno } = req.body;
        if (!name && !phoneno) {
            return res.status(400).json({ status: false, message: 'Nothing to update' });
        }

        const updates = {};
        if (name) {
            if (name.length < 2 || name.length > 30) {
                return res.status(400).json({ status: false, message: 'Name must be between 2 and 30 characters' });
            }
            if (!/^[A-Za-z]+(?: [A-Za-z]+)*$/.test(name)) {
                return res.status(400).json({
                    status: false,
                    message: 'Name can only contain alphabets and single spaces between first, middle, and last names',
                });
            }
            updates.name = name;
        }
        if (phoneno) {
            if (!/^\d{10}$/.test(phoneno)) {
                return res.status(400).json({ status: false, message: 'Invalid phone number format' });
            }
            if (phoneno === "1234567890") {
                return res.status(400).json({ status: false, message: 'Phone number cannot be 1234567890' });
            }
            if (/[^0-9]/.test(phoneno)) {
                return res.status(400).json({ status: false, message: 'Phone number cannot contain special characters' });
            }
            // Check if phone number is already used by another user
            const existingUser = await login.findOne({ phoneno, _id: { $ne: req.user._id }, status: true });
            if (existingUser) {
                return res.status(400).json({ status: false, message: 'Phone number already in use' });
            }
            updates.phoneno = phoneno;
        }

        const user = await login.findByIdAndUpdate(req.user._id, updates, { new: true, select: '-password' });
        if (!user) {
            return res.status(404).json({ status: false, message: 'User not found' });
        }
        res.status(200).json({
            status: true,
            message: 'Profile updated successfully',
            profile: {
                name: user.name,
                email: user.email,
                phoneno: user.phoneno
            }
        });
    } catch (error) {
        console.error('Error updating user profile:', error);
        res.status(500).json({ status: false, message: 'Internal server error' });
    }
});


module.exports=router;














