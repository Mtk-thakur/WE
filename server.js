// ============================================================
// TaskFlow - Express.js REST API Backend (server.js)
// Web Engineering Project | Node.js + Express + MongoDB
// ============================================================

const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const bodyParser = require('body-parser');

const app = express();
const PORT = process.env.PORT || 3000;

// ── Middleware ──────────────────────────────────────────────
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));  // Serve AngularJS frontend

// ── MongoDB Connection ──────────────────────────────────────
const MONGO_URI = process.env.MONGO_URI || 'mongodb://localhost:27017/taskflow';

mongoose.connect(MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
})
.then(() => console.log('✅ MongoDB connected successfully'))
.catch(err => console.error('❌ MongoDB connection error:', err));

// ── Schemas & Models ────────────────────────────────────────

// Task Schema
const taskSchema = new mongoose.Schema({
  title:       { type: String, required: [true, 'Task title is required'], trim: true },
  description: { type: String, default: '' },
  category:    { type: String, enum: ['Development','Design','Marketing','Operations','Research','Testing'], default: 'Development' },
  priority:    { type: String, enum: ['High','Medium','Low'], default: 'Medium' },
  status:      { type: String, enum: ['Todo','In Progress','Done'], default: 'Todo' },
  assignedTo:  { type: String, default: '' },
  dueDate:     { type: Date },
  createdAt:   { type: Date, default: Date.now },
  updatedAt:   { type: Date, default: Date.now },
});

taskSchema.pre('save', function(next) {
  this.updatedAt = new Date();
  next();
});

// User Schema
const userSchema = new mongoose.Schema({
  name:       { type: String, required: [true, 'Name is required'], trim: true },
  email:      { type: String, required: [true, 'Email is required'], unique: true, lowercase: true },
  role:       { type: String, enum: ['Admin','Manager','Developer','Designer'], default: 'Developer' },
  department: { type: String, default: 'Engineering' },
  createdAt:  { type: Date, default: Date.now },
});

const Task = mongoose.model('Task', taskSchema);
const User = mongoose.model('User', userSchema);

// ── Error Handler Helper ────────────────────────────────────
const handleError = (res, err, status = 500) => {
  console.error('Error:', err.message);
  res.status(status).json({ error: err.message || 'Internal server error' });
};

// ════════════════════════════════════════════════════════════
//  TASK ENDPOINTS
// ════════════════════════════════════════════════════════════

/**
 * GET /api/tasks
 * Retrieve all tasks. Supports filters: ?status=Done&priority=High&category=Dev
 */
app.get('/api/tasks', async (req, res) => {
  try {
    const filter = {};
    if (req.query.status)   filter.status = req.query.status;
    if (req.query.priority) filter.priority = req.query.priority;
    if (req.query.category) filter.category = req.query.category;
    if (req.query.assignedTo) filter.assignedTo = req.query.assignedTo;

    const tasks = await Task.find(filter).sort({ createdAt: -1 });
    res.json({ success: true, count: tasks.length, data: tasks });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /api/tasks/stats
 * Aggregate statistics dashboard
 */
app.get('/api/tasks/stats', async (req, res) => {
  try {
    const total      = await Task.countDocuments();
    const done       = await Task.countDocuments({ status: 'Done' });
    const inProgress = await Task.countDocuments({ status: 'In Progress' });
    const todo       = await Task.countDocuments({ status: 'Todo' });
    const overdue    = await Task.countDocuments({
      dueDate: { $lt: new Date() },
      status: { $ne: 'Done' }
    });
    const byPriority = await Task.aggregate([
      { $group: { _id: '$priority', count: { $sum: 1 } } }
    ]);
    res.json({ success: true, data: { total, done, inProgress, todo, overdue, byPriority } });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /api/tasks/:id
 * Get a single task by ID
 */
app.get('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findById(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, data: task });
  } catch (err) {
    handleError(res, err, 400);
  }
});

/**
 * POST /api/tasks
 * Create a new task
 * Body: { title, description, category, priority, assignedTo, dueDate }
 */
app.post('/api/tasks', async (req, res) => {
  try {
    const { title, description, category, priority, assignedTo, dueDate } = req.body;
    if (!title) return res.status(400).json({ error: 'Task title is required' });

    const task = new Task({ title, description, category, priority, assignedTo, dueDate });
    const saved = await task.save();
    res.status(201).json({ success: true, message: 'Task created', data: saved });
  } catch (err) {
    handleError(res, err, 400);
  }
});

/**
 * PUT /api/tasks/:id
 * Update an existing task (partial update supported)
 */
app.put('/api/tasks/:id', async (req, res) => {
  try {
    const updates = { ...req.body, updatedAt: new Date() };
    const task = await Task.findByIdAndUpdate(
      req.params.id,
      { $set: updates },
      { new: true, runValidators: true }
    );
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, message: 'Task updated', data: task });
  } catch (err) {
    handleError(res, err, 400);
  }
});

/**
 * DELETE /api/tasks/:id
 * Remove a task permanently
 */
app.delete('/api/tasks/:id', async (req, res) => {
  try {
    const task = await Task.findByIdAndDelete(req.params.id);
    if (!task) return res.status(404).json({ error: 'Task not found' });
    res.json({ success: true, message: 'Task deleted successfully' });
  } catch (err) {
    handleError(res, err, 400);
  }
});

// ════════════════════════════════════════════════════════════
//  USER ENDPOINTS
// ════════════════════════════════════════════════════════════

/**
 * GET /api/users
 * Get all users
 */
app.get('/api/users', async (req, res) => {
  try {
    const users = await User.find().sort({ createdAt: -1 });
    res.json({ success: true, count: users.length, data: users });
  } catch (err) {
    handleError(res, err);
  }
});

/**
 * GET /api/users/:id
 * Get user by ID
 */
app.get('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findById(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, data: user });
  } catch (err) {
    handleError(res, err, 400);
  }
});

/**
 * POST /api/users
 * Register a new user
 * Body: { name, email, role, department }
 */
app.post('/api/users', async (req, res) => {
  try {
    const { name, email, role, department } = req.body;
    if (!name || !email) return res.status(400).json({ error: 'Name and email required' });

    const existing = await User.findOne({ email });
    if (existing) return res.status(409).json({ error: 'Email already registered' });

    const user = new User({ name, email, role, department });
    const saved = await user.save();
    res.status(201).json({ success: true, message: 'User registered', data: saved });
  } catch (err) {
    handleError(res, err, 400);
  }
});

/**
 * PUT /api/users/:id
 * Update user profile
 */
app.put('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndUpdate(
      req.params.id, { $set: req.body }, { new: true, runValidators: true }
    );
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User updated', data: user });
  } catch (err) {
    handleError(res, err, 400);
  }
});

/**
 * DELETE /api/users/:id
 * Remove a user
 */
app.delete('/api/users/:id', async (req, res) => {
  try {
    const user = await User.findByIdAndDelete(req.params.id);
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({ success: true, message: 'User removed successfully' });
  } catch (err) {
    handleError(res, err, 400);
  }
});

// ── Health Check ────────────────────────────────────────────
/**
 * GET /api/health
 * Server health check
 */
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    uptime: process.uptime().toFixed(2) + 's',
    dbState: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected',
    timestamp: new Date().toISOString()
  });
});

// 404 fallback
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Start server
app.listen(PORT, () => {
  console.log(`🚀 TaskFlow server running at http://localhost:${PORT}`);
  console.log(`📖 API Docs: http://localhost:${PORT}/api/health`);
});

module.exports = app;
