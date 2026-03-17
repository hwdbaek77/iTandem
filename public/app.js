// Firebase Configuration
// TODO: Replace with your actual Firebase config from Firebase Console
const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY",
    authDomain: "YOUR_PROJECT.firebaseapp.com",
    projectId: "YOUR_PROJECT_ID",
    storageBucket: "YOUR_PROJECT.appspot.com",
    messagingSenderId: "YOUR_SENDER_ID",
    appId: "YOUR_APP_ID"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// API Base URL - adjust for local development vs production
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001/itandem-firebase/us-central1/api'
    : '/api';

// Global state
let currentUser = null;
let authToken = null;

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    auth.onAuthStateChanged(async (user) => {
        if (user) {
            currentUser = user;
            authToken = await user.getIdToken();
            showAuthenticatedView();
            loadUserProfile();
            checkCanvasStatus();
        } else {
            currentUser = null;
            authToken = null;
            showNotAuthenticatedView();
        }
    });

    // Setup form listeners
    document.getElementById('signupForm').addEventListener('submit', handleSignup);
    document.getElementById('loginForm').addEventListener('submit', handleLogin);
    document.getElementById('canvasForm').addEventListener('submit', handleCanvasLink);
});

// View management
function showAuthenticatedView() {
    document.getElementById('notAuthenticatedView').classList.add('hidden');
    document.getElementById('authenticatedView').classList.remove('hidden');
}

function showNotAuthenticatedView() {
    document.getElementById('notAuthenticatedView').classList.remove('hidden');
    document.getElementById('authenticatedView').classList.add('hidden');
}

