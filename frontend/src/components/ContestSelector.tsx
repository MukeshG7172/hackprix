"use client";

import { useState, useRef, useEffect } from "react";
import { ChevronLeft, ChevronRight, Search, X, Calendar, Trophy, ArrowRight, Check, ListPlus } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { motion, AnimatePresence } from "framer-motion";
import { useContest } from "@/context/ContestContext";

// Months for display
const months = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December"
];
export default function ContestSelector({ date }: { date: string }) {
  const { contests, selectedContest, setSelectedContest } = useContest();
  const [selectedPlatform, setSelectedPlatform] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [startIndex, setStartIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const modalRef = useRef<HTMLDivElement>(null);
  const carouselRef = useRef<HTMLDivElement>(null);
  const visibleCards = 3; // Number of contests visible at once

  const currentYear = new Date().getFullYear();
  const pastYears = Array.from({ length: 5 }, (_, i) => currentYear - i);

  // State for filters that are applied
  const [appliedYear, setAppliedYear] = useState(currentYear);
  const [appliedMonth, setAppliedMonth] = useState<number | null>(null);

  // Temporary selection state (only applied when clicking "Apply")
  const [tempYear, setTempYear] = useState(currentYear);
  const [tempMonth, setTempMonth] = useState<number | null>(null);

  // Get months that have contests for the selected year
  const contestMonths = new Set(
    contests
      .filter((c) => new Date(c.date).getFullYear() === tempYear)
      .map((c) => new Date(c.date).getMonth())
  );

  // Filter contests based on applied filters
  const filteredContests = contests
    .filter((c) => c.type === selectedPlatform)
    .filter((c) => c.name.toLowerCase().includes(searchTerm.toLowerCase()))
    .filter((c) => {
      if (!appliedYear || appliedMonth === null) return true;
      const contestDate = new Date(c.date);
      return contestDate.getFullYear() === appliedYear && contestDate.getMonth() === appliedMonth;
    });

  // Get contests to display in current view
  const currentContests = filteredContests.slice(startIndex, startIndex + visibleCards);

  // Convert string to title case
  const toTitleCase = (str: string): string =>
    str.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  // Get formatted date
  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: 'numeric',
      month: 'short',
      year: 'numeric'
    });
  };

  // Get relative time description
  const getTimeDescription = (dateString: string): string => {
    const contestDate = new Date(dateString);
    const today = new Date();

    // Normalize both dates to start of the day (ignoring time)
    contestDate.setHours(0, 0, 0, 0);
    today.setHours(0, 0, 0, 0);

    const diffDays = (contestDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);

    if (diffDays < 0) return "Ended";
    if (diffDays === 0) return "Today";
    if (diffDays === 1) return "Tomorrow";
    if (diffDays <= 7) return `In ${diffDays} days`;
    return `In ${Math.floor(diffDays / 7)} weeks`;
  };

  // Get status color based on date
  const getStatusColor = (dateString: string): string => {
    const contestDate = new Date(dateString);
    const today = new Date();
    const diffTime = contestDate.getTime() - today.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

    if (diffDays < 0) return "bg-gray-500";
    if (diffDays <= 2) return "bg-red-500";
    if (diffDays <= 7) return "bg-amber-500";
    return "bg-green-500";
  };

  // Check if a contest is the currently selected contest
  const isSelectedContest = (contest: any): boolean => {
    return selectedContest && selectedContest.id === contest.id;
  };

  // Navigation functions
  const prevSlide = () => {
    if (startIndex > 0 && !isAnimating) {
      setIsAnimating(true);
      setStartIndex(startIndex - 1);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  const nextSlide = () => {
    if (startIndex + visibleCards < filteredContests.length && !isAnimating) {
      setIsAnimating(true);
      setStartIndex(startIndex + 1);
      setTimeout(() => setIsAnimating(false), 300);
    }
  };

  // Close modal when clicking outside
  useEffect(() => {
    const handleOutsideClick = (event: MouseEvent) => {
      if (modalRef.current && !modalRef.current.contains(event.target as Node)) {
        setSelectedPlatform(null);
      }
    };

    document.addEventListener("mousedown", handleOutsideClick);
    return () => {
      document.removeEventListener("mousedown", handleOutsideClick);
    };
  }, [setSelectedPlatform]);

  // Keyboard navigation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        setSelectedPlatform(null);
      } else if (e.key === "ArrowLeft") {
        prevSlide();
      } else if (e.key === "ArrowRight") {
        nextSlide();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [startIndex, filteredContests.length, setSelectedPlatform]);

  // Get all available platforms
  const platforms = Array.from(new Set(contests.map(contest => contest.type)));

  const applyFilters = () => {
    setAppliedYear(tempYear);
    setAppliedMonth(tempMonth);
  };

  const clearFilters = () => {
    setTempYear(currentYear);
    setTempMonth(null);
    setAppliedYear(currentYear);
    setAppliedMonth(null);
  };

  return (
    <>
      {/* Contest List Button */}
      <div className={`${window.location.pathname !== "/leaderboard" ? "mb-6 flex flex-col justify-center items-center" : "hover:cursor-pointer"}`}>
        {window.location.pathname !== "/leaderboard" ? (
          <Button
            onClick={() => setSelectedPlatform(platforms[0] || null)}
            className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg py-2 px-4 transition-all transform hover:scale-105 shadow-md"
          >
            <ListPlus className="w-5 h-5" />
            Contest List
          </Button>
        ) : (<div className="bg-gradient-to-r from-blue-500 to-purple-500 text-transparent bg-clip-text font-semibold" onClick={() => setSelectedPlatform(platforms[0] || null)}
        >
          {date}
        </div>
        )
        }
      </div>

      {/* Contest Carousel Modal */}
      {selectedPlatform && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md flex justify-center items-center z-50 transition-all duration-300">
          <motion.div
            ref={modalRef}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="bg-white dark:bg-gray-900 p-8 rounded-2xl shadow-2xl w-full max-w-4xl relative"
          >
            {/* Header with platform selection */}
            <div className="flex items-center justify-between mb-6">
              <div className="flex items-center gap-3">
                <Trophy className="w-6 h-6 text-blue-500" />
                <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                  Contest Platforms
                </h2>
              </div>

              {/* Close Button */}
              <button
                onClick={() => setSelectedPlatform(null)}
                className="bg-gray-200 dark:bg-gray-800 text-gray-700 dark:text-gray-300 p-2 rounded-full hover:bg-gray-300 dark:hover:bg-gray-700 transition-all"
                aria-label="Close"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Platform Selection Pills */}
            <div className="flex flex-wrap gap-2 mb-6">
              {platforms.map((platform) => (
                <Button
                  key={platform}
                  variant={selectedPlatform === platform ? "default" : "outline"}
                  className={`rounded-full px-4 py-1 ${selectedPlatform === platform
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "bg-white dark:bg-gray-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-700"
                    }`}
                  onClick={() => {setSelectedPlatform(platform); setStartIndex(0);}}
                >
                  {selectedPlatform === platform && <Check className="w-4 h-4 mr-1" />}
                  {toTitleCase(platform)}
                </Button>
              ))}
            </div>


            {/* Search Bar */}
            <div className="relative">
              <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
              <Input
                type="text"
                placeholder="Search contests..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 py-3 text-base w-full bg-gray-50 dark:bg-gray-800 text-gray-900 dark:text-gray-200 border border-gray-200 dark:border-gray-700 rounded-xl focus:ring-2 focus:ring-blue-500 transition-all"
              />
            </div>

            {/* Month and Year Selection */}
            <div className="mb-3 bg-white dark:bg-gray-800 p-5">
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white mb-4 flex items-center">
                <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
                Filter by Month & Year
              </h3>

              <div className="flex flex-col">
                {/* Year Selection */}
                <div className="overflow-x-auto pb-2 mb-4">
                  <div className="flex gap-2">
                    {pastYears.map((year) => (
                      <Button
                        key={year}
                        onClick={() => setTempYear(year)}
                        variant={tempYear === year ? "default" : "outline"}
                        className={`rounded-full px-4 py-1 transition-all ${tempYear === year ? "shadow-md" : ""
                          }`}
                      >
                        {year}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Month Selection */}
                <div className="mb-4">
                  <div className="grid grid-cols-4 gap-3">
                    {months.map((month, index) => (
                      <Button
                        key={month}
                        onClick={() => !contestMonths.has(index) ? null : setTempMonth(tempMonth === index ? null : index)}
                        disabled={!contestMonths.has(index)}
                        className={`py-2 rounded-md ${tempMonth === index
                          ? "bg-blue-600 text-white"
                          : !contestMonths.has(index)
                            ? "bg-gray-300 dark:bg-gray-700 text-gray-500 dark:text-gray-500 cursor-not-allowed"
                            : "bg-gray-200 dark:bg-gray-700 text-gray-900 dark:text-gray-300 hover:bg-gray-300 dark:hover:bg-gray-600"
                          }`}
                      >
                        {month}
                      </Button>
                    ))}
                  </div>
                </div>

                {/* Apply Button */}
                <div className="flex justify-between mt-4 gap-3">
                  <Button
                    onClick={applyFilters}
                    className="flex-1 bg-blue-600 hover:bg-blue-700 text-white transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                    </svg>
                    Apply
                  </Button>
                  <Button
                    onClick={clearFilters}
                    variant="outline"
                    className="flex-1 border-gray-300 dark:border-gray-600 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors"
                  >
                    <svg className="w-4 h-4 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    </svg>
                    Clear
                  </Button>
                </div>
              </div>
            </div>

            {/* Contest Count */}
            <div className="mb-4 text-sm text-gray-500 dark:text-gray-400">
              Showing {currentContests.length} of {filteredContests.length} contests
            </div>

            {/* Contest Carousel */}
            <div className="flex items-center justify-between gap-4">
              {/* Previous Button */}
              <Button
                onClick={prevSlide}
                disabled={startIndex === 0 || isAnimating}
                variant="outline"
                size="icon"
                className={`rounded-full p-3 h-12 w-12 flex-shrink-0 ${startIndex === 0 ? "hover:cursor-not-allowed opacity-50" : "hover:cursor-pointer hover:bg-gray-200 dark:hover:bg-gray-700 transition-all"}`}
              >
                <ChevronLeft className="w-5 h-5" />
              </Button>

              {/* Contest Cards */}
              <div
                ref={carouselRef}
                className="flex justify-center gap-6 overflow-hidden p-2 relative w-full"
              >
                <AnimatePresence mode="wait">
                  <motion.div
                    key={startIndex}
                    initial={{ x: 20, opacity: 0 }}
                    animate={{ x: 0, opacity: 1 }}
                    exit={{ x: -20, opacity: 0 }}
                    transition={{ duration: 0.2 }}
                    className="flex justify-center gap-6 w-full"
                  >
                    {currentContests.length > 0 ? (
                      currentContests.map((contest) => {
                        const selected = isSelectedContest(contest);
                        return (
                          <Card
                            key={contest.id}
                            onClick={() => {
                              setSelectedContest(contest);
                              setSelectedPlatform(null);
                            }}
                            className={`cursor-pointer w-full max-w-60 transition-all hover:scale-105 ${selected
                              ? "bg-blue-50 dark:bg-blue-900/30 border-2 border-blue-500 dark:border-blue-400 shadow-md"
                              : "bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 hover:shadow-lg"
                              } group`}
                          >
                            <div className={`${getStatusColor(contest.date)} h-1 w-full rounded-t-lg`} />
                            <CardHeader className="p-4 pb-2">
                              <div className="flex items-center justify-between mb-2">
                                <Badge className="w-fit" variant={selected ? "default" : "outline"}>
                                  {contest.type}
                                </Badge>
                                {selected && (
                                  <div className="flex items-center gap-1 text-xs font-medium text-blue-600 dark:text-blue-400">
                                    <Check className="w-3 h-3" />
                                    Selected
                                  </div>
                                )}
                              </div>
                              <CardTitle className={`text-lg font-bold ${selected
                                ? "text-blue-700 dark:text-blue-300"
                                : "group-hover:text-blue-600 dark:group-hover:text-blue-400"
                                } transition-colors`}>
                                {toTitleCase(contest.name)}
                              </CardTitle>
                            </CardHeader>
                            <CardContent className="p-4 pt-0">
                              <div className="flex items-center text-sm text-gray-600 dark:text-gray-400 mb-2">
                                <Calendar className="w-4 h-4 mr-2" />
                                {formatDate(contest.date)}
                              </div>
                              <Badge variant={getTimeDescription(contest.date) === "Ended" ? "destructive" : "secondary"} className="mt-1">
                                {getTimeDescription(contest.date)}
                              </Badge>
                            </CardContent>
                            <CardFooter className="p-4 pt-0">
                              <Button
                                variant={selected ? "default" : "ghost"}
                                size="sm"
                                className={`${selected
                                  ? "bg-blue-600 text-white hover:bg-blue-700"
                                  : "text-blue-600 dark:text-blue-400 p-0 hover:bg-transparent group-hover:underline"
                                  }`}
                              >
                                {selected ? "Current Selection" : "View details"}
                                {!selected && <ArrowRight className="w-4 h-4 ml-1 inline" />}
                              </Button>
                            </CardFooter>
                          </Card>
                        );
                      })
                    ) : (
                      <div className="flex flex-col items-center justify-center w-full py-12 text-gray-500 dark:text-gray-400">
                        <Trophy className="w-12 h-12 mb-4 opacity-30" />
                        <p className="text-lg font-medium">No contests found</p>
                        <p className="text-sm">Try adjusting your search criteria</p>
                      </div>
                    )}
                  </motion.div>
                </AnimatePresence>
              </div>

              {/* Next Button */}
              <Button
                onClick={nextSlide}
                disabled={startIndex + visibleCards >= filteredContests.length || isAnimating}
                variant="outline"
                size="icon"
                className="rounded-full p-3 h-12 w-12 flex-shrink-0"
              >
                <ChevronRight className="w-5 h-5" />
              </Button>
            </div>

            {/* Pagination Dots */}
            <div className="flex justify-center mt-6 gap-2">
              {Array.from({ length: Math.ceil(filteredContests.length / visibleCards) }).map((_, index) => (
                <button
                  key={index}
                  onClick={() => {
                    setIsAnimating(true);
                    setStartIndex(index * visibleCards);
                    setTimeout(() => setIsAnimating(false), 300);
                  }}
                  className={`w-2 h-2 rounded-full transition-all ${index === Math.floor(startIndex / visibleCards)
                    ? "bg-blue-600 w-6"
                    : "bg-gray-300 dark:bg-gray-700 hover:bg-gray-400 dark:hover:bg-gray-600"
                    }`}
                  aria-label={`Go to page ${index + 1}`}
                />
              ))}
            </div>
          </motion.div>
        </div>
      )}
    </>
  );
}
