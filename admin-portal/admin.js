// Admin Portal JavaScript
let currentSection = 'dashboard';
let events = [];
let students = [];
let registrations = [];
let socket = null;

// Initialize the application
document.addEventListener('DOMContentLoaded', function() {
    initializeWebSocket();
    loadDashboard();
    loadEvents();
    loadRegistrations();
    loadStudents();
    loadTopStudents();
    loadInstitutes();
    
    // Handle window resize
    window.addEventListener('resize', function() {
        if (window.innerWidth > 768) {
            closeSidebar();
        }
    });
    
    // Setup mobile navigation buttons
    setupMobileNavigation();
    
    // Note: Form submission is handled by the Save Event button onclick
    
    // Note: Save Event button uses onclick attribute, no need for additional listeners
});

// Initialize WebSocket connection
function initializeWebSocket() {
    socket = io();
    
    socket.on('connect', () => {
        console.log('Connected to WebSocket server');
        // Join admin room for real-time updates
        socket.emit('join-admin');
    });
    
    socket.on('disconnect', () => {
        console.log('Disconnected from WebSocket server');
    });
    
    // Listen for attendance updates
    socket.on('attendance-updated', (data) => {
        console.log('=== ADMIN RECEIVED ATTENDANCE UPDATE ===');
        console.log('Received attendance update:', data);
        console.log('Current section:', currentSection);
        console.log('Current attendance event ID:', currentAttendanceEventId);
        console.log('Event ID in update:', data.eventId);
        
        // Update attendance table if we're viewing that event
        if (currentSection === 'attendance' && currentAttendanceEventId == data.eventId) {
            console.log('Updating attendance table for event:', data.eventId);
            updateAttendanceTable(data.attendanceData, data.eventId);
        } else {
            console.log('Not updating attendance table - section:', currentSection, 'event match:', currentAttendanceEventId == data.eventId);
        }
        
        // Update statistics if we're on dashboard or reports
        if (currentSection === 'dashboard' || currentSection === 'reports') {
            refreshAllStatistics();
        }
        console.log('=== END ADMIN ATTENDANCE UPDATE ===');
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
                loadRegistrations();
                break;
            case 'students':
                loadStudents();
                break;
        }
    });
}

// Setup mobile navigation
function setupMobileNavigation() {
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.addEventListener('click', function(e) {
            e.preventDefault();
            const section = this.getAttribute('data-section');
            if (section) {
                showSection(section);
            }
        });
    });
}

// Mobile Navigation Functions
function toggleSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.toggle('show');
    overlay.classList.toggle('show');
}

function closeSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('overlay');
    sidebar.classList.remove('show');
    overlay.classList.remove('show');
}

