import { APP_NAME, SOURCE_URL } from '@slotwise/shared';

export const steps = [
  {
    title: 'Set up your business',
    text: 'Add your staff, your services with their length and price, and when each person works.',
  },
  {
    title: 'Share your booking page',
    text: 'Your customers open your page, pick a service, a person or "anyone", and a free time.',
  },
  {
    title: 'Run your day',
    text: 'See every booking by day and by staff member. Your staff see their own schedule.',
  },
];

export const features = [
  {
    title: 'Only real free times',
    text: 'Slots follow each person’s working hours and existing bookings, in your time zone.',
  },
  {
    title: 'No double bookings',
    text: 'Two people cannot take the same time. The database itself refuses the overlap.',
  },
  {
    title: 'Booking without an account',
    text: 'Customers book with a name, email and phone, and get a private link to cancel.',
  },
  {
    title: 'Staff calendars',
    text: 'Every staff member has their own hours, services and bookings.',
  },
  {
    title: 'Owner and staff roles',
    text: 'Owners manage the business. Staff see only what they need.',
  },
  {
    title: 'Fast on every phone',
    text: 'Pages load quickly and work with a keyboard and a screen reader.',
  },
];

function Header() {
  return (
    <header className="border-b border-slate-200">
      <nav
        aria-label="Main"
        className="mx-auto flex max-w-6xl items-center justify-between px-6 py-4"
      >
        <a href="#top" className="text-lg font-semibold tracking-tight">
          {APP_NAME}
        </a>
        <ul className="flex items-center gap-6 text-sm text-slate-700">
          <li className="hidden sm:block">
            <a href="#how-it-works" className="hover:text-slate-900">
              How it works
            </a>
          </li>
          <li className="hidden sm:block">
            <a href="#features" className="hover:text-slate-900">
              Features
            </a>
          </li>
          <li>
            <a href={SOURCE_URL} className="hover:text-slate-900">
              Source on GitHub
            </a>
          </li>
        </ul>
      </nav>
    </header>
  );
}

export function Hero() {
  return (
    <section id="top" className="mx-auto max-w-6xl px-6 pt-20 pb-16 sm:pt-28">
      <p className="text-sm font-semibold text-indigo-700">
        For salons, tutors, clinics and consultants
      </p>
      <h1 className="mt-3 max-w-3xl text-4xl font-semibold tracking-tight sm:text-6xl">
        Let customers book you online, without the phone calls.
      </h1>
      <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-700">
        {APP_NAME} gives your business a booking page, a calendar for every
        staff member, and one dashboard for the day. Customers pick a free time
        in under a minute.
      </p>
      <div className="mt-10 flex flex-wrap items-center gap-4">
        <button
          type="button"
          disabled
          aria-describedby="demo-soon"
          className="rounded-md bg-indigo-700 px-5 py-3 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:opacity-70"
        >
          Try as business owner
        </button>
        <a
          href={SOURCE_URL}
          className="rounded-md px-5 py-3 text-sm font-semibold text-slate-900 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          View the source
        </a>
      </div>
      <p id="demo-soon" className="mt-3 text-sm text-slate-600">
        The live demo salon opens soon.
      </p>
    </section>
  );
}

function HowItWorks() {
  return (
    <section id="how-it-works" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight">How it works</h2>
        <ol className="mt-10 grid gap-8 sm:grid-cols-3">
          {steps.map((step, index) => (
            <li
              key={step.title}
              className="rounded-lg bg-white p-6 ring-1 ring-slate-200"
            >
              <span className="text-sm font-semibold text-indigo-700">
                Step {index + 1}
              </span>
              <h3 className="mt-2 text-lg font-semibold">{step.title}</h3>
              <p className="mt-2 text-slate-700">{step.text}</p>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section id="features" className="py-20">
      <div className="mx-auto max-w-6xl px-6">
        <h2 className="text-3xl font-semibold tracking-tight">
          Built for a busy front desk
        </h2>
        <ul className="mt-10 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((feature) => (
            <li key={feature.title}>
              <h3 className="text-lg font-semibold">{feature.title}</h3>
              <p className="mt-2 text-slate-700">{feature.text}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="mt-auto border-t border-slate-200">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-6 py-8 text-sm text-slate-600">
        <p>
          {APP_NAME} is a portfolio project by Stephen Do. All businesses in the
          demo are fictional.
        </p>
        <a
          href={SOURCE_URL}
          className="font-medium text-slate-900 hover:underline"
        >
          Source code on GitHub
        </a>
      </div>
    </footer>
  );
}

export function Landing() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <HowItWorks />
        <Features />
      </main>
      <Footer />
    </>
  );
}
