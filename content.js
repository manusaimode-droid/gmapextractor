(async () => {
    console.log('Maps Extractor: Content script started');
    const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

    const getFeed = () => document.querySelector('div[role="feed"]');

    if (!getFeed()) {
        console.log('Waiting for feed...');
        await delay(3000);
    }

    const feed = getFeed();
    if (!feed) {
        console.error('Feed not found.');
        chrome.runtime.sendMessage({ action: 'done' });
        return;
    }

    let sameHeightCount = 0;
    let maxScrolls = 500;
    let scrolls = 0;
    let isStopped = false;

    // Listen for Stop
    chrome.runtime.onMessage.addListener((req) => {
        if (req.action === 'stop') {
            isStopped = true;
            console.log('Stop requested.');
        }
    });

    console.log('Starting continuous extraction...');

    async function extractVisibleItems() {
        if (isStopped) return;
        const items = Array.from(document.querySelectorAll('div[role="article"]'));
        for (const item of items) {
            if (isStopped) break;
            try {
                const nameEl = item.querySelector('div.fontHeadlineSmall') || item.querySelector('[aria-label]');
                let name = nameEl ? nameEl.textContent.trim() : '';
                if (!name && item.getAttribute('aria-label')) name = item.getAttribute('aria-label');

                if (!name) continue;

                const websiteEl = item.querySelector('a[data-value="Website"]');
                let website = websiteEl ? websiteEl.href : '';

                if (!website) {
                    const links = Array.from(item.querySelectorAll('a'));
                    for (const l of links) {
                        if (l.href && !l.href.includes('google.com/maps') && !l.href.includes('google.com/search')) {
                            website = l.href;
                            break;
                        }
                    }
                }

                if (website && website.includes('google.com/url')) {
                    try {
                        const urlObj = new URL(website);
                        const q = urlObj.searchParams.get('q');
                        if (q) website = q;
                    } catch (e) { }
                }

                const textContent = item.innerText;
                const phoneMatch = textContent.match(/(\+\d{1,3}[- ]?)?\(?\d{3}\)?[- ]?\d{3}[- ]?\d{4}/);
                const phone = phoneMatch ? phoneMatch[0] : '';

                let address = textContent.split('\n').filter(line =>
                    line !== name &&
                    !line.includes('reviews') &&
                    !line.includes('Open') &&
                    !line.includes('Closed') &&
                    line !== phone &&
                    line.length > 5
                ).join(', ');

                let email = 'N/A';
                if (website) {
                    try {
                        const response = await chrome.runtime.sendMessage({ action: 'fetchEmail', url: website });
                        if (response && response.email) {
                            email = response.email;
                        }
                    } catch (e) {
                        console.log('Error asking background for email', e);
                    }
                }

                const record = { name, email, phone, address, website };
                chrome.runtime.sendMessage({ action: 'newRecord', record });

            } catch (err) {
                console.error('Error parsing item:', err);
            }
        }
    }

    while (sameHeightCount < 5 && scrolls < maxScrolls) {
        if (isStopped) {
            console.log('Extraction stopped by user.');
            chrome.runtime.sendMessage({ action: 'done' });
            return;
        }

        await extractVisibleItems();

        feed.scrollBy(0, window.innerHeight);
        await delay(1500);

        if (Math.ceil(feed.scrollTop + feed.clientHeight) >= feed.scrollHeight) {
            await delay(1000);
            if (Math.ceil(feed.scrollTop + feed.clientHeight) >= feed.scrollHeight) {
                sameHeightCount++;
            } else {
                sameHeightCount = 0;
            }
        } else {
            sameHeightCount = 0;
        }

        scrolls++;
        if (document.body.innerText.includes("You've reached the end of the list")) break;
    }

    await extractVisibleItems();
    console.log('Extraction finished.');
    chrome.runtime.sendMessage({ action: 'done' });

})();
