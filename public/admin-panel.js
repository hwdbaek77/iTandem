// Initialize Firebase using shared config from firebase-config.js
firebase.initializeApp(FIREBASE_CONFIG);
const auth = firebase.auth();

const API_BASE_URL = window.location.hostname === 'localhost'
    ? 'http://localhost:5001/itandem-api/us-central1/apiv2'
    : 'https://us-central1-itandem-api.cloudfunctions.net/apiv2';

let currentAdmin = null;
let authToken = null;

// ==================== AUTH ====================

document.getElementById('adminLoginForm').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('adminEmail').value;
    const password = document.getElementById('adminPassword').value;

    try {
        const userCredential = await auth.signInWithEmailAndPassword(email, password);
        authToken = await userCredential.user.getIdToken();

        const response = await fetch(`${API_BASE_URL}/admin-auth/verify`, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${authToken}`, 'Content-Type': 'application/json' }
        });
        const data = await response.json();

        if (!response.ok) throw new Error(data.message || 'Not authorized as admin');

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
    loadDashboard();
}

async function logout() {
    await auth.signOut();
    location.reload();
}

// ==================== HELPERS ====================

async function adminFetch(path, options = {}) {
    const headers = { 'Authorization': `Bearer ${authToken}`, ...options.headers };
    if (options.body && !(options.body instanceof FormData)) {
        headers['Content-Type'] = 'application/json';
    }
    return fetch(`${API_BASE_URL}${path}`, { ...options, headers });
}

function fmtDate(ts) {
    if (!ts) return '—';
    const d = ts._seconds ? new Date(ts._seconds * 1000) : new Date(ts);
    return isNaN(d) ? '—' : d.toLocaleDateString();
}

function badge(text, color) {
    const colors = {
        green: 'bg-green-100 text-green-800',
        red: 'bg-red-100 text-red-800',
        yellow: 'bg-yellow-100 text-yellow-800',
        blue: 'bg-blue-100 text-blue-800',
        purple: 'bg-purple-100 text-purple-800',
        gray: 'bg-gray-100 text-gray-800',
    };
    return `<span class="px-2 py-1 text-xs rounded-full ${colors[color] || colors.gray}">${text}</span>`;
}

function statusBadge(status) {
    const map = { active: 'green', pending: 'yellow', declined: 'red', ended: 'gray', cancelled: 'red', banned: 'red', suspended: 'yellow' };
    return badge(status || 'active', map[status] || 'blue');
}

// ==================== TAB NAVIGATION ====================

function switchTab(tabName) {
    document.querySelectorAll('.tab-content').forEach(t => t.classList.remove('active'));
    document.querySelectorAll('.tab-btn').forEach(b => {
        b.classList.remove('text-purple-600', 'border-b-2', 'border-purple-600');
        b.classList.add('text-gray-600');
    });
    document.getElementById(tabName).classList.add('active');
    event.target.classList.add('text-purple-600', 'border-b-2', 'border-purple-600');
    event.target.classList.remove('text-gray-600');

    switch (tabName) {
        case 'dashboard': loadDashboard(); break;
        case 'users': loadAllUsers(); break;
        case 'spots': loadAllSpots(); break;
        case 'tandems': loadMatches('tandem'); break;
        case 'carpools': loadMatches('carpool'); break;
        case 'rentals': loadRentals(); break;
        case 'system': loadSystemStatus(); break;
    }
}

// ==================== DASHBOARD ====================

async function loadDashboard() {
    try {
        const res = await adminFetch('/admin-panel/analytics/overview');
        const data = await res.json();

        if (res.ok) {
            const s = data.overview;
            document.getElementById('stat-totalUsers').textContent = s.totalUsers;
            document.getElementById('stat-activeTandems').textContent = s.activeTandems;
            document.getElementById('stat-activeCarpools').textContent = s.activeCarpools;
            document.getElementById('stat-totalRentals').textContent = s.totalRentals;

            document.getElementById('recentActivity').innerHTML = `
                <p>👥 <strong>${s.activeUsers}</strong> active users, <strong>${s.bannedUsers}</strong> banned</p>
                <p>🅿️ <strong>${s.totalSpots}</strong> spots — <strong>${s.availableSpots}</strong> available, <strong>${s.claimedSpots}</strong> claimed</p>
                <p>🤝 Tandems: <strong>${s.activeTandems}</strong> active, <strong>${s.pendingTandems}</strong> pending</p>
                <p>🚗 Carpools: <strong>${s.activeCarpools}</strong> active, <strong>${s.pendingCarpools}</strong> pending</p>
                <p>📋 <strong>${s.activeRentals}</strong> active rentals of <strong>${s.totalRentals}</strong> total</p>
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
        const res = await adminFetch('/admin-panel/users?limit=100');
        const data = await res.json();
        if (res.ok) displayUsers(data.users);
    } catch (error) {
        console.error('Load users error:', error);
    }
}

