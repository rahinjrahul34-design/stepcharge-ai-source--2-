# Firebase Security Rules — automated tests

33 assertions run against the real Firebase Realtime Database emulator.
No Firebase project, billing account or network access is required.

```bash
cd tests/rules
npm install
npm test          # needs Java 11+ for the emulator
```

Covers: unauthenticated denial, authenticated reads, device-ownership writes,
`actualState` forgery prevention, payload range validation, append-only
history, dataset label validation, config lock-down, and undeclared paths.
