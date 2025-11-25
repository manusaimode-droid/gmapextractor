document.addEventListener('DOMContentLoaded', () => {
    const startBtn = document.getElementById('startBtn');
    const clearBtn = document.getElementById('clearBtn');
    const exportBtn = document.getElementById('exportBtn');

    const keywordInput = document.getElementById('keyword');
    const locationInput = document.getElementById('location');
    const countryInput = document.getElementById('country');
    const filenameInput = document.getElementById('filename');

    const resultsTableBody = document.querySelector('#resultsTable tbody');
    const statusText = document.getElementById('statusText');
    const countBadge = document.getElementById('countBadge');

    let isRunning = false;

    // Load state
    chrome.storage.local.get(['results', 'isSearching', 'status'], (data) => {
        if (data.results) renderTable(data.results);
        if (data.isSearching) {
            isRunning = true;
            setRunningState(true);
        }
        if (data.status) statusText.textContent = data.status;
    });

    // Start/Stop Button
    startBtn.addEventListener('click', () => {
        if (isRunning) {
            // STOP Logic
            chrome.runtime.sendMessage({ action: 'stopSearch' });
            statusText.textContent = 'Stopping...';
            return;
        }

        // START Logic
        const keyword = keywordInput.value.trim();
        const location = locationInput.value.trim();
        const country = countryInput.value.trim();

        if (!keyword || !location) {
            statusText.textContent = 'Keyword and Location required.';
            statusText.style.color = 'var(--danger)';
            return;
        }

        statusText.style.color = '';

        chrome.storage.local.set({ results: [] }, () => {
            renderTable([]);
            chrome.runtime.sendMessage({
                action: 'startSearch',
                keyword,
                location,
                country
            });
            setRunningState(true);
        });
    });

    // Clear Results
    clearBtn.addEventListener('click', () => {
        if (confirm('Are you sure you want to clear all results?')) {
            chrome.storage.local.set({ results: [] }, () => {
                renderTable([]);
                statusText.textContent = 'Results cleared.';
            });
        }
    });

    // Export
    exportBtn.addEventListener('click', () => {
        const filename = filenameInput.value.trim() || 'leads_export';
        chrome.storage.local.get(['results'], (data) => {
            if (data.results && data.results.length > 0) {
                exportToExcel(data.results, filename);
            } else {
                statusText.textContent = 'No data to export.';
            }
        });
    });

    // Listen for updates
    chrome.storage.onChanged.addListener((changes, namespace) => {
        if (namespace === 'local') {
            if (changes.results) {
                renderTable(changes.results.newValue);
            }
            if (changes.status) {
                statusText.textContent = changes.status.newValue;
            }
            if (changes.isSearching) {
                if (changes.isSearching.newValue === false) {
                    setRunningState(false);
                } else {
                    setRunningState(true);
                }
            }
        }
    });

    function renderTable(results) {
        resultsTableBody.innerHTML = '';
        if (!results) {
            countBadge.textContent = '0';
            return;
        }

        countBadge.textContent = results.length;

        results.forEach(row => {
            const tr = document.createElement('tr');
            tr.innerHTML = `
        <td title="${row.name}">${row.name}</td>
        <td title="${row.email}">${row.email}</td>
        <td title="${row.phone}">${row.phone}</td>
        <td title="${row.address}">${row.address}</td>
        <td title="${row.website}"><a href="${row.website}" target="_blank" style="color:var(--primary);text-decoration:none;">Link</a></td>
      `;
            resultsTableBody.appendChild(tr);
        });
    }

    function setRunningState(active) {
        isRunning = active;
        if (active) {
            startBtn.innerHTML = '<span>Stop Extraction</span>';
            startBtn.style.backgroundColor = 'var(--danger)';
            startBtn.style.boxShadow = '0 4px 6px -1px rgba(239, 68, 68, 0.25)';
            statusText.textContent = 'Scraping in progress...';
        } else {
            startBtn.innerHTML = '<span>Start Extraction</span>';
            startBtn.style.backgroundColor = 'var(--primary)';
            startBtn.style.boxShadow = '0 4px 6px -1px rgba(59, 130, 246, 0.25)';
            // statusText.textContent = 'Ready'; // Don't overwrite "Done" or "Stopped" immediately
        }
    }
});
