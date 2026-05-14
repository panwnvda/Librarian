import React from 'react';
import { Link } from 'react-router-dom';
import { FileQuestion, ArrowLeft } from 'lucide-react';

export default function PageNotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-[#1f1f1f] px-4">
      <div className="text-center">
        <div className="mb-5 flex justify-center">
          <FileQuestion className="h-10 w-10 text-[#3a3a3a]" strokeWidth={1.5} />
        </div>
        <h1 className="mb-2 text-[40px] font-bold tracking-tight text-[#e8e8e8]">404</h1>
        <p className="mb-7 text-[13.5px] text-[#9a9a9a]">This page doesn't exist or has been deleted.</p>
        <Link
          to="/"
          className="inline-flex items-center gap-1.5 rounded-md bg-[#e8e8e8] px-3.5 py-1.5 text-[12.5px] font-medium text-[#1a1a1a] transition-colors hover:bg-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to home
        </Link>
      </div>
    </div>
  );
}
