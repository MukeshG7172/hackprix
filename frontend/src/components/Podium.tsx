import { Trophy, Medal, Award } from "lucide-react";

interface Performer {
  name: string;
  rank: number;
  dept: string;
  year: string;
}

interface ContestAnalysisData {
  name: string;
  date: string;
  type: string;
  topPerformers: Performer[];
}

interface PodiumProps {
  selectedContest: ContestAnalysisData | null;
}

export default function Podium({ selectedContest }: PodiumProps) {
  // Ensure selectedContest and topPerformers are properly initialized
  if (!selectedContest || !Array.isArray(selectedContest.topPerformers) || selectedContest.topPerformers.length === 0) {
    return (
      <div className="text-center p-12 bg-blue-50 rounded-lg">
        <p className="text-gray-600">No top performers available for this contest.</p>
      </div>
    );
  }

  const getPodiumOrder = (performers: Performer[] = []) =>
    performers.length === 3 ? [performers[1], performers[0], performers[2]] : performers;

  const getIcon = (index: number) => {
    if (index === 1) return <Trophy className="w-8 h-8 text-yellow-400" />;
    if (index === 0) return <Medal className="w-6 h-6 text-gray-300" />;
    return <Award className="w-6 h-6 text-orange-400" />;
  };

  return (
    <div className="max-w-4xl mx-auto p-6 bg-gradient-to-b from-blue-50 to-white rounded-xl shadow-lg mb-5">
      <h2 className="text-3xl font-bold mb-6 text-center text-blue-800">Contest Champions</h2>

      {/* Podium Display */}
      <div className="mt-16 mb-8 -z-150">
        <div className="flex justify-center items-end gap-4 text-center">
          {getPodiumOrder(selectedContest.topPerformers.slice(0, 3)).map((performer, index) => (
            <div key={index} className="flex flex-col items-center">
              <div className="mb-2">{getIcon(index)}</div>
              <div
                className={`w-28 rounded-t-lg shadow-lg transform transition-all hover:scale-105 ${index === 1
                    ? "bg-gradient-to-b from-yellow-400 to-yellow-300 h-40 z-10"
                    : index === 0
                      ? "bg-gradient-to-b from-gray-300 to-gray-200 h-32"
                      : "bg-gradient-to-b from-orange-400 to-orange-300 h-24"
                  }`}
              >
                <div className="flex flex-col justify-end items-center h-full">
                  <div className="absolute -top-14">
                    <div className="w-16 h-16 rounded-full bg-white shadow-md flex items-center justify-center overflow-hidden border-4 border-white">
                      <div className="text-2xl font-bold bg-blue-100 w-full h-full flex items-center justify-center text-blue-800">
                        {index === 0 ? "2nd" : index === 1 ? "1st" : "3rd"}
                      </div>
                    </div>
                  </div>
                  <div className="w-full p-4 rounded-t-lg">
                    <p className="font-semibold text-black">{performer.name}</p>
                    <p className="text-xs text-black/80">
                      {performer.dept} • {performer.year}
                    </p>
                    <p className="text-xs text-black/80">Rank: {performer.rank}</p>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
