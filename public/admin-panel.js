// Firebase Configuration
const firebaseConfig = {
    apiKey: "AIzaSyAAhoJ5rnC4q9XKwrvoldp39stRs0bBvew",
    authDomain: "itandem-api.firebaseapp.com",
    projectId: "itandem-api",
    storageBucket: "itandem-api.firebasestorage.app",
    messagingSenderId: "954488814160",
    appId: "1:954488814160:web:18f5bf2a958bb7ce0b98c5"
};

// Initialize Firebase
firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();

// API Base URL
const API_BASE_URL = window.location.hostname === 'localhost' 
    ? 'http://localhost:5001/itandem-api/us-central1/apiv2'
    : 'https://us-central1-itandem-api.cloudfunctions.net/apiv2';

// Global state
let currentAdmin = null;
let authToken = null;

// ==================== AUTH ====================

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;
    
    try {
        // Sign in with Firebase
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        authToken = await userCredential.user.getIdToken();
        
        // Verify admin status
        const response = await fetch(`${API_BASE_URL}/admin-auth/verify`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        const data = await response.json();
        
        if (!response.ok) {
            throw new Error(data.message || 'Not authorized as admin');
        }
        
        currentAdmin = data.admin;
        showAdminPanel();
        
    } catch (error) {
        document.getElementById('loginError').textContent = error.message;
        document.getElementById('loginError').classList.remove('hidden');
    }
});

function showAdminPanel() {
    document.getElementById('loginScreen').classList.add('hidden');
    document.getElementById('adminPanel').classList.remove('hidden');
    document.getElementById('adminName').textContent = currentAdmin.user.name || currentAdmin.user.email;
    document.getElementById('adminRole').textContent = currentAdmin.role;
    
    // Load initial data
    loadDashboard();
}

async function logout() {
    await auth.signOut();
    location.reload();
}

// ==================== TAB NAVIGATION ====================

function switchTab(tabName) {
    // Hide all tabs
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });
    
    // Remove active state from all buttons
    document.querySelectorAll('.tab-btn').forEach(btn => {
        btn.classList.remove('text-purple-600', 'border-b-2', 'border-purple-600');
        btn.classList.add('text-gray-600');
    });
    
    // Show selected tab
    document.getElementById(tabName).classList.add('active');
    
    // Update button state
    event.target.classList.add('text-purple-600', 'border-b-2', 'border-purple-600');
    event.target.classList.remove('text-gray-600');
    
    // Load data for the tab
    switch(tabName) {
        case 'dashboard': loadDashboard(); break;
        case 'users': loadAllUsers(); break;
        case 'spots': loadAllSpots(); break;
        case 'tandems': loadTandems(); break;
        case 'carpools': loadCarpools(); break;
        case 'rentals': loadRentals(); break;
        case 'reports': loadReports(); break;
        case 'system': loadSystemStatus(); break;
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/analytics/overview`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const stats = data.overview;
            document.getElementById('stat-totalUsers').textContent = stats.totalUsers;
            document.getElementById('stat-activeTandems').textContent = stats.activeTandems;
            document.getElementById('stat-totalRentals').textContent = stats.totalRentals;
            document.getElementById('stat-pendingReports').textContent = stats.pendingReports;
            
            document.getElementById('recentActivity').innerHTML = `
                <p>✅ ${stats.activeUsers} active users</p>
                <p>⚠️ ${stats.bannedUsers} banned users</p>
                <p>🚗 ${stats.totalSpots} total parking spots</p>
                <p>🤝 ${stats.activeCarpools} active carpools</p>
            `;
        }
        
        await loadSystemStatus();
        
    } catch (error) {
        console.error('Dashboard load error:', error);
    }
}

// ==================== USER MANAGEMENT ====================

async function loadAllUsers() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/users?limit=100`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayUsers(data.users);
        }
        
    } catch (error) {
        console.error('Load users error:', error);
    }
}

