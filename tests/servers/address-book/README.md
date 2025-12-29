# SDMUI Address Book Example Server

A minimal Express server exposing dummy in-memory data and simple SDMUI form descriptors for the Single Entity Form prototype.

- Port: 8181
- Endpoints:
  - REST
    - GET /api/address, GET /api/address/:id, POST /api/address, POST /api/address/:id
    - GET /api/person,  GET /api/person/:id,  POST /api/person,  POST /api/person/:id
    - GET /api/company, GET /api/company/:id, POST /api/company, POST /api/company/:id
  - SDMUI Form descriptors
    - GET /sdmui/address/:id
    - GET /sdmui/person/:id (email read-only)
    - GET /sdmui/company/:id

## Usage

# Using root devDependencies (recommended)
pnpm tsx tests/servers/address-book/server.ts

# Or via a root script (after we add it)
pnpm run server:address-book

