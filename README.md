# SkillSync: AI-Powered Resume Analyzer

SkillSync is a full-stack AI Resume Analyzer designed to help job seekers optimize their resumes, discover skill gaps, and generate actionable learning roadmaps. 

## ✨ Features
- **AI Resume Parsing**: Extracts skills directly from PDF and DOCX files entirely in memory.
- **Skill Gap Analysis**: Compares extracted skills against target job roles to identify critical missing skills.
- **Learning Roadmaps**: Generates step-by-step milestones to help users master their missing skills.
- **Interactive Dashboard**: Visualizes resume progress, scores, and active goals using dynamic charts.
- **Secure Authentication**: Modern, secure user identity management powered by Supabase Auth.
- **PDF Export**: Generate sleek, downloadable reports of your resume analysis.

## 💻 Tech Stack
- **Frontend**: React, Vite, Tailwind CSS, Framer Motion, Recharts
- **Backend**: Python, FastAPI, SQLAlchemy, PyPDF2
- **Database & Auth**: Supabase (PostgreSQL & JWT Authentication)
- **Deployment**: Serverless-ready architecture optimized for Vercel, Render, or Railway.

---

## 🚀 Local Development Setup

### 1. Supabase Setup
Create a free project on [Supabase](https://supabase.com). You will need the following credentials:
- **Project URL**
- **Anon Key**
- **Database Connection String** (URI starting with `postgresql://`)
- **JWT Secret**

### 2. Frontend Setup
```bash
# From the root directory, install dependencies
npm install

# Create a .env file and add your Supabase keys
# VITE_API_BASE_URL=http://localhost:8000
# VITE_SUPABASE_URL=your_project_url
# VITE_SUPABASE_ANON_KEY=your_anon_key

# Start the Vite development server
npm run dev
```

### 3. Backend Setup
```bash
# Navigate to the backend directory
cd backend

# Create and activate a virtual environment
python -m venv .venv
# On Windows: .venv\Scripts\activate
# On Mac/Linux: source .venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Create a .env file in the backend folder
# DATABASE_URL=your_supabase_postgresql_uri
# SUPABASE_JWT_SECRET=your_jwt_secret
# CORS_ORIGINS=http://localhost:5173

# Start the FastAPI server
uvicorn app.main:app --reload
```

---

## 🌍 Production Deployment

### Frontend (Vercel / Netlify)
1. Import the GitHub repository into Vercel.
2. Ensure the Framework Preset is set to **Vite**.
3. Add the `VITE_API_BASE_URL` (pointing to your live backend URL), `VITE_SUPABASE_URL`, and `VITE_SUPABASE_ANON_KEY` as environment variables.
4. Deploy!

### Backend (Render / Railway)
1. Create a new Web Service.
2. Connect your GitHub repository.
3. Set the **Root Directory** to `backend` (if required by your platform).
4. Set the Build Command to `pip install -r requirements.txt`.
5. Set the Start Command to `uvicorn main:app --host 0.0.0.0 --port $PORT` (adjust path based on your exact file structure).
6. Add your `DATABASE_URL`, `SUPABASE_JWT_SECRET`, and `CORS_ORIGINS` (pointing to your live Vercel URL) as environment variables.
7. Deploy!
