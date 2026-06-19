import React from "react";
import {
  FaBrain,
  FaSearch,
  FaCalendarAlt,
  FaUsers,
  FaChartLine,
  FaClipboardList,
} from "react-icons/fa";

const Features = () => {
  const Features_data = [
    {
      icon: <FaBrain className="text-2xl text-indigo-600" />,
      title: "AI-Powered Matching",
      description:
        "Advanced algorithms match candidates to positions with incredible accuracy.",
      bg: "bg-indigo-50",
    },
    {
      icon: <FaSearch className="text-2xl text-emerald-600" />,
      title: "Smart Search & Filters",
      description: "Find candidates quickly with intelligent search and filtering options.",
      bg: "bg-emerald-50",
    },
    {
      icon: <FaCalendarAlt className="text-2xl text-indigo-600" />,
      title: "Interview Scheduling",
      description:
        "Automated interview scheduling saves time and reduces coordination hassles.",
      bg: "bg-indigo-50",
    },
    {
      icon: <FaUsers className="text-2xl text-emerald-600" />,
      title: "Candidate Database",
      description: "Comprehensive candidate management with detailed profiles and history.",
      bg: "bg-emerald-50",
    },
    {
      icon: <FaChartLine className="text-2xl text-indigo-600" />,
      title: "Analytics & Insights",
      description:
        "Track recruitment metrics and optimize your hiring process with data.",
      bg: "bg-indigo-50",
    },
    {
      icon: <FaClipboardList className="text-2xl text-emerald-600" />,
      title: "Application Tracking",
      description:
        "Manage applications through every stage of the recruitment pipeline.",
      bg: "bg-emerald-50",
    },
  ];
  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="mb-10 text-center">
          <h2 className="text-2xl font-bold text-slate-900 md:text-4xl">
            Powerful Features for Modern Recruiting
          </h2>
          <p className="mx-auto mt-4 max-w-2xl text-slate-600">
            Everything you need to streamline your recruitment process and hire the best talent.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {Features_data.map((f, index) => (
            <div
              key={index}
              className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-0.5 hover:border-indigo-200 hover:shadow-md"
            >
              <div className={`flex h-12 w-12 items-center justify-center rounded-xl ${f.bg}`}>
                {f.icon}
              </div>
              <h3 className="mt-6 text-xl font-bold text-slate-900">{f.title}</h3>
              <p className="mt-3 text-sm text-slate-600">{f.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
};

export default Features;