// Authentication Functions
async function handleSignup(e) {
    e.preventDefault();
    
    const name = document.getElementById('signupName').value;
    const email = document.getElementById('signupEmail').value;
    const password = document.getElementById('signupPassword').value;
    const phoneNumber = document.getElementById('signupPhone').value;
    const licensePlate = document.getElementById('signupLicense').value;
    
    const statusDiv = document.getElementById('signupStatus');
    statusDiv.innerHTML = '<div class="status info">Creating account...</div>';
    
    try {
        // Create account via API
        const response = await fetch(`${API_BASE_URL}/auth/signup`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                name,
                email,
                password,
                phoneNumber,
                licensePlate,
                userType: 'STUDENT'
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Signup failed');
        }
        
        // Sign in with the custom token
        await auth.signInWithCustomToken(data.customToken);
        
        statusDiv.innerHTML = `<div class="status success">Account created successfully! Welcome, ${name}!</div>`;
        
        // Clear form
        document.getElementById('signupForm').reset();
    } catch (error) {
        console.error('Signup error:', error);
        statusDiv.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
}

async function handleLogin(e) {
    e.preventDefault();
    
    const email = document.getElementById('loginEmail').value;
    const password = document.getElementById('loginPassword').value;
    
    const statusDiv = document.getElementById('loginStatus');
    statusDiv.innerHTML = '<div class="status info">Logging in...</div>';
    
    try {
        await auth.signInWithEmailAndPassword(email, password);
        statusDiv.innerHTML = '<div class="status success">Login successful!</div>';
        document.getElementById('loginForm').reset();
    } catch (error) {
        console.error('Login error:', error);
        let errorMessage = 'Login failed';
        
        if (error.code === 'auth/wrong-password') {
            errorMessage = 'Incorrect password';
        } else if (error.code === 'auth/user-not-found') {
            errorMessage = 'No account found with this email';
        } else if (error.code === 'auth/invalid-email') {
            errorMessage = 'Invalid email address';
        }
        
        statusDiv.innerHTML = `<div class="status error">Error: ${errorMessage}</div>`;
    }
}

async function logout() {
    try {
        await auth.signOut();
        location.reload();
    } catch (error) {
        console.error('Logout error:', error);
        alert('Error logging out: ' + error.message);
    }
}

// User Profile Functions
async function loadUserProfile() {
    try {
        const response = await fetch(`${API_BASE_URL}/users/me`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to load profile');
        }
        
        const data = await response.json();
        const user = data.user;
        
        document.getElementById('userProfile').innerHTML = `
            <div class="user-info">
                <h3>Welcome, ${user.name}!</h3>
                <p><strong>Email:</strong> ${user.email}</p>
                <p><strong>User Type:</strong> ${user.userType}</p>
                ${user.phoneNumber ? `<p><strong>Phone:</strong> ${user.phoneNumber}</p>` : ''}
                ${user.licensePlate ? `<p><strong>License Plate:</strong> ${user.licensePlate}</p>` : ''}
                <p><strong>User ID:</strong> <code>${user.userID}</code></p>
            </div>
        `;
    } catch (error) {
        console.error('Profile load error:', error);
        document.getElementById('userProfile').innerHTML = 
            '<div class="status error">Failed to load profile</div>';
    }
}

// Canvas Integration Functions
async function checkCanvasStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/auth/canvas-token`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        if (!response.ok) {
            throw new Error('Failed to check Canvas status');
        }
        
        const data = await response.json();
        const statusDiv = document.getElementById('canvasStatus');
        
        if (data.canvasLinked) {
            statusDiv.innerHTML = `
                <div class="status success">
                    ✅ Canvas account linked!
                    <p style="margin-top: 10px;">
                        <strong>Canvas User:</strong> ${data.canvasUserName}<br>
                        <strong>Canvas ID:</strong> ${data.canvasUserId}
                    </p>
                </div>
            `;
            document.getElementById('canvasForm').classList.add('hidden');
            document.getElementById('refreshCanvasBtn').classList.remove('hidden');
        } else {
            statusDiv.innerHTML = `
                <div class="status info">
                    Canvas account not linked. Link your account to enable schedule-based matching.
                </div>
            `;
            document.getElementById('canvasForm').classList.remove('hidden');
            document.getElementById('refreshCanvasBtn').classList.add('hidden');
        }
    } catch (error) {
        console.error('Canvas status check error:', error);
    }
}

async function handleCanvasLink(e) {
    e.preventDefault();
    
    const canvasToken = document.getElementById('canvasToken').value;
    const statusDiv = document.getElementById('canvasLinkStatus');
    
    statusDiv.innerHTML = '<div class="status info">Linking Canvas account and fetching data...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/canvas-token`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                canvasAccessToken: canvasToken
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to link Canvas account');
        }
        
        statusDiv.innerHTML = `
            <div class="status success">
                ✅ Canvas account linked successfully!
                <p style="margin-top: 10px;">
                    <strong>Canvas Profile:</strong> ${data.canvasProfile.name}<br>
                    <strong>Courses Found:</strong> ${data.dataFetched.coursesCount}<br>
                    <strong>Events Found:</strong> ${data.dataFetched.upcomingEventsCount}<br>
                    <strong>Assignments Found:</strong> ${data.dataFetched.assignmentsCount}
                </p>
            </div>
        `;
        
        document.getElementById('canvasForm').reset();
        checkCanvasStatus();
    } catch (error) {
        console.error('Canvas link error:', error);
        statusDiv.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
}

async function refreshCanvasData() {
    const statusDiv = document.getElementById('canvasLinkStatus');
    statusDiv.innerHTML = '<div class="status info">Refreshing Canvas data...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/canvas/refresh`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to refresh Canvas data');
        }
        
        statusDiv.innerHTML = `
            <div class="status success">
                ✅ Canvas data refreshed!
                <p style="margin-top: 10px;">
                    <strong>Courses:</strong> ${data.dataFetched.coursesCount}<br>
                    <strong>Calendar Events:</strong> ${data.dataFetched.calendarEventsCount}<br>
                    <strong>Assignments:</strong> ${data.dataFetched.assignmentsCount}
                </p>
            </div>
        `;
    } catch (error) {
        console.error('Canvas refresh error:', error);
        statusDiv.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
}