async function searchUsers() {
    const search = document.getElementById('userSearch').value;
    try {
        const res = await adminFetch(`/admin-panel/users?search=${encodeURIComponent(search)}`);
        const data = await res.json();
        if (res.ok) displayUsers(data.users);
    } catch (error) {
        console.error('Search users error:', error);
    }
}

function displayUsers(users) {
    const tbody = document.getElementById('usersTableBody');

    if (users.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="px-6 py-4 text-center text-gray-500">No users found</td></tr>';
        return;
    }

    tbody.innerHTML = users.map(user => `
        <tr class="hover:bg-gray-50">
            <td class="px-4 py-3 whitespace-nowrap">
                <div class="font-medium">${user.name || 'N/A'}</div>
                <div class="text-xs text-gray-400">${user.email}</div>
            </td>
            <td class="px-4 py-3 whitespace-nowrap">${badge(user.userType || 'N/A', 'blue')}</td>
            <td class="px-4 py-3 whitespace-nowrap">${statusBadge(user.accountStatus)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-xs">
                ${user.hasSpot ? `${user.spotLot || ''} ${user.parkingSpot || ''}`.trim() || 'Yes' : '—'}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs">
                ${[user.doesTandem && 'Tandem', user.doesCarpool && 'Carpool'].filter(Boolean).join(', ') || '—'}
            </td>
            <td class="px-4 py-3 whitespace-nowrap text-xs text-gray-400">${fmtDate(user.createdAt)}</td>
            <td class="px-4 py-3 whitespace-nowrap text-sm space-x-1">
                <button onclick='editUser("${user.id}")' class="text-blue-600 hover:text-blue-800">Edit</button>
                ${user.accountStatus !== 'banned'
                    ? `<button onclick='banUser("${user.id}")' class="text-yellow-600 hover:text-yellow-800">Ban</button>`
                    : `<button onclick='unbanUser("${user.id}")' class="text-green-600 hover:text-green-800">Unban</button>`
                }
                <button onclick='deleteUser("${user.id}", "${(user.name || user.email || '').replace(/'/g, "\\'")}")' class="text-red-600 hover:text-red-800">Delete</button>
            </td>
        </tr>
    `).join('');
}

