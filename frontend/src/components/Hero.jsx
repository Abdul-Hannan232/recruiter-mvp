import React from "react";
import { FiZap } from "react-icons/fi";
import { FaCheck } from "react-icons/fa6";
import { BiRightArrowAlt } from "react-icons/bi";
import { NavLink } from 'react-router-dom';
import { GiAlliedStar } from "react-icons/gi";

const Hero = () => {
  return (
    <section className="bg-blue-100">
      <div className="mx-auto max-w-6xl px-6 py-25">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-50 px-4 py-2 text-sm 
              font-semibold text-blue-700">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-blue-600
               text-white text-[11px]">
                <GiAlliedStar className="rounded-full w-6 h-4" />
              </span>
              AI-Powered Recruitment
            </div>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Find The Perfect{" "}
              <span className="text-blue-600"> Candidate </span> Faster
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              Leverage AI technology to streamline your hiring process, match <br /> the
              best candidates, and build your dream team efficiently!
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <NavLink to="/login" className="inline-flex items-center justify-center gap-2 rounded-md bg-blue-600
                px-6 py-3 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 cursor-pointer">
                Get Started Free <BiRightArrowAlt className="text-lg" />
              </NavLink>

              <NavLink to="/dashboard" className="inline-flex items-center justify-center rounded-md border
               border-slate-300 bg-white px-6 py-3 text-sm font-semibold cursor-pointer
                text-slate-800 hover:bg-slate-50"> View Dashboard
              </NavLink>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto w-full max-w-xl rounded-2xl bg-gradient-to-r from-blue-500
             via-indigo-500 to-purple-600 p-6 shadow-xl">
             <div className="absolute -right-2 -top-3 z-10 inline-flex items-center gap-2 rounded-md
               bg-yellow-400 px-3 py-2 text-xs font-bold text-slate-900 shadow">
                <FiZap className="text-base" />
                AI Powered
              </div>

              <div className="rounded-xl bg-white p-5">
                <div className="flex items-start gap-4">
                  <div className="h-12 w-12 rounded-full bg-slate-200" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3 w-1/3 rounded bg-slate-200" />
                    <div className="h-3 w-1/2 rounded bg-slate-100" />
                  </div>

                  <div className="rounded-full bg-green-100 px-3 py-1 text-xs font-bold text-green-700">
                    98% Match
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-11/12 rounded bg-slate-100" />
                  <div className="h-3 w-10/12 rounded bg-slate-100" />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-blue-700">
                    React Js
                  </span>
                  <span className="rounded-full bg-purple-50 px-3 py-1 text-xs font-semibold text-purple-700">
                    Node Js
                  </span>
                  <span className="rounded-full bg-green-50 px-3 py-1 text-xs font-semibold text-green-700">
                    AWS
                  </span>
                </div>
              </div>

              <div className="absolute -bottom-3 left-6 inline-flex items-center gap-2 rounded-md bg-green-600
                px-3 py-2 text-xs font-bold text-white shadow">
                <FaCheck className="bg-blue-400 rounded-full w-8 h-6" /> 1000+ Hired
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 -bottom-10 mx-auto h-16 w-[85%] rounded-full
             bg-slate-200/60 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;