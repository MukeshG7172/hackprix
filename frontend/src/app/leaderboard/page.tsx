"use client";

import React from "react";
import { useContest } from "@/context/ContestContext";
import { useState, useEffect } from "react";
import ContestSelector from "@/components/ContestSelector";
import Pagination from "@/components/Pagination";
import TotalCountChart from "@/components/TotalCountChart";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Calendar, Filter, Search } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
// import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { platform } from "os";

type FilterType = "dept" | "section" | "noOfQuestions" | "batch" | "status";

export default function Leaderboard() {
  const { selectedContest, isLoading } = useContest();
  console.log(selectedContest?.allParticipants[0].leetcode_id);
  const [filteredParticipants, setFilteredParticipants] = useState([]);
  const [filters, setFilters] = useState({
    dept: "all",
    section: "all",
    noOfQuestions: "all",
    batch: "all",
    status: "all",
  });
  const [showCal, setShowCal] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [showFilterOptions, setShowFilterOptions] = useState<Record<FilterType, boolean>>({
    dept: false,
    section: false,
    noOfQuestions: false,
    batch: false,
    status: false,
  });
  const [currentPage, setCurrentPage] = useState(1);
  const [rowsPerPage] = useState(25);
  const [expandedRow, setExpandedRow] = useState<number | null>(null);
  
  useEffect(() => {
    setCurrentPage(1);
  }, [filters, selectedContest]);

  const paginatedParticipants = filteredParticipants.slice(
    (currentPage - 1) * rowsPerPage,
    currentPage * rowsPerPage
  );

  const toggleFilterOptions = (filter: FilterType) => {
    setShowFilterOptions((prev) => ({
      ...prev,
      [filter]: !prev[filter],
    }));
  };

  // Initialize filtered participants when contest changes
  useEffect(() => {
    if (selectedContest) {
      setFilteredParticipants(selectedContest.allParticipants);
      // Reset filters when contest changes
      setFilters({
        dept: "all",
        section: "all",
        noOfQuestions: "all",
        batch: "all",
        status: "all",
      });
    }
  }, [selectedContest]);

  // Apply filters when filters state changes
  useEffect(() => {
    if (!selectedContest) return;

    let result = [...selectedContest.allParticipants];

    if (filters.dept !== "all") {
      result = result.filter(p => p.dept === filters.dept);
    }

    if (filters.section !== "all") {
      result = result.filter(p => p.section === filters.section);
    }

    if (filters.noOfQuestions !== "all") {
      result = result.filter(p => p.no_of_questions.toString() === filters.noOfQuestions);
    }

    if (filters.batch !== "all") {
      result = result.filter(p => p.year === filters.batch);
    }

    if (filters.status !== "all") {
      if (filters.status === "Attended") {
        result = result.filter(p => p.rank !== -1);
      } else if (filters.status === "Not Attended") {
        result = result.filter(p => p.rank === -1);
      }
    }

    setFilteredParticipants(result);
  }, [filters, selectedContest]);

  const getStatus = (rank: number): string => {
    return rank === -1 ? "Not Attended" : "Attended";
  };

  function calculateLeetcodeDuration(finishTime: string): string {
    if (!finishTime) {
      return "00:00:00";
    }

    // Parse finish time
    const [time, period] = finishTime.split(" ");
    const [finishHours, finishMinutes, finishSeconds] = time.split(":").map(Number);

    // Convert finish time to 24-hour format
    let finishHour24 = finishHours;
    if (period === "PM" && finishHours !== 12) finishHour24 += 12;
    if (period === "AM" && finishHours === 12) finishHour24 = 0;

    // Determine the correct contest start time (8:00 AM or 8:00 PM)
    const isMorningContest = finishHour24 < 12; // If finish time is before 12 PM, it's a morning contest
    const startHour24 = isMorningContest ? 8 : 20; // 8 AM or 8 PM
    const startMinute = 0, startSecond = 0;

    // Convert times to total seconds
    const finishTotalSeconds = finishHour24 * 3600 + finishMinutes * 60 + finishSeconds;
    const startTotalSeconds = startHour24 * 3600 + startMinute * 60 + startSecond;

    // Calculate elapsed time (can exceed 1hr 30mins due to penalties)
    let totalSeconds = finishTotalSeconds - startTotalSeconds;

    // Ensure no negative values appear (invalid cases)
    if (totalSeconds < 0) {
      return "00:00:00";
    }

    // Convert seconds to hh:mm:ss format
    const hours = Math.floor(totalSeconds / 3600);
    totalSeconds %= 3600;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = totalSeconds % 60;

    return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
  }

  const formatDate = (dateString: string): string => {
    const date = new Date(dateString);
    return date.toLocaleDateString("en-GB", {
      day: "numeric",
      month: "short",
      year: "numeric",
    });
  };

  const getRankBadgeColor = (index: number, rank: number): string => {
    if (index === 0 && rank !== -1) return "shine-gold";
    if (index === 1 && rank !== -1) return "shine-silver";
    if (index === 2 && rank !== -1) return "shine-bronze";
    if (index <= 10 && rank !== -1) return "bg-blue-500 text-white";
    if (rank !== -1) return "bg-gray-500 text-white";
    return "bg-red-500 text-white";
  };

  const toTitleCase = (str: string): string =>
    str.replace(/-/g, " ").replace(/\b\w/g, (char) => char.toUpperCase());

  const resetFilters = () => {
    setFilters({
      dept: "all",
      section: "all",
      noOfQuestions: "all",
      batch: "all",
      status: "all",
      rank: { from: "", to: "" },
    });
  };

  // Extract unique values for filter options
  const getUniqueValues = (key) => {
    if (!selectedContest) return [];
    const values = [...new Set(selectedContest.allParticipants.map(p => p[key]))];
    return values.filter(Boolean).sort();
  };

  const uniqueDepts = getUniqueValues("dept");
  const uniqueSections = getUniqueValues("section");
  const uniqueNoOfQuestions = getUniqueValues("no_of_questions");
  const uniqueBatches = getUniqueValues("year");

  const toggleExpandRow = (index: number) => {
    setExpandedRow(expandedRow === index ? null : index);
  };

  return (
    <div className="container mx-auto px-4 py-6 mt-16">
      <h1 className="text-3xl font-bold mb-6 text-center">Contest Leaderboard</h1>

      {/* <ContestSelector /> */}

      {isLoading ? (
        <LoadingState />
      ) : selectedContest ? (
        <Card className="mt-6">
          <CardHeader className="pb-2">
            <div className="flex justify-between items-center">
              <CardTitle className="text-xl">{toTitleCase(selectedContest.name)}</CardTitle>

              <div className="flex items-center gap-2">
                <div className="relative">
                  <Search className="w-4 h-4 absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" />
                  <Input
                    type="text"
                    placeholder="Search by name..."
                    className="pl-8 w-48 h-8"
                    onChange={(e) => {
                      const searchTerm = e.target.value.toLowerCase();
                      if (selectedContest) {
                        const filtered = selectedContest.allParticipants.filter(p =>
                          p.name.toLowerCase().includes(searchTerm)
                        );
                        setFilteredParticipants(filtered);
                      }
                    }}
                  />
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFilters({
                    dept: "all",
                    section: "all",
                    noOfQuestions: "all",
                    batch: "all",
                    status: "all",
                    rank: { from: "", to: "" },
                  })}
                  className="flex items-center gap-2"
                >
                  <Filter className="w-4 h-4" />
                  {showFilters ? "Hide Filters" : "Reset Filters"}
                </Button>
              </div>
            </div>
            <div className="flex items-center text-sm text-gray-500">
              <Calendar className="w-4 h-4 mr-2" />
              <ContestSelector date={formatDate(selectedContest?.date)}
              />
              <Badge variant="outline" className="ml-3">{selectedContest.type}</Badge>
            </div>
          </CardHeader>
          <CardContent>
            {filteredParticipants.length > 0 ? (
              <>
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-16 font-semibold text-black text-center">S.No</TableHead>
                      <TableHead className="w-20 font-semibold text-black">Rank</TableHead>
                      <TableHead className="font-semibold text-black">Name</TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-row items-center justify-center relative">
                          <span className="pr-2 font-semibold text-black">Department</span>
                          <div className="w-6 h-6 bg-gray-200 rounded-full border-black border flex items-center justify-center cursor-pointer hover:bg-gray-300" onClick={() => toggleFilterOptions("dept")}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                          </div>
                          {showFilterOptions.dept && (
                            <div className="absolute z-10 bg-white border rounded shadow-lg top-full right-0 min-w-[150px]">
                              <div
                                className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.dept === "all" ? "bg-blue-100" : ""}`}
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, dept: "all" }));
                                  toggleFilterOptions("dept")
                                }}
                              >
                                All Departments
                              </div>
                              {uniqueDepts.map(dept => (
                                <div
                                  key={dept}
                                  className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.dept === dept ? "bg-blue-100" : ""}`}
                                  onClick={() => {
                                    setFilters((prev) => ({ ...prev, dept }));
                                    toggleFilterOptions("dept")
                                  }}
                                >
                                  {dept}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-row items-center justify-center relative">
                          <span className="pr-2 font-semibold text-black">Section</span>
                          <div className="w-6 h-6 bg-gray-200 rounded-full border-black border flex items-center justify-center cursor-pointer hover:bg-gray-300" onClick={() => toggleFilterOptions("section")}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                          </div>
                          {showFilterOptions.section && (
                            <div className="absolute z-10 bg-white border rounded shadow-lg top-full right-0 min-w-[150px]">
                              <div
                                className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.section === "all" ? "bg-blue-100" : ""}`}
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, section: "all" }));
                                  toggleFilterOptions("section")
                                }}
                              >
                                All Sections
                              </div>
                              {uniqueSections.map(section => (
                                <div
                                  key={section}
                                  className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.section === section ? "bg-blue-100" : ""}`}
                                  onClick={() => {
                                    setFilters((prev) => ({ ...prev, section }));
                                    toggleFilterOptions("section")
                                  }}
                                >
                                  {section}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-row items-center justify-center relative">
                          <span className="pr-2 font-semibold text-black">No. of Questions</span>
                          <div className="w-6 h-6 bg-gray-200 rounded-full border-black border flex items-center justify-center cursor-pointer hover:bg-gray-300" onClick={() => toggleFilterOptions("noOfQuestions")}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                          </div>
                          {showFilterOptions.noOfQuestions && (
                            <div className="absolute z-10 bg-white border rounded shadow-lg top-full right-0 min-w-[150px]">
                              <div
                                className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.noOfQuestions === "all" ? "bg-blue-100" : ""}`}
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, noOfQuestions: "all" }));
                                  toggleFilterOptions("noOfQuestions")
                                }}
                              >
                                All Questions
                              </div>
                              {uniqueNoOfQuestions.map(noOfQuestions => (
                                <div
                                  key={noOfQuestions}
                                  className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.noOfQuestions === noOfQuestions ? "bg-blue-100" : ""}`}
                                  onClick={() => {
                                    setFilters((prev) => ({ ...prev, noOfQuestions: String(noOfQuestions) }));
                                    toggleFilterOptions("noOfQuestions")
                                  }}
                                >
                                  {noOfQuestions}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableHead>
                      <TableHead className="text-center">
                        <div className="flex flex-row items-center justify-center relative">
                          <span className="pr-2 font-semibold text-black">Batch</span>
                          <div className="w-6 h-6 bg-gray-200 rounded-full border-black border flex items-center justify-center cursor-pointer hover:bg-gray-300" onClick={() => toggleFilterOptions("batch")}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                          </div>
                          {showFilterOptions.batch && (
                            <div className="absolute z-10 bg-white border rounded shadow-lg top-full right-0 min-w-[150px]">
                              <div
                                className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.batch === "all" ? "bg-blue-100" : ""}`}
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, batch: "all" }));
                                  toggleFilterOptions("batch")
                                }}
                              >
                                All Batches
                              </div>
                              {uniqueBatches.map(batch => (
                                <div
                                  key={batch}
                                  className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.batch === batch ? "bg-blue-100" : ""}`}
                                  onClick={() => {
                                    setFilters((prev) => ({ ...prev, batch }));
                                    toggleFilterOptions("batch")
                                  }}
                                >
                                  {batch}
                                </div>
                              ))}
                            </div>
                          )}
                        </div>
                      </TableHead>
                      {selectedContest.type === "Leetcode" && (
                        <TableHead className="text-center font-semibold text-black">Finish Time</TableHead>
                      )}
                      <TableHead className="text-center">
                        <div className="flex flex-row items-center justify-center relative">
                          <span className="pr-2 font-semibold text-black">Status</span>
                          <div className="w-6 h-6 bg-gray-200 rounded-full border-black border flex items-center justify-center cursor-pointer hover:bg-gray-300" onClick={() => toggleFilterOptions("status")}>
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                              <polygon points="22 3 2 3 10 12.46 10 19 14 21 14 12.46 22 3"></polygon>
                            </svg>
                          </div>
                          {showFilterOptions.status && (
                            <div className="absolute z-10 bg-white border rounded shadow-lg top-full right-0 min-w-[150px]">
                              <div
                                className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.status === "all" ? "bg-blue-100" : ""}`}
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, status: "all" }));
                                  toggleFilterOptions("status")
                                }}
                              >
                                All Status
                              </div>
                              <div
                                className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.status === "Attended" ? "bg-blue-100" : ""}`}
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, status: "Attended" }));
                                  toggleFilterOptions("status")
                                }}
                              >
                                Attended
                              </div>
                              <div
                                className={`px-2 py-2 hover:bg-gray-100 cursor-pointer border-b border-b-black ${filters.status === "Not Attended" ? "bg-blue-100" : ""}`}
                                onClick={() => {
                                  setFilters((prev) => ({ ...prev, status: "Not Attended" }));
                                  toggleFilterOptions("status");
                                }}
                              >
                                Not Attended
                              </div>
                            </div>
                          )}
                        </div>
                      </TableHead>
                    </TableRow>
                  </TableHeader>
                    <TableBody>
                      {paginatedParticipants.map((participant, index) => (
                        <React.Fragment key={index}>
                          <TableRow onClick={() => toggleExpandRow(index)}>
                            <TableCell className="text-center">
                              {(currentPage - 1) * rowsPerPage + index + 1}
                            </TableCell>
                            <TableCell>
                              <Badge className={`${getRankBadgeColor(index, participant.rank)}`}>
                                {participant.rank === -1 ? "NA" : `#${participant.rank}`}
                              </Badge>
                            </TableCell>
                            <TableCell className="font-medium">{participant.name}</TableCell>
                            <TableCell className="text-center">{participant.dept}</TableCell>
                            <TableCell className="text-center">{participant.section}</TableCell>
                            <TableCell className="text-center">{participant.no_of_questions}</TableCell>
                            <TableCell className="text-center">{participant.year}</TableCell>
                            {selectedContest.type === "Leetcode" && (
                              <TableCell className="text-center">
                                {calculateLeetcodeDuration(participant.finish_time)}
                              </TableCell>
                            )}
                            <TableCell
                              className={`text-center ${participant.rank === -1 ? "text-red-600" : "text-green-600"}`}
                            >
                              {getStatus(participant.rank)}
                            </TableCell>
                          </TableRow>

                          {expandedRow === index && selectedContest.type === "Leetcode" && (
                            <TableRow>
                              <TableCell colSpan={9} className="bg-gray-800 p-6 border-none">
                                <div className="bg-gray-900 rounded-xl shadow-lg p-4">
                                  <TotalCountChart username={participant.leetcode_id} />
                                </div>
                              </TableCell>
                            </TableRow>
                          )}
                        </React.Fragment>
                      ))}
                    </TableBody>
                </Table>

                <Pagination
                  currentPage={currentPage}
                  totalItems={filteredParticipants.length}
                  rowsPerPage={rowsPerPage}
                  onPageChange={setCurrentPage}
                />
              </>
            ) : (
              <div className="flex justify-center items-center p-6 bg-gray-50 dark:bg-gray-800 rounded-lg">
                <p className="text-gray-500 dark:text-gray-400">
                  No participants match your filters. Try different filter options.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      ) : (
        <div className="flex justify-center items-center p-12 bg-gray-50 dark:bg-gray-800 rounded-lg mt-6">
          <p className="text-gray-500 dark:text-gray-400">
            No contest selected. Please use the contest selector above.
          </p>
        </div>
      )}
    </div>
  );
}

// Loading state component
function LoadingState() {
  return (
    <Card className="mt-6">
      <CardHeader className="pb-2">
        <Skeleton className="h-6 w-64 mb-2" />
        <Skeleton className="h-4 w-36" />
      </CardHeader>
      <CardContent>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead><Skeleton className="h-4 w-10" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-24" /></TableHead>
              <TableHead><Skeleton className="h-4 w-16" /></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {[...Array(5)].map((_, i) => (
              <TableRow key={i}>
                <TableCell><Skeleton className="h-6 w-10" /></TableCell>
                <TableCell><Skeleton className="h-6 w-32" /></TableCell>
                <TableCell><Skeleton className="h-6 w-24" /></TableCell>
                <TableCell><Skeleton className="h-6 w-16" /></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}

