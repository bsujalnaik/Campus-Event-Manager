// Mobile App JavaScript
let currentStudent = null;
let events = [];
let myRegistrations = [];
let myFeedback = [];
let selectedFeedback = new Set();
let currentSection = 'events';
let attendanceData = [];
let socket = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    // Initialize WebSocket connection
    initializeWebSocket();
    

    // Load institutes for dropdowns
    loadInstitutes();
    
    // Check if student is already logged in
    const studentId = localStorage.getItem('studentId');
    if (studentId) {
        loadStudentInfo();
        loadEvents();
        setupRatingStars();
        setupDesktopNavigation();
        setupMobileNavigation();
        
        // Refresh student data from server on page load
        setTimeout(() => {
            refreshStudentData();
        }, 1000);
    } else {
        // Show authentication modal for new users
        showAuthModal();
        setupRatingStars();
        setupDesktopNavigation();
        setupMobileNavigation();
    }
});

// Load institutes for dropdowns
async function loadInstitutes() {
    try {
        const response = await fetch('http://localhost:3000/api/institutes');
        const institutes = await response.json();
        
        // Populate registration institute dropdown
        const registerInstituteSelect = document.getElementById('registerStudentInstitute');
        if (registerInstituteSelect) {
            registerInstituteSelect.innerHTML = '<option value="">Select Institute</option>' +
                institutes.map(institute => `<option value="${institute}">${institute}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading institutes:', error);
    }
}

// Initialize WebSocket connection
function initializeWebSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        
        // Set up periodic refresh as backup (every 10 seconds)
        setInterval(() => {
            if (currentStudent && currentSection === 'my-events') {
                console.log('Periodic refresh of attendance data...');
                loadAttendanceData();
            }
        }, 10000);
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });
    
    // Listen for attendance updates
    socket.on('attendance-updated', (data) => {
        console.log('=== ATTENDANCE UPDATE RECEIVED ===');
        console.log('Received attendance update:', data);
        console.log('Current student:', currentStudent);
        console.log('Current student ID:', currentStudent ? currentStudent.id : 'No student');
        
        // Update attendance data for the specific event
        if (currentStudent && currentStudent.id) {
            // Look for attendance by database ID (att.id) matching currentStudent.id
            const studentAttendance = data.attendanceData.find(att => att.id == currentStudent.id);
            console.log('Looking for student attendance in data:', studentAttendance);
            console.log('Current student ID:', currentStudent.id);
            console.log('Available attendance records:', data.attendanceData.map(att => ({ id: att.id, student_id: att.student_id, status: att.attendance_status })));
            
            if (studentAttendance) {
                console.log('Found student attendance update:', studentAttendance);
                
                // Update attendance data
                const existingIndex = attendanceData.findIndex(att => att.event_id == data.eventId);
                if (existingIndex >= 0) {
                    attendanceData[existingIndex] = {
                        event_id: data.eventId,
                        status: studentAttendance.attendance_status
                    };
                } else {
                    attendanceData.push({
                        event_id: data.eventId,
                        status: studentAttendance.attendance_status
                    });
                }
                
                console.log('Updated attendance data:', attendanceData);
                
                // Also refresh attendance data from server to ensure consistency
                loadAttendanceData().then(() => {
                    // Always refresh My Events display regardless of current section
                    loadMyEvents();
                });
                
                // Show notification to user about attendance update
                if (studentAttendance.attendance_status === 'attended') {
                    showSuccessNotification('Your attendance has been marked as present!', 3000);
                } else if (studentAttendance.attendance_status === 'absent') {
                    showWarningNotification('Your attendance has been marked as absent.', 3000);
                }
            } else {
                console.log('No attendance data found for current student in this update');
            }
        } else {
            console.log('No current student or student ID not available');
        }
        console.log('=== END ATTENDANCE UPDATE ===');
    });
    
    // Listen for general data updates
    socket.on('data-updated', (data) => {
        console.log('Received data update:', data);
        
        // Refresh relevant sections based on update type
        switch(data.type) {
            case 'events':
                loadEvents();
                break;
            case 'registrations':
                loadMyEvents();
                break;
            case 'feedback':
                loadMyFeedback();
                break;
        }
    });
}

// Desktop App Navigation
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('[id$="-section"]').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(section + '-section').style.display = 'block';
    
    // Update active nav item
    document.querySelectorAll('.nav-item').forEach(item => {
        item.classList.remove('active', 'text-white', 'bg-blue-600');
        item.classList.add('text-gray-700');
    });
    
    // Add active class to clicked desktop nav item
    const activeNavItem = document.querySelector(`.nav-item[onclick="showSection('${section}')"]`);
    if (activeNavItem) {
        activeNavItem.classList.add('active', 'text-white', 'bg-blue-600');
        activeNavItem.classList.remove('text-gray-700');
    }
    
    // Update mobile navigation active states
    document.querySelectorAll('.mobile-nav-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Add active class to clicked mobile item
    const activeMobileItem = document.querySelector(`.mobile-nav-item[onclick="showSection('${section}')"]`);
    if (activeMobileItem) {
        activeMobileItem.classList.add('active');
    }
    
    currentSection = section;
    
    // Load section-specific data
    switch(section) {
        case 'events':
            loadEvents();
            break;
        case 'my-events':
            // Refresh attendance data when switching to My Events
            if (currentStudent) {
                loadAttendanceData().then(() => {
                    loadMyEvents();
                });
            } else {
                loadMyEvents();
            }
            break;
        case 'feedback':
            loadMyFeedback();
            break;
    }
}

function setupDesktopNavigation() {
    // Add click handlers for desktop navigation
    document.querySelectorAll('.nav-item').forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('onclick').match(/'([^']+)'/)[1];
            showSection(section);
        });
    });
}

// Setup mobile navigation
function setupMobileNavigation() {
    // Add click handlers for mobile navigation items
    const mobileNavItems = document.querySelectorAll('.mobile-nav-item');
    mobileNavItems.forEach(item => {
        item.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('onclick').match(/showSection\('([^']+)'\)/)[1];
            showSection(section);
        });
    });
    console.log('Mobile navigation setup complete');
}

function refreshEvents() {
    console.log('Manual refresh triggered');
    refreshAllData();
}

// Force refresh student data from server
async function refreshStudentData() {
    console.log('Refreshing student data from server...');
    try {
        const response = await fetch('/api/students');
        const students = await response.json();
        console.log('All students from server:', students);
        
        const studentId = localStorage.getItem('studentId');
        if (studentId) {
            const student = students.find(s => s.student_id === studentId);
            if (student) {
                console.log('Found student in server data:', student);
                localStorage.setItem('studentDbId', student.id);
                currentStudent = {
                    id: student.id,
                    student_id: student.student_id,
                    name: student.name,
                    email: student.email,
                    phone: student.phone
                };
                console.log('Updated currentStudent:', currentStudent);
            } else {
                console.log('Student not found in server data');
            }
        }
    } catch (error) {
        console.error('Error refreshing student data:', error);
    }
}

// Test function to verify database connection
async function testDatabaseConnection() {
    console.log('=== TESTING DATABASE CONNECTION ===');
    try {
        // Test students endpoint
        const studentsResponse = await fetch('/api/students');
        const students = await studentsResponse.json();
        console.log('Students in database:', students);
        
        // Test events endpoint
        const eventsResponse = await fetch('/api/events');
        const events = await eventsResponse.json();
        console.log('Events in database:', events);
        
        // Test registrations endpoint
        const registrationsResponse = await fetch('/api/registrations');
        const registrations = await registrationsResponse.json();
        console.log('Registrations in database:', registrations);
        
        // Debug current app state
        console.log('=== CURRENT APP STATE ===');
        console.log('Current student:', currentStudent);
        console.log('My registrations:', myRegistrations);
        console.log('Events:', events);
        console.log('Current section:', currentSection);
        
        alert('Database test complete. Check console for results.');
    } catch (error) {
        console.error('Database test failed:', error);
        alert('Database test failed: ' + error.message);
    }
}

// Update event button status to show registered state
function updateEventButtonStatus(eventId, isRegistered) {
    // This function is now mainly used for the event details modal
    // The events list automatically filters out registered events
    console.log(`Event ${eventId} registration status updated: ${isRegistered}`);
}

// Show success notification
function showSuccessNotification(message, duration = 3000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
    notification.style.zIndex = '9999';
    notification.innerHTML = `
        <div class="alert alert-success alert-dismissible fade show" role="alert">
            <i class="fas fa-check-circle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after specified duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// Show warning notification
function showWarningNotification(message, duration = 5000) {
    // Create notification element
    const notification = document.createElement('div');
    notification.className = 'position-fixed top-0 start-50 translate-middle-x mt-3';
    notification.style.zIndex = '9999';
    notification.innerHTML = `
        <div class="alert alert-warning alert-dismissible fade show" role="alert">
            <i class="fas fa-exclamation-triangle me-2"></i>
            ${message}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
    
    // Add to page
    document.body.appendChild(notification);
    
    // Auto remove after specified duration
    setTimeout(() => {
        if (notification.parentNode) {
            notification.remove();
        }
    }, duration);
}

// Real-time sync functionality (replaced auto-sync with WebSocket)

// Function to join event rooms for all registered events
async function joinEventRoomsForStudent() {
    console.log('=== JOINING EVENT ROOMS ===');
    console.log('Socket available:', !!socket);
    console.log('Current student:', currentStudent);
    
    if (!socket || !currentStudent) {
        console.log('Cannot join event rooms - missing socket or student');
        return;
    }
    
    try {
        // Get all registrations for the current student
        const response = await fetch('/api/registrations');
        const allRegistrations = await response.json();
        const studentRegistrations = allRegistrations.filter(reg => reg.student_id == currentStudent.id);
        
        console.log('All registrations:', allRegistrations);
        console.log('Student registrations:', studentRegistrations);
        
        // Join rooms for all events the student is registered for
        studentRegistrations.forEach(reg => {
            socket.emit('join-event', reg.event_id);
            console.log(`Joined event room for event ${reg.event_id}`);
        });
        
        console.log('=== FINISHED JOINING EVENT ROOMS ===');
    } catch (error) {
        console.error('Error joining event rooms:', error);
    }
}

// Enhanced refresh function that updates all data
async function refreshAllData() {
    console.log('Refreshing all data...');
    
    // Show sync indicator
    showSyncIndicator();
    
    try {
        // Store previous state for comparison
        const previousRegistrations = [...myRegistrations];
        
        // Refresh student data
        await refreshStudentData();
        
        // Refresh all sections
        await loadEvents();
        await loadMyEvents();
        await loadMyFeedback();
        
        // Check for changes and notify user
        checkForChanges(previousRegistrations);
        
        // Check for removed registrations and notify student
        checkForRemovedRegistrations(previousRegistrations);
        
        console.log('All data refreshed successfully');
    } catch (error) {
        console.error('Error refreshing all data:', error);
    } finally {
        // Hide sync indicator
        hideSyncIndicator();
    }
}

// Highlight My Events tab to draw attention after registration
function highlightMyEventsTab() {
    const myEventsTab = document.querySelector('[onclick*="my-events"]');
    if (myEventsTab) {
        // Add highlight class
        myEventsTab.classList.add('highlight-pulse');
        
        // Remove highlight after animation
        setTimeout(() => {
            myEventsTab.classList.remove('highlight-pulse');
        }, 2000);
    }
}

// Check for removed registrations and notify student
function checkForRemovedRegistrations(previousRegistrations) {
    if (!currentStudent || !currentStudent.id) return;
    
    const currentRegistrations = myRegistrations || [];
    const previousCount = previousRegistrations.length;
    const currentCount = currentRegistrations.length;
    
    // If registrations decreased, notify student
    if (currentCount < previousCount) {
        const removedCount = previousCount - currentCount;
        const removedEvents = previousRegistrations.filter(prevReg => 
            !currentRegistrations.some(currReg => currReg.event_id === prevReg.event_id)
        );
        
        if (removedEvents.length > 0) {
            const eventTitles = removedEvents.map(reg => {
                const event = events.find(e => e.id === reg.event_id);
                return event ? event.title : 'Unknown Event';
            }).join(', ');
            
            showWarningNotification(
                `Your registration has been removed from: ${eventTitles}. Please contact the administrator if you believe this is an error.`,
                8000
            );
        }
    }
}

// Check for changes and notify user
function checkForChanges(previousRegistrations) {
    if (!currentStudent || !currentStudent.id) return;
    
    const currentRegistrations = myRegistrations || [];
    const previousCount = previousRegistrations.length;
    const currentCount = currentRegistrations.length;
    
    // Check if new registrations were added
    if (currentCount > previousCount) {
        const newRegistrations = currentRegistrations.filter(current => 
            !previousRegistrations.some(prev => 
                prev.id === current.id && prev.event_id === current.event_id
            )
        );
        
        if (newRegistrations.length > 0) {
            showSuccessNotification(`You have ${newRegistrations.length} new event registration(s)!`);
        }
    }
    
    // Check for verification status changes
    currentRegistrations.forEach(currReg => {
        const prevReg = previousRegistrations.find(prev => prev.event_id === currReg.event_id);
        if (prevReg) {
            const wasVerified = prevReg.verified === 1 || prevReg.verified === true;
            const isNowVerified = currReg.verified === 1 || currReg.verified === true;
            
            if (!wasVerified && isNowVerified) {
                const event = events.find(e => e.id === currReg.event_id);
                const eventTitle = event ? event.title : 'Unknown Event';
                showSuccessNotification(`Your registration for "${eventTitle}" has been verified! You can now check in to the event.`, 5000);
            }
        }
    });
    
    // Update count badges
    updateCountBadges();
}

// Update count badges across the app
function updateCountBadges() {
    // Update my events count
    const myEventsCount = document.getElementById('my-events-count');
    if (myEventsCount) {
        myEventsCount.textContent = myRegistrations ? myRegistrations.length : 0;
    }
    
    // Update feedback count if element exists
    const feedbackCount = document.getElementById('feedback-count');
    if (feedbackCount) {
        feedbackCount.textContent = myFeedback ? myFeedback.length : 0;
    }
}

// Sync indicator functions
function showSyncIndicator() {
    // Remove existing indicator if any
    hideSyncIndicator();
    
    // Create sync indicator
    const indicator = document.createElement('div');
    indicator.id = 'sync-indicator';
    indicator.className = 'fixed top-4 right-4 z-50';
    indicator.innerHTML = `
        <div class="bg-blue-100 border border-blue-400 text-blue-700 px-4 py-3 rounded-lg flex items-center shadow-lg">
            <div class="w-4 h-4 border-2 border-blue-600 border-t-transparent rounded-full animate-spin mr-3"></div>
            <span class="text-sm font-medium">Syncing data...</span>
        </div>
    `;
    
    document.body.appendChild(indicator);
}

function hideSyncIndicator() {
    const indicator = document.getElementById('sync-indicator');
    if (indicator) {
        indicator.remove();
    }
}

// Force immediate sync (bypasses timing restrictions)
async function forceSync() {
    console.log('Force sync triggered');
    await refreshAllData();
}

// Comprehensive debug function
async function debugCurrentState() {
    console.log('=== COMPREHENSIVE DEBUG ===');
    
    // Check current student
    console.log('Current Student:', currentStudent);
    console.log('Student ID type:', typeof currentStudent?.id, 'Value:', currentStudent?.id);
    
    // Check events
    console.log('Events array:', events);
    console.log('Events count:', events.length);
    
    // Check registrations
    console.log('My Registrations:', myRegistrations);
    console.log('Registrations count:', myRegistrations.length);
    
    // Fetch fresh data from API
    try {
        const regResponse = await fetch('/api/registrations');
        const allRegistrations = await regResponse.json();
        console.log('Fresh registrations from API:', allRegistrations);
        
        const eventsResponse = await fetch('/api/events');
        const allEvents = await eventsResponse.json();
        console.log('Fresh events from API:', allEvents);
        
        // Test filtering logic
        if (currentStudent && currentStudent.id) {
            const testRegistrations = allRegistrations.filter(reg => reg.student_id == currentStudent.id);
            console.log('Test filtered registrations:', testRegistrations);
            
            const testUnregisteredEvents = allEvents.filter(event => 
                !testRegistrations.some(reg => reg.event_id == event.id)
            );
            console.log('Test unregistered events:', testUnregisteredEvents);
        }
    } catch (error) {
        console.error('Error fetching fresh data:', error);
    }
    
    // Check DOM elements
    const eventsList = document.getElementById('events-list');
    console.log('Events list element:', eventsList);
    console.log('Events list innerHTML length:', eventsList?.innerHTML?.length);
    
    const myEventsList = document.getElementById('my-events-list');
    console.log('My events list element:', myEventsList);
    console.log('My events list innerHTML length:', myEventsList?.innerHTML?.length);
    
    console.log('=== END DEBUG ===');
}

// Manual function to force update the events list
async function forceUpdateEventsList() {
    console.log('Force updating events list...');
    
    // Ensure we have fresh data
    await loadEvents();
    
    // Force update the UI
    const eventsList = document.getElementById('events-list');
    if (eventsList) {
        console.log('Events list element found, forcing update...');
        
        // Check if we should show empty state
        if (myRegistrations && myRegistrations.length > 0 && events && events.length > 0) {
            const unregisteredEvents = events.filter(event => 
                !myRegistrations.some(reg => reg.event_id == event.id)
            );
            
            console.log('Unregistered events count:', unregisteredEvents.length);
            
            if (unregisteredEvents.length === 0) {
                eventsList.innerHTML = `
                    <div class="empty-state">
                        <i class="fas fa-calendar-check"></i>
                        <p>All events registered!</p>
                        <small class="text-muted">You've registered for all available events. Check "My Events" to see your registrations.</small>
                    </div>
                `;
                console.log('Updated to show "All events registered" state');
            } else {
                console.log('Still have unregistered events, showing them');
            }
        }
    }
}

// Authentication Functions
function showAuthModal() {
    document.getElementById('authModal').classList.remove('hidden');
}

function showLoginForm() {
    document.getElementById('loginForm').style.display = 'block';
    document.getElementById('registerForm').style.display = 'none';
    document.getElementById('authModalTitle').textContent = 'Student Login';
}

function showRegisterForm() {
    document.getElementById('loginForm').style.display = 'none';
    document.getElementById('registerForm').style.display = 'block';
    document.getElementById('authModalTitle').textContent = 'Student Registration';
}

async function loginStudent() {
    const studentId = document.getElementById('loginStudentId').value.trim();
    const studentName = document.getElementById('loginStudentName').value.trim();
    
    if (!studentId || !studentName) {
        alert('Please enter both Student ID and Name');
        return;
    }
    
    try {
        const response = await fetch('/api/students');
        const students = await response.json();
        
        // Find student by SRN and name
        const student = students.find(s => 
            s.student_id.toLowerCase() === studentId.toLowerCase() && 
            s.name.toLowerCase() === studentName.toLowerCase()
        );
        
        if (student) {
            // Login successful
            currentStudent = {
                id: student.id,
                student_id: student.student_id,
                name: student.name,
                email: student.email,
                phone: student.phone
            };
            
            // Save to localStorage
            localStorage.setItem('studentId', student.student_id);
            localStorage.setItem('studentName', student.name);
            localStorage.setItem('studentEmail', student.email);
            localStorage.setItem('studentPhone', student.phone);
            localStorage.setItem('studentDbId', student.id);
            
            // Join student room for real-time updates
            if (socket) {
                socket.emit('join-student', student.id);
                // Also join rooms for all events the student is registered for
                joinEventRoomsForStudent();
            }
            
            // Close modal
            document.getElementById('authModal').classList.add('hidden');
            
            // Update UI
            updateUIAfterLogin();
            
            // Load data
            loadEvents();
            loadMyEvents();
            loadMyFeedback();
            
            showSuccessNotification('Login successful! Welcome back, ' + student.name);
        } else {
            alert('Student not found. Please check your Student ID and Name, or register as a new student.');
        }
    } catch (error) {
        console.error('Error during login:', error);
        alert('Error during login. Please try again.');
    }
}

async function registerStudent() {
    const studentId = document.getElementById('registerStudentId').value.trim();
    const studentName = document.getElementById('registerStudentName').value.trim();
    const studentEmail = document.getElementById('registerStudentEmail').value.trim();
    const studentPhone = document.getElementById('registerStudentPhone').value.trim();
    const studentInstitute = document.getElementById('registerStudentInstitute').value.trim();
    
    if (!studentId || !studentName || !studentEmail || !studentInstitute) {
        alert('Please fill in all required fields');
        return;
    }
    
    try {
        // Check if student already exists
        const response = await fetch('/api/students');
        const students = await response.json();
        
        const existingStudent = students.find(s => 
            s.student_id.toLowerCase() === studentId.toLowerCase()
        );
        
        if (existingStudent) {
            alert('Student with this SRN already exists. Please login instead.');
            showLoginForm();
            return;
        }
        
        // Create new student
        const createResponse = await fetch('/api/students', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: studentId,
                name: studentName,
                email: studentEmail,
                phone: studentPhone,
                institute: studentInstitute
            })
        });
        
        if (createResponse.ok) {
            const result = await createResponse.json();
            
            // Set current student
            currentStudent = {
                id: result.id,
                student_id: studentId,
                name: studentName,
                email: studentEmail,
                phone: studentPhone,
                institute: studentInstitute
            };
            
            // Save to localStorage
            localStorage.setItem('studentId', studentId);
            localStorage.setItem('studentName', studentName);
            localStorage.setItem('studentEmail', studentEmail);
            localStorage.setItem('studentPhone', studentPhone);
            localStorage.setItem('studentDbId', result.id);
            
            // Join student room for real-time updates
            if (socket) {
                socket.emit('join-student', result.id);
                // Also join rooms for all events the student is registered for
                joinEventRoomsForStudent();
            }
            
            // Close modal
            document.getElementById('authModal').classList.add('hidden');
            
            // Update UI
            updateUIAfterLogin();
            
            // Load data
            loadEvents();
            loadMyEvents();
            loadMyFeedback();
            
            showSuccessNotification('Registration successful! Welcome, ' + studentName);
        } else {
            const error = await createResponse.json();
            alert('Error during registration: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error during registration:', error);
        alert('Error during registration. Please try again.');
    }
}

function updateUIAfterLogin() {
    // Update student card
    document.getElementById('student-name').textContent = currentStudent.name;
    document.getElementById('student-id').textContent = `ID: ${currentStudent.student_id} (DB: ${currentStudent.id})`;
    document.getElementById('student-avatar').innerHTML = currentStudent.name.charAt(0).toUpperCase();
    
    // Show/hide buttons
    document.getElementById('profileBtn').style.display = 'inline-block';
    document.getElementById('loginBtn').style.display = 'none';
    document.getElementById('headerProfileBtn').style.display = 'inline-block';
    document.getElementById('headerLoginBtn').style.display = 'none';
    
    // Enable sections
    document.querySelectorAll('[id$="-section"]').forEach(section => {
        section.style.pointerEvents = 'auto';
    });
}

function logoutStudent() {
    // Clear localStorage
    localStorage.removeItem('studentId');
    localStorage.removeItem('studentName');
    localStorage.removeItem('studentEmail');
    localStorage.removeItem('studentPhone');
    localStorage.removeItem('studentDbId');
    
    // Clear current student
    currentStudent = null;
    myRegistrations = [];
    myFeedback = [];
    
    // Reset UI
    document.getElementById('student-name').textContent = 'Welcome!';
    document.getElementById('student-id').textContent = 'Tap to set up your profile';
    document.getElementById('student-avatar').innerHTML = '<i class="fas fa-user"></i>';
    
    // Show/hide buttons
    document.getElementById('profileBtn').style.display = 'none';
    document.getElementById('loginBtn').style.display = 'inline-block';
    document.getElementById('headerProfileBtn').style.display = 'none';
    document.getElementById('headerLoginBtn').style.display = 'inline-block';
    
    // Clear sections
    document.getElementById('events-list').innerHTML = '<div class="loading"><div class="spinner"></div></div>';
    document.getElementById('my-events-list').innerHTML = '<div class="empty-state"><i class="fas fa-ticket-alt"></i><p>No registered events yet</p></div>';
    document.getElementById('feedback-list').innerHTML = '<div class="empty-state"><i class="fas fa-star"></i><p>No feedback submitted yet</p></div>';
    
    // Show auth modal
    showAuthModal();
    
    showSuccessNotification('Logged out successfully');
}

// Student Info Functions
async function loadStudentInfo() {
    const studentId = localStorage.getItem('studentId');
    const studentName = localStorage.getItem('studentName');
    const studentEmail = localStorage.getItem('studentEmail');
    const studentPhone = localStorage.getItem('studentPhone');
    const studentDbId = localStorage.getItem('studentDbId');
    
    console.log('Loading student info:', { studentId, studentName, studentDbId });
    
    if (studentId && studentDbId) {
        currentStudent = {
            id: studentDbId,
            student_id: studentId,
            name: studentName,
            email: studentEmail,
            phone: studentPhone
        };
        
        console.log('Current student object:', currentStudent);
        
        // Join student room for real-time updates
        if (socket) {
            socket.emit('join-student', currentStudent.id);
            // Also join rooms for all events the student is registered for
            joinEventRoomsForStudent();
        }
        
        // Update UI
        updateUIAfterLogin();
        
        // Add debug info to show current student ID
        console.log('Student logged in with database ID:', currentStudent.id);
        console.log('Student ID string:', currentStudent.student_id);
        
        // Load student's events and feedback
        loadMyEvents();
        loadMyFeedback();
        loadAttendanceData();
    } else {
        // Show welcome state and auth modal
        document.getElementById('student-name').textContent = 'Welcome!';
        document.getElementById('student-id').textContent = 'Please login or register';
        document.getElementById('student-avatar').innerHTML = '<i class="fas fa-user"></i>';
        showAuthModal();
    }
}

function showStudentModal() {
    if (currentStudent) {
        document.getElementById('studentId').value = currentStudent.id;
        document.getElementById('studentName').value = currentStudent.name;
        document.getElementById('studentEmail').value = currentStudent.email;
        document.getElementById('studentPhone').value = currentStudent.phone || '';
    }
    
    document.getElementById('studentModal').classList.remove('hidden');
}

async function saveStudentInfo() {
    const studentData = {
        student_id: document.getElementById('studentId').value,
        name: document.getElementById('studentName').value,
        email: document.getElementById('studentEmail').value,
        phone: document.getElementById('studentPhone').value
    };
    
    console.log('Saving student info:', studentData);
    
    try {
        // Check if student already exists
        const existingResponse = await fetch('/api/students');
        const existingStudents = await existingResponse.json();
        console.log('Existing students:', existingStudents);
        
        const existingStudent = existingStudents.find(s => s.student_id === studentData.student_id);
        console.log('Found existing student:', existingStudent);
        
        let response;
        let dbId;
        
        if (existingStudent) {
            // Update existing student
            console.log('Updating existing student with ID:', existingStudent.id);
            response = await fetch(`/api/students/${existingStudent.id}`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentData)
            });
            dbId = existingStudent.id;
        } else {
            // Create new student
            console.log('Creating new student');
            response = await fetch('/api/students', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(studentData)
            });
        }
        
        console.log('Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Response result:', result);
            
            // Get the database ID
            if (!dbId) {
                dbId = result.id;
            }
            
            console.log('Final database ID:', dbId);
            
            // Ensure we have a valid database ID
            if (!dbId) {
                alert('Error: Could not get student database ID. Please try again.');
                return;
            }
            
            // Update current student object
            currentStudent = { 
                id: dbId,
                student_id: studentData.student_id,
                name: studentData.name,
                email: studentData.email,
                phone: studentData.phone
            };
            
            console.log('Updated currentStudent:', currentStudent);
            
            // Save to localStorage
            localStorage.setItem('studentId', studentData.student_id);
            localStorage.setItem('studentName', studentData.name);
            localStorage.setItem('studentEmail', studentData.email);
            localStorage.setItem('studentPhone', studentData.phone);
            localStorage.setItem('studentDbId', dbId);
            
            // Update display
            document.getElementById('student-id').textContent = `ID: ${studentData.student_id}`;
            document.getElementById('student-name').textContent = studentData.name;
            document.getElementById('student-avatar').innerHTML = studentData.name.charAt(0).toUpperCase();
            
            document.getElementById('studentModal').classList.add('hidden');
            
            alert('Student information saved successfully! Database ID: ' + dbId);
            loadMyEvents();
            loadMyFeedback();
        } else {
            const error = await response.json();
            console.error('Error response:', error);
            alert('Error saving student information: ' + (error.error || 'Unknown error'));
        }
    } catch (error) {
        console.error('Error saving student info:', error);
        alert('Error saving student information: ' + error.message);
    }
}

// Events Functions
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        const fetchedEvents = await response.json();
        events = fetchedEvents; // Update global events array
        console.log('Events loaded and updated globally:', events);
        
        const eventsList = document.getElementById('events-list');
        if (events.length === 0) {
            eventsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-times"></i>
                    <p>No events available</p>
                </div>
            `;
            return;
        }
        
        // Get current student's registrations
        if (currentStudent && currentStudent.id) {
            try {
                const regResponse = await fetch('/api/registrations');
                const allRegistrations = await regResponse.json();
                console.log('All registrations from API:', allRegistrations);
                
                // Update global myRegistrations array
                myRegistrations = allRegistrations.filter(reg => {
                    console.log('Comparing registration student_id:', reg.student_id, 'with current student ID:', currentStudent.id);
                    const isMatch = reg.student_id == currentStudent.id; // Use loose equality for type flexibility
                    console.log('Registration match in loadEvents:', isMatch);
                    return isMatch;
                });
                console.log('Filtered myRegistrations for loadEvents:', myRegistrations);
                console.log('Global myRegistrations updated:', myRegistrations);
            } catch (error) {
                console.error('Error loading registrations:', error);
                myRegistrations = [];
            }
        } else {
            console.log('No current student or student ID, clearing myRegistrations');
            myRegistrations = [];
        }
        
        // Filter out events that the user has already registered for
        const unregisteredEvents = events.filter(event => {
            const isRegistered = myRegistrations.some(reg => reg.event_id == event.id); // Use loose equality
            console.log(`Event ${event.id} (${event.title}): isRegistered = ${isRegistered}`);
            if (isRegistered) {
                console.log(`Found matching registration for event ${event.id}:`, myRegistrations.find(reg => reg.event_id == event.id));
            }
            return !isRegistered;
        });
        
        // Log the filtering results for debugging
        console.log('Event filtering results:');
        console.log('- Total events:', events.length);
        console.log('- My registrations:', myRegistrations.length);
        console.log('- Unregistered events:', unregisteredEvents.length);
        console.log('- Registered event IDs:', myRegistrations.map(reg => reg.event_id));
        
        console.log('Events filtering debug:');
        console.log('Total events:', events.length);
        console.log('My registrations:', myRegistrations);
        console.log('Unregistered events:', unregisteredEvents.length);
        console.log('Unregistered events details:', unregisteredEvents.map(e => ({id: e.id, title: e.title})));
        
        if (unregisteredEvents.length === 0) {
            eventsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-calendar-check"></i>
                    <p>All events registered!</p>
                    <small class="text-muted">You've registered for all available events. Check "My Events" to see your registrations.</small>
                </div>
            `;
            return;
        }
        
        eventsList.innerHTML = unregisteredEvents.map(event => {
            return `
                <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer" data-event-id="${event.id}" onclick="showEventDetails(${event.id})">
                    <div class="h-24 flex items-center justify-center" style="background-color:rgb(104, 150, 214);">
                        <i class="fas fa-calendar-alt text-white text-2xl"></i>
                    </div>
                    <div class="p-4">
                        <h6 class="text-lg font-bold text-gray-900 mb-2 line-clamp-2">${event.title}</h6>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-2">${event.description || 'No description available'}</p>
                        <div class="space-y-2 mb-4">
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-calendar w-4 mr-2"></i>
                                <span>${new Date(event.date).toLocaleDateString()}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-clock w-4 mr-2"></i>
                                <span>${event.time}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-map-marker-alt w-4 mr-2"></i>
                                <span class="truncate">${event.location}</span>
                            </div>
                        </div>
                        <button class="w-full bg-blue-600 hover:bg-blue-700 text-white py-2 px-4 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105" onclick="event.stopPropagation(); showEventDetails(${event.id})">
                            <i class="fas fa-info-circle mr-1"></i>View Details
                        </button>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading events:', error);
        document.getElementById('events-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading events</p>
            </div>
        `;
    }
}

async function showEventDetails(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    const eventDetails = document.getElementById('event-details');
    eventDetails.innerHTML = `
        <h6>${event.title}</h6>
        <p class="text-muted">${event.description || 'No description available'}</p>
        <div class="row mb-3">
            <div class="col-6">
                <strong>Date:</strong><br>
                <span class="text-muted">${new Date(event.date).toLocaleDateString()}</span>
            </div>
            <div class="col-6">
                <strong>Time:</strong><br>
                <span class="text-muted">${event.time}</span>
            </div>
        </div>
        <div class="row mb-3">
            <div class="col-6">
                <strong>Location:</strong><br>
                <span class="text-muted">${event.location}</span>
            </div>
            <div class="col-6">
                <strong>Capacity:</strong><br>
                <span class="text-muted">${event.max_capacity} people</span>
            </div>
        </div>
    `;
    
    // Check if student is already registered
    let isRegistered = false;
    if (currentStudent && currentStudent.id) {
        try {
            const response = await fetch('/api/registrations');
            const registrations = await response.json();
            isRegistered = registrations.some(reg => 
                reg.student_id === currentStudent.id && reg.event_id === eventId
            );
        } catch (error) {
            console.error('Error checking registration status:', error);
        }
    }
    
    const registerBtn = document.getElementById('register-btn');
    if (isRegistered) {
        registerBtn.innerHTML = '<i class="fas fa-check me-2"></i>Already Registered';
        registerBtn.className = 'btn btn-success w-100';
        registerBtn.disabled = true;
        registerBtn.onclick = null;
    } else if (currentStudent) {
        registerBtn.innerHTML = '<i class="fas fa-calendar-plus me-2"></i>Register for Event';
        registerBtn.className = 'btn btn-primary w-100';
        registerBtn.disabled = false;
        registerBtn.onclick = () => registerForEvent(eventId);
    } else {
        registerBtn.innerHTML = '<i class="fas fa-user-plus me-2"></i>Please set your student info first';
        registerBtn.className = 'btn btn-secondary w-100';
        registerBtn.disabled = true;
        registerBtn.onclick = null;
    }
    
    document.getElementById('eventModal').classList.remove('hidden');
}

async function registerForEvent(eventId) {
    console.log('=== REGISTRATION ATTEMPT ===');
    console.log('Event ID:', eventId);
    console.log('Current student:', currentStudent);
    
    // First, ensure we have student data
    if (!currentStudent) {
        console.log('No current student, loading from localStorage...');
        await loadStudentInfo();
    }
    
    // If still no student, show error
    if (!currentStudent) {
        alert('Please set your student information first');
        return;
    }
    
    // Ensure we have the database ID
    if (!currentStudent.id) {
        console.log('No database ID found, attempting to find/create student...');
        
        // Try to find existing student in database
        try {
            const response = await fetch('/api/students');
            const students = await response.json();
            const existingStudent = students.find(s => s.student_id === currentStudent.student_id);
            
            if (existingStudent) {
                console.log('Found existing student in database:', existingStudent);
                currentStudent.id = existingStudent.id;
                localStorage.setItem('studentDbId', existingStudent.id);
            } else {
                console.log('Student not found in database, creating new one...');
                // Create student in database
                const createResponse = await fetch('/api/students', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        student_id: currentStudent.student_id,
                        name: currentStudent.name,
                        email: currentStudent.email,
                        phone: currentStudent.phone
                    })
                });
                
                if (createResponse.ok) {
                    const result = await createResponse.json();
                    currentStudent.id = result.id;
                    localStorage.setItem('studentDbId', result.id);
                    console.log('Created new student with ID:', result.id);
                } else {
                    const error = await createResponse.json();
                    alert('Error creating student: ' + (error.error || 'Unknown error'));
                    return;
                }
            }
        } catch (error) {
            console.error('Error finding/creating student:', error);
            alert('Error setting up student data: ' + error.message);
            return;
        }
    }
    
    const registrationData = {
        student_id: currentStudent.id,
        event_id: eventId
    };
    
    console.log('Sending registration data:', registrationData);
    
    try {
        const response = await fetch('/api/registrations', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(registrationData)
        });
        
        console.log('Registration response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Registration successful:', result);
            
            // Close modal immediately
            document.getElementById('eventModal').classList.add('hidden');
            
            // Show success notification
            showSuccessNotification('Successfully registered! Event moved to "My Events" tab.');
            
            // Update the event button to show registered status
            updateEventButtonStatus(eventId, true);
            
            // Immediately update the global myRegistrations array
            const newRegistration = {
                id: result.id || Date.now(), // Use server ID or fallback
                student_id: currentStudent.id,
                event_id: eventId,
                registration_date: new Date().toISOString()
            };
            myRegistrations.push(newRegistration);
            console.log('Added new registration to global array:', newRegistration);
            
            // Immediately remove the event card from the DOM if we're on the events tab
            if (currentSection === 'events') {
                const eventCard = document.querySelector(`[data-event-id="${eventId}"]`);
                if (eventCard) {
                    eventCard.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                    eventCard.style.opacity = '0';
                    eventCard.style.transform = 'translateX(-100%)';
                    setTimeout(() => {
                        eventCard.remove();
                    }, 300);
                }
            }
            
            // Join event room for real-time updates
            if (socket) {
                socket.emit('join-event', eventId);
                console.log(`Joined event room for new registration: ${eventId}`);
            }
            
            // Immediately refresh both tabs to show the change
            console.log('Registration successful, immediately updating both tabs...');
            await Promise.all([
                loadEvents(),
                loadMyEvents()
            ]);
            
            // Update count badges
            updateCountBadges();
            
            // If user is currently on events tab, suggest switching to My Events
            if (currentSection === 'events') {
                setTimeout(() => {
                    showSuccessNotification('Check "My Events" tab to see your registered events!', 3000);
                }, 1000);
            }
            
            // Add visual feedback by briefly highlighting the My Events tab
            highlightMyEventsTab();
            
        } else {
            const errorText = await response.text();
            console.error('Registration error response:', errorText);
            let error;
            try {
                error = JSON.parse(errorText);
            } catch (e) {
                error = { error: errorText };
            }
            console.error('Registration error:', error);
            
            if (error.error && error.error.includes('UNIQUE constraint failed')) {
                // Close modal and show already registered message
                document.getElementById('eventModal').classList.add('hidden');
                showSuccessNotification('Already registered! Check "My Events" tab.');
                updateEventButtonStatus(eventId, true);
                // Sync data to ensure UI is up to date
                await refreshAllData();
            } else {
                alert('Error registering for event: ' + (error.error || 'Unknown error'));
            }
        }
    } catch (error) {
        console.error('Network error during registration:', error);
        alert('Network error: ' + error.message);
    }
}

// My Events Functions
async function loadMyEvents() {
    if (!currentStudent) {
        document.getElementById('my-events-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <p>Please set your student information first</p>
            </div>
        `;
        return;
    }
    
    try {
        const response = await fetch('/api/registrations');
        const allRegistrations = await response.json();
        console.log('All registrations:', allRegistrations);
        console.log('Current student ID:', currentStudent.id, 'Type:', typeof currentStudent.id);
        
        myRegistrations = allRegistrations.filter(reg => {
            console.log('Registration student_id:', reg.student_id, 'Type:', typeof reg.student_id);
            console.log('Current student ID:', currentStudent.id, 'Type:', typeof currentStudent.id);
            const isMatch = reg.student_id == currentStudent.id; // Use loose equality for type flexibility
            console.log('Registration match:', isMatch);
            return isMatch;
        });
        
        console.log('Filtered my registrations:', myRegistrations);
        console.log('My events debug - Current student ID:', currentStudent.id);
        console.log('My events debug - Registration count:', myRegistrations.length);
        
        // Update count badge
        updateCountBadges();
        
        // Log detailed registration info for debugging
        console.log('My Events - Registration details:');
        myRegistrations.forEach((reg, index) => {
            console.log(`Registration ${index + 1}:`, {
                id: reg.id,
                student_id: reg.student_id,
                event_id: reg.event_id,
                registration_date: reg.registration_date
            });
        });
        
        const myEventsList = document.getElementById('my-events-list');
        if (myRegistrations.length === 0) {
            myEventsList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-ticket-alt"></i>
                    <p>No registered events yet</p>
                    <small class="text-muted">Go to "Events" tab to register for upcoming events</small>
                </div>
            `;
            return;
        }
        
        myEventsList.innerHTML = myRegistrations.map(reg => {
            const event = events.find(e => e.id == reg.event_id);
            if (!event) return '';
            
            const eventDate = new Date(event.date);
            const today = new Date();
            const isPastEvent = eventDate < today;
            const isVerified = reg.verified === 1 || reg.verified === true;
            
            // Get attendance status for this event
            const attendanceStatus = getAttendanceStatus(event.id);
            console.log(`Event ${event.id} (${event.title}) attendance status:`, attendanceStatus);
            console.log(`Registration ID: ${reg.id}, Event ID: ${reg.event_id}, Student ID: ${reg.student_id}`);
            
            return `
                <div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl cursor-pointer" data-event-id="${event.id}" onclick="showEventDetails(${event.id})">
                    <div class="bg-gradient-to-r ${isVerified ? 'from-green-500 to-green-600' : 'from-amber-500 to-amber-600'} h-24 flex items-center justify-center">
                        <i class="fas fa-ticket-alt text-white text-2xl"></i>
                    </div>
                    <div class="p-4">
                        <div class="flex justify-between items-start mb-2">
                            <h6 class="text-lg font-bold text-gray-900 line-clamp-2">${event.title}</h6>
                            <div class="text-right ml-2">
                                <span class="inline-block px-2 py-1 rounded-full text-xs font-semibold ${isVerified ? 'bg-green-100 text-green-800' : 'bg-amber-100 text-amber-800'} mb-1">
                                    <i class="fas ${isVerified ? 'fa-check-circle' : 'fa-clock'} mr-1"></i>
                                    ${isVerified ? 'Verified' : 'Pending'}
                                </span>
                                ${attendanceStatus ? `
                                    <br><span class="inline-block px-2 py-1 rounded-full text-xs font-semibold ${attendanceStatus === 'attended' ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}">
                                        <i class="fas ${attendanceStatus === 'attended' ? 'fa-check-circle' : 'fa-times-circle'} mr-1"></i>
                                        ${attendanceStatus === 'attended' ? 'Present' : 'Absent'}
                                    </span>
                                ` : `
                                    <br><span class="inline-block px-2 py-1 rounded-full text-xs font-semibold bg-gray-100 text-gray-800">
                                        <i class="fas fa-question-circle mr-1"></i>
                                        Not Marked
                                    </span>
                                `}
                            </div>
                        </div>
                        <p class="text-gray-600 text-sm mb-3 line-clamp-2">${event.description || 'No description available'}</p>
                        <div class="space-y-2 mb-4">
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-calendar w-4 mr-2"></i>
                                <span>${eventDate.toLocaleDateString()}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-clock w-4 mr-2"></i>
                                <span>${event.time}</span>
                            </div>
                            <div class="flex items-center text-sm text-gray-600">
                                <i class="fas fa-map-marker-alt w-4 mr-2"></i>
                                <span class="truncate">${event.location}</span>
                            </div>
                        </div>
                        
                        ${!isVerified ? `
                            <div class="bg-amber-50 border border-amber-200 rounded-lg p-2 mb-3">
                                <i class="fas fa-exclamation-triangle text-amber-600 mr-2"></i>
                                <span class="text-amber-800 text-xs">Verification pending</span>
                            </div>
                        ` : ''}
                        
                        <div class="mt-3">
                            ${isPastEvent ? 
                                `<button class="w-full bg-amber-500 hover:bg-amber-600 text-white py-2 px-4 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105" onclick="event.stopPropagation(); showFeedbackModal(${event.id})">
                                    <i class="fas fa-star mr-1"></i>Give Feedback
                                </button>` :
                                isVerified ?
                                `<button class="w-full bg-green-500 hover:bg-green-600 text-white py-2 px-4 rounded-xl text-sm font-semibold transition-all duration-300 hover:scale-105" onclick="event.stopPropagation(); showCheckinModal(${event.id})">
                                    <i class="fas fa-check-circle mr-1"></i>Check In
                                </button>` :
                                `<button class="w-full bg-gray-400 text-white py-2 px-4 rounded-xl text-sm font-semibold cursor-not-allowed" disabled>
                                    <i class="fas fa-clock mr-1"></i>Verification Pending
                                </button>`
                            }
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
    } catch (error) {
        console.error('Error loading my events:', error);
        document.getElementById('my-events-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-exclamation-triangle"></i>
                <p>Error loading events</p>
            </div>
        `;
    }
}

// Check-in Functions
function showCheckinModal(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    const checkinDetails = document.getElementById('checkin-details');
    checkinDetails.innerHTML = `
        <h6 class="text-lg font-semibold text-gray-900 mb-3">${event.title}</h6>
        <p class="text-gray-600 mb-4">${event.description || 'No description available'}</p>
        <div class="grid grid-cols-2 gap-4 mb-4">
            <div>
                <strong class="text-gray-900">Date:</strong><br>
                <span class="text-gray-600">${new Date(event.date).toLocaleDateString()}</span>
            </div>
            <div>
                <strong class="text-gray-900">Time:</strong><br>
                <span class="text-gray-600">${event.time}</span>
            </div>
        </div>
        <div class="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <i class="fas fa-info-circle mr-2 text-blue-600"></i>
            <span class="text-blue-800">Are you sure you want to check in for this event?</span>
        </div>
    `;
    
    const checkinBtn = document.getElementById('checkinModal').querySelector('.bg-green-500');
    checkinBtn.onclick = () => checkInForEvent(eventId);
    
    document.getElementById('checkinModal').classList.remove('hidden');
}

async function checkInForEvent(eventId) {
    if (!currentStudent) {
        alert('Please set your student information first');
        return;
    }
    
    try {
        const response = await fetch('/api/attendance', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                student_id: currentStudent.id,
                event_id: eventId
            })
        });
        
        if (response.ok) {
            alert('Successfully checked in for the event!');
            document.getElementById('checkinModal').classList.add('hidden');
        } else {
            const error = await response.json();
            alert(error.error || 'Error checking in for event');
        }
    } catch (error) {
        console.error('Error checking in for event:', error);
        alert('Error checking in for event');
    }
}

// Feedback Functions
function showFeedbackModal(eventId) {
    const event = events.find(e => e.id === eventId);
    if (!event) return;
    
    document.getElementById('feedback-event-id').value = eventId;
    document.getElementById('rating-value').value = 0;
    document.getElementById('feedback-comment').value = '';
    
    // Reset stars
    document.querySelectorAll('#rating-stars i').forEach(star => {
        star.classList.remove('fas');
        star.classList.add('far');
    });
    
    document.getElementById('feedbackModal').classList.remove('hidden');
}

function setupRatingStars() {
    const stars = document.querySelectorAll('#rating-stars i');
    stars.forEach((star, index) => {
        star.addEventListener('click', () => {
            const rating = index + 1;
            document.getElementById('rating-value').value = rating;
            
            stars.forEach((s, i) => {
                if (i < rating) {
                    s.classList.remove('far');
                    s.classList.add('fas');
                } else {
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
        
        star.addEventListener('mouseenter', () => {
            const rating = index + 1;
            stars.forEach((s, i) => {
                if (i < rating) {
                    s.classList.remove('far');
                    s.classList.add('fas');
                } else {
                    s.classList.remove('fas');
                    s.classList.add('far');
                }
            });
        });
    });
    
    document.getElementById('rating-stars').addEventListener('mouseleave', () => {
        const currentRating = parseInt(document.getElementById('rating-value').value);
        stars.forEach((s, i) => {
            if (i < currentRating) {
                s.classList.remove('far');
                s.classList.add('fas');
            } else {
                s.classList.remove('fas');
                s.classList.add('far');
            }
        });
    });
}

async function submitFeedback() {
    const eventId = document.getElementById('feedback-event-id').value;
    const rating = document.getElementById('rating-value').value;
    const comment = document.getElementById('feedback-comment').value;
    
    console.log('=== SUBMITTING FEEDBACK ===');
    console.log('Event ID:', eventId);
    console.log('Rating:', rating);
    console.log('Comment:', comment);
    console.log('Current student:', currentStudent);
    
    if (rating == 0) {
        alert('Please select a rating');
        return;
    }
    
    if (!currentStudent) {
        alert('Please set your student information first');
        return;
    }
    
    try {
        const feedbackData = {
            student_id: currentStudent.id,
            event_id: eventId,
            rating: parseInt(rating),
            comment: comment
        };
        
        console.log('Sending feedback data:', feedbackData);
        
        const response = await fetch('/api/feedback', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(feedbackData)
        });
        
        console.log('Feedback submission response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Feedback submission successful:', result);
            alert('Feedback submitted successfully!');
            document.getElementById('feedbackModal').classList.add('hidden');
            
            // Refresh feedback list
            await loadMyFeedback();
            
            // Also refresh all data to ensure consistency
            await refreshAllData();
        } else {
            const error = await response.json();
            console.error('Feedback submission error:', error);
            alert(error.error || 'Error submitting feedback');
        }
    } catch (error) {
        console.error('Error submitting feedback:', error);
        alert('Error submitting feedback: ' + error.message);
    }
}

async function loadMyFeedback() {
    console.log('=== LOADING FEEDBACK ===');
    console.log('Current student:', currentStudent);
    
    if (!currentStudent) {
        console.log('No current student, showing login prompt');
        document.getElementById('feedback-list').innerHTML = `
            <div class="empty-state">
                <i class="fas fa-user-slash"></i>
                <p>Please set your student information first</p>
            </div>
        `;
        return;
    }
    
    try {
        console.log('Fetching feedback for student ID:', currentStudent.id);
        const response = await fetch(`/api/feedback?student_id=${currentStudent.id}`);
        
        console.log('Feedback response status:', response.status);
        
        if (!response.ok) {
            const errorText = await response.text();
            console.error('Feedback API error:', errorText);
            throw new Error(`HTTP error! status: ${response.status} - ${errorText}`);
        }
        
        const allFeedback = await response.json();
        console.log('Received feedback data:', allFeedback);
        
        // Server already filters by student_id, so we can use all feedback directly
        myFeedback = allFeedback;
        
        // Update count badge
        const feedbackCount = document.getElementById('feedback-count');
        if (feedbackCount) {
            feedbackCount.textContent = myFeedback.length;
        }
        
        // Display feedback cards with delete buttons and checkboxes
        displayFeedbackCards();
        
        console.log('Feedback loaded successfully, count:', myFeedback.length);
        
    } catch (error) {
        console.error('Error loading feedback:', error);
        const feedbackList = document.getElementById('feedback-list');
        if (feedbackList) {
            feedbackList.innerHTML = `
                <div class="empty-state">
                    <i class="fas fa-exclamation-triangle"></i>
                    <p>Error loading feedback: ${error.message}</p>
                    <button class="mt-4 bg-blue-600 hover:bg-blue-700 text-white px-4 py-2 rounded-lg text-sm font-medium transition-all duration-200" onclick="loadMyFeedback()">
                        <i class="fas fa-sync-alt mr-2"></i>Retry
                    </button>
                </div>
            `;
        }
    }
}

// Feedback Management Functions
async function deleteFeedback(feedbackId) {
    if (confirm('Delete this feedback?')) {
        try {
            const response = await fetch(`/api/feedback/${feedbackId}?student_id=${currentStudent.id}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                // Remove from myFeedback array
                myFeedback = myFeedback.filter(fb => fb.id != feedbackId);
                
                // Remove from DOM
                const card = document.querySelector(`[data-feedback-id="${feedbackId}"]`);
                if (card) {
                    card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                    card.style.opacity = '0';
                    card.style.transform = 'translateX(-100%)';
                    setTimeout(() => {
                        card.remove();
                    }, 300);
                }
                
                // Update count
                document.getElementById('feedback-count').textContent = myFeedback.length;
                
                // Show success message
                showSuccessNotification('Feedback deleted successfully');
                
                // Refresh only the feedback section
                setTimeout(() => {
                    loadMyFeedback();
                }, 1000);
            } else {
                console.log('API delete failed, trying local deletion');
                // Fallback: Delete locally even if API fails
                myFeedback = myFeedback.filter(fb => fb.id != feedbackId);
                
                // Remove from DOM
                const card = document.querySelector(`[data-feedback-id="${feedbackId}"]`);
                if (card) {
                    card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                    card.style.opacity = '0';
                    card.style.transform = 'translateX(-100%)';
                    setTimeout(() => {
                        card.remove();
                    }, 300);
                }
                
                // Update count
                const countElement = document.getElementById('feedback-count');
                if (countElement) {
                    countElement.textContent = myFeedback.length;
                }
                
                alert('Feedback deleted locally (API may be unavailable)');
                
                // Refresh only the feedback section
                setTimeout(() => {
                    loadMyFeedback();
                }, 1000);
            }
        } catch (error) {
            console.error('Error deleting feedback:', error);
            alert('Error deleting feedback: ' + error.message);
        }
    }
}

function updateSelection() {
    const checkedBoxes = document.querySelectorAll('.feedback-select-checkbox:checked');
    const bulkActions = document.getElementById('feedback-bulk-actions');
    const selectedCount = document.getElementById('feedback-selected-count');
    const selectAllCheckbox = document.getElementById('select-all-feedback');
    
    // Add null checks to prevent errors
    if (!bulkActions || !selectedCount || !selectAllCheckbox) {
        console.log('Some feedback elements not found, skipping selection update');
        return;
    }
    
    console.log('Update selection - checked boxes:', checkedBoxes.length, 'total feedback:', myFeedback.length);
    
    if (checkedBoxes.length > 0) {
        // Show bulk actions when items are selected
        bulkActions.classList.remove('hidden');
        selectedCount.textContent = checkedBoxes.length + ' selected';
        
        // Update select all checkbox state
        if (checkedBoxes.length === myFeedback.length && myFeedback.length > 0) {
            selectAllCheckbox.checked = true;
        } else {
            selectAllCheckbox.checked = false;
        }
    } else {
        // Hide all actions when no items are selected
        bulkActions.classList.add('hidden');
        selectAllCheckbox.checked = false;
    }
}

async function deleteSelected() {
    console.log('Delete selected function called');
    const checkedBoxes = document.querySelectorAll('.feedback-select-checkbox:checked');
    console.log('Checked boxes found:', checkedBoxes.length);
    
    // Debug: Log all checkboxes and their data attributes
    document.querySelectorAll('.feedback-select-checkbox').forEach((cb, index) => {
        console.log(`Checkbox ${index}:`, {
            checked: cb.checked,
            feedbackId: cb.dataset.feedbackId,
            element: cb
        });
    });
    
    if (checkedBoxes.length === 0) {
        alert('No feedback selected');
        return;
    }
    
    if (confirm('Delete ' + checkedBoxes.length + ' selected feedback items?')) {
        console.log('User confirmed deletion');
        try {
            const feedbackIds = [];
            
            checkedBoxes.forEach(checkbox => {
                const feedbackId = parseInt(checkbox.dataset.feedbackId);
                feedbackIds.push(feedbackId);
            });
            
            console.log('Feedback IDs to delete:', feedbackIds);
            console.log('Student ID:', currentStudent.id);
            
            const response = await fetch('/api/feedback', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackIds: feedbackIds, student_id: currentStudent.id })
            });
            
            console.log('Delete response status:', response.status);
            
            if (response.ok) {
                const result = await response.json();
                console.log('Delete successful:', result);
                
                // Remove from DOM with animation
                checkedBoxes.forEach(checkbox => {
                    const card = checkbox.closest('[data-feedback-id]');
                    if (card) {
                        console.log('Removing card:', card);
                        card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(-100%)';
                        setTimeout(() => {
                            card.remove();
                        }, 300);
                    }
                });
                
                // Remove from myFeedback array
                myFeedback = myFeedback.filter(fb => !feedbackIds.includes(fb.id));
                
                // Update count
                const countElement = document.getElementById('feedback-count');
                if (countElement) {
                    countElement.textContent = myFeedback.length;
                }
                
                // Hide bulk actions
                const bulkActions = document.getElementById('feedback-bulk-actions');
                if (bulkActions) {
                    bulkActions.classList.add('hidden');
                }
                
                // Clear selection
                clearSelection();
                
                alert(`${feedbackIds.length} feedback items deleted successfully`);
                
                // Refresh only the feedback section
                setTimeout(() => {
                    loadMyFeedback();
                }, 100);
            } else {
                console.log('API delete failed, trying local deletion');
                // Fallback: Delete locally even if API fails
                checkedBoxes.forEach(checkbox => {
                    const card = checkbox.closest('[data-feedback-id]');
                    if (card) {
                        console.log('Removing card locally:', card);
                        card.style.transition = 'opacity 0.3s ease-out, transform 0.3s ease-out';
                        card.style.opacity = '0';
                        card.style.transform = 'translateX(-100%)';
                        setTimeout(() => {
                            card.remove();
                        }, 300);
                    }
                });
                
                // Remove from myFeedback array
                myFeedback = myFeedback.filter(fb => !feedbackIds.includes(fb.id));
                
                // Update count
                const countElement = document.getElementById('feedback-count');
                if (countElement) {
                    countElement.textContent = myFeedback.length;
                }
                
                // Hide bulk actions
                const bulkActions = document.getElementById('feedback-bulk-actions');
                if (bulkActions) {
                    bulkActions.classList.add('hidden');
                }
                
                // Clear selection
                clearSelection();
                
                alert(`${feedbackIds.length} feedback items deleted locally (API may be unavailable)`);
                
                // Refresh only the feedback section
                setTimeout(() => {
                    loadMyFeedback();
                }, 1000);
            }
        } catch (error) {
            console.error('Error deleting selected feedback:', error);
            alert('Error deleting feedback: ' + error.message);
        }
    }
}

// Test function to debug delete functionality
function testDelete() {
    console.log('=== DELETE TEST ===');
    console.log('My feedback array:', myFeedback);
    console.log('All checkboxes:', document.querySelectorAll('.feedback-select-checkbox'));
    console.log('Checked checkboxes:', document.querySelectorAll('.feedback-select-checkbox:checked'));
    
    // Test selecting the first checkbox
    const firstCheckbox = document.querySelector('.feedback-select-checkbox');
    if (firstCheckbox) {
        firstCheckbox.checked = true;
        updateSelection();
        console.log('First checkbox selected, calling deleteSelected...');
        deleteSelected();
    } else {
        console.log('No checkboxes found');
    }
}

function clearSelection() {
    console.log('Clearing all selections');
    
    // Uncheck all individual checkboxes
    document.querySelectorAll('.feedback-select-checkbox').forEach(cb => cb.checked = false);
    
    // Uncheck select all checkbox
    const selectAllCheckbox = document.getElementById('select-all-feedback');
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    
    // Hide bulk actions
    const bulkActions = document.getElementById('feedback-bulk-actions');
    if (bulkActions) bulkActions.classList.add('hidden');
}

// Toggle select all functionality
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-feedback');
    const individualCheckboxes = document.querySelectorAll('.feedback-select-checkbox');
    
    if (!selectAllCheckbox) {
        console.log('Select all checkbox not found');
        return;
    }
    
    console.log('Toggle select all - checked:', selectAllCheckbox.checked);
    
    // Update all individual checkboxes to match the select all checkbox
    individualCheckboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
    });
    
    // Update the selection display - this will handle showing/hiding delete options
    updateSelection();
}

