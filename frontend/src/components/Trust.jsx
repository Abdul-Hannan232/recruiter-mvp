import React from "react";

const Trust = () => {
  const Trust_data = [
    { value: "10,000+", label: "Candidates Hired" },
    { value: "500+", label: "Companies Trust Us" },
    { value: "95%", label: "Client Satisfaction" },
    { value: "50%", label: "Time Saved" },
  ];
  return (
    <section className="bg-gradient-to-br from-slate-900 to-indigo-900 py-16">
      <div className="mx-auto grid max-w-7xl grid-cols-1 gap-10 px-6 text-center text-white md:grid-cols-2 lg:grid-cols-4">
        {Trust_data.map((t, index) => (
          <div key={index} className="flex flex-col items-center">
            <p className="mb-2 text-5xl font-extrabold text-white">{t.value}</p>
            <p className="text-md font-medium text-indigo-200">{t.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
};

export default Trust;
