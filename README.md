# Nexus ERP Software 

A modern Enterprise Resource Planning (ERP) platform designed to streamline business operations through a centralized and intuitive interface.

## Overview

Nexus ERP Software helps organizations manage core business processes efficiently, including employee management, customer records, operational workflows, reporting, and administrative tasks.

Built with a modern full-stack architecture, the platform focuses on scalability, performance, and user experience.

## Features

* Authentication and role-based access control
* Employee management
* Customer management
* Dashboard and analytics
* Real-time data management
* Responsive user interface
* Secure cloud database integration
* ERP workflow automation
* Modern admin panel

## Tech Stack

### Frontend

* TypeScript
* React
* TanStack Router
* Vite
* Tailwind CSS
* shadcn/ui

### Backend & Database

* Supabase
* PostgreSQL
* PL/pgSQL

### Development Tools

* ESLint
* Prettier
* Bun

## Project Structure

```bash
nexus-erp-software/
├── public/
├── src/
│   ├── components/
│   ├── routes/
│   ├── hooks/
│   ├── services/
│   └── pages/
├── supabase/
├── package.json
└── README.md
```

## Getting Started

### Prerequisites

* Node.js 18+
* Bun (recommended)
* Supabase Project

### Installation

```bash
git clone https://github.com/aryanbarde80/nexus-erp-software.git

cd nexus-erp-software

bun install
```

### Environment Setup

Create a `.env` file in the project root:

```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Run Development Server

```bash
bun run dev
```

The application will be available at:

```text
http://localhost:3000
```

## Database

The project uses Supabase as the backend service and PostgreSQL as the primary database.

Database-related configurations, migrations, and functions can be found in the `supabase/` directory.

## Future Enhancements

* Inventory Management
* Payroll System
* Attendance Tracking
* Invoice Generation
* Advanced Analytics
* Multi-tenant Support
* AI-powered Business Insights

## Author

**Aryan Barde**

* GitHub: https://github.com/aryanbarde80

## License

This project is licensed under the MIT License.
