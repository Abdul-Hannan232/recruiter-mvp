import React from "react";
import { FiZap } from "react-icons/fi";
import { FaCheck } from "react-icons/fa6";
import { BiRightArrowAlt } from "react-icons/bi";
import { NavLink } from "react-router-dom";
import { GiAlliedStar } from "react-icons/gi";

const Hero = () => {
  return (
    <section className="bg-gradient-to-b from-slate-50 to-white">
      <div className="mx-auto max-w-6xl px-6 py-24">
        <div className="grid items-center gap-12 lg:grid-cols-2">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-indigo-50 px-4 py-2 text-sm font-semibold text-indigo-700 ring-1 ring-inset ring-indigo-100">
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-indigo-600 text-[11px] text-white">
                <GiAlliedStar className="h-4 w-6 rounded-full" />
              </span>
              AI-Powered Recruitment
            </div>

            <h1 className="mt-6 text-4xl font-extrabold leading-tight tracking-tight text-slate-900 sm:text-5xl">
              Find The Perfect <span className="text-indigo-600">Candidate</span> Faster
            </h1>

            <p className="mt-5 max-w-xl text-base leading-relaxed text-slate-600">
              Leverage AI to streamline your hiring process, match the best candidates, and
              build your dream team efficiently.
            </p>

            <div className="mt-8 flex flex-wrap items-center gap-4">
              <NavLink
                to="/signup"
                className="inline-flex items-center justify-center gap-2 rounded-lg bg-indigo-600 px-6 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-indigo-500"
              >
                Get Started Free <BiRightArrowAlt className="text-lg" />
              </NavLink>

              <NavLink
                to="/dashboard"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-6 py-3 text-sm font-semibold text-slate-800 transition hover:border-indigo-400 hover:text-indigo-600"
              >
                View Dashboard
              </NavLink>
            </div>
          </div>

          <div className="relative">
            <div className="relative mx-auto w-full max-w-xl rounded-2xl bg-gradient-to-br from-indigo-500 via-indigo-600 to-violet-600 p-6 shadow-xl">
              <div className="absolute -right-2 -top-3 z-10 inline-flex items-center gap-2 rounded-md bg-emerald-400 px-3 py-2 text-xs font-bold text-slate-900 shadow">
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
                  <div className="rounded-full bg-emerald-100 px-3 py-1 text-xs font-bold text-emerald-700">
                    98% Match
                  </div>
                </div>

                <div className="mt-4 space-y-2">
                  <div className="h-3 w-full rounded bg-slate-100" />
                  <div className="h-3 w-11/12 rounded bg-slate-100" />
                  <div className="h-3 w-10/12 rounded bg-slate-100" />
                </div>

                <div className="mt-5 flex flex-wrap gap-2">
                  <span className="rounded-full bg-indigo-50 px-3 py-1 text-xs font-semibold text-indigo-700">
                    React Js
                  </span>
                  <span className="rounded-full bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700">
                    Node Js
                  </span>
                  <span className="rounded-full bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                    AWS
                  </span>
                </div>
              </div>

              <div className="absolute -bottom-3 left-6 inline-flex items-center gap-2 rounded-md bg-emerald-600 px-3 py-2 text-xs font-bold text-white shadow">
                <FaCheck /> 1000+ Hired
              </div>
            </div>

            <div className="pointer-events-none absolute inset-x-0 -bottom-10 mx-auto h-16 w-[85%] rounded-full bg-indigo-200/50 blur-2xl" />
          </div>
        </div>
      </div>
    </section>
  );
};

export default Hero;