// Delete all feedback function
async function deleteAllFeedback() {
    if (myFeedback.length === 0) {
        alert('No feedback to delete');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ALL ${myFeedback.length} feedback items? This action cannot be undone.`)) {
        try {
            const feedbackIds = myFeedback.map(fb => fb.id);
            
            const response = await fetch('/api/feedback', {
                method: 'DELETE',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ feedbackIds: feedbackIds, student_id: currentStudent.id })
            });
            
            if (response.ok) {
                const result = await response.json();
                
                // Clear the feedback list
                myFeedback = [];
                
                // Update the display
                displayFeedbackCards();
                
                // Update count
                document.getElementById('feedback-count').textContent = '0';
                
                // Hide all action buttons
                const bulkActions = document.getElementById('feedback-bulk-actions');
                const deleteAllBtn = document.getElementById('delete-all-btn');
                const selectAllCheckbox = document.getElementById('select-all-feedback');
                
                if (bulkActions) bulkActions.classList.add('d-none');
                if (deleteAllBtn) deleteAllBtn.style.display = 'none';
                if (selectAllCheckbox) selectAllCheckbox.checked = false;
                
                showSuccessNotification(`All ${result.deletedCount} feedback items deleted successfully`);
            } else {
                const error = await response.json();
                alert('Error deleting all feedback: ' + (error.error || 'Unknown error'));
            }
        } catch (error) {
            console.error('Error deleting all feedback:', error);
            alert('Error deleting all feedback: ' + error.message);
        }
    }
}

function displayFeedbackCards() {
    console.log('=== DISPLAYING FEEDBACK CARDS ===');
    console.log('My feedback array:', myFeedback);
    console.log('Events array:', events);
    
    const feedbackList = document.getElementById('feedback-list');
    
    if (!feedbackList) {
        console.error('Feedback list element not found');
        return;
    }
    
    // Reset select all checkbox and delete all button
    const selectAllCheckbox = document.getElementById('select-all-feedback');
    const deleteAllBtn = document.getElementById('delete-all-btn');
    const bulkActions = document.getElementById('feedback-bulk-actions');
    
    if (selectAllCheckbox) selectAllCheckbox.checked = false;
    if (deleteAllBtn) deleteAllBtn.style.display = 'none';
    if (bulkActions) bulkActions.classList.add('d-none');
    
    if (myFeedback.length === 0) {
        console.log('No feedback to display, showing empty state');
        feedbackList.innerHTML = `
            <div class="text-center py-12 col-span-full">
                <div class="w-20 h-20 bg-purple-100 rounded-full flex items-center justify-center mx-auto mb-4">
                    <i class="fas fa-envelope text-2xl text-purple-600"></i>
                </div>
                <h3 class="text-lg font-semibold text-gray-900 mb-2">No feedback yet</h3>
                <p class="text-gray-500 mb-6">Once you start receiving feedback, it will appear here. Stay tuned!</p>
                <button class="bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-all duration-200 flex items-center mx-auto" onclick="refreshAllData()">
                    <i class="fas fa-sync-alt mr-2"></i>Refresh for Updates
                </button>
            </div>
        `;
        return;
    }
    
    // Simple test - create basic HTML without complex template literals
    let html = '';
    myFeedback.forEach((fb, index) => {
        console.log(`Processing feedback ${index + 1}:`, fb);
        const event = events.find(e => e.id == fb.event_id);
        console.log(`Found event for feedback ${fb.id}:`, event);
        if (!event) {
            console.log(`No event found for feedback ${fb.id}, skipping`);
            return;
        }
        
        const stars = '★'.repeat(fb.rating) + '☆'.repeat(5 - fb.rating);
        const eventDate = new Date(event.date);
        
        html += '<div class="bg-white rounded-2xl shadow-lg border border-gray-100 overflow-hidden transition-all duration-300 hover:scale-105 hover:shadow-xl" data-feedback-id="' + fb.id + '">';
        html += '<div class="bg-gradient-to-r from-amber-500 to-orange-500 h-24 flex items-center justify-center">';
        html += '<i class="fas fa-star text-white text-2xl"></i>';
        html += '</div>';
        html += '<div class="p-4">';
        html += '<div class="flex justify-between items-start mb-2">';
        html += '<h6 class="text-lg font-bold text-gray-900 line-clamp-2">' + event.title + '</h6>';
        html += '<div class="text-right ml-2">';
        html += '<input type="checkbox" class="w-4 h-4 text-blue-500 bg-gray-100 border-gray-300 rounded focus:ring-blue-500 focus:ring-2 feedback-select-checkbox" data-feedback-id="' + fb.id + '" onchange="updateSelection()">';
        html += '</div>';
        html += '</div>';
        html += '<p class="text-gray-600 text-sm mb-3 line-clamp-2">' + (event.description || 'No description available') + '</p>';
        html += '<div class="space-y-2 mb-4">';
        html += '<div class="flex items-center text-sm text-gray-600">';
        html += '<i class="fas fa-calendar w-4 mr-2"></i>';
        html += '<span>' + eventDate.toLocaleDateString() + '</span>';
        html += '</div>';
        html += '<div class="flex items-center text-sm text-gray-600">';
        html += '<i class="fas fa-clock w-4 mr-2"></i>';
        html += '<span>' + event.time + '</span>';
        html += '</div>';
        html += '<div class="flex items-center text-sm text-gray-600">';
        html += '<i class="fas fa-map-marker-alt w-4 mr-2"></i>';
        html += '<span class="truncate">' + event.location + '</span>';
        html += '</div>';
        html += '</div>';
        html += '<div class="mb-3">';
        html += '<div class="flex items-center justify-between">';
        html += '<div class="flex items-center">';
        html += '<div class="text-amber-500 text-lg">' + stars + '</div>';
        html += '<span class="text-gray-600 text-sm ml-2">(' + fb.rating + '/5)</span>';
        html += '</div>';
        html += '<button class="w-8 h-8 bg-red-500 hover:bg-red-600 text-white rounded-xl flex items-center justify-center transition-all duration-300 hover:scale-105" onclick="deleteFeedback(' + fb.id + ')" title="Delete this feedback">';
        html += '<i class="fas fa-trash text-xs"></i>';
        html += '</button>';
        html += '</div>';
        html += '</div>';
        if (fb.comment) {
            html += '<div class="bg-gray-50 rounded-lg p-3 mb-3">';
            html += '<p class="text-gray-700 text-sm italic">"' + fb.comment + '"</p>';
            html += '</div>';
        }
        html += '<div class="flex items-center justify-between text-xs text-gray-500">';
        html += '<span><i class="fas fa-clock mr-1"></i>Submitted: ' + new Date(fb.submitted_at).toLocaleDateString() + '</span>';
        html += '</div>';
        html += '</div>';
        html += '</div>';
    });
    
    console.log('Generated HTML length:', html.length);
    console.log('Setting innerHTML...');
    
    feedbackList.innerHTML = html;
    
    console.log('Feedback cards displayed successfully');
    
    // Event listeners are now handled via onclick attributes
}

// Attendance Functions
async function loadAttendanceData() {
    if (!currentStudent) return;
    
    try {
        // Clear existing attendance data
        attendanceData = [];
        
        // Load attendance for all events the student is registered for
        const eventIds = myRegistrations.map(reg => reg.event_id);
        
        for (const eventId of eventIds) {
            const response = await fetch(`/api/attendance/event/${eventId}`);
            if (response.ok) {
                const eventAttendance = await response.json();
                const studentAttendance = eventAttendance.find(att => att.id == currentStudent.id);
                if (studentAttendance) {
                    attendanceData.push({
                        event_id: eventId,
                        status: studentAttendance.attendance_status
                    });
                }
            }
        }
        
        console.log('Loaded attendance data:', attendanceData);
        
        // Always refresh My Events display to show updated attendance
        loadMyEvents();
    } catch (error) {
        console.error('Error loading attendance data:', error);
    }
}

function getAttendanceStatus(eventId) {
    console.log('Getting attendance status for event:', eventId);
    console.log('Current attendance data:', attendanceData);
    const attendance = attendanceData.find(att => att.event_id == eventId);
    console.log('Found attendance record:', attendance);
    return attendance ? attendance.status : null;
}

// Debug function to check current state
function debugAttendanceState() {
    console.log('=== ATTENDANCE DEBUG STATE ===');
    console.log('Current Student:', currentStudent);
    console.log('My Registrations:', myRegistrations);
    console.log('Attendance Data:', attendanceData);
    console.log('Events:', events);
    console.log('Current Section:', currentSection);
    
    if (myRegistrations.length > 0) {
        console.log('Checking attendance for each registration:');
        myRegistrations.forEach(reg => {
            const event = events.find(e => e.id == reg.event_id);
            const attendanceStatus = getAttendanceStatus(reg.event_id);
            console.log(`- Event ${reg.event_id} (${event ? event.title : 'Unknown'}): ${attendanceStatus || 'No attendance data'}`);
        });
    }
    console.log('=== END DEBUG ===');
}

// Make it available globally for testing
window.debugAttendanceState = debugAttendanceState;

// Test WebSocket connection
window.testWebSocket = function() {
    console.log('=== TESTING WEBSOCKET CONNECTION ===');
    console.log('Socket connected:', socket ? socket.connected : 'No socket');
    console.log('Current student:', currentStudent);
    console.log('Socket ID:', socket ? socket.id : 'No socket');
    
    if (socket) {
        // Test sending a message
        socket.emit('test-message', { message: 'Hello from mobile app' });
        console.log('Test message sent');
    }
    console.log('=== END WEBSOCKET TEST ===');
};

