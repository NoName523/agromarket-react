# Changelog

All notable changes to this project are documented in this file. This project follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/) and [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [1.0.0] - 2026-11-15

### Added

- React storefront with a product catalog, category filtering, and product cards.
- Login and registration forms, product submission, and order-related interfaces integrated with the REST API.
- Client-side form validation using shared Zod schemas synchronized from the backend source.
- Component tests with Vitest and browser end-to-end tests with Playwright.

### Changed

- Forms send schema-validated, normalized data to the API and display API validation feedback beside the relevant fields.

### Fixed

- Failed API requests are surfaced as visible error messages in the relevant forms and panels.

### Security

- Added an XSS regression test confirming that a product name such as `<img src=x onerror=alert(1)>` is rendered as text, without creating an injected image element or running its event handler.
