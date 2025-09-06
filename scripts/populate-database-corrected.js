const sqlite3 = require('sqlite3').verbose();
const path = require('path');

// Create database connection
const db = new sqlite3.Database('./database.sqlite');

console.log('Clearing existing data and populating database with new events...');

db.serialize(() => {
  // Clear all existing data
  console.log('Clearing existing data...');
  db.run('DELETE FROM feedback');
  db.run('DELETE FROM attendance');
  db.run('DELETE FROM registrations');
  db.run('DELETE FROM students');
  db.run('DELETE FROM events');
  console.log('Existing data cleared!');

  // Insert new events (15 events)
  console.log('Inserting new events...');
  
  const newEvents = [
    {
      title: 'Spring Welcome Festival 2024',
      description: 'Join us for an exciting spring festival with live music, food trucks, games, and activities for all students!',
      date: '2024-03-15',
      time: '12:00',
      location: 'Main Quad',
      max_capacity: 300
    },
    {
      title: 'AI & Machine Learning Workshop',
      description: 'Hands-on workshop covering the fundamentals of AI and ML with practical coding exercises and real-world applications.',
      date: '2024-03-18',
      time: '14:00',
      location: 'Computer Science Lab 205',
      max_capacity: 30
    },
    {
      title: 'Entrepreneurship Summit',
      description: 'Meet successful entrepreneurs, learn about startup funding, and network with industry professionals.',
      date: '2024-03-22',
      time: '09:00',
      location: 'Business School Auditorium',
      max_capacity: 150
    },
    {
      title: 'Cultural Diversity Night',
      description: 'Celebrate our diverse campus community with performances, food from around the world, and cultural displays.',
      date: '2024-03-25',
      time: '18:30',
      location: 'Student Center Ballroom',
      max_capacity: 200
    },
    {
      title: 'Environmental Sustainability Conference',
      description: 'Learn about climate change solutions, sustainable practices, and how to make a positive environmental impact.',
      date: '2024-03-28',
      time: '10:00',
      location: 'Environmental Science Building',
      max_capacity: 80
    },
    {
      title: 'Hackathon 2024: Tech for Good',
      description: '48-hour coding competition focused on creating technology solutions for social good. Prizes for top teams!',
      date: '2024-04-01',
      time: '18:00',
      location: 'Engineering Building',
      max_capacity: 100
    },
    {
      title: 'Mental Health Awareness Workshop',
      description: 'Interactive workshop on stress management, mental health resources, and building resilience during college.',
      date: '2024-04-05',
      time: '16:00',
      location: 'Counseling Center',
      max_capacity: 40
    },
    {
      title: 'Art Exhibition Opening',
      description: 'View amazing artwork created by students and faculty. Light refreshments will be served.',
      date: '2024-04-08',
      time: '19:00',
      location: 'Art Gallery',
      max_capacity: 60
    },
    {
      title: 'Research Symposium',
      description: 'Present your research projects and learn about cutting-edge research happening across campus.',
      date: '2024-04-12',
      time: '13:00',
      location: 'Research Center',
      max_capacity: 120
    },
    {
      title: 'Sports Day & Tournament',
      description: 'Annual sports day featuring basketball, volleyball, soccer, and track events. Open to all skill levels!',
      date: '2024-04-15',
      time: '08:00',
      location: 'Sports Complex',
      max_capacity: 250
    },
    {
      title: 'Career Networking Mixer',
      description: 'Connect with alumni and industry professionals in an informal setting. Bring your resume!',
      date: '2024-04-18',
      time: '17:30',
      location: 'Alumni Hall',
      max_capacity: 100
    },
    {
      title: 'Study Abroad Fair',
      description: 'Explore study abroad opportunities, meet with program coordinators, and learn about scholarships.',
      date: '2024-04-22',
      time: '11:00',
      location: 'International Center',
      max_capacity: 80
    },
    {
      title: 'Graduate School Information Session',
      description: 'Learn about graduate programs, application processes, and funding opportunities from various departments.',
      date: '2024-04-25',
      time: '15:00',
      location: 'Graduate Studies Office',
      max_capacity: 50
    },
    {
      title: 'Community Service Day',
      description: 'Join fellow students in giving back to the community through various volunteer activities.',
      date: '2024-04-28',
      time: '09:00',
      location: 'Various Locations',
      max_capacity: 150
    },
    {
      title: 'End of Semester Celebration',
      description: 'Celebrate the end of another successful semester with food, music, and fun activities!',
      date: '2024-05-02',
      time: '16:00',
      location: 'Main Campus Lawn',
      max_capacity: 400
    }
  ];

  // Insert events and collect their IDs
  const eventIds = [];
  let eventsInserted = 0;
  
  newEvents.forEach((event, index) => {
    db.run(
      'INSERT INTO events (title, description, date, time, location, max_capacity) VALUES (?, ?, ?, ?, ?, ?)',
      [event.title, event.description, event.date, event.time, event.location, event.max_capacity],
      function(err) {
        if (err) {
          console.error('Error inserting event:', err);
        } else {
          eventIds[index] = this.lastID;
          eventsInserted++;
          console.log(`Inserted event ${eventsInserted}: ${event.title} (ID: ${this.lastID})`);
          
          // When all events are inserted, proceed with students
          if (eventsInserted === newEvents.length) {
            insertStudents();
          }
        }
      }
    );
  });

  function insertStudents() {
    console.log('Inserting sample students...');
    
    const sampleStudents = [
      {
        student_id: 'STU2024001',
        name: 'Emma Thompson',
        email: 'emma.thompson@university.edu',
        phone: '555-1001'
      },
      {
        student_id: 'STU2024002',
        name: 'James Wilson',
        email: 'james.wilson@university.edu',
        phone: '555-1002'
      },
      {
        student_id: 'STU2024003',
        name: 'Sofia Martinez',
        email: 'sofia.martinez@university.edu',
        phone: '555-1003'
      },
      {
        student_id: 'STU2024004',
        name: 'David Kim',
        email: 'david.kim@university.edu',
        phone: '555-1004'
      },
      {
        student_id: 'STU2024005',
        name: 'Olivia Brown',
        email: 'olivia.brown@university.edu',
        phone: '555-1005'
      },
      {
        student_id: 'STU2024006',
        name: 'Michael Garcia',
        email: 'michael.garcia@university.edu',
        phone: '555-1006'
      },
      {
        student_id: 'STU2024007',
        name: 'Isabella Davis',
        email: 'isabella.davis@university.edu',
        phone: '555-1007'
      },
      {
        student_id: 'STU2024008',
        name: 'Alexander Johnson',
        email: 'alexander.johnson@university.edu',
        phone: '555-1008'
      },
      {
        student_id: 'STU2024009',
        name: 'Mia Anderson',
        email: 'mia.anderson@university.edu',
        phone: '555-1009'
      },
      {
        student_id: 'STU2024010',
        name: 'William Taylor',
        email: 'william.taylor@university.edu',
        phone: '555-1010'
      }
    ];

    // Insert students and collect their IDs
    const studentIds = [];
    let studentsInserted = 0;
    
    sampleStudents.forEach((student, index) => {
      db.run(
        'INSERT INTO students (student_id, name, email, phone) VALUES (?, ?, ?, ?)',
        [student.student_id, student.name, student.email, student.phone],
        function(err) {
          if (err) {
            console.error('Error inserting student:', err);
          } else {
            studentIds[index] = this.lastID;
            studentsInserted++;
            console.log(`Inserted student ${studentsInserted}: ${student.name} (ID: ${this.lastID})`);
            
            // When all students are inserted, proceed with registrations
            if (studentsInserted === sampleStudents.length) {
              insertRegistrations(studentIds, eventIds);
            }
          }
        }
      );
    });
  }

  function insertRegistrations(studentIds, eventIds) {
    console.log('Inserting sample registrations...');
    
    const sampleRegistrations = [
      { studentIndex: 0, eventIndex: 0 }, // Emma -> Spring Welcome Festival
      { studentIndex: 0, eventIndex: 2 }, // Emma -> Entrepreneurship Summit
      { studentIndex: 1, eventIndex: 1 }, // James -> AI Workshop
      { studentIndex: 1, eventIndex: 5 }, // James -> Hackathon
      { studentIndex: 2, eventIndex: 3 }, // Sofia -> Cultural Diversity Night
      { studentIndex: 2, eventIndex: 6 }, // Sofia -> Mental Health Workshop
      { studentIndex: 3, eventIndex: 4 }, // David -> Environmental Conference
      { studentIndex: 3, eventIndex: 8 }, // David -> Research Symposium
      { studentIndex: 4, eventIndex: 7 }, // Olivia -> Art Exhibition
      { studentIndex: 4, eventIndex: 10 }, // Olivia -> Study Abroad Fair
      { studentIndex: 5, eventIndex: 9 }, // Michael -> Sports Day
      { studentIndex: 5, eventIndex: 11 }, // Michael -> Career Networking
      { studentIndex: 6, eventIndex: 0 }, // Isabella -> Spring Welcome Festival
      { studentIndex: 6, eventIndex: 3 }, // Isabella -> Cultural Diversity Night
      { studentIndex: 7, eventIndex: 1 }, // Alexander -> AI Workshop
      { studentIndex: 7, eventIndex: 5 }, // Alexander -> Hackathon
      { studentIndex: 8, eventIndex: 7 }, // Mia -> Art Exhibition
      { studentIndex: 8, eventIndex: 12 }, // Mia -> Graduate School Session
      { studentIndex: 9, eventIndex: 9 }, // William -> Sports Day
      { studentIndex: 9, eventIndex: 13 } // William -> Community Service Day
    ];

    // Insert registrations
    let registrationsInserted = 0;
    
    sampleRegistrations.forEach((reg, index) => {
      const studentId = studentIds[reg.studentIndex];
      const eventId = eventIds[reg.eventIndex];
      
      db.run(
        'INSERT INTO registrations (student_id, event_id) VALUES (?, ?)',
        [studentId, eventId],
        function(err) {
          if (err) {
            console.error('Error inserting registration:', err);
          } else {
            registrationsInserted++;
            console.log(`Inserted registration ${registrationsInserted}: student ${studentId} -> event ${eventId}`);
            
            // When all registrations are inserted, proceed with attendance
            if (registrationsInserted === sampleRegistrations.length) {
              insertAttendance(studentIds, eventIds);
            }
          }
        }
      );
    });
  }

  function insertAttendance(studentIds, eventIds) {
    console.log('Inserting sample attendance...');
    
    const sampleAttendance = [
      { studentIndex: 0, eventIndex: 0 }, // Emma attended Spring Welcome Festival
      { studentIndex: 1, eventIndex: 1 }, // James attended AI Workshop
      { studentIndex: 2, eventIndex: 3 }, // Sofia attended Cultural Diversity Night
      { studentIndex: 3, eventIndex: 4 }, // David attended Environmental Conference
      { studentIndex: 4, eventIndex: 7 }, // Olivia attended Art Exhibition
      { studentIndex: 5, eventIndex: 9 }, // Michael attended Sports Day
      { studentIndex: 6, eventIndex: 0 }, // Isabella attended Spring Welcome Festival
      { studentIndex: 7, eventIndex: 1 }, // Alexander attended AI Workshop
      { studentIndex: 8, eventIndex: 7 }, // Mia attended Art Exhibition
      { studentIndex: 9, eventIndex: 9 } // William attended Sports Day
    ];

    // Insert attendance
    let attendanceInserted = 0;
    
    sampleAttendance.forEach((att, index) => {
      const studentId = studentIds[att.studentIndex];
      const eventId = eventIds[att.eventIndex];
      
      db.run(
        'INSERT INTO attendance (student_id, event_id) VALUES (?, ?)',
        [studentId, eventId],
        function(err) {
          if (err) {
            console.error('Error inserting attendance:', err);
          } else {
            attendanceInserted++;
            console.log(`Inserted attendance ${attendanceInserted}: student ${studentId} -> event ${eventId}`);
            
            // When all attendance is inserted, proceed with feedback
            if (attendanceInserted === sampleAttendance.length) {
              insertFeedback(studentIds, eventIds);
            }
          }
        }
      );
    });
  }

  function insertFeedback(studentIds, eventIds) {
    console.log('Inserting sample feedback...');
    
    const sampleFeedback = [
      { studentIndex: 0, eventIndex: 0, rating: 5, comment: 'Amazing event! Great food and music.' },
      { studentIndex: 1, eventIndex: 1, rating: 4, comment: 'Very informative workshop, learned a lot about AI.' },
      { studentIndex: 2, eventIndex: 3, rating: 5, comment: 'Loved the cultural performances and food!' },
      { studentIndex: 3, eventIndex: 4, rating: 4, comment: 'Eye-opening conference about sustainability.' },
      { studentIndex: 4, eventIndex: 7, rating: 5, comment: 'Beautiful artwork on display!' },
      { studentIndex: 5, eventIndex: 9, rating: 4, comment: 'Fun sports day, great competition.' },
      { studentIndex: 6, eventIndex: 0, rating: 5, comment: 'Perfect way to start the semester!' },
      { studentIndex: 7, eventIndex: 1, rating: 5, comment: 'Excellent hands-on learning experience.' },
      { studentIndex: 8, eventIndex: 7, rating: 4, comment: 'Great exhibition, very inspiring.' },
      { studentIndex: 9, eventIndex: 9, rating: 5, comment: 'Best sports day ever!' }
    ];

    // Insert feedback
    let feedbackInserted = 0;
    
    sampleFeedback.forEach((feedback, index) => {
      const studentId = studentIds[feedback.studentIndex];
      const eventId = eventIds[feedback.eventIndex];
      
      db.run(
        'INSERT INTO feedback (student_id, event_id, rating, comment) VALUES (?, ?, ?, ?)',
        [studentId, eventId, feedback.rating, feedback.comment],
        function(err) {
          if (err) {
            console.error('Error inserting feedback:', err);
          } else {
            feedbackInserted++;
            console.log(`Inserted feedback ${feedbackInserted}: student ${studentId} -> event ${eventId}`);
            
            // When all feedback is inserted, we're done
            if (feedbackInserted === sampleFeedback.length) {
              console.log('\nDatabase populated successfully!');
              console.log(`Added ${newEvents.length} events`);
              console.log(`Added 10 students`);
              console.log(`Added 20 registrations`);
              console.log(`Added 10 attendance records`);
              console.log(`Added 10 feedback records`);
              
              // Close database connection
              db.close((err) => {
                if (err) {
                  console.error('Error closing database:', err.message);
                } else {
                  console.log('Database connection closed.');
                  console.log('\nYou can now start the server with: npm start');
                  console.log('Admin Portal: http://localhost:3000/admin');
                  console.log('Mobile App: http://localhost:3000/mobile');
                }
              });
            }
          }
        }
      );
    });
  }
});