async function viewCanvasCourses() {
    const displayDiv = document.getElementById('canvasDataDisplay');
    displayDiv.innerHTML = '<div class="loading">Loading courses</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/canvas/courses`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load courses');
        }
        
        let html = `<div class="status success"><strong>Found ${data.count} courses:</strong></div>`;
        
        data.courses.forEach(course => {
            html += `
                <div class="user-info" style="margin-top: 10px;">
                    <h3>${course.name}</h3>
                    <p><strong>Code:</strong> ${course.course_code || 'N/A'}</p>
                    <p><strong>ID:</strong> ${course.id}</p>
                </div>
            `;
        });
        
        displayDiv.innerHTML = html;
    } catch (error) {
        console.error('Courses load error:', error);
        displayDiv.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
}

async function viewCanvasSchedule() {
    const displayDiv = document.getElementById('canvasDataDisplay');
    displayDiv.innerHTML = '<div class="loading">Loading schedule</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/canvas/schedule`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load schedule');
        }
        
        let html = `<div class="status success"><strong>Found ${data.count} upcoming events:</strong></div>`;
        
        data.calendar.slice(0, 10).forEach(event => {
            const startDate = new Date(event.start_at);
            html += `
                <div class="user-info" style="margin-top: 10px;">
                    <h3>${event.title}</h3>
                    <p><strong>Date:</strong> ${startDate.toLocaleString()}</p>
                    ${event.location_name ? `<p><strong>Location:</strong> ${event.location_name}</p>` : ''}
                </div>
            `;
        });
        
        if (data.count > 10) {
            html += `<p style="margin-top: 10px; color: #666;"><em>Showing first 10 of ${data.count} events</em></p>`;
        }
        
        displayDiv.innerHTML = html;
    } catch (error) {
        console.error('Schedule load error:', error);
        displayDiv.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
}

// API Key Management
async function generateApiKey() {
    const statusDiv = document.getElementById('apiKeyStatus');
    statusDiv.innerHTML = '<div class="status info">Generating API key...</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/generate-api-key`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                name: 'Mobile App Key',
                expiresInDays: 365
            })
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to generate API key');
        }
        
        statusDiv.innerHTML = `
            <div class="api-key-display">
                <strong>⚠️ Your API Key (save this securely!):</strong>
                <p style="margin: 10px 0; font-family: monospace; word-break: break-all;">
                    ${data.apiKey}
                </p>
                <small style="color: #856404;">
                    This key will only be shown once. Use it in your mobile app with the header: 
                    <code>x-api-key: ${data.apiKey}</code>
                </small>
            </div>
        `;
    } catch (error) {
        console.error('API key generation error:', error);
        statusDiv.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
}

async function loadApiKeys() {
    const listDiv = document.getElementById('apiKeysList');
    listDiv.innerHTML = '<div class="loading">Loading API keys</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/auth/api-keys`, {
            headers: {
                'Authorization': `Bearer ${authToken}`
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.error || 'Failed to load API keys');
        }
        
        if (data.apiKeys.length === 0) {
            listDiv.innerHTML = '<div class="status info">No API keys found. Generate one above.</div>';
            return;
        }
        
        let html = `<div class="status success"><strong>Your API Keys (${data.count}):</strong></div>`;
        
        data.apiKeys.forEach(key => {
            const statusBadge = key.active ? 
                '<span class="badge healthy">Active</span>' : 
                '<span class="badge unhealthy">Revoked</span>';
            
            html += `
                <div class="user-info" style="margin-top: 10px;">
                    <h3>${key.name} ${statusBadge}</h3>
                    <p><strong>Key:</strong> <code>${key.keyPreview}</code></p>
                    <p><strong>Created:</strong> ${new Date(key.createdAt).toLocaleString()}</p>
                    ${key.lastUsedAt ? `<p><strong>Last Used:</strong> ${new Date(key.lastUsedAt).toLocaleString()}</p>` : '<p><strong>Last Used:</strong> Never</p>'}
                    ${key.expiresAt ? `<p><strong>Expires:</strong> ${new Date(key.expiresAt).toLocaleString()}</p>` : ''}
                </div>
            `;
        });
        
        listDiv.innerHTML = html;
    } catch (error) {
        console.error('API keys load error:', error);
        listDiv.innerHTML = `<div class="status error">Error: ${error.message}</div>`;
    }
}

