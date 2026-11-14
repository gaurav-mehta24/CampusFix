# 🎓 CampusFix — Smart Campus Complaint Management System

CampusFix is a web-based campus complaint management platform designed to help students report campus issues and enable college staff to manage, track, and resolve them efficiently.

The platform provides role-based dashboards, complaint tracking, image uploads, duplicate complaint detection, and AI-powered complaint analysis using Google Gemini.

## ✨ Features

### 👨‍🎓 Student Portal
- Register and log in securely.
- Submit campus complaints.
- Upload images of reported issues.
- Track complaint status.
- View existing complaints.
- Verify completed resolutions or reopen complaints.
- Get AI-powered complaint recommendations.

### 🧑‍💼 Staff Portal
- View assigned complaints.
- Manage complaint progress.
- Submit resolution details.
- Update complaint status.

### 🛡️ Admin Portal
- Manage staff accounts.
- Assign staff members and departments.
- View platform users.
- Manage campus complaint operations.

### 🤖 AI-Powered Analysis
Powered by Google Gemini, the AI assistant can:
- Recommend complaint categories.
- Identify the responsible department.
- Suggest priority levels.
- Generate concise complaint summaries.

*AI recommendations are suggestions and do not automatically resolve complaints.*

### 🔍 Smart Complaint Management
- Duplicate complaint detection.
- Link related student reports.
- Track affected students.
- Support student verification of resolutions.

## 🛠️ Tech Stack

| Technology | Purpose |
|---|---|
| React | Frontend |
| Vite | Frontend development |
| Node.js | Backend runtime |
| Express.js | REST API |
| Supabase | Authentication and database |
| Google Gemini | AI complaint analysis |
| Multer | Image uploads |
| CSS | User interface styling |

## 📁 Project Structure

```text
CampusFix/
│
├── backend/
│   ├── data/
│   ├── uploads/
│   ├── auth.js
│   ├── server.js
│   ├── supabase.js
│   └── package.json
│
├── frontend/
│   ├── src/
│   │   ├── App.jsx
│   │   ├── App.css
│   │   ├── Staff.jsx
│   │   ├── Admin.jsx
│   │   └── ...
│   └── package.json
│
├── .gitignore
└── README.md
```

## 🚀 Getting Started

### 1. Clone the repository

```bash
git clone https://github.com/gaurav-mehta24/CampusFix.git
cd CampusFix
```

### 2. Install backend dependencies

```bash
cd backend
npm install
```

### 3. Configure backend environment

Create `backend/.env`:

```env
PORT=5001

SUPABASE_URL=your_supabase_project_url
SUPABASE_SECRET_KEY=your_supabase_secret_key

JWT_SECRET=your_jwt_secret
JWT_EXPIRES_IN=7d

ADMIN_SETUP_KEY=your_admin_setup_key

GEMINI_API_KEY=your_gemini_api_key
GEMINI_MODEL=your_supported_gemini_model
```

Never commit your `.env` file or expose secret keys publicly.

### 4. Configure frontend

Create `frontend/.env`:

```env
VITE_SUPABASE_URL=your_supabase_project_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key
```

### 5. Start the backend

```bash
cd backend
npm run dev
```

Backend runs at:

`http://localhost:5001`

### 6. Start the frontend

Open another terminal:

```bash
cd frontend
npm install
npm run dev
```

Open the Vite URL displayed in your terminal.

## 🔐 Authentication and Database

CampusFix uses Supabase for authentication and database services.

The platform uses role-based access:

- Student
- Staff
- Admin

Database access is protected using Supabase Row Level Security (RLS) policies.

Configure the required database tables, triggers, and policies in your Supabase project before using the application.

## 🤖 Gemini API Setup

1. Visit [Google AI Studio](https://aistudio.google.com/apikey).
2. Generate a Gemini API key.
3. Add the key to `backend/.env`.
4. Configure a model supported by your API account.
5. Restart the backend.

The AI endpoint is:

```text
POST /api/ai/analyze-complaint
```

The endpoint requires student authentication.

## 🔒 Security

- Environment variables are used for private credentials.
- Authentication is handled through Supabase.
- Protected API routes use authentication middleware.
- Role-based authorization restricts access.
- Database security is enforced through RLS policies.

## 🛣️ Future Improvements

- Real-time complaint notifications.
- Complaint analytics dashboard.
- Email notifications.
- Interactive campus issue map.
- Improved AI-based complaint prioritization.
- Cloud-based image storage.
- Deployment for college-wide access.

## 👨‍💻 Developer

**Gaurav Mehta**

GitHub: [@gaurav-mehta24](https://github.com/gaurav-mehta24)

## 📄 License

This project is currently available for educational and demonstration purposes. A formal open-source license can be added separately.

---

**CampusFix — Report. Track. Resolve.** 🎓