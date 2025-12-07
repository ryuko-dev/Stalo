# Stalo - Project Budget Allocation Manager

A full-stack application for managing project budgets and personnel allocations with monthly tracking and visualization.

## Features

- 📊 **Project Management**: View and manage multiple projects with budgets
- 👥 **Personnel Allocation**: Assign budgeted positions to actual resources
- 📅 **Monthly Tracking**: Track allocations on a monthly basis
- 📈 **Progress Visualization**: Progress bars showing budget coverage
- 📋 **Detailed Tables**: Comprehensive views of all allocations

## Tech Stack

### Backend
- Node.js + Express
- TypeScript
- Azure SQL Database (mssql)
- RESTful API

### Frontend
- React 18
- TypeScript
- Vite
- Material-UI (MUI)
- React Query
- React Router
- Recharts
- date-fns

## Project Structure

```
Stalo/
├── backend/
│   ├── src/
│   │   ├── config/
│   │   │   └── database.ts
│   │   ├── models/
│   │   │   └── types.ts
│   │   ├── routes/
│   │   │   ├── projects.ts
│   │   │   ├── resources.ts
│   │   │   └── allocations.ts
│   │   └── server.ts
│   ├── package.json
│   └── tsconfig.json
└── frontend/
    ├── src/
    │   ├── pages/
    │   │   ├── ProjectList.tsx
    │   │   ├── ProjectDetail.tsx
    │   │   └── AllocationManager.tsx
    │   ├── services/
    │   │   ├── api.ts
    │   │   └── staloService.ts
    │   ├── types/
    │   │   └── index.ts
    │   ├── App.tsx
    │   └── main.tsx
    ├── package.json
    └── vite.config.ts
```

## Setup Instructions

### Prerequisites
- Node.js (v18 or higher)
- Azure SQL Database

### 1. Configure Database

1. Copy the example environment file:
   ```powershell
   cd backend
   cp .env.example .env
   ```

2. Edit `.env` and add your Azure SQL Database credentials:
   ```
   PORT=5000
   DB_SERVER=your-azure-server.database.windows.net
   DB_DATABASE=your-database-name
   DB_USER=your-username
   DB_PASSWORD=your-password
   DB_ENCRYPT=true
   ```

### 2. Start Backend

```powershell
cd backend
npm run dev
```

The backend server will start on http://localhost:5000

### 3. Start Frontend

```powershell
cd frontend
npm run dev
```

The frontend will start on http://localhost:3000

## API Endpoints

### Projects
- `GET /api/projects` - Get all projects
- `GET /api/projects/:id` - Get project by ID
- `GET /api/projects/:id/positions` - Get project positions

### Resources
- `GET /api/resources` - Get all resources
- `GET /api/resources/:id` - Get resource by ID

### Allocations
- `GET /api/allocations` - Get all allocations
- `POST /api/allocations` - Create new allocation
- `PUT /api/allocations/:id` - Update allocation
- `DELETE /api/allocations/:id` - Delete allocation
- `GET /api/allocations/project/:projectId/monthly` - Get monthly summary

## Usage

1. **View Projects**: The home page displays all projects with their basic information
2. **Manage Allocations**: Click "Manage Allocations" on any project card
3. **Navigate Months**: Use Previous/Next Month buttons to view different time periods
4. **Add Allocations**: Click "Add New Allocation" to assign resources to positions
5. **Monitor Coverage**: Progress bars show how much of each position's budget is allocated

## Database Schema

The application works with the following Azure SQL tables:
- `dbo_Projects` - Project information
- `dbo_Positions` - Budgeted positions per project
- `dbo_Resources` - Available personnel/resources
- `dbo_Allocation` - Personnel assignments to positions
- `dbo_PayrollAllocation` - Payroll-related allocations
- `dbo_SystemUsers` - System users
- `dbo_Prefix` - Configuration prefixes

## Development

### Build for Production

Backend:
```powershell
cd backend
npm run build
npm start
```

Frontend:
```powershell
cd frontend
npm run build
npm run preview
```

## License

MIT