// Navigation functions
function showSection(section) {
    // Hide all sections
    document.querySelectorAll('[id$="-section"]').forEach(el => {
        el.style.display = 'none';
    });
    
    // Show selected section
    document.getElementById(section + '-section').style.display = 'block';
    
    // Update active nav item in sidebar
    document.querySelectorAll('.nav-link').forEach(link => {
        link.classList.remove('active');
    });
    document.querySelectorAll('.nav-link').forEach(link => {
        if (link.getAttribute('onclick') && link.getAttribute('onclick').includes(section)) {
            link.classList.add('active');
        }
    });
    
    // Update active mobile bottom nav button
    document.querySelectorAll('.mobile-nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    const activeBtn = document.querySelector(`[data-section="${section}"]`);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
    
    currentSection = section;
    
    // Update mobile section title and subtitle
    const sectionInfo = {
        'dashboard': { title: 'Dashboard', subtitle: 'Overview and statistics' },
        'events': { title: 'Manage Events', subtitle: 'Create and manage campus events' },
        'registrations': { title: 'Student Registrations', subtitle: 'View student event registrations' },
        'attendance': { title: 'Attendance Management', subtitle: 'Track event attendance' },
        'reports': { title: 'Reports & Analytics', subtitle: 'View detailed reports and insights' }
    };
    
    const mobileTitle = document.getElementById('mobile-section-title');
    const mobileSubtitle = document.getElementById('mobile-section-subtitle');
    
    if (mobileTitle && mobileSubtitle) {
        const info = sectionInfo[section] || { title: section, subtitle: '' };
        mobileTitle.textContent = info.title;
        mobileSubtitle.textContent = info.subtitle;
    }
    
    // Close mobile sidebar after selection
    if (window.innerWidth <= 768) {
        closeSidebar();
    }
    
    // Load section-specific data
    switch(section) {
        case 'dashboard':
            loadDashboard();
            break;
        case 'events':
            loadEvents();
            break;
        case 'registrations':
            loadRegistrations();
            break;
        case 'attendance':
            loadAttendanceEvents();
            break;
        case 'reports':
            loadReports();
            break;
    }
}

// Load institutes for dropdowns
async function loadInstitutes() {
    try {
        const response = await fetch('/api/institutes');
        const institutes = await response.json();
        
        // Populate event institute dropdown
        const eventInstituteSelect = document.getElementById('eventInstitute');
        if (eventInstituteSelect) {
            eventInstituteSelect.innerHTML = '<option value="">Select Institute</option>' +
                institutes.map(institute => `<option value="${institute}">${institute}</option>`).join('');
        }
    } catch (error) {
        console.error('Error loading institutes:', error);
    }
}

// Dashboard functions
async function loadDashboard() {
    try {
        const [eventsRes, studentsRes, registrationsRes] = await Promise.all([
            fetch('/api/events'),
            fetch('/api/students'),
            fetch('/api/registrations')
        ]);
        
        const eventsData = await eventsRes.json();
        const studentsData = await studentsRes.json();
        const registrationsData = await registrationsRes.json();
        
        // Update stats with real data
        document.getElementById('total-events').textContent = eventsData.length;
        document.getElementById('total-students').textContent = studentsData.length;
        document.getElementById('total-registrations').textContent = registrationsData.length;
        
        // Calculate average rating
        let totalRating = 0;
        let ratingCount = 0;
        for (let event of eventsData) {
            const feedbackRes = await fetch(`/api/feedback/${event.id}`);
            const feedback = await feedbackRes.json();
            if (feedback.length > 0) {
                const avgRating = feedback.reduce((sum, f) => sum + f.rating, 0) / feedback.length;
                totalRating += avgRating;
                ratingCount++;
            }
        }
        const overallAvgRating = ratingCount > 0 ? (totalRating / ratingCount).toFixed(1) : '0.0';
        document.getElementById('avg-rating').textContent = overallAvgRating;
        
        // Show recent events
        const recentEvents = eventsData.slice(0, 5);
        if (recentEvents.length > 0) {
            const recentEventsHtml = recentEvents.map(event => `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <h6 class="mb-0">${event.title}</h6>
                        <small class="text-muted">${event.date} at ${event.time}</small>
                    </div>
                    <span class="badge bg-primary">${event.location}</span>
                </div>
            `).join('');
            document.getElementById('recent-events').innerHTML = recentEventsHtml;
        } else {
            document.getElementById('recent-events').innerHTML = '<p class="text-muted">No events created yet. <a href="#" onclick="showSection(\'events\')">Create your first event</a></p>';
        }
        
    } catch (error) {
        console.error('Error loading dashboard:', error);
    }
}

// Events functions
async function loadEvents() {
    try {
        const response = await fetch('/api/events');
        events = await response.json();
        
        const eventsTable = document.getElementById('events-table');
        if (events.length === 0) {
            eventsTable.innerHTML = '<tr><td colspan="7" class="text-center">No events found</td></tr>';
            return;
        }
        
        eventsTable.innerHTML = events.map(event => `
            <tr>
                <td>${event.title}</td>
                <td>${event.date}</td>
                <td>${event.time}</td>
                <td>${event.location}</td>
                <td>${event.institute || 'N/A'}</td>
                <td>${event.max_capacity}</td>
                <td>
                    <button class="btn btn-sm btn-outline-primary me-1" onclick="editEvent(${event.id})">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteEvent(${event.id})">
                        <i class="fas fa-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
        
    } catch (error) {
        console.error('Error loading events:', error);
    }
}

function showEventModal(eventId = null) {
    const modal = new bootstrap.Modal(document.getElementById('eventModal'));
    const form = document.getElementById('eventForm');
    
    // Load institutes when modal opens
    loadInstitutes();
    
    if (eventId) {
        const event = events.find(e => e.id === eventId);
        document.getElementById('eventModalTitle').textContent = 'Edit Event';
        document.getElementById('eventId').value = event.id;
        document.getElementById('eventTitle').value = event.title;
        document.getElementById('eventDescription').value = event.description || '';
        document.getElementById('eventDate').value = event.date;
        document.getElementById('eventTime').value = event.time;
        document.getElementById('eventLocation').value = event.location;
        document.getElementById('eventInstitute').value = event.institute || '';
        document.getElementById('eventCapacity').value = event.max_capacity;
    } else {
        document.getElementById('eventModalTitle').textContent = 'Create Event';
        form.reset();
        document.getElementById('eventId').value = '';
    }
    
    // Note: Save Event button uses onclick attribute, no need for additional listeners
    
    modal.show();
}

async function saveEvent() {
    console.log('🔄 Save Event function called - Button clicked!');
    
    // Prevent duplicate submissions
    const saveButton = document.querySelector('button[onclick="saveEvent()"]');
    if (saveButton && saveButton.disabled) {
        console.log('⚠️ Save button already processing, ignoring duplicate click');
        return;
    }
    
    if (saveButton) {
        saveButton.disabled = true;
        saveButton.textContent = 'Saving...';
    }
    
    const form = document.getElementById('eventForm');
    const formData = new FormData(form);
    
    const eventData = {
        title: document.getElementById('eventTitle').value,
        description: document.getElementById('eventDescription').value,
        date: document.getElementById('eventDate').value,
        time: document.getElementById('eventTime').value,
        location: document.getElementById('eventLocation').value,
        institute: document.getElementById('eventInstitute').value,
        max_capacity: parseInt(document.getElementById('eventCapacity').value)
    };
    
    console.log('📝 Event data:', eventData);
    
    // Validate required fields
    if (!eventData.title || !eventData.date || !eventData.time || !eventData.location) {
        alert('Please fill in all required fields:\n- Event Title\n- Date\n- Time\n- Location');
        console.log('❌ Validation failed - missing required fields');
        return;
    }
    
    console.log('✅ Form validation passed');
    
    const eventId = document.getElementById('eventId').value;
    const url = eventId ? `/api/events/${eventId}` : '/api/events';
    const method = eventId ? 'PUT' : 'POST';
    
    console.log('🌐 Making request to:', url, 'Method:', method);
    
    try {
        const response = await fetch(url, {
            method: method,
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(eventData)
        });
        
        console.log('📡 Response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('✅ Event saved successfully:', result);
            
            // Close modal
            const modal = bootstrap.Modal.getInstance(document.getElementById('eventModal'));
            if (modal) {
                modal.hide();
                console.log('✅ Modal closed');
            } else {
                console.log('⚠️ Modal instance not found, trying alternative method');
                const modalElement = document.getElementById('eventModal');
                const modalInstance = new bootstrap.Modal(modalElement);
                modalInstance.hide();
            }
            
            // Reset form
            form.reset();
            console.log('✅ Form reset');
            
            // Reload data
            loadEvents();
            loadDashboard();
            console.log('✅ Data reloaded');
            
            // Refresh event filter if we're on the registrations page
            if (document.getElementById('registrations-section').style.display !== 'none') {
                await refreshEventFilter();
                console.log('✅ Event filter refreshed');
            }
            
            alert('Event saved successfully!');
        } else {
            const errorText = await response.text();
            console.error('❌ Error response:', response.status, errorText);
            alert(`Error saving event: ${response.status} - ${errorText}`);
        }
    } catch (error) {
        console.error('❌ Error saving event:', error);
        alert(`Error saving event: ${error.message}`);
    } finally {
        // Re-enable the save button
        if (saveButton) {
            saveButton.disabled = false;
            saveButton.textContent = 'Save Event';
        }
    }
}

function editEvent(eventId) {
    showEventModal(eventId);
}

async function deleteEvent(eventId) {
    if (confirm('Are you sure you want to delete this event?')) {
        try {
            const response = await fetch(`/api/events/${eventId}`, {
                method: 'DELETE'
            });
            
            if (response.ok) {
                loadEvents();
                loadDashboard();
                alert('Event deleted successfully!');
            } else {
                alert('Error deleting event');
            }
        } catch (error) {
            console.error('Error deleting event:', error);
            alert('Error deleting event');
        }
    }
}

// Global variables for filtering
let allRegistrations = [];
let filteredRegistrations = [];
let selectedRegistrations = new Set(); // Track selected registration IDs

// Registrations functions
async function loadRegistrations() {
    try {
        const response = await fetch('/api/registrations');
        allRegistrations = await response.json();
        filteredRegistrations = [...allRegistrations];
        
        // Populate event filter dropdown
        await populateEventFilter();
        
        // Display registrations
        displayRegistrations();
        
    } catch (error) {
        console.error('Error loading registrations:', error);
    }
}

// Populate the event filter dropdown
async function populateEventFilter() {
    const eventFilter = document.getElementById('event-filter');
    
    try {
        // Fetch all events from the events API
        const response = await fetch('/api/events');
        const allEvents = await response.json();
        
        // Clear existing options except "All Events"
        eventFilter.innerHTML = '<option value="">All Events</option>';
        
        // Sort events by date (newest first)
        const sortedEvents = allEvents.sort((a, b) => new Date(b.date) - new Date(a.date));
        
        // Add event options with more details
        sortedEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            
            // Format date for display
            const eventDate = new Date(event.date);
            const formattedDate = eventDate.toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
            
            // Count registrations for this event
            const registrationCount = allRegistrations.filter(reg => reg.event_id == event.id).length;
            
            option.textContent = `${event.title} - ${formattedDate} (${registrationCount} registrations)`;
            eventFilter.appendChild(option);
        });
        
        console.log(`Loaded ${allEvents.length} events for filter dropdown`);
        
    } catch (error) {
        console.error('Error loading events for filter:', error);
        // Fallback to events from registrations if API fails
        const uniqueEvents = [...new Set(allRegistrations.map(reg => ({
            id: reg.event_id,
            title: reg.event_title,
            date: reg.date
        })))];
        
        eventFilter.innerHTML = '<option value="">All Events</option>';
        uniqueEvents.forEach(event => {
            const option = document.createElement('option');
            option.value = event.id;
            option.textContent = `${event.title} - ${event.date}`;
            eventFilter.appendChild(option);
        });
    }
}

// Display registrations in the table
function displayRegistrations() {
    const registrationsTable = document.getElementById('registrations-table');
    
    if (filteredRegistrations.length === 0) {
        registrationsTable.innerHTML = '<tr><td colspan="8" class="text-center">No registrations found</td></tr>';
        return;
    }
    
    registrationsTable.innerHTML = filteredRegistrations.map(reg => `
        <tr>
            <td>
                <input type="checkbox" class="registration-checkbox" value="${reg.id}" onchange="updateSelection()" ${selectedRegistrations.has(reg.id) ? 'checked' : ''}>
            </td>
            <td>${reg.student_name}</td>
            <td>${reg.student_id_string}</td>
            <td>${reg.event_title}</td>
            <td>${reg.date} at ${reg.time}</td>
            <td>${new Date(reg.registered_at).toLocaleString()}</td>
            <td>
                <span class="badge ${reg.verified ? 'bg-success' : 'bg-warning'}">
                    ${reg.verified ? 'Verified' : 'Pending'}
                </span>
                ${reg.verified && reg.verified_at ? `<br><small class="text-muted">${new Date(reg.verified_at).toLocaleString()}</small>` : ''}
            </td>
            <td>
                <div class="btn-group" role="group">
                    ${!reg.verified ? `
                        <button class="btn btn-success btn-sm" onclick="verifyRegistration(${reg.id})" title="Verify">
                            <i class="fas fa-check"></i>
                        </button>
                    ` : ''}
                    <button class="btn btn-danger btn-sm" onclick="deleteRegistration(${reg.id}, '${reg.student_name}', '${reg.event_title}')" title="Delete">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join('');
}

// Filter registrations by selected event
function filterRegistrationsByEvent() {
    const eventFilter = document.getElementById('event-filter');
    const selectedEventId = eventFilter.value;
    
    if (selectedEventId === '') {
        // Show all registrations
        filteredRegistrations = [...allRegistrations];
    } else {
        // Filter by selected event
        filteredRegistrations = allRegistrations.filter(reg => reg.event_id == selectedEventId);
    }
    
    // Update display
    displayRegistrations();
    
    // Update the table header to show filter status
    updateFilterStatus();
}

// Clear event filter
function clearEventFilter() {
    const eventFilter = document.getElementById('event-filter');
    eventFilter.value = '';
    filteredRegistrations = [...allRegistrations];
    displayRegistrations();
    updateFilterStatus();
}

// Checkbox management functions
function toggleSelectAll() {
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    const checkboxes = document.querySelectorAll('.registration-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = selectAllCheckbox.checked;
        if (selectAllCheckbox.checked) {
            selectedRegistrations.add(parseInt(checkbox.value));
        } else {
            selectedRegistrations.delete(parseInt(checkbox.value));
        }
    });
    
    updateBulkActions();
}

function updateSelection() {
    const checkboxes = document.querySelectorAll('.registration-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    // Update selected registrations set
    selectedRegistrations.clear();
    checkboxes.forEach(checkbox => {
        if (checkbox.checked) {
            selectedRegistrations.add(parseInt(checkbox.value));
        }
    });
    
    // Update select all checkbox state
    const totalCheckboxes = checkboxes.length;
    const checkedCheckboxes = selectedRegistrations.size;
    
    if (checkedCheckboxes === 0) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = false;
    } else if (checkedCheckboxes === totalCheckboxes) {
        selectAllCheckbox.indeterminate = false;
        selectAllCheckbox.checked = true;
    } else {
        selectAllCheckbox.indeterminate = true;
        selectAllCheckbox.checked = false;
    }
    
    updateBulkActions();
}

function updateBulkActions() {
    const bulkActions = document.getElementById('bulk-actions');
    const selectedCount = document.getElementById('selected-count');
    
    if (selectedRegistrations.size > 0) {
        bulkActions.style.display = 'block';
        selectedCount.textContent = selectedRegistrations.size;
    } else {
        bulkActions.style.display = 'none';
    }
}

function clearSelection() {
    selectedRegistrations.clear();
    const checkboxes = document.querySelectorAll('.registration-checkbox');
    const selectAllCheckbox = document.getElementById('select-all-checkbox');
    
    checkboxes.forEach(checkbox => {
        checkbox.checked = false;
    });
    
    selectAllCheckbox.checked = false;
    selectAllCheckbox.indeterminate = false;
    
    updateBulkActions();
}

// Verify selected registrations
async function verifySelectedRegistrations() {
    if (selectedRegistrations.size === 0) {
        alert('No registrations selected');
        return;
    }
    
    const selectedCount = selectedRegistrations.size;
    if (!confirm(`Are you sure you want to verify ${selectedCount} selected registration(s)?`)) {
        return;
    }
    
    try {
        // Get details of selected registrations for confirmation
        const selectedRegs = filteredRegistrations.filter(reg => selectedRegistrations.has(reg.id));
        const studentNames = selectedRegs.map(reg => reg.student_name).join(', ');
        
        // Verify each selected registration
        const verifyPromises = Array.from(selectedRegistrations).map(registrationId => 
            fetch(`/api/registrations/${registrationId}/verify`, {
                method: 'PUT'
            })
        );
        
        const responses = await Promise.all(verifyPromises);
        const failedVerifies = responses.filter(response => !response.ok);
        
        if (failedVerifies.length === 0) {
            alert(`Successfully verified ${selectedCount} registration(s)! Students: ${studentNames}`);
            
            // Update verification status in our data
            allRegistrations.forEach(reg => {
                if (selectedRegistrations.has(reg.id)) {
                    reg.verified = 1;
                    reg.verified_at = new Date().toISOString();
                }
            });
            
            // Clear selection and refresh display
            clearSelection();
            filterRegistrationsByEvent();
        } else {
            alert(`Verified ${selectedCount - failedVerifies.length} of ${selectedCount} registrations. Some verifications failed.`);
        }
        
    } catch (error) {
        console.error('Error verifying selected registrations:', error);
        alert('Error verifying selected registrations: ' + error.message);
    }
}

// Delete selected registrations
async function deleteSelectedRegistrations() {
    if (selectedRegistrations.size === 0) {
        alert('No registrations selected');
        return;
    }
    
    const selectedCount = selectedRegistrations.size;
    if (!confirm(`Are you sure you want to delete ${selectedCount} selected registration(s)? This action cannot be undone and all students will be notified.`)) {
        return;
    }
    
    if (!confirm(`This will permanently delete ${selectedCount} student registration(s). Are you absolutely sure?`)) {
        return;
    }
    
    try {
        // Get details of selected registrations for confirmation
        const selectedRegs = filteredRegistrations.filter(reg => selectedRegistrations.has(reg.id));
        const studentNames = selectedRegs.map(reg => reg.student_name).join(', ');
        
        // Delete each selected registration
        const deletePromises = Array.from(selectedRegistrations).map(registrationId => 
            fetch(`/api/registrations/${registrationId}`, {
                method: 'DELETE'
            })
        );
        
        const responses = await Promise.all(deletePromises);
        const failedDeletes = responses.filter(response => !response.ok);
        
        if (failedDeletes.length === 0) {
            alert(`Successfully deleted ${selectedCount} registration(s)! Students: ${studentNames}`);
            
            // Remove deleted registrations from our data
            allRegistrations = allRegistrations.filter(reg => !selectedRegistrations.has(reg.id));
            
            // Clear selection and refresh display
            clearSelection();
            filterRegistrationsByEvent();
        } else {
            alert(`Deleted ${selectedCount - failedDeletes.length} of ${selectedCount} registrations. Some deletions failed.`);
        }
        
    } catch (error) {
        console.error('Error deleting selected registrations:', error);
        alert('Error deleting selected registrations: ' + error.message);
    }
}

// Refresh event filter dropdown (useful when new events are added)
async function refreshEventFilter() {
    const refreshBtn = document.querySelector('[onclick="refreshEventFilter()"]');
    const originalText = refreshBtn.innerHTML;
    
    // Show loading state
    refreshBtn.innerHTML = '<i class="fas fa-spinner fa-spin me-1"></i>Refreshing...';
    refreshBtn.disabled = true;
    
    try {
        await populateEventFilter();
        console.log('Event filter refreshed with latest events');
        
        // Show success state briefly
        refreshBtn.innerHTML = '<i class="fas fa-check me-1"></i>Refreshed!';
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 1500);
        
    } catch (error) {
        console.error('Error refreshing event filter:', error);
        
        // Show error state
        refreshBtn.innerHTML = '<i class="fas fa-exclamation-triangle me-1"></i>Error';
        setTimeout(() => {
            refreshBtn.innerHTML = originalText;
            refreshBtn.disabled = false;
        }, 2000);
    }
}

// Update filter status display
function updateFilterStatus() {
    const eventFilter = document.getElementById('event-filter');
    const selectedEventId = eventFilter.value;
    const countElement = document.getElementById('registration-count');
    
    if (countElement) {
        const totalCount = allRegistrations.length;
        const filteredCount = filteredRegistrations.length;
        
        if (selectedEventId) {
            const selectedEvent = allRegistrations.find(reg => reg.event_id == selectedEventId);
            const eventTitle = selectedEvent ? selectedEvent.event_title : 'Selected Event';
            countElement.textContent = `Showing ${filteredCount} of ${totalCount} registrations for "${eventTitle}"`;
        } else {
            countElement.textContent = `Showing ${filteredCount} of ${totalCount} registrations (all events)`;
        }
    }
    
    console.log(`Showing ${filteredRegistrations.length} registrations${selectedEventId ? ` for event ID ${selectedEventId}` : ' (all events)'}`);
}

// Verify a single registration
async function verifyRegistration(registrationId) {
    if (!confirm('Are you sure you want to verify this registration?')) {
        return;
    }
    
    try {
        console.log('Attempting to verify registration:', registrationId);
        const response = await fetch(`/api/registrations/${registrationId}/verify`, {
            method: 'PUT'
        });
        
        console.log('Verify response status:', response.status);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Verify successful:', result);
            alert('Registration verified successfully!');
            
            // Update the registration in our data
            const regIndex = allRegistrations.findIndex(reg => reg.id === registrationId);
            if (regIndex !== -1) {
                allRegistrations[regIndex].verified = 1;
                allRegistrations[regIndex].verified_at = new Date().toISOString();
            }
            
            // Refresh the filtered display
            filterRegistrationsByEvent();
        } else {
            const responseText = await response.text();
            console.log('Verify error response text:', responseText);
            try {
                const error = JSON.parse(responseText);
                alert('Error verifying registration: ' + error.error);
            } catch (parseError) {
                console.error('Failed to parse verify error response:', parseError);
                alert('Error verifying registration: ' + responseText);
            }
        }
    } catch (error) {
        console.error('Error verifying registration:', error);
        alert('Error verifying registration: ' + error.message);
    }
}


