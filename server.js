const express = require('express');
const sqlite3 = require('sqlite3').verbose();
const cors = require('cors');
const bodyParser = require('body-parser');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});
const PORT = process.env.PORT || 3000;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Serve static files
app.use('/admin', express.static(path.join(__dirname, 'admin-portal')));
app.use('/mobile', express.static(path.join(__dirname, 'mobile-app')));

// Test page for debugging
app.get('/test-debug', (req, res) => {
    res.sendFile(path.join(__dirname, 'test-attendance-debug.html'));
});

// Database setup
const db = new sqlite3.Database('./database.sqlite');

// Initialize database tables
db.serialize(() => {
  // Events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    max_capacity INTEGER DEFAULT 100,
    institute TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Students table
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    institute TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Registrations table
  db.run(`CREATE TABLE IF NOT EXISTS registrations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    registered_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    verified BOOLEAN DEFAULT 0,
    verified_at DATETIME,
    FOREIGN KEY (student_id) REFERENCES students (id),
    FOREIGN KEY (event_id) REFERENCES events (id),
    UNIQUE(student_id, event_id)
  )`);

  // Attendance table
  db.run(`CREATE TABLE IF NOT EXISTS attendance (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    checked_in_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students (id),
    FOREIGN KEY (event_id) REFERENCES events (id),
    UNIQUE(student_id, event_id)
  )`);

  // Feedback table
  db.run(`CREATE TABLE IF NOT EXISTS feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    rating INTEGER CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    submitted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students (id),
    FOREIGN KEY (event_id) REFERENCES events (id)
  )`);

  // Deleted feedback table (for student-specific soft deletion)
  db.run(`CREATE TABLE IF NOT EXISTS deleted_feedback (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    feedback_id INTEGER NOT NULL,
    deleted_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students (id),
    FOREIGN KEY (feedback_id) REFERENCES feedback (id),
    UNIQUE(student_id, feedback_id)
  )`);

  // Attendance marks table (for admin marking attendance)
  db.run(`CREATE TABLE IF NOT EXISTS attendance_marks (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id INTEGER NOT NULL,
    event_id INTEGER NOT NULL,
    status TEXT NOT NULL CHECK (status IN ('attended', 'absent')),
    marked_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (student_id) REFERENCES students (id),
    FOREIGN KEY (event_id) REFERENCES events (id),
    UNIQUE(student_id, event_id)
  )`);
  
  // Add verification columns to existing registrations table if they don't exist
  db.run(`ALTER TABLE registrations ADD COLUMN verified BOOLEAN DEFAULT 0`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding verified column:', err.message);
    }
  });
  
  db.run(`ALTER TABLE registrations ADD COLUMN verified_at DATETIME`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding verified_at column:', err.message);
    }
  });

  // Add institute columns to existing tables
  db.run(`ALTER TABLE events ADD COLUMN institute TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding institute column to events:', err.message);
    }
  });
  
  db.run(`ALTER TABLE students ADD COLUMN institute TEXT`, (err) => {
    if (err && !err.message.includes('duplicate column name')) {
      console.error('Error adding institute column to students:', err.message);
    }
  });

  // Clean up orphaned data on startup
  db.run('DELETE FROM registrations WHERE student_id NOT IN (SELECT id FROM students)', function(err) {
    if (err) {
      console.error('Error cleaning orphaned registrations:', err);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned registrations`);
    }
  });
  
  db.run('DELETE FROM attendance WHERE student_id NOT IN (SELECT id FROM students)', function(err) {
    if (err) {
      console.error('Error cleaning orphaned attendance:', err);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned attendance records`);
    }
  });
  
  db.run('DELETE FROM feedback WHERE student_id NOT IN (SELECT id FROM students)', function(err) {
    if (err) {
      console.error('Error cleaning orphaned feedback:', err);
    } else if (this.changes > 0) {
      console.log(`Cleaned up ${this.changes} orphaned feedback records`);
    }
  });
});

// API Routes

// Events API
app.get('/api/events', (req, res) => {
  db.all('SELECT * FROM events ORDER BY date, time', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/events', (req, res) => {
  const { title, description, date, time, location, max_capacity, institute } = req.body;
  
  db.run(
    'INSERT INTO events (title, description, date, time, location, max_capacity, institute) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [title, description, date, time, location, max_capacity, institute],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Event created successfully' });
    }
  );
});

app.put('/api/events/:id', (req, res) => {
  const { title, description, date, time, location, max_capacity, institute } = req.body;
  const eventId = req.params.id;
  
  db.run(
    'UPDATE events SET title = ?, description = ?, date = ?, time = ?, location = ?, max_capacity = ?, institute = ? WHERE id = ?',
    [title, description, date, time, location, max_capacity, institute, eventId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: 'Event updated successfully' });
    }
  );
});

app.delete('/api/events/:id', (req, res) => {
  const eventId = req.params.id;
  
  db.run('DELETE FROM events WHERE id = ?', [eventId], function(err) {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json({ message: 'Event deleted successfully' });
  });
});

// Students API
app.get('/api/students', (req, res) => {
  db.all('SELECT * FROM students ORDER BY name', (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/students', (req, res) => {
  const { student_id, name, email, phone, institute } = req.body;
  
  db.run(
    'INSERT INTO students (student_id, name, email, phone, institute) VALUES (?, ?, ?, ?, ?)',
    [student_id, name, email, phone, institute],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Student registered successfully' });
    }
  );
});

app.put('/api/students/:id', (req, res) => {
  const { student_id, name, email, phone, institute } = req.body;
  const studentDbId = req.params.id;
  
  db.run(
    'UPDATE students SET student_id = ?, name = ?, email = ?, phone = ?, institute = ? WHERE id = ?',
    [student_id, name, email, phone, institute, studentDbId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: studentDbId, message: 'Student updated successfully' });
    }
  );
});

// Registrations API
app.get('/api/registrations', (req, res) => {
  const query = `
    SELECT r.id, r.student_id, r.event_id, r.registered_at, r.verified, r.verified_at,
           s.name as student_name, s.student_id as student_id_string, 
           e.title as event_title, e.date, e.time
    FROM registrations r
    INNER JOIN students s ON r.student_id = s.id
    INNER JOIN events e ON r.event_id = e.id
    ORDER BY r.registered_at DESC
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/registrations', (req, res) => {
  const { student_id, event_id } = req.body;
  
  db.run(
    'INSERT INTO registrations (student_id, event_id) VALUES (?, ?)',
    [student_id, event_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Registration successful' });
    }
  );
});

// Verify a single registration
app.put('/api/registrations/:id/verify', (req, res) => {
  const registrationId = req.params.id;
  
  db.run(
    'UPDATE registrations SET verified = 1, verified_at = CURRENT_TIMESTAMP WHERE id = ?',
    [registrationId],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Registration not found' });
        return;
      }
      res.json({ message: 'Registration verified successfully' });
    }
  );
});

