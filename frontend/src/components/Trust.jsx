import React from 'react'
const Trust = () => {
    const Trust_data = [
        { value: '10,000+', label: 'Candidates Hired' },
        { value: '500+', label: 'Companies Trust Us' },
        { value: '95%', label: 'Client Satisfaction' },
        { value: '50%', label: 'Time Saved' }
    ];
  return (
    <section className='bg-gradient-to-b from-blue-600 to-purple-800 py-16'>
        <div className='max-w-7xl mx-auto px-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-10
            text-center text-white'>
            {
                Trust_data.map((t, index) => (
                    <div key={index} className='flex flex-col items-center'>
                        <p className='text-5xl font-extrabold mb-2'> {t.value} </p>
                        <p className='text-md font-medium opacity-80'> {t.label} </p>
                    </div>
                ))
            }
        </div>
    </section>
  )
}

export default Trust;