// Delete a single registration
async function deleteRegistration(registrationId, studentName, eventTitle) {
    if (!confirm(`Are you sure you want to delete the registration for ${studentName} for event "${eventTitle}"? The student will be notified of this removal.`)) {
        return;
    }
    
    try {
        console.log('Attempting to delete registration:', registrationId);
        const response = await fetch(`/api/registrations/${registrationId}`, {
            method: 'DELETE'
        });
        
        console.log('Response status:', response.status);
        console.log('Response headers:', response.headers);
        
        if (response.ok) {
            const result = await response.json();
            console.log('Delete successful:', result);
            alert(`Registration deleted successfully! Student ${result.student_name} has been notified.`);
            
            // Remove the registration from our data
            allRegistrations = allRegistrations.filter(reg => reg.id !== registrationId);
            
            // Remove from selection if it was selected
            selectedRegistrations.delete(registrationId);
            
            // Refresh the filtered display
            filterRegistrationsByEvent();
        } else {
            const responseText = await response.text();
            console.log('Error response text:', responseText);
            try {
                const error = JSON.parse(responseText);
                alert('Error deleting registration: ' + error.error);
            } catch (parseError) {
                console.error('Failed to parse error response:', parseError);
                alert('Error deleting registration: ' + responseText);
            }
        }
    } catch (error) {
        console.error('Error deleting registration:', error);
        alert('Error deleting registration: ' + error.message);
    }
}


