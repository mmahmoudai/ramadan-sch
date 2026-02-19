# Ramadan Tracker v2 🌙

A comprehensive full-stack web application for tracking daily worship, habits, and spiritual progress during Ramadan. Built with Next.js 14 and Express.js, featuring full multilingual support (Arabic/English/Turkish), family sharing, and automated reminders.

## 🆕 Version 2 (Production Sprint)

This README reflects the **v2 release** currently deployed to production.

### v2 Highlights
- ✅ Full frontend localization across **English, Arabic, and Turkish**
- ✅ Improved language switcher UX with a clickable dropdown and explicit language selection
- ✅ Backend support for Turkish locale in profile/settings validation
- ✅ Reminder cron stability fixes for invalid timezone values
- ✅ Automatic timezone detection on first login/signup with Egypt (`Africa/Cairo`) fallback

## ✨ Features

### 📿 Daily Worship Tracking
- **Ibadah (العبادة)**: Track intentions, Quran recitation, dhikr, prayers, charity, and more
- **Salah Tracker**: Monitor all five daily prayers with rakat counting
- **Sunnah Tracker**: Follow prophetic traditions (morning/evening dhikr, tahajjud, tarawih, etc.)
- **Habits**: Build positive habits (no smoking, exercise, healthy eating, water intake)
- **Mood & Gratitude**: Daily emotional tracking and gratitude journal
- **Quran & Hadith**: Track Quran reading progress and daily hadith reflections

### 🏆 Challenge System
- Create personal challenges (daily, weekly, monthly scope)
- Track progress with percentage completion and notes
- Visual progress history with completion badges
- Edit past dates, delete old entries

### 👨‍👩‍👧‍👦 Family Features
- Create family groups and invite members
- Visibility approvals for privacy control
- Comments and reactions on shared content
- Encourage each other through Ramadan

### 📊 Dashboard & Reports
- Personal dashboard with streaks, scores, and trends
- Generate detailed reports (public or private)
- Share reports via unique links
- Daily breakdown with completion metrics

### 🌍 Multilingual Support (EN/AR/TR)
- Full English/Arabic/Turkish language support across pages and components
- RTL layout for Arabic
- Improved navbar language switcher (click-to-open dropdown with direct selection)
- Localized date formats (Hijri/Gregorian)

### ⏰ Reminders
- Automated email reminders at 9 PM local time
- Bilingual reminder templates
- Delivery metrics dashboard
- Skip tracking for incomplete days

### �️ Admin Dashboard
- Multi-level authentication (user/admin roles)
- View total registered users and platform stats
- Search, paginate, promote/demote users
- Delete users and all associated data
- Audit log viewer

### �🔒 Security Features
- JWT authentication with refresh tokens
- Role-based access control (user/admin)
- Password hashing (bcrypt, 12 rounds)
- Rate limiting on endpoints (auth: 20/15min, general: 100/min)
- CORS protection
- Input validation (Zod)
- Permanent daily locks at midnight

## 🛠 Tech Stack

### Frontend
- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **State Management**: React hooks
- **API**: Custom fetch wrapper with auth

### Backend
- **Runtime**: Node.js
- **Framework**: Express.js
- **Database**: MongoDB with Mongoose ODM
- **Authentication**: JWT with refresh tokens
- **Validation**: Zod schemas
- **Email**: Nodemailer
- **Scheduling**: node-cron

### Testing
- **Framework**: Vitest
- **API Testing**: Supertest
- **Database**: MongoDB Memory Server
- **Coverage**: 36 tests passing (unit + integration)

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- MongoDB 5.0+
- npm or yarn

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/mmahmoudai/ramadan-sch.git
   cd ramadan-sch
   ```

2. **Install dependencies**
   ```bash
   # Install root dependencies
   npm install
   
   # Install backend dependencies
   cd backend
   npm install
   
   # Install frontend dependencies
   cd ../frontend
   npm install
   
   # Install shared types
   cd ../shared
   npm install
   ```

3. **Environment Setup**
   ```bash
   # Backend environment
   cp backend/.env.example backend/.env
   # Edit backend/.env with your settings
   
   # Frontend environment
   cp frontend/.env.local.example frontend/.env.local
   # Edit frontend/.env.local with your settings
   ```

4. **Database Setup**
   ```bash
   cd backend
   npm run migrate  # Create indexes
   npm run seed     # Seed test data
   ```

5. **Start Development Servers**
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   cd frontend
   npm run dev
   ```

6. **Access the Application**
   - Frontend: http://localhost:3000
   - Backend API: http://localhost:4000

### Test Accounts
After seeding, you can use these accounts:
- **admin@ramadantracker.app** / admin123 (Admin — full user management)
- **ahmad@example.com** / password123 (English, 7 entries, 3 challenges)
- **fatima@example.com** / password123 (Arabic, 5 entries, 1 challenge)
- **omar@example.com** / password123 (English, invited to family)