async function editUser(userId) {
    try {
        const res = await adminFetch(`/admin-panel/users/${userId}`);
        const data = await res.json();

        if (res.ok) {
            const user = data.user;
            document.getElementById('editUserId').value = userId;
            document.getElementById('editUserName').value = user.name || '';
            document.getElementById('editUserEmail').value = user.email || '';
            document.getElementById('editUserPhone').value = user.phoneNumber || '';
            document.getElementById('editUserLicense').value = user.licensePlate || '';
            document.getElementById('editUserType').value = user.userType || 'JUNIOR';
            document.getElementById('editUserStatus').value = user.accountStatus || 'active';
            document.getElementById('editUserSpotLot').value = user.spotLot || '';
            document.getElementById('editUserSpotNumber').value = user.parkingSpot || '';
            document.getElementById('editUserHasSpot').checked = !!user.hasSpot;
            document.getElementById('editUserDoesTandem').checked = !!user.doesTandem;
            document.getElementById('editUserDoesCarpool').checked = !!user.doesCarpool;
            document.getElementById('editUserAddress').value = user.address || '';
            document.getElementById('editUserZipCode').value = user.zipCode || '';
            document.getElementById('editUserCommuteMethod').value = user.commuteMethod || '';

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
        accountStatus: document.getElementById('editUserStatus').value,
        spotLot: document.getElementById('editUserSpotLot').value,
        parkingSpot: document.getElementById('editUserSpotNumber').value,
        hasSpot: document.getElementById('editUserHasSpot').checked,
        doesTandem: document.getElementById('editUserDoesTandem').checked,
        doesCarpool: document.getElementById('editUserDoesCarpool').checked,
        address: document.getElementById('editUserAddress').value,
        zipCode: document.getElementById('editUserZipCode').value,
        commuteMethod: document.getElementById('editUserCommuteMethod').value,
    };

    try {
        const res = await adminFetch(`/admin-panel/users/${userId}`, {
            method: 'PUT',
            body: JSON.stringify(updates)
        });

        if (res.ok) {
            alert('User updated successfully');
            closeEditUserModal();
            loadAllUsers();
        } else {
            const data = await res.json();
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
        const res = await adminFetch(`/admin-panel/users/${userId}/ban`, {
            method: 'POST',
            body: JSON.stringify({ reason, type: duration ? 'temporary' : 'permanent', duration: duration || null })
        });

        if (res.ok) { alert('User banned successfully'); loadAllUsers(); }
        else { const data = await res.json(); alert('Error: ' + data.message); }
    } catch (error) {
        console.error('Ban user error:', error);
        alert('Failed to ban user');
    }
}

async function unbanUser(userId) {
    if (!confirm('Unban this user?')) return;

    try {
        const res = await adminFetch(`/admin-panel/users/${userId}/unban`, { method: 'POST' });
        if (res.ok) { alert('User unbanned successfully'); loadAllUsers(); }
        else { const data = await res.json(); alert('Error: ' + data.message); }
    } catch (error) {
        console.error('Unban user error:', error);
        alert('Failed to unban user');
    }
}

async function deleteUser(userId, displayName) {
    if (!confirm(`Permanently delete user "${displayName}"?\n\nThis will:\n• Remove their account\n• End their active matches\n• Release their parking spot\n• Delete all related data\n\nThis cannot be undone.`)) return;
    if (!confirm('Are you absolutely sure? This is irreversible.')) return;

    try {
        const res = await adminFetch(`/admin-panel/users/${userId}`, { method: 'DELETE' });
        if (res.ok) { alert('User permanently deleted'); loadAllUsers(); }
        else { const data = await res.json(); alert('Error: ' + (data.message || 'Delete failed')); }
    } catch (error) {
        console.error('Delete user error:', error);
        alert('Failed to delete user');
    }
}

// ==================== PARKING SPOTS ====================

async function loadAllSpots() {
    try {
        const res = await adminFetch('/admin-panel/spots');
        const data = await res.json();
        if (res.ok) displaySpots(data.spots);
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
        <div class="bg-white rounded-lg shadow p-5">
            <div class="flex justify-between items-start mb-3">
                <div>
                    <h3 class="font-bold text-lg">${spot.lot || 'Unknown'}</h3>
                    <p class="text-gray-600">Spot ${spot.number || 'N/A'}</p>
                </div>
                ${spot.isAvailable
                    ? badge('Available', 'green')
                    : badge(spot.ownerId ? 'Claimed' : 'Unavailable', 'red')
                }
            </div>
            <div class="text-sm space-y-1 mb-3">
                <p><strong>Type:</strong> ${spot.type || 'standard'}</p>
                ${spot.ownerId ? `<p><strong>Owner:</strong> ${spot.ownerId.substring(0, 8)}…</p>` : ''}
                ${spot.rentDays?.length ? `<p><strong>Rent days:</strong> ${spot.rentDays.join(', ')}</p>` : ''}
                ${spot.currentRenterId ? `<p><strong>Renter:</strong> ${spot.currentRenterId.substring(0, 8)}…</p>` : ''}
            </div>
            <div class="flex space-x-2">
                <button onclick='deleteSpot("${spot.id}")' class="flex-1 bg-red-600 text-white px-3 py-1.5 rounded text-sm hover:bg-red-700">Delete</button>
            </div>
        </div>
    `).join('');
}

async function deleteSpot(spotId) {
    if (!confirm('Delete this parking spot?')) return;

    try {
        const res = await adminFetch(`/admin-panel/spots/${spotId}`, { method: 'DELETE' });
        if (res.ok) { alert('Spot deleted successfully'); loadAllSpots(); }
        else { const data = await res.json(); alert('Error: ' + data.message); }
    } catch (error) {
        console.error('Delete spot error:', error);
        alert('Failed to delete spot');
    }
}

// ==================== MATCHES (TANDEMS & CARPOOLS) ====================

async function loadMatches(type) {
    const containerId = type === 'tandem' ? 'tandemsContainer' : 'carpoolsContainer';
    const container = document.getElementById(containerId);
    container.innerHTML = '<p class="text-gray-500">Loading…</p>';

    try {
        const res = await adminFetch(`/admin-panel/matches?type=${type}`);
        const data = await res.json();

        if (!res.ok || !data.matches?.length) {
            container.innerHTML = `<p class="text-gray-500">No ${type} matches found.</p>`;
            return;
        }

        const active = data.matches.filter(m => m.status === 'active');
        const pending = data.matches.filter(m => m.status === 'pending');
        const ended = data.matches.filter(m => ['ended', 'declined'].includes(m.status));

        container.innerHTML = `
            <div class="mb-4 flex gap-4 text-sm">
                <span class="font-medium">${badge(active.length + ' active', 'green')} ${badge(pending.length + ' pending', 'yellow')} ${badge(ended.length + ' ended/declined', 'gray')}</span>
            </div>
            <div class="overflow-x-auto">
                <table class="min-w-full divide-y divide-gray-200 text-sm">
                    <thead class="bg-gray-50">
                        <tr>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Requester</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Target</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                            <th class="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
                        </tr>
                    </thead>
                    <tbody class="divide-y divide-gray-200">
                        ${data.matches.map(m => `
                            <tr class="hover:bg-gray-50">
                                <td class="px-4 py-2">${m.requesterName}</td>
                                <td class="px-4 py-2">${m.targetName}</td>
                                <td class="px-4 py-2">${statusBadge(m.status)}</td>
                                <td class="px-4 py-2 text-gray-400">${fmtDate(m.createdAt)}</td>
                                <td class="px-4 py-2">
                                    ${['active', 'pending'].includes(m.status)
                                        ? `<button onclick='endMatch("${m.id}", "${type}")' class="text-red-600 hover:text-red-800 text-xs">End</button>`
                                        : '<span class="text-gray-400 text-xs">—</span>'
                                    }
                                </td>
                            </tr>
                        `).join('')}
                    </tbody>
                </table>
            </div>
        `;
    } catch (error) {
        console.error(`Load ${type} matches error:`, error);
        container.innerHTML = `<p class="text-red-500">Failed to load ${type} matches.</p>`;
    }
}

async function endMatch(matchId, type) {
    if (!confirm('Force-end this match?')) return;

    try {
        const res = await adminFetch(`/admin-panel/matches/${matchId}/end`, { method: 'PUT' });
        if (res.ok) { alert('Match ended'); loadMatches(type); }
        else { const data = await res.json(); alert('Error: ' + data.message); }
    } catch (error) {
        console.error('End match error:', error);
        alert('Failed to end match');
    }
}

// ==================== RENTALS ====================

async function loadRentals() {
    const tbody = document.getElementById('rentalsTableBody');
    tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">Loading…</td></tr>';

    try {
        const res = await adminFetch('/admin-panel/rentals');
        const data = await res.json();

        if (!res.ok || !data.rentals?.length) {
            tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-gray-500">No rentals found.</td></tr>';
            return;
        }

        tbody.innerHTML = data.rentals.map(r => `
            <tr class="hover:bg-gray-50">
                <td class="px-4 py-3 text-sm">${r.renterName || r.renterId?.substring(0, 8) || '—'}</td>
                <td class="px-4 py-3 text-sm">${r.lot || ''} ${r.spotNumber || ''}</td>
                <td class="px-4 py-3 text-sm text-gray-500">${fmtDate(r.startDate)} → ${fmtDate(r.endDate)}</td>
                <td class="px-4 py-3">${statusBadge(r.status)}</td>
                <td class="px-4 py-3 text-sm text-gray-400">${fmtDate(r.createdAt)}</td>
                <td class="px-4 py-3 text-sm">
                    ${r.status === 'active'
                        ? `<button onclick='cancelRental("${r.id}")' class="text-red-600 hover:text-red-800 text-xs">Cancel</button>`
                        : '<span class="text-gray-400 text-xs">—</span>'
                    }
                </td>
            </tr>
        `).join('');
    } catch (error) {
        console.error('Load rentals error:', error);
        tbody.innerHTML = '<tr><td colspan="6" class="px-6 py-4 text-center text-red-500">Failed to load rentals.</td></tr>';
    }
}

async function cancelRental(rentalId) {
    if (!confirm('Cancel this rental?')) return;

    try {
        const res = await adminFetch(`/admin-panel/rentals/${rentalId}/cancel`, { method: 'PUT' });
        if (res.ok) { alert('Rental cancelled'); loadRentals(); }
        else { const data = await res.json(); alert('Error: ' + data.message); }
    } catch (error) {
        console.error('Cancel rental error:', error);
        alert('Failed to cancel rental');
    }
}

// ==================== SYSTEM CONTROL ====================

async function loadSystemStatus() {
    try {
        const res = await adminFetch('/admin-panel/system/status');
        const data = await res.json();

        if (res.ok) {
            const statusHtml = data.appActive
                ? '<div class="p-4 bg-green-100 text-green-800 rounded-md"><strong>✅ App is Active</strong><p class="text-sm mt-1">Users can access the app normally</p></div>'
                : `<div class="p-4 bg-red-100 text-red-800 rounded-md"><strong>🔒 App is Frozen</strong><p class="text-sm mt-1">${data.message || 'App is temporarily unavailable'}</p></div>`;

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
        const res = await adminFetch('/admin-panel/system/freeze', {
            method: 'POST',
            body: JSON.stringify({ message })
        });
        if (res.ok) { alert('App frozen successfully'); loadSystemStatus(); }
        else { const data = await res.json(); alert('Error: ' + data.message); }
    } catch (error) {
        console.error('Freeze app error:', error);
        alert('Failed to freeze app');
    }
}

async function unfreezeApp() {
    if (!confirm('Re-enable app access for all users?')) return;

    try {
        const res = await adminFetch('/admin-panel/system/unfreeze', { method: 'POST' });
        if (res.ok) { alert('App unfrozen successfully'); loadSystemStatus(); }
        else { const data = await res.json(); alert('Error: ' + data.message); }
    } catch (error) {
        console.error('Unfreeze app error:', error);
        alert('Failed to unfreeze app');
    }
}
