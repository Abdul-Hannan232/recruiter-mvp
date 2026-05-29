import React, { useState } from "react";
import { MdOutlineEngineering } from "react-icons/md";
import { IoCalendarNumber } from "react-icons/io5";
import { FaMapLocationDot, FaPerson } from "react-icons/fa6";
import { BiSolidData } from "react-icons/bi";
import { NavLink } from 'react-router-dom';
import { FaDollarSign } from "react-icons/fa";
import Image1 from '../assets/Image1.jpg';
import Image2 from '../assets/Image2.jpg';
import Image3 from '../assets/Image3.jpg';
import Image4 from '../assets/Image4.jpg';
import Image5 from '../assets/Image5.jpg';
import Image6 from '../assets/Image6.jpg';
import Image7 from '../assets/Image7.jpg';
import Image8 from '../assets/Image8.jpg';
import Image9 from '../assets/Image9.jpg';
import Image10 from '../assets/Image10.jpg';
import Image11 from '../assets/Image11.jpg';
import Image12 from '../assets/Image12.jpg';
import Image13 from '../assets/Image13.jpg';

export const jobsData = [
  {
    id: 1,
    title: "Frontend Developer",
    department: "Engineering",
    location: "San Francisco, CA",
    type: "Full-time",
    salary: "$120k - $160k",
    applicants: 45,
    posted: "10/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image1,
    description: "Build responsive and high-performance web interfaces.",
    requirements: [
      "3+ years experience",
      "HTML, CSS, JS",
      "React Js",
      "TypeScript",
      "REST APIs"
    ],
  },
  {
    id: 2,
    title: "Backend Developer",
    department: "Engineering",
    location: "Seattle, WA",
    type: "Full-time",
    salary: "$115k - $155k",
    applicants: 51,
    posted: "08/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image2,
    description: "Design and maintain scalable backend systems and APIs.",
    requirements: [
      "5+ years experience",
      "Node.js / Python / Java",
      "SQL / NoSQL",
      "Microservices",
      "REST APIs"
    ],
  },
  {
    id: 3,
    title: "Full Stack Developer",
    department: "Engineering",
    location: "Remote",
    type: "Full-time",
    salary: "$110k - $150k",
    applicants: 62,
    posted: "12/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image3,
    description: "Work on both frontend and backend of modern web apps.",
    requirements: [
      "4+ years experience",
      "Node.js / React",
      "MongoDB / PostgreSQL",
      "REST APIs",
      "Git / CI/CD"
    ],
  },
  {
    id: 4,
    title: "DevOps Engineer",
    department: "Engineering",
    location: "Austin, TX",
    type: "Part-time",
    salary: "$120k - $160k",
    applicants: 34,
    posted: "15/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image4,
    description: "Manage infrastructure and CI/CD pipelines for software deployment.",
    requirements: [
      "5+ years experience",
      "AWS / Azure / GCP",
      "Kubernetes / Docker",
      "Terraform / Ansible",
      "CI/CD pipelines"
    ],
  },
  {
    id: 5,
    title: "Data Scientist",
    department: "Data",
    location: "Remote",
    type: "Part-time",
    salary: "$125k - $165k",
    applicants: 41,
    posted: "13/01/2024",
    icon1: <BiSolidData />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image5,
    description: "Analyze large datasets and build machine learning models.",
    requirements: [
      "4+ years experience",
      "Python / R",
      "SQL  NoSQL",
      "Machine Learning / AI",
      "Statistics"
    ],
  },
  {
    id: 6,
    title: "Cybersecurity Analyst",
    department: "Security",
    location: "New York, NY",
    type: "Full-time",
    salary: "$105k - $145k",
    applicants: 36,
    posted: "16/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image6,
    description: "Monitor, detect, and prevent security threats in enterprise systems.",
    requirements: [
      "3+ years experience",
      "Network Security",
      "SIEM tools",
      "Penetration Testing",
      "Incident Response"
    ],
  },
  {
    id: 7,
    title: "Cloud Engineer",
    department: "Engineering",
    location: "Boston, MA",
    type: "Full-time",
    salary: "$115k - $155k",
    applicants: 28,
    posted: "17/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image7,
    description: "Design and manage scalable cloud infrastructure.",
    requirements: [
      "4+ years experience",
      "AWS / GCP / Azure",
      "Docker & Kubernetes",
      "Infrastructure as Code",
      "Linux"
    ],
  },
  {
    id: 8,
    title: "AI / ML Engineer",
    department: "Engineering",
    location: "San Francisco, CA",
    type: "Internship",
    salary: "$130k - $175k",
    applicants: 40,
    posted: "18/01/2024",
    icon1: <BiSolidData />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image8,
    description: "Develop and deploy ML models into production systems.",
    requirements: [
      "4+ years experience",
      "Python",
      "TensorFlow / PyTorch",
      "Deep Learning",
      "Model Deployment"
    ],
  },
  {
    id: 9,
    title: "Mobile App Developer",
    department: "Engineering",
    location: "Remote",
    type: "Contract",
    salary: "$100k - $140k",
    applicants: 33,
    posted: "19/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image9,
    description: "Develop mobile applications for iOS and Android platforms.",
    requirements: [
      "3+ years experience",
      "Flutter / React Native",
      "Swift / Kotlin",
      "REST APIs",
      "App Store Deployment"
    ],
  },
  {
    id: 10,
    title: "Software QA Engineer",
    department: "Engineering",
    location: "Chicago, IL",
    type: "Full-time",
    salary: "$85k - $115k",
    applicants: 25,
    posted: "20/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image10,
    description: "Ensure software quality through automated and manual testing.",
    requirements: [
      "3+ years experience",
      "Selenium / Cypress",
      "Test Automation",
      "CI/CD Pipelines",
      "Bug Tracking Tools"
    ],
  },
  {
  id: 11,
  title: "Database Administrator (DBA)",
  department: "IT Operations",
  location: "Austin, TX",
  type: "Full-time",
  salary: "$100k - $135k",
  applicants: 31,
  posted: "27/01/2024",
  icon1: <BiSolidData />,
  icon2: <FaMapLocationDot />,
  icon3: <IoCalendarNumber />,
  icon_person: <FaPerson />,
  icon_dollar: <FaDollarSign />,
  image: Image11,
  description: "Manage, optimize, and secure enterprise databases.",
  requirements: [
    "MySQL / PostgreSQL / Oracle",
    "Performance tuning",
    "Backup & recovery",
    "Monitoring & optimization",
    "SQL expertise"
  ],
},
  {
    id: 12,
    title: "IT Support Engineer",
    department: "IT Operations",
    location: "San Diego, CA",
    type: "Full-time",
    salary: "$70k - $95k",
    applicants: 42,
    posted: "22/01/2024",
    icon1: <MdOutlineEngineering />,
    icon2: <FaMapLocationDot />,
    icon3: <IoCalendarNumber />,
    icon_person: <FaPerson />,
    icon_dollar: <FaDollarSign />,
    image: Image12,
    description: "Provide technical support and maintain internal IT systems.",
    requirements: [
      "Networking basics",
      "Windows / Linux",
      "Troubleshooting",
      "Helpdesk systems",
      "Customer Support"
    ],
  },
  {
  id: 13,
  title: "Security Engineer",
  department: "Security",
  location: "San Francisco, CA",
  type: "Full-time",
  salary: "$120k - $160k",
  applicants: 28,
  posted: "17/01/2024",
  icon1: <MdOutlineEngineering />,
  icon2: <FaMapLocationDot />,
  icon3: <IoCalendarNumber />,
  icon_person: <FaPerson />,
  icon_dollar: <FaDollarSign />,
  image: Image13,
  description: "Design and implement security systems to protect company assets.",
  requirements: [
    "4+ years experience",
    "Firewall & VPN configuration",
    "Cloud Security (AWS/Azure)",
    "Vulnerability Management",
    "Scripting (Python/Bash)"
  ],
}
];