// Attendance functions
async function loadAttendanceEvents() {
    try {
        const response = await fetch('/api/events');
        const eventsData = await response.json();
        
        const select = document.getElementById('attendance-event-select');
        select.innerHTML = '<option value="">Select an event to view attendance</option>' +
            eventsData.map(event => `<option value="${event.id}">${event.title} - ${event.date}</option>`).join('');
        
        select.addEventListener('change', function() {
            if (this.value) {
                loadEventAttendance();
            } else {
                document.getElementById('attendance-table').innerHTML = 
                    '<tr><td colspan="5" class="text-center">Select an event to view attendance</td></tr>';
            }
        });
        
    } catch (error) {
        console.error('Error loading attendance events:', error);
    }
}


// Reports & Analytics functions
async function loadReports() {
    try {
        // Load overview statistics
        await loadAnalyticsOverview();
        
        // Load events for report selection
        const eventsResponse = await fetch('/api/events');
        const eventsData = await eventsResponse.json();
        
        const select = document.getElementById('report-event-select');
        select.innerHTML = '<option value="">Select an event for detailed analysis</option>' +
            eventsData.map(event => `<option value="${event.id}">${event.title} - ${event.date}</option>`).join('');
        
        // Load all analytics sections
        await Promise.all([
            loadTopActiveStudents(),
            loadEventTypeAnalysis(),
            loadEventPopularityReport(),
            loadTopParticipationReport()
        ]);
        
    } catch (error) {
        console.error('Error loading reports:', error);
    }
}

