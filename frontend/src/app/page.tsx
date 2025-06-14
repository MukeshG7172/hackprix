import { Suspense } from "react";
import ContestAnalysisPage from "@/components/ContestAnalysis";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50 w-full">
      <main className="flex-1 container mx-auto px-4 py-8 max-w-7xl">
        <Suspense fallback={
          <div className="flex justify-center items-center h-64">
            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500"></div>
          </div>
        }>
          <ContestAnalysisPage />
        </Suspense>
      </main>
    </div>
  );
}

