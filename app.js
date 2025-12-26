// Encrypted credentials (Base64 encoded)
const encryptedCredentials = {
    username: "U0VCUExD", // Base64 for "SEBPLC"
    password: "U0VCUExDQDEyMw==" // Base64 for "SEBPLC@123"
};

// Function to decode base64
function decodeBase64(str) {
    return atob(str);
}

// CSV data URL
const csvUrl = "https://docs.google.com/spreadsheets/d/e/2PACX-1vRAcDCwak1NDm2MGl9ofFK33yD8SidHer4VARtJCaFWNS-T2l9fdOnPLM_zyQIklRfsxRAlvLpfNWyf/pub?gid=0&single=true&output=csv";

let applicationsData = [];
let table;

// DOM elements
const loginContainer = document.getElementById('loginContainer');
const dashboardContainer = document.getElementById('dashboardContainer');
const loginForm = document.getElementById('loginForm');
const errorMessage = document.getElementById('errorMessage');
const logoutBtn = document.getElementById('logoutBtn');
const exportBtn = document.getElementById('exportExcel');
const resetFiltersBtn = document.getElementById('resetFilters');
const keywordSearch = document.getElementById('keywordSearch');
const dateFilter = document.getElementById('dateFilter');
const divisionFilter = document.getElementById('divisionFilter');

