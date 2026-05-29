import {useParams, Link} from 'react-router-dom';
import { jobsData } from './Jobs';
import { MdOutlineEngineering } from "react-icons/md";
import { FaMapLocationDot } from "react-icons/fa6";
import { IoCalendarNumber } from "react-icons/io5";

const JobDetailsPage = () => {
  const { id } = useParams();
  const job = jobsData.find((job) => job.id === parseInt(id));

  if (!job) {
    return <div className="p-10 text-red-500 text-xl text-center"> Error! This Job you have searched doesn't
      not found </div>;
  }

  return (
    <div className="min-h-screen bg-gray-300 p-8">
      <div className="max-w-6xl mx-auto mt-20">
        <Link to="/jobs" className="text-white rounded-full px-6 py-2 text-sm cursor-pointer
          bg-blue-500 font-bold hover:bg-blue-800"> &larr; Back to Jobs 
        </Link>

        <div className="grid md:grid-cols-2 gap-10 mt-6 bg-white p-8 rounded-xl shadow">

          <div>
            <h1 className="text-3xl mb-4 font-bold text-gray-800 underline">
              {job.title}
            </h1>

            <div className="flex flex-wrap gap-4 text-sm text-gray-500 mt-3">
              <span className='flex flex-wrap justify-between items-center gap-1'> <MdOutlineEngineering size={16} />
                {job.department} </span>
              <span className='flex flex-wrap justify-between items-center gap-1'> <FaMapLocationDot size={16} />
                {job.location} </span>
              <span className='flex flex-wrap justify-between items-center gap-1'> <IoCalendarNumber size={16} />
                {job.type} </span>
            </div>

            <p className="mt-6 text-gray-600 leading-relaxed"> {job.description} </p>
            <div className="mt-6">
              <h3 className="font-bold text-gray-800 text-xl underline"> Requirements: </h3>

              <ul className="list-disc ml-6 mt-3 space-y-2 text-gray-600">
                {
                  job.requirements.map((req, index) => (
                    <li key={index}> {req} </li>
                  ))
                }
              </ul>
            </div>

            <div className="mt-6 text-sm text-gray-500 space-y-1">
              <p> <strong className='text-[18px] font-bold'> Salary: </strong> {job.salary} </p>
              <p> <strong className='text-[18px] font-bold'> Applicants: </strong> {job.applicants} </p>
              <p> <strong className='text-[18px] font-bold'> Posted: </strong> {job.posted} </p>
            </div>
          </div>

          <div>
            <img src={job.image} alt={job.title} 
            className="rounded-4xl shadow-md w-full h-full object-cover hover:scale-90 cursor-pointer
            md:scale-95" />
          </div>

        </div>
      </div>
    </div>
  );
};

export default JobDetailsPage;