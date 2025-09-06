const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const db = new sqlite3.Database('./database.sqlite');

console.log('Initializing Campus Event Management Database...');

db.serialize(() => {
  // Create tables
  console.log('Creating tables...');
  
  // Events table
  db.run(`CREATE TABLE IF NOT EXISTS events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    title TEXT NOT NULL,
    description TEXT,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    location TEXT NOT NULL,
    max_capacity INTEGER DEFAULT 100,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  // Students table
  db.run(`CREATE TABLE IF NOT EXISTS students (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_id TEXT UNIQUE NOT NULL,
    name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
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

  console.log('Tables created successfully!');

  // Note: Sample data insertion is commented out for clean start
  // Uncomment the section below if you want sample data
  /*
  console.log('Inserting sample data...');

  // Sample events
  const sampleEvents = [
    {
      title: 'Welcome Back Party',
      description: 'Join us for a fun welcome back party with food, music, and games!',
      date: '2024-02-15',
      time: '18:00',
      location: 'Student Center',
      max_capacity: 200
    },
    {
      title: 'Tech Talk: AI in Education',
      description: 'Learn about the latest trends in artificial intelligence and its impact on education.',
      date: '2024-02-20',
      time: '14:00',
      location: 'Computer Science Building Room 101',
      max_capacity: 50
    },
    {
      title: 'Career Fair 2024',
      description: 'Meet with top companies and explore career opportunities.',
      date: '2024-02-25',
      time: '10:00',
      location: 'Gymnasium',
      max_capacity: 500
    },
    {
      title: 'Basketball Tournament',
      description: 'Annual inter-department basketball tournament. Teams of 5 players.',
      date: '2024-03-01',
      time: '16:00',
      location: 'Sports Complex',
      max_capacity: 100
    },
    {
      title: 'Study Group: Data Structures',
      description: 'Collaborative study session for Data Structures and Algorithms course.',
      date: '2024-03-05',
      time: '19:00',
      location: 'Library Study Room 3',
      max_capacity: 20
    }
  ];

  sampleEvents.forEach(event => {
    db.run(
      'INSERT INTO events (title, description, date, time, location, max_capacity) VALUES (?, ?, ?, ?, ?, ?)',
      [event.title, event.description, event.date, event.time, event.location, event.max_capacity]
    );
  });

  // Sample students
  const sampleStudents = [
    {
      student_id: 'STU001',
      name: 'John Smith',
      email: 'john.smith@university.edu',
      phone: '555-0101'
    },
    {
      student_id: 'STU002',
      name: 'Sarah Johnson',
      email: 'sarah.johnson@university.edu',
      phone: '555-0102'
    },
    {
      student_id: 'STU003',
      name: 'Mike Chen',
      email: 'mike.chen@university.edu',
      phone: '555-0103'
    },
    {
      student_id: 'STU004',
      name: 'Emily Davis',
      email: 'emily.davis@university.edu',
      phone: '555-0104'
    },
    {
      student_id: 'STU005',
      name: 'Alex Rodriguez',
      email: 'alex.rodriguez@university.edu',
      phone: '555-0105'
    }
  ];

  sampleStudents.forEach(student => {
    db.run(
      'INSERT INTO students (student_id, name, email, phone) VALUES (?, ?, ?, ?)',
      [student.student_id, student.name, student.email, student.phone]
    );
  });

  console.log('Sample data inserted successfully!');
  */
  console.log('Database initialization complete!');
  console.log('\nYou can now start the server with: npm start');
  console.log('Admin Portal: http://localhost:3000/admin');
  console.log('Mobile App: http://localhost:3000/mobile');
  console.log('\nNote: Database starts empty. Add data through the admin portal or mobile app.');
});

// Close database connection
db.close((err) => {
  if (err) {
    console.error('Error closing database:', err.message);
  } else {
    console.log('Database connection closed.');
  }
});
