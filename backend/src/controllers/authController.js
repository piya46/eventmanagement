const Admin = require('../models/admin');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const Session = require('../models/session');
const ApiLog = require('../models/apilog');
const auditLog = require('../helpers/auditLog');
const ms = require('ms');

exports.login = async (req, res) => {
    const { username, password } = req.body;
    const admin = await Admin.findOne({ username });
    if (!admin) {
        auditLog({ req, action: 'LOGIN_FAIL', detail: 'User not found', status: 400 });
        return res.status(400).json({ error: 'User not found' });
    }
    const isMatch = await bcrypt.compare(password, admin.passwordHash);
    if (!isMatch) {
        auditLog({ req, action: 'LOGIN_FAIL', detail: 'Invalid credentials', status: 400 });
        return res.status(400).json({ error: 'Invalid credentials' });
    }

    // ดึงค่า JWT_EXPIRES_IN จาก .env
    const jwtExpiresIn = process.env.JWT_EXPIRES_IN || '4h';
    const expiresInMs = ms(jwtExpiresIn); // แปลงเป็น ms
    const expiresAt = new Date(Date.now() + expiresInMs);

    // เคลียร์ session ที่หมดอายุทิ้ง (optional)
    await Session.deleteMany({ userId: admin._id, expiresAt: { $lt: new Date() } });

    // เช็ค session ที่ยังไม่หมดอายุ/ไม่โดน revoke
    const activeSessionCount = await Session.countDocuments({
        userId: admin._id,
        revoked: false,
        expiresAt: { $gt: new Date() }
    });
    if (activeSessionCount >= 3) {
        auditLog({ req, action: 'LOGIN_FAIL', detail: 'Too many active sessions', status: 400 });
        return res.status(400).json({ error: 'Login from too many device' });
    }

    // ออก token (เวลาตรงกับ expiresAt)
    const payload = { id: admin._id, role: admin.role };
    const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: jwtExpiresIn });

    // save session
    await Session.create({
        userId: admin._id,
        token,
        userAgent: req.headers['user-agent'],
        ip: req.ip,
        revoked: false,
        expiresAt // เวลาเดียวกับ token
    });

    res.json({
        token,
        admin: {
            id: admin._id,
            username: admin.username,
            role: admin.role,
            email: admin.email,
            fullName: admin.fullName
        }
    });
    auditLog({ req, action: 'LOGIN', detail: 'Login success' });
};

exports.getMe = async (req, res) => {
  // req.user ต้องมาจาก middleware auth ที่ decode JWT ให้
  if (!req.user) return res.status(401).json({ error: 'Unauthorized' });

  // ดึงข้อมูลผู้ใช้จาก database (หรือจะใช้ req.user เลยก็ได้ ถ้า payload มีทุก field)
  const admin = await Admin.findById(req.user.id);
  if (!admin) return res.status(404).json({ error: 'User not found' });

  // ไม่ควรส่ง passwordHash กลับไป
  res.json({
    id: admin._id,
    username: admin.username,
    role: admin.role,
    email: admin.email,
    fullName: admin.fullName,
    avartarUrl: admin.avatarUrl,
    // ...field อื่นๆที่ต้องการ
  });
};

// exports.login = async (req, res) => {
//     const {username, password} = req.body;
//     const admin = await Admin.findOne({username});
//     if (!admin) {
//     auditLog({ req, action: 'LOGIN_FAIL', detail: 'User not found', status: 400 });
//     return res.status(400).json({ error: 'User not found' });
//     }
//     const isMatch = await bcrypt.compare(password, admin.passwordHash);
//     if (!isMatch) {
//     auditLog({ req, action: 'LOGIN_FAIL', detail: 'Invalid credentials', status: 400 });
//     return res.status(400).json({ error: 'Invalid credentials' });
//     }

//     const payload = { id: admin._id, role: admin.role };
//     const token = jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: process.env.JWT_EXPIRES_IN});
//     await Session.create({
//         userId: admin._id,
//         token,
//         userAgent: req.headers['user-agent'],
//         ip: req.ip
//     });
//     res.json({
//         token,
//         admin: {
//             id: admin._id,
//             username: admin.username,
//             role: admin.role,
//             email: admin.email,
//             fullName: admin.fullName
//         }
//     });
//     auditLog({ req, action: 'LOGIN', detail: 'Login success' });
// };


