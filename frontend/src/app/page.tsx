import Link from "next/link";

export default function Home() {
  return (
    <div className="space-y-6">
      <div className="border-2 border-line rounded-2xl bg-[repeating-linear-gradient(45deg,rgba(255,255,255,0.85),rgba(255,255,255,0.85)_10px,rgba(240,240,240,0.95)_10px,rgba(240,240,240,0.95)_20px)] p-6 text-center">
        <p className="font-ruqaa text-4xl md:text-6xl mt-1 mb-2">رمضان كريم</p>
        <h1 className="text-3xl md:text-5xl font-extrabold tracking-wide">Ramadan Tracker</h1>
        <p className="mt-3 text-gray-600 max-w-lg mx-auto">
          Track your daily worship, habits, and challenges during Ramadan. Set goals, join family groups, and build consistency with permanent daily locks.
        </p>
        <div className="mt-6 flex gap-3 justify-center">
          <Link href="/signup" className="bg-ink text-white px-8 py-3 rounded-xl font-bold text-lg hover:opacity-90 transition">
            Get Started
          </Link>
          <Link href="/login" className="border-2 border-ink px-8 py-3 rounded-xl font-bold text-lg hover:bg-gray-100 transition">
            Login
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">📿</div>
          <h3 className="font-bold text-lg">Daily Tracker</h3>
          <p className="text-sm text-gray-600 mt-1">Track ibadah, salah, sunnah, habits, mood, Qur&apos;an and more — all in one place.</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">🏆</div>
          <h3 className="font-bold text-lg">Challenges</h3>
          <p className="text-sm text-gray-600 mt-1">Set daily, weekly, or monthly challenges and track your progress throughout Ramadan.</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">👨‍👩‍👧‍👦</div>
          <h3 className="font-bold text-lg">Family Sharing</h3>
          <p className="text-sm text-gray-600 mt-1">Create family groups, invite members, and encourage each other through the month.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">📊</div>
          <h3 className="font-bold text-lg">Dashboard</h3>
          <p className="text-sm text-gray-600 mt-1">View streaks, completion scores, weekly trends, and challenge progress at a glance.</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">📋</div>
          <h3 className="font-bold text-lg">Reports</h3>
          <p className="text-sm text-gray-600 mt-1">Generate public or private reports and share your Ramadan journey with others.</p>
        </div>
        <div className="border-2 border-line rounded-xl bg-card p-5 text-center">
          <div className="text-4xl mb-2">🔒</div>
          <h3 className="font-bold text-lg">Daily Lock</h3>
          <p className="text-sm text-gray-600 mt-1">Entries permanently lock at midnight to promote honest, real-time tracking.</p>
        </div>
      </div>
    </div>
  );
}
