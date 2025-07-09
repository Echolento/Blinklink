# Blinklink - Temporary Link Generator Application

## Overview

This is a full-stack TypeScript application called "Blinklink" that generates temporary links with customizable expiration modes. The app uses React for the frontend, Express for the backend, and includes anti-refresh functionality similar to temporary email services. It features a modern black/blue theme and comprehensive session persistence.

## User Preferences

Preferred communication style: Simple, everyday language.

## System Architecture

### Frontend Architecture
- **Framework**: React with TypeScript
- **Routing**: Wouter for client-side routing
- **State Management**: TanStack Query for server state management
- **UI Components**: shadcn/ui component library with Radix UI primitives
- **Styling**: Tailwind CSS with custom theming
- **Form Handling**: React Hook Form with Zod validation
- **Build Tool**: Vite with React plugin

### Backend Architecture
- **Framework**: Express.js with TypeScript
- **Database**: None (completely databaseless)
- **Schema**: Shared TypeScript interface definitions
- **Storage**: In-memory storage only using Maps
- **API**: RESTful API endpoints for link management

## Key Components

### Data Schema
The application uses two main TypeScript interfaces stored in memory:
- **User**: Basic user management (id, username, password)
- **TemporaryLink**: Core functionality storing temporary links with expiration settings

### Link Management System
- **Expiration Modes**: 
  - 1-click: Expires after first use
  - 1-hour: Expires after 1 hour
  - 24-hours: Expires after 24 hours
- **Tracking**: Click count and expiration status tracking
- **Short ID Generation**: Uses nanoid for generating unique short identifiers

### Anti-Refresh Functionality
- **Session Persistence**: Saves form data and generated links to localStorage
- **Cross-Session Restore**: Works across browser refreshes, tab closures, and reopening
- **Server Validation**: Verifies links still exist on server before restoration
- **Smart Recovery**: Restores form data even if links have expired
- **Auto-Cleanup**: Removes sessions older than 24 hours
- **Event Handling**: Saves session on beforeunload and visibility change events

### UI Components
- Comprehensive component library from shadcn/ui
- Modern black/blue theme with gradient backgrounds
- Card-based selection for expiration modes (no radio buttons)
- Toast notifications for user feedback
- Form validation with Zod schemas
- Loading states for session restoration
- Responsive design with mobile support

## Data Flow

1. **Link Creation**: User submits destination URL and expiration mode
2. **Validation**: Client-side validation with Zod schemas
3. **Storage**: Link stored in memory with generated short ID
4. **Response**: Generated link returned to user
5. **Access**: Users access temporary links via `/t/:shortId` route
6. **Expiration Check**: System checks expiration rules on each access
7. **Redirect**: Valid links redirect to destination, expired links show error

## External Dependencies

### Core Dependencies
- **Database**: None (completely databaseless)
- **UI Framework**: React with TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React icons
- **Form Validation**: Zod for schema validation
- **HTTP Client**: Fetch API with custom wrapper

### Development Tools
- **Build**: Vite for frontend bundling
- **Database Management**: None (in-memory storage only)
- **Type Safety**: TypeScript throughout the stack
- **Code Quality**: ESBuild for production builds

## Deployment Strategy

### Development
- Frontend served by Vite dev server
- Backend runs on Express with hot reloading via tsx
- In-memory storage for rapid development
- No database setup required

### Production
- Frontend built and served as static assets
- Backend bundled with ESBuild
- In-memory storage (data resets on restart)
- Environment-based configuration

### Build Process
- `npm run build`: Builds frontend and backend for production
- `npm run dev`: Starts development server with hot reloading
- No database commands needed

The application is designed to be deployed on platforms like Replit, with pure in-memory storage that requires no database setup or configuration.