// Update current date
function updateCurrentDate() {
    const now = new Date();
    const options = { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' };
    document.getElementById('currentDate').textContent = now.toLocaleDateString('en-US', options);
}

// Login handler
loginForm.addEventListener('submit', function (e) {
    e.preventDefault();

    const username = document.getElementById('username').value;
    const password = document.getElementById('password').value;

    // Decode and compare credentials
    const correctUsername = decodeBase64(encryptedCredentials.username);
    const correctPassword = decodeBase64(encryptedCredentials.password);

    if (username === correctUsername && password === correctPassword) {
        // Successful login - store in localStorage
        localStorage.setItem('sebAdminLoggedIn', 'true');
        localStorage.setItem('sebAdminLoginTime', new Date().toISOString());

        // Show dashboard
        loginContainer.style.display = 'none';
        dashboardContainer.style.display = 'block';
        errorMessage.style.display = 'none';

        // Update date and load data
        updateCurrentDate();
        loadCSVData();
    } else {
        errorMessage.style.display = 'block';
        document.getElementById('password').value = '';
    }
});

// Logout handler
logoutBtn.addEventListener('click', function () {
    // Clear localStorage and reload page
    localStorage.removeItem('sebAdminLoggedIn');
    localStorage.removeItem('sebAdminLoginTime');
    location.reload();
});

// Check if user is already logged in
function checkLoginStatus() {
    const isLoggedIn = localStorage.getItem('sebAdminLoggedIn');
    const loginTime = localStorage.getItem('sebAdminLoginTime');

    if (isLoggedIn === 'true' && loginTime) {
        // Check if login is within 24 hours (for security)
        const loginDate = new Date(loginTime);
        const now = new Date();
        const hoursSinceLogin = (now - loginDate) / (1000 * 60 * 60);

        if (hoursSinceLogin < 24) { // Session valid for 24 hours
            loginContainer.style.display = 'none';
            dashboardContainer.style.display = 'block';
            updateCurrentDate();
            loadCSVData();
            return true;
        } else {
            // Session expired
            localStorage.removeItem('sebAdminLoggedIn');
            localStorage.removeItem('sebAdminLoginTime');
        }
    }
    return false;
}

// Load CSV data
function loadCSVData() {
    fetch(csvUrl)
        .then(response => response.text())
        .then(csvText => {
            parseCSVData(csvText);
        })
        .catch(error => {
            console.error('Error loading CSV:', error);
            // Fallback to sample data if CSV can't be loaded
            loadSampleData();
        });
}

// Parse CSV data with proper date sorting
function parseCSVData(csvText) {
    const rows = csvText.split('\n');
    const headers = rows[0].split(',').map(h => h.trim());

    applicationsData = [];

    for (let i = 1; i < rows.length; i++) {
        if (rows[i].trim() === '') continue;

        // Handle CSV with commas in values
        const values = [];
        let insideQuotes = false;
        let currentValue = '';

        for (let char of rows[i]) {
            if (char === '"') {
                insideQuotes = !insideQuotes;
            } else if (char === ',' && !insideQuotes) {
                values.push(currentValue.trim());
                currentValue = '';
            } else {
                currentValue += char;
            }
        }
        values.push(currentValue.trim());

        // Ensure we have all columns
        while (values.length < headers.length) {
            values.push('');
        }

        const rowData = {};
        headers.forEach((header, index) => {
            rowData[header] = values[index] || '';
        });

        applicationsData.push(rowData);
    }

    // Sort by timestamp in descending order (newest first)
    applicationsData.sort((a, b) => {
        const dateA = parseDate(a.Timestamp);
        const dateB = parseDate(b.Timestamp);
        return dateB - dateA; // Descending order
    });

    initializeTable();
    updateStats();
    updateLastUpdated();
}

// Helper function to parse various date formats
function parseDate(dateString) {
    if (!dateString) return new Date(0);

    // Try multiple date formats
    const dateFormats = [
        'YYYY-MM-DD HH:mm:ss',
        'YYYY/MM/DD HH:mm:ss',
        'MM/DD/YYYY HH:mm:ss',
        'DD-MM-YYYY HH:mm:ss',
        'DD/MM/YYYY HH:mm:ss',
        'YYYY-MM-DD',
        'MM/DD/YYYY'
    ];

    for (let format of dateFormats) {
        const parsed = moment(dateString, format, true);
        if (parsed.isValid()) {
            return parsed.toDate();
        }
    }

    // Fallback to Date.parse
    const parsed = new Date(dateString);
    return isNaN(parsed) ? new Date(0) : parsed;
}

// Initialize DataTable with proper date sorting
function initializeTable() {
    if ($.fn.DataTable.isDataTable('#applicationsTable')) {
        table.destroy();
        $('#applicationsTable tbody').empty();
    }

    const tableBody = document.getElementById('tableBody');
    tableBody.innerHTML = '';

    // Populate division filter
    const divisions = [...new Set(applicationsData.map(item => item.Division).filter(Boolean))];
    divisionFilter.innerHTML = '<option value="">All Divisions</option>';
    divisions.forEach(division => {
        divisionFilter.innerHTML += `<option value="${division}">${division}</option>`;
    });

    // Populate table
    applicationsData.forEach((row, index) => {
        const tr = document.createElement('tr');

        // Format date for display
        let formattedDate = row.Timestamp || '';
        if (formattedDate) {
            const date = parseDate(formattedDate);
            if (date && !isNaN(date.getTime())) {
                formattedDate = date.toLocaleString('en-US', {
                    year: 'numeric',
                    month: 'short',
                    day: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit'
                });
            }
        }

        // Format income with commas
        let incomeFormatted = row.Income || '0';
        if (incomeFormatted && !isNaN(incomeFormatted.replace(/[^0-9.-]+/g, ""))) {
            incomeFormatted = parseFloat(incomeFormatted.replace(/[^0-9.-]+/g, "")).toLocaleString('en-US');
        }

        tr.innerHTML = `
                    <td data-order="${parseDate(row.Timestamp).getTime()}">${formattedDate}</td>
                    <td>${row.Name || ''}</td>
                    <td class="contact-cell">${row.Contact || ''}</td>
                    <td>${row.Profession || ''}</td>
                    <td>${row.Organization || ''}</td>
                    <td class="income-cell">${incomeFormatted}</td>
                    <td>${row.Division || ''}</td>
                    <td class="address-cell">${row['Organization Address'] || ''}</td>
                `;

        tableBody.appendChild(tr);
    });

    // Initialize DataTable with proper sorting
    table = $('#applicationsTable').DataTable({
        pageLength: 25,
        order: [[0, 'desc']], // Sort by first column (Timestamp) in descending order
        responsive: true,
        dom: '<"top"lf>rt<"bottom"ip><"clear">',
        language: {
            search: "Quick Filter:",
            lengthMenu: "Show _MENU_ entries"
        },
        columnDefs: [
            {
                type: 'date',
                targets: 0 // Date column for proper sorting
            }
        ]
    });

    // Update record count
    document.getElementById('recordCount').textContent = applicationsData.length;

    // Add search functionality
    keywordSearch.addEventListener('keyup', function () {
        table.search(this.value).draw();
    });

    // Add date filter
    dateFilter.addEventListener('change', function () {
        if (this.value) {
            const selectedDate = new Date(this.value);
            table.column(0).search(selectedDate.toISOString().split('T')[0]).draw();
        } else {
            table.column(0).search('').draw();
        }
    });

    // Add division filter
    divisionFilter.addEventListener('change', function () {
        table.column(6).search(this.value).draw();
    });
}

// Update statistics
function updateStats() {
    // Update total applications
    document.getElementById('totalApplications').textContent = applicationsData.length;

    // Calculate today's applications
    const today = new Date();
    const todayStr = today.toDateString();
    const todayApplications = applicationsData.filter(item => {
        const itemDate = parseDate(item.Timestamp);
        return itemDate.toDateString() === todayStr;
    });
    document.getElementById('todayApplications').textContent = todayApplications.length;

    // Count unique organizations
    const organizations = new Set();
    applicationsData.forEach(item => {
        if (item.Organization) organizations.add(item.Organization);
    });
    document.getElementById('organizationsCount').textContent = organizations.size;
}

// Update last updated timestamp
function updateLastUpdated() {
    const now = new Date();
    document.getElementById('lastUpdated').textContent = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

// Export to Excel
exportBtn.addEventListener('click', function () {
    // Prepare data for export
    const exportData = applicationsData.map(item => ({
        Timestamp: item.Timestamp || '',
        Name: item.Name || '',
        Contact: item.Contact || '',
        Profession: item.Profession || '',
        Organization: item.Organization || '',
        Income: item.Income || '',
        Division: item.Division || '',
        'Organization Address': item['Organization Address'] || ''
    }));

    // Create worksheet
    const ws = XLSX.utils.json_to_sheet(exportData);

    // Create workbook
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Applications");

    // Generate filename with current date
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `SEB_CreditCard_Applications_${dateStr}.xlsx`;

    // Save file
    XLSX.writeFile(wb, filename);
});

// Reset filters
resetFiltersBtn.addEventListener('click', function () {
    keywordSearch.value = '';
    dateFilter.value = '';
    divisionFilter.value = '';

    if (table) {
        table.search('').columns().search('').draw();
        // Reset to original order (newest first)
        table.order([0, 'desc']).draw();
    }
});

// Load sample data if CSV fails (for demo purposes)
function loadSampleData() {
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    const twoDaysAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000);
    const threeDaysAgo = new Date(now.getTime() - 72 * 60 * 60 * 1000);

    applicationsData = [
        {
            Timestamp: now.toISOString(),
            Name: "John Doe",
            Contact: "+8801712345678",
            Profession: "Software Engineer",
            Organization: "Tech Solutions Ltd",
            Income: "85000",
            Division: "Dhaka",
            "Organization Address": "123 Tech Street, Banani, Dhaka 1213"
        },
        {
            Timestamp: now.toISOString(),
            Name: "Sarah Johnson",
            Contact: "+8801723456789",
            Profession: "Accountant",
            Organization: "Finance Corp",
            Income: "55000",
            Division: "Dhaka",
            "Organization Address": "456 Finance Road, Gulshan, Dhaka"
        },
        {
            Timestamp: yesterday.toISOString(),
            Name: "Jane Smith",
            Contact: "+8801812345678",
            Profession: "Marketing Manager",
            Organization: "Global Marketing Inc",
            Income: "65000",
            Division: "Chittagong",
            "Organization Address": "456 Business Avenue, Agrabad, Chittagong"
        },
        {
            Timestamp: twoDaysAgo.toISOString(),
            Name: "Ahmed Khan",
            Contact: "+8801912345678",
            Profession: "Bank Manager",
            Organization: "Prime Bank",
            Income: "120000",
            Division: "Dhaka",
            "Organization Address": "789 Finance Road, Motijheel, Dhaka 1000"
        },
        {
            Timestamp: threeDaysAgo.toISOString(),
            Name: "Fatima Begum",
            Contact: "+8801612345678",
            Profession: "Doctor",
            Organization: "City Hospital",
            Income: "95000",
            Division: "Sylhet",
            "Organization Address": "321 Medical Center, Zindabazar, Sylhet"
        },
        {
            Timestamp: new Date(threeDaysAgo.getTime() - 24 * 60 * 60 * 1000).toISOString(),
            Name: "Robert Brown",
            Contact: "+8801512345678",
            Profession: "University Professor",
            Organization: "North South University",
            Income: "110000",
            Division: "Dhaka",
            "Organization Address": "Bashundhara R/A, Dhaka 1229"
        }
    ];

    // Sort by timestamp in descending order
    applicationsData.sort((a, b) => {
        return new Date(b.Timestamp || 0) - new Date(a.Timestamp || 0);
    });

    initializeTable();
    updateStats();
    updateLastUpdated();
}

// Auto-refresh data every 5 minutes
setInterval(() => {
    if (dashboardContainer.style.display !== 'none') {
        loadCSVData();
    }
}, 300000);

// Initialize on page load
document.addEventListener('DOMContentLoaded', function () {
    updateCurrentDate();

    // Check if user is already logged in
    if (!checkLoginStatus()) {
        loginContainer.style.display = 'block';
        dashboardContainer.style.display = 'none';
    }
});