// Health Check Functions
async function checkHealth() {
    const statusDiv = document.getElementById('healthStatus');
    statusDiv.innerHTML = '<div class="loading">Checking platform health</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/health`);
        const data = await response.json();
        
        statusDiv.innerHTML = `
            <div class="status success">
                <strong>✅ Platform is ${data.status}</strong>
                <p style="margin-top: 10px;">
                    <strong>Service:</strong> ${data.service}<br>
                    <strong>Version:</strong> ${data.version}<br>
                    <strong>Uptime:</strong> ${Math.floor(data.uptime)} seconds
                </p>
            </div>
        `;
    } catch (error) {
        console.error('Health check error:', error);
        statusDiv.innerHTML = `<div class="status error">❌ Platform health check failed</div>`;
    }
}

async function checkDetailedHealth() {
    const statusDiv = document.getElementById('detailedHealthStatus');
    statusDiv.innerHTML = '<div class="loading">Running detailed health check</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/health/detailed`);
        const data = await response.json();
        
        let html = `<div class="status ${data.status === 'healthy' ? 'success' : 'error'}">
            <strong>${data.status === 'healthy' ? '✅' : '❌'} Overall Status: ${data.status.toUpperCase()}</strong>
        </div>`;
        
        Object.entries(data.checks).forEach(([name, check]) => {
            const statusClass = check.status === 'healthy' ? 'healthy' : 
                               check.status === 'warning' ? 'warning' : 'unhealthy';
            const icon = check.status === 'healthy' ? '✅' : 
                        check.status === 'warning' ? '⚠️' : '❌';
            
            html += `
                <div class="health-status ${statusClass}">
                    <div>
                        <strong>${icon} ${name}</strong>
                        <p style="margin: 5px 0 0 0; font-size: 0.9em; color: #666;">
                            ${check.message || check.error || 'No details'}
                        </p>
                    </div>
                    <span class="badge ${statusClass}">${check.status}</span>
                </div>
            `;
        });
        
        statusDiv.innerHTML = html;
    } catch (error) {
        console.error('Detailed health check error:', error);
        statusDiv.innerHTML = `<div class="status error">Failed to perform health check: ${error.message}</div>`;
    }
}

async function loadPlatformStats() {
    const statsDiv = document.getElementById('platformStats');
    statsDiv.innerHTML = '<div class="loading">Loading platform statistics</div>';
    
    try {
        const response = await fetch(`${API_BASE_URL}/health/stats`);
        const data = await response.json();
        
        let html = '<div class="stats-grid">';
        
        html += `
            <div class="stat-item">
                <div class="stat-value">${data.platform.totalUsers}</div>
                <div class="stat-label">Total Users</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.platform.usersWithCanvas}</div>
                <div class="stat-label">Canvas Linked</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.parking.totalSpots}</div>
                <div class="stat-label">Parking Spots</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.social.activeTandems}</div>
                <div class="stat-label">Active Tandems</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.social.activeCarpools}</div>
                <div class="stat-label">Active Carpools</div>
            </div>
            <div class="stat-item">
                <div class="stat-value">${data.parking.totalRentals}</div>
                <div class="stat-label">Total Rentals</div>
            </div>
        `;
        
        html += '</div>';
        html += `<p style="margin-top: 15px; text-align: center; color: #666; font-size: 0.9em;">
            Canvas Linkage Rate: ${data.platform.canvasLinkageRate}
        </p>`;
        
        statsDiv.innerHTML = html;
    } catch (error) {
        console.error('Stats load error:', error);
        statsDiv.innerHTML = `<div class="status error">Failed to load statistics: ${error.message}</div>`;
    }
}
