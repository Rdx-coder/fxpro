# API Test Suite

This project includes automated pytest coverage for critical backend flows:

- Auth + profile flow
- Admin authorization checks
- Deposit approval wallet credit
- Withdrawal insufficient balance and rejection refund path
- Trade execute/close flow
- Admin trade create/update/close flow

## Requirements

Set a MongoDB URL for tests (separate test DB is created and dropped automatically):

```cmd
set TEST_MONGO_URL=mongodb://localhost:27017
```

## Run Tests

```cmd
cd backend
.\.venv\Scripts\python.exe -m pytest -rs
```

## Notes

- Tests auto-skip if `TEST_MONGO_URL` (or `MONGO_URL`) is missing.
- Test DB name is randomized per run.
- Collections are cleaned before each test.
- The test database is dropped after the session.
