// Open Side Panel on icon click
chrome.action.onClicked.addListener((tab) => {
    chrome.sidePanel.open({ windowId: tab.windowId });
});

let searchTabId = null;

chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
    if (request.action === 'startSearch') {
        const { keyword, location, country } = request;
        const query = encodeURIComponent(`${keyword} ${location} ${country || ''}`);
        const url = `https://www.google.com/maps/search/${query}`;

        chrome.storage.local.set({ isSearching: true, status: 'Opening Google Maps...' });

        chrome.tabs.create({ url: url }, (tab) => {
            searchTabId = tab.id; // Store ID
            chrome.tabs.onUpdated.addListener(function listener(tabId, changeInfo) {
                if (tabId === tab.id && changeInfo.status === 'complete') {
                    chrome.tabs.onUpdated.removeListener(listener);

                    chrome.storage.local.set({ status: 'Injecting scraper...' });

                    chrome.scripting.executeScript({
                        target: { tabId: tabId },
                        files: ['content.js']
                    }, () => {
                        if (chrome.runtime.lastError) {
                            console.error(chrome.runtime.lastError);
                            chrome.storage.local.set({ isSearching: false, status: 'Error injecting script.' });
                        }
                    });
                }
            });
        });
    }

    if (request.action === 'stopSearch') {
        if (searchTabId) {
            chrome.tabs.sendMessage(searchTabId, { action: 'stop' }).catch(() => {
                // Tab might be closed
                chrome.storage.local.set({ isSearching: false, status: 'Stopped (Tab closed).' });
            });
        } else {
            chrome.storage.local.set({ isSearching: false, status: 'Stopped.' });
        }
    }

    if (request.action === 'newRecord') {
        chrome.storage.local.get(['results'], (data) => {
            const results = data.results || [];
            // Avoid duplicates
            const exists = results.some(r => r.name === request.record.name && (r.address === request.record.address || r.phone === request.record.phone));

            if (!exists) {
                results.push(request.record);
                chrome.storage.local.set({ results: results });
            }
        });
    }

    if (request.action === 'done') {
        chrome.storage.local.set({ isSearching: false, status: 'Extraction complete.' });
    }

    // Handle Email Fetching in Background
    if (request.action === 'fetchEmail') {
        fetch(request.url)
            .then(response => response.text())
            .then(html => {
                const mailtoMatch = html.match(/mailto:([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/);
                if (mailtoMatch) {
                    sendResponse({ email: mailtoMatch[1] });
                    return;
                }

                const emailRegex = /([a-zA-Z0-9._-]+@[a-zA-Z0-9._-]+\.[a-zA-Z0-9._-]+)/gi;
                const matches = html.match(emailRegex);
                let email = 'N/A';

                if (matches && matches.length > 0) {
                    const validEmails = matches.filter(e =>
                        !e.includes('.png') &&
                        !e.includes('.jpg') &&
                        !e.includes('.svg') &&
                        !e.includes('sentry') &&
                        !e.includes('example.com') &&
                        !e.includes('wixpress.com')
                    );
                    if (validEmails.length > 0) email = validEmails[0];
                }
                sendResponse({ email: email });
            })
            .catch(err => {
                console.error('Fetch error:', err);
                sendResponse({ email: 'N/A' });
            });

        return true;
    }
});
