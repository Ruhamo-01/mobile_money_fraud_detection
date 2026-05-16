# MoMo Shield - React Frontend

This is the React frontend for the Mobile Money Fraud Detection system. It has been converted from the original HTML templates to React components while preserving all logic and functionality.

## Project Structure

```
frontend/
├── index.html
├── package.json
├── vite.config.js
├── tailwind.config.js
├── postcss.config.js
└── src/
    ├── main.jsx
    ├── App.jsx
    ├── index.css
    ├── components/
    │   ├── Login.jsx
    │   ├── AdminDashboard.jsx
    │   ├── ProviderDashboard.jsx
    │   └── UserDashboard.jsx
    └── utils/
        └── helpers.js
```

## Installation

1. Navigate to the frontend directory:
```bash
cd frontend
```

2. Install dependencies:
```bash
npm install
```

## Development

Start the development server:
```bash
npm run dev
```

The frontend will run on `http://localhost:5173` and proxy API requests to `http://localhost:5000`.

## Build

Build for production:
```bash
npm run build
```

The built files will be in the `dist/` directory.

## Preview Production Build

Preview the production build:
```bash
npm run preview
```

## Components

### Login (`Login.jsx`)
- User login and registration
- Multi-step registration with face capture
- Forgot password functionality
- NID validation with gender auto-detection
- Camera handling for face registration

### AdminDashboard (`AdminDashboard.jsx`)
- System overview with statistics
- Provider management (add/edit)
- User management (edit)
- Fraud alerts monitoring
- Security settings
- Database backup
- Performance monitoring
- System settings

### ProviderDashboard (`ProviderDashboard.jsx`)
- Overview with real-time stats
- Fraud alerts management
- User lookup by phone
- All users registry
- Travel control (SIM blocking/reactivation)

### UserDashboard (`UserDashboard.jsx`)
- Balance overview
- Money transfer with PIN verification
- Transaction history
- Profile management
- PIN reset with face verification
- Face update with identity verification

## API Integration

The frontend expects the backend API to be running on `http://localhost:5000`. The Vite proxy configuration handles this automatically.

## Features Preserved

All original functionality has been preserved:
- Session validation
- API calls for data fetching
- Form validation
- Face capture and validation
- PIN verification
- Multi-step workflows
- Real-time data updates
- Modals and alerts
- Navigation between sections

## Styling

- TailwindCSS for utility-first styling
- Custom CSS variables in `index.css`
- Lucide React icons
- Sora and JetBrains Mono fonts

## Browser Requirements

- Modern browser with ES6 support
- Camera access required for face capture
- JavaScript must be enabled