// Verify all registrations
app.put('/api/registrations/verify-all', (req, res) => {
  db.run(
    'UPDATE registrations SET verified = 1, verified_at = CURRENT_TIMESTAMP WHERE verified = 0',
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ message: `Verified ${this.changes} registrations successfully` });
    }
  );
});

// Delete a single registration
app.delete('/api/registrations/:id', (req, res) => {
  const registrationId = req.params.id;
  
  // First get the registration details for notification
  db.get(
    'SELECT r.*, s.name as student_name, s.email, e.title as event_title FROM registrations r INNER JOIN students s ON r.student_id = s.id INNER JOIN events e ON r.event_id = e.id WHERE r.id = ?',
    [registrationId],
    (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (!row) {
        res.status(404).json({ error: 'Registration not found' });
        return;
      }
      
      // Delete the registration
      db.run(
        'DELETE FROM registrations WHERE id = ?',
        [registrationId],
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ 
            message: 'Registration deleted successfully',
            student_name: row.student_name,
            student_email: row.email,
            event_title: row.event_title
          });
        }
      );
    }
  );
});

// Delete all registrations
app.delete('/api/registrations', (req, res) => {
  // First get all registration details for notifications
  db.all(
    'SELECT r.*, s.name as student_name, s.email, e.title as event_title FROM registrations r INNER JOIN students s ON r.student_id = s.id INNER JOIN events e ON r.event_id = e.id',
    (err, rows) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Delete all registrations
      db.run(
        'DELETE FROM registrations',
        function(err) {
          if (err) {
            res.status(500).json({ error: err.message });
            return;
          }
          res.json({ 
            message: `Deleted ${this.changes} registrations successfully`,
            deleted_registrations: rows
          });
        }
      );
    }
  );
});

