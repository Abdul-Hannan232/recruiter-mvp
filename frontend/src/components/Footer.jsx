import { FiMapPin, FiPhoneCall, FiMail } from "react-icons/fi";
export default function Footer() {
  return (
    <footer className="bg-slate-900 text-slate-300">
      <div className="max-w-7xl mx-auto px-6 py-16">
        <div className="grid grid-cols-1 md:grid-cols-4 md:gap-5 gap-10">
          <div>
            <h2 className="text-white text-xl font-semibold mb-4">
              Recruiter-AI
            </h2>
            <p className="text-sm leading-relaxed text-slate-400">
              AI-powered recruitment system helping companies find the best
              talent efficiently!
            </p>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 underline text-xl">Quick Links</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition">
                  Home
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  Jobs
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  Dashboard
                </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition">
                  Applications
                </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 underline text-xl">Company</h3>
            <ul className="space-y-2 text-sm">
              <li>
                <a href="#" className="hover:text-white transition"> About Us </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition"> Careers </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition"> Privacy Policy </a>
              </li>
              <li>
                <a href="#" className="hover:text-white transition"> Terms of Service </a>
              </li>
            </ul>
          </div>

          <div>
            <h3 className="text-white font-semibold mb-4 underline text-xl">Contact</h3>
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-2">
                <FiMail size={16} />
                <span>info@recruiter-ai.com</span>
              </li>
              <li className="flex items-center gap-2">
                <FiPhoneCall size={16} />
                <span>+1 (555) 123-4567</span>
              </li>
              <li className="flex items-center gap-2">
                <FiMapPin size={16} />
                <span>Lahore, Pakistan</span>
              </li>
            </ul>
          </div>
        </div>

        <div className="border-t border-slate-700 mt-12 pt-6 text-center text-md text-gray-500 cursor-pointer">
          &#169; 2026 Recruiter-AI Created by Zehab Faisal, All Rights Reserved!
        </div>
      </div>
    </footer>
  );
}