## 📁 Project Structure

```
ramdan-sch/
├── backend/                 # Express.js API
│   ├── src/
│   │   ├── models/         # MongoDB models
│   │   ├── routes/         # API routes (auth, entries, challenges, admin, etc.)
│   │   ├── middleware/     # Auth, error handling, rate limiting
│   │   ├── utils/          # Helper functions
│   │   ├── jobs/           # Cron jobs (reminders)
│   │   ├── scripts/        # Migration & seeding
│   │   └── tests/          # Unit & integration tests
│   └── package.json
├── frontend/               # Next.js app
│   ├── src/
│   │   ├── app/           # App router pages (tracker, dashboard, admin, etc.)
│   │   ├── components/    # Reusable components
│   │   └── lib/           # Utilities, API, auth, i18n
│   └── package.json
├── shared/                # Shared TypeScript types
│   └── src/
│       └── types/        # Type definitions
└── design/               # Design mockups
```

## 🧪 Testing

```bash
# Run all tests
cd backend
npm test

# Run tests with coverage
npm run test:coverage

# Run specific test files
npx vitest src/tests/unit/
npx vitest src/tests/integration/
```

## 📝 API Documentation

### Authentication
- `POST /auth/signup` - Create new account
- `POST /auth/login` - Login with email/password
- `POST /auth/logout` - Logout (invalidate refresh token)
- `POST /auth/refresh` - Get new access token

### Daily Tracker
- `GET /entries` - List entries (with date range)
- `GET /entries/:date` - Get specific day's entry
- `PUT /entries/:date` - Update/create entry
- `POST /entries/:date/submit` - Lock day's entry

### Challenges
- `GET /challenges` - List user challenges
- `POST /challenges` - Create new challenge
- `PATCH /challenges/:id` - Update challenge
- `POST /challenges/:id/progress` - Add/update progress
- `DELETE /challenges/:id/progress/:date` - Delete progress

### Reports
- `GET /reports` - List user reports
- `POST /reports` - Create new report
- `GET /reports/public/:token` - Access public report
- `GET /reports/mine` - Get private reports

### Family
- `GET /families` - List family groups
- `POST /families` - Create family group
- `POST /families/:id/invite` - Invite member
- `POST /families/:id/join` - Join with invite code

### Admin (requires admin role)
- `GET /admin/stats` - Platform overview stats
- `GET /admin/users` - List all users (paginated, searchable)
- `PATCH /admin/users/:id/role` - Promote/demote user
- `DELETE /admin/users/:id` - Delete user and all data
- `GET /admin/audit` - Recent audit logs

## 🌍 Internationalization

The app supports English, Arabic, and Turkish with:
- Dynamic language switching
- RTL layout for Arabic
- Localized date formats (Hijri/Gregorian)
- Translated UI strings

## 📅 Hijri Calendar

The app displays Hijri dates with:
- Accurate conversion from Gregorian
- Month names in supported languages
- Automatic detection of Ramadan
- Historical tracking

## 🔔 Email Reminders

Configure SMTP settings in `.env`:
```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
EMAIL_FROM=noreply@ramadantracker.app
```

## 🚀 Deployment

The app is deployed on a DigitalOcean Ubuntu VPS using PM2 and Nginx.

### Live Server
- **Frontend**: http://64.225.117.214
- **API**: http://64.225.117.214:4000

### Environment Variables
**Backend (.env)**:
```env
PORT=4000
FRONTEND_URL=http://your-server-ip
NODE_ENV=production
JWT_SECRET=your-secure-secret
MONGO_URI=mongodb://localhost:27017/ramadan_tracker
```

**Frontend (.env.local)**:
```env
NEXT_PUBLIC_API_URL=http://your-server-ip:4000
```

### VPS Deployment
See [DEPLOYMENT.md](DEPLOYMENT.md) for full step-by-step instructions, or use the automated setup script:
```bash
ssh root@your-server-ip
curl -fsSL https://raw.githubusercontent.com/mmahmoudai/ramadan-sch/main/deploy/setup-vps.sh -o setup.sh
chmod +x setup.sh && ./setup.sh
```

### PM2 Process Management
```bash
pm2 status                    # Check services
pm2 restart all               # Restart all
pm2 logs ramadan-tracker-api  # View API logs
```

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 🙏 Acknowledgments

- Ramadan Mubarak! May this app help you make the most of the blessed month.
- Thanks to all contributors and the open-source community.
- Special thanks to the Umm al-Qura calendar for Hijri date calculations.

## 📞 Support

For issues, questions, or suggestions:
- Open an issue on GitHub
- Email: support@ramadantracker.app

---

**Ramadan Kareem! رمضان كريم** 🌙✨