// Attendance API
app.post('/api/attendance', (req, res) => {
  const { student_id, event_id } = req.body;
  
  db.run(
    'INSERT INTO attendance (student_id, event_id) VALUES (?, ?)',
    [student_id, event_id],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      // Broadcast attendance update
      loadAndBroadcastAttendanceData(event_id);
      
      res.json({ id: this.lastID, message: 'Check-in successful' });
    }
  );
});

app.get('/api/attendance/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  
  const query = `
    SELECT a.*, s.name as student_name, s.student_id
    FROM attendance a
    JOIN students s ON a.student_id = s.id
    WHERE a.event_id = ?
    ORDER BY a.checked_in_at DESC
  `;
  
  db.all(query, [eventId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Feedback API
app.get('/api/feedback', (req, res) => {
  const studentId = req.query.student_id;
  
  let query, params;
  
  if (studentId) {
    // For students: exclude feedback they've marked as deleted
    query = `
      SELECT f.*, s.name as student_name, s.student_id, e.title as event_title
      FROM feedback f
      JOIN students s ON f.student_id = s.id
      JOIN events e ON f.event_id = e.id
      WHERE f.student_id = ? 
      AND f.id NOT IN (
        SELECT df.feedback_id 
        FROM deleted_feedback df 
        WHERE df.student_id = ?
      )
      ORDER BY f.submitted_at DESC
    `;
    params = [studentId, studentId];
  } else {
    // For admin: show all feedback
    query = `
      SELECT f.*, s.name as student_name, s.student_id, e.title as event_title
      FROM feedback f
      JOIN students s ON f.student_id = s.id
      JOIN events e ON f.event_id = e.id
      ORDER BY f.submitted_at DESC
    `;
    params = [];
  }
  
  db.all(query, params, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/feedback', (req, res) => {
  const { student_id, event_id, rating, comment } = req.body;
  
  db.run(
    'INSERT INTO feedback (student_id, event_id, rating, comment) VALUES (?, ?, ?, ?)',
    [student_id, event_id, rating, comment],
    function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ id: this.lastID, message: 'Feedback submitted successfully' });
    }
  );
});

app.get('/api/feedback/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  
  const query = `
    SELECT f.*, s.name as student_name, s.student_id
    FROM feedback f
    JOIN students s ON f.student_id = s.id
    WHERE f.event_id = ?
    ORDER BY f.submitted_at DESC
  `;
  
  db.all(query, [eventId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Delete a single feedback item (soft deletion for students)
app.delete('/api/feedback/:id', (req, res) => {
  const feedbackId = req.params.id;
  const studentId = req.query.student_id;
  
  if (studentId) {
    // Soft deletion for students - mark as deleted in deleted_feedback table
    db.run(
      'INSERT OR IGNORE INTO deleted_feedback (student_id, feedback_id) VALUES (?, ?)',
      [studentId, feedbackId],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        res.json({ message: 'Feedback deleted successfully' });
      }
    );
  } else {
    // Hard deletion for admin
    db.run('DELETE FROM feedback WHERE id = ?', [feedbackId], function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      if (this.changes === 0) {
        res.status(404).json({ error: 'Feedback not found' });
        return;
      }
      res.json({ message: 'Feedback deleted successfully' });
    });
  }
});

// Delete multiple feedback items (soft deletion for students)
app.delete('/api/feedback', (req, res) => {
  const { feedbackIds, student_id } = req.body;
  
  if (!feedbackIds || !Array.isArray(feedbackIds) || feedbackIds.length === 0) {
    res.status(400).json({ error: 'No feedback IDs provided' });
    return;
  }
  
  if (student_id) {
    // Soft deletion for students
    const insertPromises = feedbackIds.map(feedbackId => {
      return new Promise((resolve, reject) => {
        db.run(
          'INSERT OR IGNORE INTO deleted_feedback (student_id, feedback_id) VALUES (?, ?)',
          [student_id, feedbackId],
          function(err) {
            if (err) reject(err);
            else resolve(this.changes);
          }
        );
      });
    });
    
    Promise.all(insertPromises)
      .then(() => {
        res.json({ 
          message: `Deleted ${feedbackIds.length} feedback items successfully`,
          deletedCount: feedbackIds.length
        });
      })
      .catch(err => {
        res.status(500).json({ error: err.message });
      });
  } else {
    // Hard deletion for admin
    const placeholders = feedbackIds.map(() => '?').join(',');
    const query = `DELETE FROM feedback WHERE id IN (${placeholders})`;
    
    db.run(query, feedbackIds, function(err) {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      res.json({ 
        message: `Deleted ${this.changes} feedback items successfully`,
        deletedCount: this.changes
      });
    });
  }
});

// Attendance Management API
app.get('/api/attendance/event/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  
  const query = `
    SELECT s.id, s.name, s.student_id, s.email,
           CASE 
             WHEN a.id IS NOT NULL THEN 'attended'
             WHEN att.id IS NOT NULL THEN 'absent'
             ELSE 'not_marked'
           END as attendance_status,
           a.checked_in_at,
           att.marked_at
    FROM students s
    INNER JOIN registrations r ON s.id = r.student_id AND r.event_id = ?
    LEFT JOIN attendance a ON s.id = a.student_id AND a.event_id = ?
    LEFT JOIN attendance_marks att ON s.id = att.student_id AND att.event_id = ?
    ORDER BY s.name
  `;
  
  db.all(query, [eventId, eventId, eventId], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.post('/api/attendance/mark', (req, res) => {
  const { student_id, event_id, status } = req.body;
  
  if (!student_id || !event_id || !status) {
    res.status(400).json({ error: 'Missing required fields' });
    return;
  }
  
  if (status === 'attended') {
    // Mark as attended
    db.run(
      'INSERT OR REPLACE INTO attendance (student_id, event_id, checked_in_at) VALUES (?, ?, CURRENT_TIMESTAMP)',
      [student_id, event_id],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Remove from absent marks if exists
        db.run(
          'DELETE FROM attendance_marks WHERE student_id = ? AND event_id = ?',
          [student_id, event_id],
          function(deleteErr) {
            if (deleteErr) {
              console.error('Error removing absent mark:', deleteErr);
            }
            
            // Broadcast attendance update
            loadAndBroadcastAttendanceData(event_id);
            
            res.json({ message: 'Student marked as attended' });
          }
        );
      }
    );
  } else if (status === 'absent') {
    // Mark as absent
    db.run(
      'INSERT OR REPLACE INTO attendance_marks (student_id, event_id, status, marked_at) VALUES (?, ?, ?, CURRENT_TIMESTAMP)',
      [student_id, event_id, 'absent'],
      function(err) {
        if (err) {
          res.status(500).json({ error: err.message });
          return;
        }
        
        // Remove from attendance if exists
        db.run(
          'DELETE FROM attendance WHERE student_id = ? AND event_id = ?',
          [student_id, event_id],
          function(deleteErr) {
            if (deleteErr) {
              console.error('Error removing attendance record:', deleteErr);
            }
            
            // Broadcast attendance update
            loadAndBroadcastAttendanceData(event_id);
            
            res.json({ message: 'Student marked as absent' });
          }
        );
      }
    );
  } else {
    res.status(400).json({ error: 'Invalid status. Use "attended" or "absent"' });
  }
});

// Helper function to load and broadcast attendance data
function loadAndBroadcastAttendanceData(eventId) {
  const query = `
    SELECT s.id, s.name, s.student_id, s.email,
           CASE 
             WHEN a.id IS NOT NULL THEN 'attended'
             WHEN att.id IS NOT NULL THEN 'absent'
             ELSE 'not_marked'
           END as attendance_status,
           a.checked_in_at,
           att.marked_at
    FROM students s
    INNER JOIN registrations r ON s.id = r.student_id AND r.event_id = ?
    LEFT JOIN attendance a ON s.id = a.student_id AND a.event_id = ?
    LEFT JOIN attendance_marks att ON s.id = att.student_id AND att.event_id = ?
    ORDER BY s.name
  `;
  
  db.all(query, [eventId, eventId, eventId], (err, rows) => {
    if (err) {
      console.error('Error loading attendance data for broadcast:', err);
      return;
    }
    
    // Broadcast to all clients watching this event
    broadcastAttendanceUpdate(eventId, rows);
  });
}

// Reports API
app.get('/api/reports/event-stats/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  
  const queries = {
    registrations: 'SELECT COUNT(*) as count FROM registrations WHERE event_id = ?',
    attendance: 'SELECT COUNT(*) as count FROM attendance WHERE event_id = ?',
    feedback: 'SELECT AVG(rating) as avg_rating, COUNT(*) as count FROM feedback WHERE event_id = ?'
  };
  
  const results = {};
  let completed = 0;
  
  Object.keys(queries).forEach(key => {
    db.get(queries[key], [eventId], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      results[key] = row;
      completed++;
      
      if (completed === Object.keys(queries).length) {
        res.json(results);
      }
    });
  });
});

app.get('/api/reports/top-students', (req, res) => {
  const query = `
    SELECT s.name, s.student_id, COUNT(r.id) as registration_count
    FROM students s
    INNER JOIN registrations r ON s.id = r.student_id
    GROUP BY s.id, s.name, s.student_id
    HAVING registration_count > 0
    ORDER BY registration_count DESC
    LIMIT 3
  `;
  
  db.all(query, (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Get list of institutes
app.get('/api/institutes', (req, res) => {
  const institutes = [
    'Indian Institute of Technology (IIT)',
    'National Institute of Technology (NIT)',
    'Indian Institute of Science (IISc)',
    'Delhi Technological University (DTU)',
    'Netaji Subhas University of Technology (NSUT)',
    'Jamia Millia Islamia',
    'University of Delhi',
    'Jawaharlal Nehru University (JNU)',
    'Amity University',
    'Manipal Institute of Technology',
    'Vellore Institute of Technology (VIT)',
    'Birla Institute of Technology and Science (BITS)',
    'Anna University',
    'SRM Institute of Science and Technology',
    'Lovely Professional University (LPU)',
    'Symbiosis International University',
    'Pune Institute of Computer Technology (PICT)',
    'College of Engineering, Pune (COEP)',
    'Visvesvaraya National Institute of Technology (VNIT)',
    'Indian Institute of Information Technology (IIIT)',
    'REVA University'
  ];
  
  res.json(institutes);
});

// Root route
app.get('/', (req, res) => {
  res.json({ 
    message: 'Campus Event Management System API',
    endpoints: {
      admin: '/admin',
      mobile: '/mobile',
      api: '/api'
    }
  });
});


// WebSocket connection handling
io.on('connection', (socket) => {
  console.log('Client connected:', socket.id);
  
  // Join admin room for admin portal updates
  socket.on('join-admin', () => {
    socket.join('admin');
    console.log('Client joined admin room:', socket.id);
  });
  
  // Join student room for mobile app updates
  socket.on('join-student', (studentId) => {
    socket.join(`student-${studentId}`);
    console.log(`Client joined student room for student ${studentId}:`, socket.id);
  });
  
  // Join specific event room for attendance updates
  socket.on('join-event', (eventId) => {
    socket.join(`event-${eventId}`);
    console.log(`Client joined event room for event ${eventId}:`, socket.id);
    console.log(`Client ${socket.id} is now in rooms:`, Array.from(socket.rooms));
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Helper function to broadcast attendance updates
function broadcastAttendanceUpdate(eventId, attendanceData) {
  console.log(`=== BROADCASTING ATTENDANCE UPDATE ===`);
  console.log(`Event ID: ${eventId}`);
  console.log(`Attendance Data:`, attendanceData);
  
  const updateData = {
    eventId: eventId,
    attendanceData: attendanceData,
    timestamp: new Date().toISOString()
  };
  
  // Broadcast to event-specific room
  const eventRoom = io.sockets.adapter.rooms.get(`event-${eventId}`);
  console.log(`Clients in event-${eventId} room:`, eventRoom ? Array.from(eventRoom) : 'No clients');
  
  io.to(`event-${eventId}`).emit('attendance-updated', updateData);
  console.log(`Broadcasted to event-${eventId} room`);
  
  // Also broadcast to admin room
  io.to('admin').emit('attendance-updated', updateData);
  console.log(`Broadcasted to admin room`);
  
  console.log(`=== END BROADCAST ===`);
}

// Helper function to broadcast general updates
function broadcastUpdate(type, data) {
  io.emit('data-updated', {
    type: type,
    data: data,
    timestamp: new Date().toISOString()
  });
}

// Analytics API endpoints
app.get('/api/analytics/overview', (req, res) => {
  const queries = {
    totalEvents: 'SELECT COUNT(*) as count FROM events',
    totalStudents: 'SELECT COUNT(*) as count FROM students',
    totalRegistrations: 'SELECT COUNT(*) as count FROM registrations',
    attendanceRate: `
      SELECT 
        COUNT(DISTINCT CASE 
          WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.student_id 
        END) as attended_students,
        COUNT(DISTINCT r.student_id) as total_registered_students
      FROM registrations r
      LEFT JOIN attendance a ON r.student_id = a.student_id AND r.event_id = a.event_id
      LEFT JOIN attendance_marks am ON r.student_id = am.student_id AND r.event_id = am.event_id AND am.status = 'attended'
    `
  };

  const results = {};
  let completed = 0;
  const totalQueries = Object.keys(queries).length;

  Object.keys(queries).forEach(key => {
    db.get(queries[key], [], (err, row) => {
      if (err) {
        res.status(500).json({ error: err.message });
        return;
      }
      
      if (key === 'attendanceRate') {
        const attendanceRate = row.total_registered_students > 0 
          ? Math.round((row.attended_students * 100) / row.total_registered_students)
          : 0;
        results[key] = attendanceRate;
      } else {
        results[key] = row.count;
      }
      
      completed++;
      if (completed === totalQueries) {
        res.json(results);
      }
    });
  });
});

app.get('/api/analytics/top-active-students', (req, res) => {
  const query = `
    SELECT 
      s.id,
      s.name,
      s.student_id,
      COUNT(DISTINCT r.event_id) as total_registrations,
      COUNT(DISTINCT CASE 
        WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.event_id 
      END) as events_attended,
      CASE 
        WHEN COUNT(DISTINCT r.event_id) > 0 

        THEN ROUND((COUNT(DISTINCT CASE 
          WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.event_id 
        END) * 100.0 / COUNT(DISTINCT r.event_id)), 1)
        ELSE 0 
      END as attendance_rate
    FROM students s
    LEFT JOIN registrations r ON s.id = r.student_id
    LEFT JOIN attendance a ON s.id = a.student_id AND r.event_id = a.event_id
    LEFT JOIN attendance_marks am ON s.id = am.student_id AND r.event_id = am.event_id AND am.status = 'attended'
    GROUP BY s.id, s.name, s.student_id
    HAVING total_registrations > 0
    ORDER BY total_registrations DESC, attendance_rate DESC
    LIMIT 10
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/analytics/event-type-analysis', (req, res) => {
  const query = `
    SELECT 
      CASE 
        WHEN LOWER(title) LIKE '%workshop%' THEN 'Workshop'
        WHEN LOWER(title) LIKE '%seminar%' THEN 'Seminar'
        WHEN LOWER(title) LIKE '%conference%' THEN 'Conference'
        WHEN LOWER(title) LIKE '%meeting%' THEN 'Meeting'
        WHEN LOWER(title) LIKE '%training%' THEN 'Training'
        WHEN LOWER(title) LIKE '%competition%' OR LOWER(title) LIKE '%contest%' THEN 'Competition'
        WHEN LOWER(title) LIKE '%social%' OR LOWER(title) LIKE '%party%' THEN 'Social'
        WHEN LOWER(title) LIKE '%sports%' OR LOWER(title) LIKE '%game%' THEN 'Sports'
        WHEN LOWER(title) LIKE '%session%' THEN 'Session'
        WHEN LOWER(title) LIKE '%design%' THEN 'Design'
        WHEN LOWER(title) LIKE '%dsa%' THEN 'Technical'
        ELSE 'Other'
      END as event_type,
      COUNT(*) as count,
      ROUND((COUNT(*) * 100.0 / (SELECT COUNT(*) FROM events)), 1) as percentage
    FROM events
    GROUP BY event_type
    ORDER BY count DESC
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/analytics/event-popularity', (req, res) => {
  const query = `
    SELECT 
      e.id,
      e.title,
      e.date,
      e.location,
      COUNT(DISTINCT r.student_id) as registration_count,
      COUNT(DISTINCT CASE 
        WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.student_id 
      END) as attendance_count,
      CASE 
        WHEN COUNT(DISTINCT r.student_id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE 
          WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.student_id 
        END) * 100.0 / COUNT(DISTINCT r.student_id)), 1)
        ELSE 0 
      END as attendance_rate
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    LEFT JOIN attendance a ON e.id = a.event_id AND r.student_id = a.student_id
    LEFT JOIN attendance_marks am ON e.id = am.event_id AND r.student_id = am.student_id AND am.status = 'attended'
    GROUP BY e.id, e.title, e.date, e.location
    ORDER BY registration_count DESC, attendance_count DESC
    LIMIT 10
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

app.get('/api/analytics/top-participation', (req, res) => {
  const query = `
    SELECT 
      s.id,
      s.name,
      s.student_id,
      COUNT(DISTINCT CASE 
        WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.event_id 
      END) as events_attended,
      COUNT(DISTINCT r.event_id) as total_registrations,
      CASE 
        WHEN COUNT(DISTINCT r.event_id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE 
          WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.event_id 
        END) * 100.0 / COUNT(DISTINCT r.event_id)), 1)
        ELSE 0 
      END as participation_score
    FROM students s
    LEFT JOIN registrations r ON s.id = r.student_id
    LEFT JOIN attendance a ON s.id = a.student_id AND r.event_id = a.event_id
    LEFT JOIN attendance_marks am ON s.id = am.student_id AND r.event_id = am.event_id AND am.status = 'attended'
    GROUP BY s.id, s.name, s.student_id
    HAVING events_attended > 0
    ORDER BY events_attended DESC, participation_score DESC
    LIMIT 10
  `;
  
  db.all(query, [], (err, rows) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    res.json(rows);
  });
});

// Debug endpoint to inspect database data
app.get('/api/debug/database', (req, res) => {
  const queries = {
    events: "SELECT * FROM events",
    students: "SELECT * FROM students", 
    registrations: "SELECT * FROM registrations",
    attendance: "SELECT * FROM attendance",
    attendance_marks: "SELECT * FROM attendance_marks"
  };
  
  const results = {};
  let completed = 0;
  const total = Object.keys(queries).length;
  
  Object.keys(queries).forEach(table => {
    db.all(queries[table], [], (err, rows) => {
      if (err) {
        results[table] = { error: err.message };
      } else {
        results[table] = rows;
      }
      completed++;
      
      if (completed === total) {
        res.json(results);
      }
    });
  });
});

// Individual event statistics endpoint
app.get('/api/analytics/event-stats/:eventId', (req, res) => {
  const eventId = req.params.eventId;
  
  const query = `
    SELECT 
      e.id,
      e.title,
      e.description,
      e.date,
      e.time,
      e.location,
      e.max_capacity,
      COUNT(DISTINCT r.student_id) as total_registrations,
      COUNT(DISTINCT CASE 
        WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.student_id 
      END) as total_attendance,
      COUNT(DISTINCT a.student_id) as total_check_ins,
      CASE 
        WHEN COUNT(DISTINCT r.student_id) > 0 
        THEN ROUND((COUNT(DISTINCT CASE 
          WHEN a.id IS NOT NULL OR am.id IS NOT NULL THEN r.student_id 
        END) * 100.0 / COUNT(DISTINCT r.student_id)), 1)
        ELSE 0 
      END as attendance_rate,
      CASE 
        WHEN COUNT(DISTINCT r.student_id) > 0 
        THEN ROUND((COUNT(DISTINCT a.student_id) * 100.0 / COUNT(DISTINCT r.student_id)), 1)
        ELSE 0 
      END as check_in_rate
    FROM events e
    LEFT JOIN registrations r ON e.id = r.event_id
    LEFT JOIN attendance a ON e.id = a.event_id AND r.student_id = a.student_id
    LEFT JOIN attendance_marks am ON e.id = am.event_id AND r.student_id = am.student_id AND am.status = 'attended'
    WHERE e.id = ?
    GROUP BY e.id, e.title, e.description, e.date, e.time, e.location, e.max_capacity
  `;
  
  db.get(query, [eventId], (err, row) => {
    if (err) {
      res.status(500).json({ error: err.message });
      return;
    }
    
    if (!row) {
      res.status(404).json({ error: 'Event not found' });
      return;
    }
    
    res.json(row);
  });
});

// Start server
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
  console.log(`Admin Portal: http://localhost:${PORT}/admin`);
  console.log(`Mobile App: http://localhost:${PORT}/mobile`);
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});

// Graceful shutdown
process.on('SIGINT', () => {
  console.log('\nShutting down server...');
  db.close((err) => {
    if (err) {
      console.error(err.message);
    }
    console.log('Database connection closed.');
    process.exit(0);
  });
});