async function searchUsers() {
    const search = document.getElementById('userSearch').value;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/users?search=${search}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displayUsers(data.users);
        }
        
    } catch (error) {
        console.error('Search users error:', error);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');
    
    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="5" class="px-6 py-4 text-center text-gray-500">No users found</td></tr>';
        return;
    }
    
    tbody.innerHTML = users.map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-6 py-4 whitespace-nowrap">
                <div class="font-medium">${user.name || 'N/A'}</div>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm">${user.email}</td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full bg-blue-100 text-blue-800">
                    ${user.userType || 'N/A'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap">
                <span class="px-2 py-1 text-xs rounded-full ${
                    user.accountStatus === 'active' ? 'bg-green-100 text-green-800' :
                    user.accountStatus === 'banned' ? 'bg-red-100 text-red-800' :
                    'bg-yellow-100 text-yellow-800'
                }">
                    ${user.accountStatus || 'active'}
                </span>
            </td>
            <td class="px-6 py-4 whitespace-nowrap text-sm space-x-2">
                <button onclick='editUser("${user.id}")' 
                        class="text-blue-600 hover:text-blue-800">Edit</button>
                ${user.accountStatus !== 'banned' ? 
                    `<button onclick='banUser("${user.id}")' 
                             class="text-red-600 hover:text-red-800">Ban</button>` :
                    `<button onclick='unbanUser("${user.id}")' 
                             class="text-green-600 hover:text-green-800">Unban</button>`
                }
            </td>
        </tr>
    `).join('');
}

async function editUser(userId) {
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/users/${userId}`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const user = data.user;
            document.getElementById('editUserId').value = userId;
            document.getElementById('editUserName').value = user.name || '';
            document.getElementById('editUserEmail').value = user.email || '';
            document.getElementById('editUserPhone').value = user.phoneNumber || '';
            document.getElementById('editUserLicense').value = user.licensePlate || '';
            document.getElementById('editUserType').value = user.userType || 'JUNIOR';
            document.getElementById('editUserStatus').value = user.accountStatus || 'active';
            
            document.getElementById('editUserModal').classList.add('active');
        }
        
    } catch (error) {
        console.error('Load user error:', error);
        alert('Failed to load user details');
    }
}

document.getElementById('editUserForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    
    const userId = document.getElementById('editUserId').value;
    const updates = {
        name: document.getElementById('editUserName').value,
        email: document.getElementById('editUserEmail').value,
        phoneNumber: document.getElementById('editUserPhone').value,
        licensePlate: document.getElementById('editUserLicense').value,
        userType: document.getElementById('editUserType').value,
        accountStatus: document.getElementById('editUserStatus').value
    };
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/users/${userId}`, {
            method: 'PUT',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(updates)
        });
        
        if (response.ok) {
            alert('User updated successfully');
            closeEditUserModal();
            loadAllUsers();
        } else {
            const data = await response.json();
            alert('Error: ' + data.message);
        }
        
    } catch (error) {
        console.error('Update user error:', error);
        alert('Failed to update user');
    }
});

function closeEditUserModal() {
    document.getElementById('editUserModal').classList.remove('active');
}

async function banUser(userId) {
    const reason = prompt('Enter ban reason:');
    if (!reason) return;
    
    const duration = prompt('Enter ban duration in days (leave empty for permanent):');
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/users/${userId}/ban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({
                reason,
                type: duration ? 'temporary' : 'permanent',
                duration: duration || null
            })
        });
        
        if (response.ok) {
            alert('User banned successfully');
            loadAllUsers();
        } else {
            const data = await response.json();
            alert('Error: ' + data.message);
        }
        
    } catch (error) {
        console.error('Ban user error:', error);
        alert('Failed to ban user');
    }
}

async function unbanUser(userId) {
    if (!confirm('Unban this user?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/users/${userId}/unban`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert('User unbanned successfully');
            loadAllUsers();
        } else {
            const data = await response.json();
            alert('Error: ' + data.message);
        }
        
    } catch (error) {
        console.error('Unban user error:', error);
        alert('Failed to unban user');
    }
}

// ==================== PARKING SPOTS ====================

