# Staging URLs (deployed 22 Nov 2026)

- Staff dashboard and API: https://truthful-pro-api-v2-staging.mrkmallah.workers.dev
- Customer app web preview: https://truthful-pro-app-staging.pages.dev
- Android APK: built by EAS with the `staging` profile (`mobile/eas.json`), pointed at the API above.

Deployed from commit c91d721 (all 17 migrations applied to `truthful-pro-v2-staging-db`).
Secrets set on the Worker: PEPPER, DATA_KEY, OWNER_SETUP_KEY. OWNER_PHONE and STAGING_TESTER_PHONES are added once the owner gives the numbers.
No WhatsApp sending, email or payments are configured (health: `email:false`, scanner `fake-test`).
