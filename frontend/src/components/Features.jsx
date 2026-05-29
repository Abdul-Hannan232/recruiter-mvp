import React from 'react';
import { FaBrain, FaSearch, FaCalendarAlt, FaUsers, FaChartLine, FaClipboardList, } from "react-icons/fa";

const Features = () => {
    const Features_data = [
        {
            icon: <FaBrain className="text-3xl text-blue-600" />,
            title: "AI-Powered Matching",
            description:
            "Advanced algorithms match candidates to positions with incredible accuracy.",
            bg: "bg-blue-50",
        },
        {
            icon: <FaSearch className="text-3xl text-purple-600" />,
            title: "Smart Search & Filters",
            description:
            "Find candidates quickly with intelligent search and filtering options.",
            bg: "bg-purple-50",
        },
        {
            icon: <FaCalendarAlt className="text-3xl text-green-600" />,
            title: "Interview Scheduling",
            description:
            "Automated interview scheduling saves time and reduces coordination hassles.",
            bg: "bg-green-50",
        },
        {
            icon: <FaUsers className="text-3xl text-orange-600" />,
            title: "Candidate Database",
            description:
            "Comprehensive candidate management with detailed profiles and history.",
            bg: "bg-orange-50",
        },
        {
            icon: <FaChartLine className="text-3xl text-pink-600" />,
            title: "Analytics & Insights",
            description:
            "Track recruitment metrics and optimize your hiring process with data.",
            bg: "bg-pink-50",
        },
        {
            icon: <FaClipboardList className="text-3xl text-indigo-600" />,
            title: "Application Tracking",
            description:
            "Manage applications through every stage of the recruitment pipeline.",
            bg: "bg-indigo-50",
        },
    ];
  return (
    <section className='py-16 bg-white'>
        <div className='max-w-7xl mx-auto px-4 sm:px-6 lg:px-8'>
            <div className='text-center mb-2'>
                <h2 className='text-2xl md:text-4xl font-bold text-gray-900'> Powerful Features for Modern 
                    Recruiting </h2>
                <p className='mt-4 text-gray-600 max-w-2xl mx-auto'> Everything you need to streamline your 
                    recruitment process and hire the best talent! </p>
            </div>

            <div className='grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5'>
                {
                    Features_data.map((f, index) => (
                        <div key={index} className="p-6 rounded-xl border border-gray-100 shadow-sm
                            hover:shadow-md transition duration-300 mt-10 cursor-pointer hover:bg-blue-100">
                            <div className={`w-10 h-10 flex items-center justify-center rounded-lg 
                                ${f.bg}`}>
                                {f.icon}
                            </div>

                            <h3 className='text-xl text-gray-900 mt-6 font-bold'> {f.title} </h3>
                            <p className='mt-4 text-sm'> {f.description} </p>
                        </div>
                    ))
                }
            </div>
        </div>
    </section>
  )
}

export default Features;