// Load analytics overview cards
async function loadAnalyticsOverview() {
    try {
        const response = await fetch('/api/analytics/overview');
        const data = await response.json();
        
        document.getElementById('total-events-count').textContent = data.totalEvents || 0;
        document.getElementById('total-students-count').textContent = data.totalStudents || 0;
        document.getElementById('total-registrations-count').textContent = data.totalRegistrations || 0;
        document.getElementById('attendance-rate').textContent = `${data.attendanceRate || 0}%`;
        
    } catch (error) {
        console.error('Error loading analytics overview:', error);
        // Show error state
        document.getElementById('total-events-count').textContent = '0';
        document.getElementById('total-students-count').textContent = '0';
        document.getElementById('total-registrations-count').textContent = '0';
        document.getElementById('attendance-rate').textContent = '0%';
    }
}

// Load top active students
async function loadTopActiveStudents() {
    try {
        const response = await fetch('/api/analytics/top-active-students');
        const data = await response.json();
        
        const container = document.getElementById('top-active-students');
        
        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted">No student activity data available</p>';
            return;
        }
        
        const html = data.map((student, index) => `
            <div class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-light">
                <div class="d-flex align-items-center">
                    <span class="badge bg-warning me-3 fs-6">#${index + 1}</span>
                    <div>
                        <h6 class="mb-1">${student.name}</h6>
                        <small class="text-muted">${student.student_id}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="mb-1">
                        <span class="badge bg-primary me-2">${student.total_registrations} registered</span>
                        <span class="badge bg-success">${student.events_attended} attended</span>
                    </div>
                    <div class="progress" style="width: 100px; height: 8px;">
                        <div class="progress-bar bg-success" role="progressbar" 
                             style="width: ${student.attendance_rate}%" 
                             aria-valuenow="${student.attendance_rate}" 
                             aria-valuemin="0" aria-valuemax="100">
                        </div>
                    </div>
                    <small class="text-muted">${student.attendance_rate}% attendance rate</small>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading top active students:', error);
        document.getElementById('top-active-students').innerHTML = '<p class="text-danger">Error loading data</p>';
    }
}

// Load event type analysis
async function loadEventTypeAnalysis() {
    try {
        const response = await fetch('/api/analytics/event-type-analysis');
        const data = await response.json();
        
        const container = document.getElementById('event-type-analysis');
        
        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted">No event type data available</p>';
            return;
        }
        
        const html = data.map(type => {
            const percentage = type.percentage || 0;
            const colors = ['bg-primary', 'bg-success', 'bg-info', 'bg-warning', 'bg-danger', 'bg-secondary', 'bg-dark'];
            const colorClass = colors[data.indexOf(type) % colors.length];
            
            return `
                <div class="mb-3">
                    <div class="d-flex justify-content-between align-items-center mb-1">
                        <span><strong>${type.event_type || 'Other'}</strong></span>
                        <span class="badge ${colorClass}">${type.count} events (${percentage}%)</span>
                    </div>
                    <div class="progress" style="height: 12px;">
                        <div class="progress-bar ${colorClass}" role="progressbar" 
                             style="width: ${percentage}%" 
                             aria-valuenow="${percentage}" 
                             aria-valuemin="0" aria-valuemax="100">
                        </div>
                    </div>
                </div>
            `;
        }).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading event type analysis:', error);
        document.getElementById('event-type-analysis').innerHTML = '<p class="text-danger">Error loading data</p>';
    }
}

// Load event popularity report
async function loadEventPopularityReport() {
    try {
        const response = await fetch('/api/analytics/event-popularity');
        const data = await response.json();
        
        const container = document.getElementById('event-popularity-report');
        
        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted">No event popularity data available</p>';
            return;
        }
        
        const html = data.map((event, index) => `
            <div class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-light">
                <div class="d-flex align-items-center">
                    <span class="badge bg-warning me-3 fs-6">#${index + 1}</span>
                    <div>
                        <h6 class="mb-1">${event.title}</h6>
                        <small class="text-muted">${new Date(event.date).toLocaleDateString()} • ${event.location}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="mb-1">
                        <span class="badge bg-primary me-2">${event.registration_count} registered</span>
                        <span class="badge bg-success">${event.attendance_count} attended</span>
                    </div>
                    <div class="progress" style="width: 120px; height: 8px;">
                        <div class="progress-bar bg-success" role="progressbar" 
                             style="width: ${event.attendance_rate}%" 
                             aria-valuenow="${event.attendance_rate}" 
                             aria-valuemin="0" aria-valuemax="100">
                        </div>
                    </div>
                    <small class="text-muted">${event.attendance_rate}% attendance rate</small>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading event popularity report:', error);
        document.getElementById('event-popularity-report').innerHTML = '<p class="text-danger">Error loading data</p>';
    }
}