async function loadAllSpots() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/spots`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            displaySpots(data.spots);
        }
        
    } catch (error) {
        console.error('Load spots error:', error);
    }
}

function displaySpots(spots) {
    const grid = document.getElementById('spotsGrid');
    
    if (spots.length === 0) {
        grid.innerHTML = '<p class="text-gray-500 col-span-3">No spots found</p>';
        return;
    }
    
    grid.innerHTML = spots.map(spot => `
        <div class="bg-white rounded-lg shadow p-6">
            <div class="flex justify-between items-start mb-4">
                <div>
                    <h3 class="font-bold text-lg">${spot.lotName || 'Unknown'}</h3>
                    <p class="text-gray-600">Spot ${spot.spotNumber || 'N/A'}</p>
                </div>
                <span class="px-2 py-1 text-xs rounded-full ${
                    spot.available ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }">
                    ${spot.available ? 'Available' : 'Occupied'}
                </span>
            </div>
            <div class="text-sm space-y-1 mb-4">
                <p><strong>Type:</strong> ${spot.spotType || 'single'}</p>
                <p><strong>Distance:</strong> ${spot.distance || 0}m</p>
                ${spot.ownerId ? `<p><strong>Owner:</strong> ${spot.ownerId.substring(0, 8)}...</p>` : ''}
            </div>
            <div class="flex space-x-2">
                <button onclick='editSpot("${spot.id}")' 
                        class="flex-1 bg-blue-600 text-white px-4 py-2 rounded text-sm hover:bg-blue-700">
                    Edit
                </button>
                <button onclick='deleteSpot("${spot.id}")' 
                        class="flex-1 bg-red-600 text-white px-4 py-2 rounded text-sm hover:bg-red-700">
                    Delete
                </button>
            </div>
        </div>
    `).join('');
}

function showCreateSpotModal() {
    alert('Create spot functionality - to be implemented');
}

function editSpot(spotId) {
    alert(`Edit spot ${spotId} - to be implemented`);
}

async function deleteSpot(spotId) {
    if (!confirm('Delete this parking spot?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/spots/${spotId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        if (response.ok) {
            alert('Spot deleted successfully');
            loadAllSpots();
        } else {
            const data = await response.json();
            alert('Error: ' + data.message);
        }
        
    } catch (error) {
        console.error('Delete spot error:', error);
        alert('Failed to delete spot');
    }
}

// ==================== TANDEMS/CARPOOLS/RENTALS/REPORTS ====================

async function loadTandems() {
    document.getElementById('tandemsContainer').innerHTML = 
        '<p class="text-gray-500">Tandem management - Connect to tandems collection</p>';
}

async function loadCarpools() {
    document.getElementById('carpoolsContainer').innerHTML = 
        '<p class="text-gray-500">Carpool management - Connect to carpools collection</p>';
}

async function loadRentals() {
    document.getElementById('rentalsTableBody').innerHTML = 
        '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Rental management - Connect to rentals collection</td></tr>';
}

async function loadReports() {
    document.getElementById('reportsContainer').innerHTML = 
        '<p class="text-gray-500">Reports management - Connect to reports collection</p>';
}

// ==================== SYSTEM CONTROL ====================

async function loadSystemStatus() {
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/system/status`, {
            headers: { 'Authorization': `Bearer ${authToken}` }
        });
        
        const data = await response.json();
        
        if (response.ok) {
            const statusHtml = data.appActive ?
                '<div class="p-4 bg-green-100 text-green-800 rounded-md"><strong>✅ App is Active</strong><p class="text-sm mt-1">Users can access the app normally</p></div>' :
                `<div class="p-4 bg-red-100 text-red-800 rounded-md"><strong>🔒 App is Frozen</strong><p class="text-sm mt-1">${data.message || 'App is temporarily unavailable'}</p></div>`;
            
            document.getElementById('appStatusDisplay').innerHTML = statusHtml;
            document.getElementById('systemStatus').innerHTML = statusHtml;
        }
        
    } catch (error) {
        console.error('Load system status error:', error);
    }
}

async function freezeApp() {
    const message = prompt('Enter maintenance message for users:');
    if (!message) return;
    
    if (!confirm('This will prevent all users from accessing the app. Continue?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/system/freeze`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            },
            body: JSON.stringify({ message })
        });
        
        if (response.ok) {
            alert('App frozen successfully');
            loadSystemStatus();
        } else {
            const data = await response.json();
            alert('Error: ' + data.message);
        }
        
    } catch (error) {
        console.error('Freeze app error:', error);
        alert('Failed to freeze app');
    }
}

async function unfreezeApp() {
    if (!confirm('Re-enable app access for all users?')) return;
    
    try {
        const response = await fetch(`${API_BASE_URL}/admin-panel/system/unfreeze`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${authToken}`,
                'Content-Type': 'application/json'
            }
        });
        
        if (response.ok) {
            alert('App unfrozen successfully');
            loadSystemStatus();
        } else {
            const data = await response.json();
            alert('Error: ' + data.message);
        }
        
    } catch (error) {
        console.error('Unfreeze app error:', error);
        alert('Failed to unfreeze app');
    }
}
