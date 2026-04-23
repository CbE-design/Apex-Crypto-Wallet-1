
import React from 'react';

export const LoadingSpinner = () => {
  return (
    <div className="flex justify-center items-center h-full">
      <div className="animate-spin rounded-full h-32 w-32 border-t-2 border-b-2 border-primary">
        <svg className="animate-pulse" width="128" height="128" viewBox="0 0 512 512" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="512" height="512" rx="96" fill="#121212"/>
          <path d="M128 384L256 128L384 384" stroke="#4285F4" stroke-width="32" stroke-linecap="round" stroke-linejoin="round"/>
          <path d="M192 288H320" stroke="#7DF9FF" stroke-width="24" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      </div>
    </div>
  );
};