// Load top participation report
async function loadTopParticipationReport() {
    try {
        const response = await fetch('/api/analytics/top-participation');
        const data = await response.json();
        
        const container = document.getElementById('top-participation-report');
        
        if (data.length === 0) {
            container.innerHTML = '<p class="text-muted">No participation data available</p>';
            return;
        }
        
        const html = data.map((student, index) => `
            <div class="d-flex justify-content-between align-items-center mb-3 p-3 border rounded bg-light">
                <div class="d-flex align-items-center">
                    <span class="badge bg-success me-3 fs-6">#${index + 1}</span>
                    <div>
                        <h6 class="mb-1">${student.name}</h6>
                        <small class="text-muted">${student.student_id}</small>
                    </div>
                </div>
                <div class="text-end">
                    <div class="mb-1">
                        <span class="badge bg-primary me-2">${student.events_attended} attended</span>
                        <span class="badge bg-info">${student.total_registrations} registered</span>
                    </div>
                    <div class="progress" style="width: 100px; height: 8px;">
                        <div class="progress-bar bg-success" role="progressbar" 
                             style="width: ${student.participation_score}%" 
                             aria-valuenow="${student.participation_score}" 
                             aria-valuemin="0" aria-valuemax="100">
                        </div>
                    </div>
                    <small class="text-muted">${student.participation_score}% participation</small>
                </div>
            </div>
        `).join('');
        
        container.innerHTML = html;
        
    } catch (error) {
        console.error('Error loading top participation report:', error);
        document.getElementById('top-participation-report').innerHTML = '<p class="text-danger">Error loading data</p>';
    }
}

