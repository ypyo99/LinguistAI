const puppeteer = require('puppeteer');

(async () => {
  const browser = await puppeteer.launch({ args: ['--no-sandbox', '--disable-setuid-sandbox'] });
  const page = await browser.newPage();
  
  page.on('console', msg => console.log('PAGE LOG:', msg.text()));
  page.on('pageerror', error => console.log('PAGE ERROR:', error.message));
  page.on('requestfailed', request => console.log('REQUEST FAILED:', request.url(), request.failure().errorText));

  try {
    console.log('Navigating to Netlify...');
    await page.goto('https://linguistai2.netlify.app/', { waitUntil: 'networkidle0' });
    console.log('Finished loading.');
  } catch (e) {
    console.log('Error navigating:', e.message);
  }
  
  await browser.close();
})();