const Jobs = () => {
  const [search, setSearch] = useState("");
  const [department, setDepartment] = useState("All");
  const [jobType, setJobType] = useState("All");
  const [location, setLocation] = useState("All");

  const filtered_Jobs = jobsData.filter((job) => {
    return (
      (department === "All" || job.department === department) &&
      (jobType === "All" || job.type === jobType) &&
      (location === "All" || job.location === location) &&
      job.title.toLowerCase().includes(search.toLowerCase())
    );
  });

  return (
    <div className="min-h-screen bg-gray-200 p-8">
      <div className="max-w-6xl mx-auto mt-15"> 
        <h1 className="text-3xl font-bold text-gray-900"> Open Positions </h1>
        <p className="text-gray-500 mt-2"> Find your next great hire from our active job listings! </p>

        <div className="bg-white rounded-xl shadow-sm border mt-6 p-6">
          <input type="text" placeholder="Search jobs by title or description..."
            className="w-full border rounded-lg px-4 py-2 mb-4 focus:outline-none focus:ring-2 
            focus:ring-blue-500 focus:border-0"
            value={search} onChange={(e) => setSearch(e.target.value)} />

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm text-gray-900 font-semibold mb-1"> Department </label>
              <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 
                cursor-pointer"
                value={department} onChange={(e) => setDepartment(e.target.value)} >
                <option value="All"> All </option>
                <option value="Engineering"> Engineering </option>
                <option value="IT Operations"> IT Operations  </option>
                <option value="Data"> Data </option>
                <option value="Security"> Security </option>

              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-900 font-semibold mb-1"> Job Type </label>
              <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500
                cursor-pointer" value={jobType} onChange={(e) => setJobType(e.target.value)} >
                <option> All </option>
                <option> Full-time </option>
                <option> Part-time </option>
                <option> Contract </option>
                <option> Internship </option>
              </select>
            </div>

            <div>
              <label className="block text-sm text-gray-900 font-semibold mb-1"> Location </label>
              <select className="w-full border rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500"
                value={location} onChange={(e) => setLocation(e.target.value)}>
                <option> All </option>
                <option> San Francisco, CA </option>
                <option> New York, NY </option>
                <option> Remotes </option>
              </select>
            </div>
          </div>
        </div>

        <p className="text-sm text-gray-900 font-semibold underline mt-6 mb-6">
          Showing {filtered_Jobs.length} of {jobsData.length} jobs </p>

        <div className="mt-4 space-y-8">
          {
            filtered_Jobs.map((job) => (
              <div key={job.id} className="bg-white border rounded-xl p-6 shadow-sm hover:shadow-md transition">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="text-xl font-semibold text-gray-900 underline">
                      {job.title}
                    </h2>

                    <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-2">
                      <span className="flex justify-between items-center gap-1"> {job.icon1} {job.department} </span>
                      <span className="flex justify-between items-center gap-1"> {job.icon2} {job.location} </span>
                      <span className="flex justify-between items-center gap-1"> {job.icon3} {job.type} </span>
                    </div>

                    <p className="mt-4 text-gray-600"> {job.description} </p>

                    <div className="mt-4">
                      <p className="text-sm font-medium text-gray-700"> Requirements: </p>
                      <div className="flex flex-wrap gap-2 mt-2">
                        {
                          job.requirements.map((req, index) => (
                            <span key={index} className="bg-blue-100 text-blue-600 text-xs px-3 py-1 
                              rounded-full">
                              {req}
                            </span>
                          ))
                        }
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-6 text-sm text-gray-500 mt-4">
                      <span className="flex justify-between items-center gap-1"> {job.icon_dollar} {job.salary} </span>
                      <span className="flex justify-between items-center gap-1"> {job.icon_person} {job.applicants} applicants </span>
                      <span className="flex justify-between items-center gap-1"> {job.icon3} Posted {job.posted} </span>
                    </div>
                  </div>

                  <div className="flex flex-col items-end gap-5">
                    <span className="bg-green-200 text-green-600 text-md font-semibold px-3 py-1 rounded-full">
                      Active
                    </span>

                    <NavLink to={`/jobs/${job.id}`} className="bg-blue-600 text-white px-4 py-2 
                      rounded-lg hover:bg-blue-700 transition md:w-30">
                      View Details
                    </NavLink>
                  </div>
                </div>
              </div>
            ))
          }
        </div>
      </div>
    </div>
  );
};

export default Jobs;