// Load individual event statistics
async function loadEventStatistics() {
    const eventId = document.getElementById('report-event-select').value;
    if (!eventId) {
        document.getElementById('event-stats').innerHTML = '<p class="text-muted">Please select an event</p>';
        return;
    }
    
    try {
        const response = await fetch(`/api/analytics/event-stats/${eventId}`);
        const stats = await response.json();
        
        const html = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Event Details</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Title:</strong> ${stats.title}</p>
                            <p><strong>Date:</strong> ${new Date(stats.date).toLocaleDateString()}</p>
                            <p><strong>Time:</strong> ${stats.time || 'Not specified'}</p>
                            <p><strong>Location:</strong> ${stats.location}</p>
                            <p><strong>Max Capacity:</strong> ${stats.max_capacity || 'Unlimited'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Statistics</h6>
                        </div>
                        <div class="card-body">
                            <div class="row text-center">
                                <div class="col-4">
                                    <div class="border rounded p-2 mb-2">
                                        <h5 class="text-primary mb-0">${stats.total_registrations}</h5>
                                        <small class="text-muted">Registrations</small>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="border rounded p-2 mb-2">
                                        <h5 class="text-success mb-0">${stats.total_attendance}</h5>
                                        <small class="text-muted">Attended</small>
                                    </div>
                                </div>
                                <div class="col-4">
                                    <div class="border rounded p-2 mb-2">
                                        <h5 class="text-info mb-0">${stats.total_check_ins}</h5>
                                        <small class="text-muted">Check-ins</small>
                                    </div>
                                </div>
                            </div>
                            <hr>
                            <div class="row">
                                <div class="col-6">
                                    <p class="mb-1"><strong>Attendance Rate:</strong></p>
                                    <div class="progress mb-2" style="height: 8px;">
                                        <div class="progress-bar bg-success" role="progressbar" 
                                             style="width: ${stats.attendance_rate}%" 
                                             aria-valuenow="${stats.attendance_rate}" 
                                             aria-valuemin="0" aria-valuemax="100">
                                        </div>
                                    </div>
                                    <small class="text-muted">${stats.attendance_rate}%</small>
                                </div>
                                <div class="col-6">
                                    <p class="mb-1"><strong>Check-in Rate:</strong></p>
                                    <div class="progress mb-2" style="height: 8px;">
                                        <div class="progress-bar bg-info" role="progressbar" 
                                             style="width: ${stats.check_in_rate}%" 
                                             aria-valuenow="${stats.check_in_rate}" 
                                             aria-valuemin="0" aria-valuemax="100">
                                        </div>
                                    </div>
                                    <small class="text-muted">${stats.check_in_rate}%</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('event-stats').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading event statistics:', error);
        document.getElementById('event-stats').innerHTML = '<p class="text-danger">Error loading event statistics</p>';
    }
}

// Report generation functions
// Report generation functions removed - analytics now display live data automatically

async function loadEventStats(eventId) {
    try {
        const response = await fetch(`/api/analytics/event-stats/${eventId}`);
        const stats = await response.json();
        
        const html = `
            <div class="row">
                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-info-circle me-2"></i>Event Details</h6>
                        </div>
                        <div class="card-body">
                            <p><strong>Title:</strong> ${stats.title}</p>
                            <p><strong>Date:</strong> ${new Date(stats.date).toLocaleDateString()}</p>
                            <p><strong>Time:</strong> ${stats.time || 'Not specified'}</p>
                            <p><strong>Location:</strong> ${stats.location}</p>
                            <p><strong>Max Capacity:</strong> ${stats.max_capacity || 'Unlimited'}</p>
                        </div>
                    </div>
                </div>
                <div class="col-md-6">
                    <div class="card bg-light">
                        <div class="card-header">
                            <h6 class="mb-0"><i class="fas fa-chart-bar me-2"></i>Statistics</h6>
                        </div>
                        <div class="card-body">
            <div class="row text-center">
                <div class="col-4">
                                    <div class="border rounded p-2 mb-2">
                                        <h5 class="text-primary mb-0">${stats.total_registrations}</h5>
                                        <small class="text-muted">Registrations</small>
                                    </div>
                </div>
                <div class="col-4">
                                    <div class="border rounded p-2 mb-2">
                                        <h5 class="text-success mb-0">${stats.total_attendance}</h5>
                                        <small class="text-muted">Attended</small>
                                    </div>
                </div>
                <div class="col-4">
                                    <div class="border rounded p-2 mb-2">
                                        <h5 class="text-info mb-0">${stats.total_check_ins}</h5>
                                        <small class="text-muted">Check-ins</small>
                                    </div>
                </div>
            </div>
            <hr>
                            <div class="row">
                                <div class="col-6">
                                    <p class="mb-1"><strong>Attendance Rate:</strong></p>
                                    <div class="progress mb-2" style="height: 8px;">
                                        <div class="progress-bar bg-success" role="progressbar" 
                                             style="width: ${stats.attendance_rate}%" 
                                             aria-valuenow="${stats.attendance_rate}" 
                                             aria-valuemin="0" aria-valuemax="100">
                                        </div>
                                    </div>
                                    
                                    <small class="text-muted">${stats.attendance_rate}%</small>
                                </div>
                                <div class="col-6">
                                    <p class="mb-1"><strong>Check-in Rate:</strong></p>
                                    <div class="progress mb-2" style="height: 8px;">
                                        <div class="progress-bar bg-info" role="progressbar" 
                                             style="width: ${stats.check_in_rate}%" 
                                             aria-valuenow="${stats.check_in_rate}" 
                                             aria-valuemin="0" aria-valuemax="100">
                                        </div>
                                    </div>
                                    <small class="text-muted">${stats.check_in_rate}%</small>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        document.getElementById('event-stats').innerHTML = html;
        
    } catch (error) {
        console.error('Error loading event statistics:', error);
        document.getElementById('event-stats').innerHTML = '<p class="text-danger">Error loading event statistics</p>';
    }
}

async function loadTopStudents() {
    try {
        const response = await fetch('/api/reports/top-students');
        const topStudents = await response.json();
        
        if (topStudents.length > 0) {
            const topStudentsHtml = topStudents.map((student, index) => `
                <div class="d-flex justify-content-between align-items-center mb-2">
                    <div>
                        <h6 class="mb-0">${index + 1}. ${student.name}</h6>
                        <small class="text-muted">ID: ${student.student_id}</small>
                    </div>
                    <span class="badge bg-primary">${student.registration_count} events</span>
                </div>
            `).join('');
            document.getElementById('top-students').innerHTML = topStudentsHtml;
        } else {
            document.getElementById('top-students').innerHTML = '<p class="text-muted">No student registrations yet. Students will appear here once they register for events.</p>';
        }
        
    } catch (error) {
        console.error('Error loading top students:', error);
    }
}

async function loadTopStudentsReport() {
    try {
        const response = await fetch('/api/reports/top-students');
        const topStudents = await response.json();
        
        const topStudentsHtml = topStudents.map((student, index) => `
            <div class="d-flex justify-content-between align-items-center mb-2">
                <div>
                    <h6 class="mb-0">${index + 1}. ${student.name}</h6>
                    <small class="text-muted">ID: ${student.student_id}</small>
                </div>
                <span class="badge bg-primary">${student.registration_count} events</span>
            </div>
        `).join('');
        
        document.getElementById('top-students-report').innerHTML = topStudentsHtml || '<p class="text-muted">No data available</p>';
        
    } catch (error) {
        console.error('Error loading top students report:', error);
    }
}

// Load students for other functions
async function loadStudents() {
    try {
        const response = await fetch('/api/students');
        students = await response.json();
    } catch (error) {
        console.error('Error loading students:', error);
    }
}

// Attendance Management Functions
let currentAttendanceEventId = null;

async function loadEventAttendance() {
    const eventId = document.getElementById('attendance-event-select').value;
    
    if (!eventId) {
        // Clear current event
        currentAttendanceEventId = null;
        
        // Hide indicators
        document.getElementById('auto-refresh-indicator').style.display = 'none';
        document.getElementById('attendance-completion-indicator').style.display = 'none';
        
        document.getElementById('attendance-table').innerHTML = `
            <tr>
                <td colspan="5" class="text-center">Select an event to view attendance</td>
            </tr>
        `;
        document.getElementById('attendance-event-info').textContent = 'Select an event to view students';
        return;
    }
    
    // Set current event
    currentAttendanceEventId = eventId;
    
    // Show auto-refresh indicator
    document.getElementById('auto-refresh-indicator').style.display = 'flex';
    document.getElementById('attendance-completion-indicator').style.display = 'none';
    
    // Join event room for real-time updates
    if (socket) {
        socket.emit('join-event', eventId);
    }
    
    // Load attendance data immediately
    await loadAttendanceData(eventId);
    
    // Show real-time indicator
    document.getElementById('auto-refresh-indicator').style.display = 'flex';
    document.getElementById('attendance-completion-indicator').style.display = 'none';
}

async function loadAttendanceData(eventId) {
    try {
        console.log('Loading attendance data for event:', eventId);
        const response = await fetch(`/api/attendance/event/${eventId}`);
        const attendanceData = await response.json();
        console.log('Received attendance data:', attendanceData);
        
        // Update event info
        const selectedEvent = events.find(e => e.id == eventId);
        if (selectedEvent) {
            document.getElementById('attendance-event-info').textContent = 
                `${selectedEvent.title} - ${new Date(selectedEvent.date).toLocaleDateString()}`;
        }
        
        // Update the table with the new data
        updateAttendanceTable(attendanceData, eventId);
        
    } catch (error) {
        console.error('Error loading attendance:', error);
        document.getElementById('attendance-table').innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger">Error loading attendance data</td>
            </tr>
        `;
    }
}

// Function to update attendance table with new data
function updateAttendanceTable(attendanceData, eventId = null) {
    console.log('=== UPDATE ATTENDANCE TABLE ===');
    console.log('Attendance data:', attendanceData);
    console.log('Event ID:', eventId);
    console.log('Current attendance event ID:', currentAttendanceEventId);
    
    if (!eventId) {
        eventId = currentAttendanceEventId;
    }
    
    if (!eventId) {
        console.log('No event ID provided, returning');
        return;
        }
        
        if (attendanceData.length === 0) {
        console.log('No attendance data, showing empty message');
            document.getElementById('attendance-table').innerHTML = `
                <tr>
                    <td colspan="5" class="text-center">No students found for this event</td>
                </tr>
            `;
            return;
        }
        
        const attendanceHtml = attendanceData.map(student => {
            const statusBadge = getAttendanceStatusBadge(student.attendance_status);
            const actionButtons = getAttendanceActionButtons(student.id, eventId, student.attendance_status);
        
        console.log('Student:', student.name, 'Status:', student.attendance_status, 'Badge:', statusBadge, 'Actions:', actionButtons);
            
            return `
                <tr>
                    <td>${student.name}</td>
                    <td>${student.student_id}</td>
                    <td>${student.email}</td>
                    <td>${statusBadge}</td>
                    <td>${actionButtons}</td>
                </tr>
            `;
        }).join('');
        
    // Update the table
    console.log('Updating table HTML:', attendanceHtml);
    const tableElement = document.getElementById('attendance-table');
    console.log('Table element found:', !!tableElement);
    if (tableElement) {
        console.log('Table innerHTML before update:', tableElement.innerHTML);
        tableElement.innerHTML = attendanceHtml;
        console.log('Table updated successfully');
        console.log('Table innerHTML after update:', tableElement.innerHTML);
        
        // Verify the update worked
        setTimeout(() => {
            console.log('Table innerHTML after 100ms:', tableElement.innerHTML);
        }, 100);
        } else {
        console.error('Table element not found!');
        }
        
    // Check if all students are marked
        const allMarked = attendanceData.every(student => 
            student.attendance_status === 'attended' || student.attendance_status === 'absent'
        );
    
    console.log('All students marked check:', allMarked, 'out of', attendanceData.length);
        
        if (allMarked && attendanceData.length > 0) {
        console.log('All students marked - showing completion indicator');
        // Hide real-time indicator and show completion message
            document.getElementById('auto-refresh-indicator').style.display = 'none';
            
            // Show completion indicator
            const completionIndicator = document.getElementById('attendance-completion-indicator');
            if (completionIndicator) {
                completionIndicator.style.display = 'flex';
            }
    } else {
        // Show real-time indicator
        document.getElementById('auto-refresh-indicator').style.display = 'flex';
        document.getElementById('attendance-completion-indicator').style.display = 'none';
    }
    
    console.log('=== END UPDATE ATTENDANCE TABLE ===');
}

function getAttendanceStatusBadge(status) {
    switch (status) {
        case 'attended':
            return '<span class="badge bg-success"><i class="fas fa-check-circle me-1"></i>Attended</span>';
        case 'absent':
            return '<span class="badge bg-danger"><i class="fas fa-times-circle me-1"></i>Absent</span>';
        default:
            return '<span class="badge bg-secondary"><i class="fas fa-question-circle me-1"></i>Not Marked</span>';
    }
}

function getAttendanceActionButtons(studentId, eventId, currentStatus) {
    if (currentStatus === 'attended') {
        return `
            <span class="text-success">
                <i class="fas fa-check-circle me-1"></i>Confirmed
            </span>
        `;
    } else if (currentStatus === 'absent') {
        return `
            <span class="text-danger">
                <i class="fas fa-times-circle me-1"></i>Confirmed
            </span>
        `;
    } else {
        return `
            <button class="btn btn-success btn-sm me-1" onclick="markAttendance(${studentId}, ${eventId}, 'attended')" title="Mark as Attended">
                <i class="fas fa-check"></i> Attended
            </button>
            <button class="btn btn-danger btn-sm" onclick="markAttendance(${studentId}, ${eventId}, 'absent')" title="Mark as Absent">
                <i class="fas fa-times"></i> Absent
            </button>
        `;
    }
}

async function markAttendance(studentId, eventId, status) {
    try {
        const response = await fetch('/api/attendance/mark', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                student_id: studentId,
                event_id: eventId,
                status: status
            })
        });
        
        if (response.ok) {
            const result = await response.json();
            showNotification(result.message, 'success');
            
            // Immediately refresh the attendance data
            console.log('Immediately refreshing attendance after marking');
            await loadAttendanceData(eventId);
            
            // WebSocket will handle real-time updates automatically
            // But also add a fallback refresh after a short delay
            setTimeout(() => {
                console.log('Fallback refresh after marking attendance');
                loadEventAttendance(eventId);
            }, 1000);
        } else {
            const error = await response.json();
            showNotification('Error: ' + error.error, 'error');
        }
    } catch (error) {
        console.error('Error marking attendance:', error);
        showNotification('Error marking attendance', 'error');
    }
}

// Function to refresh all statistics sections
async function refreshAllStatistics() {
    try {
        // Refresh dashboard if it's the current section
        if (currentSection === 'dashboard') {
            await loadDashboard();
        }
        
        // Refresh reports if it's the current section and an event is selected
        if (currentSection === 'reports') {
            const reportEventSelect = document.getElementById('report-event-select');
            if (reportEventSelect && reportEventSelect.value) {
                await loadEventStats(reportEventSelect.value);
            }
        }
        
        // Refresh top students
        await loadTopStudents();
        
        console.log('All statistics refreshed');
    } catch (error) {
        console.error('Error refreshing statistics:', error);
    }
}