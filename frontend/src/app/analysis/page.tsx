"use client";

import React, { useEffect, useState, useMemo } from "react";
import { ContestProvider, useContest } from "@/context/ContestContext";
import CountChart from "../../components/CountChart"; 
import ContestTrendChart from "@/components/ContestTrends";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Filter, X, Users, Calendar, Building2 } from "lucide-react";

interface FilterState {
  platform: string;
  department: string;
  section: string;
  year: string;
}

function AnalysisContent() {
  const { contests, isLoading } = useContest();
  console.log("Contests: ", contests);

  const [filters, setFilters] = useState<FilterState>({
    platform: "Leetcode",
    department: "All",
    section: "All",
    year: "All",
  });

  const [selectedContestId, setSelectedContestId] = useState<string | null>(null);

  const filterOptions = useMemo(() => {
    const departments = new Set<string>();
    const sections = new Set<string>();
    const years = new Set<string>();

    contests.forEach((contest) => {
      contest.allParticipants.forEach((participant) => {
        if (participant.dept) departments.add(participant.dept);
        if (participant.section) sections.add(participant.section);
        if (participant.year) years.add(participant.year.toString());
      });
    });

    return {
      departments: Array.from(departments).sort(),
      sections: Array.from(sections).sort(),
      years: Array.from(years).sort((a, b) => parseInt(b) - parseInt(a)),
    };
  }, [contests]);

  const filteredContests = useMemo(() => {
    return contests
      .filter((contest) => contest.type === filters.platform)
      .map((contest) => ({
        ...contest,
        allParticipants: contest.allParticipants.filter((participant) => {
          const deptMatch = filters.department === "All" || participant.dept === filters.department;
          const sectionMatch = filters.section === "All" || participant.section === filters.section;
          const yearMatch = filters.year === "All" || participant.year?.toString() === filters.year;
          return deptMatch && sectionMatch && yearMatch;
        }),
      }))
      .filter((contest) => contest.allParticipants.length > 0);
  }, [contests, filters]);

  useEffect(() => {
    if (filteredContests.length > 0) {
      setSelectedContestId(filteredContests[0].id);
    } else {
      setSelectedContestId(null);
    }
  }, [filteredContests]);

  const updateFilter = (key: keyof FilterState, value: string) => {
    setFilters((prev) => ({ ...prev, [key]: value }));
  };

  const clearFilter = (key: keyof FilterState) => {
    setFilters((prev) => ({ ...prev, [key]: "All" }));
  };

  const clearAllFilters = () => {
    setFilters({
      platform: "Leetcode",
      department: "All",
      section: "All",
      year: "All",
    });
  };

  const activeFiltersCount =
    Object.values(filters).filter((value) => value !== "All" && value !== "Leetcode").length + 1;

  const platforms = ["Leetcode", "Codeforces", "Codechef"];

  return (
    <div className="mt-20 px-6 max-w-7xl mx-auto">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-4xl font-bold text-gray-900 dark:text-gray-100 mb-2">
          Contest Analysis
        </h1>
        <p className="text-gray-600 dark:text-gray-400">
          Analyze contest performance trends across different platforms and participant segments
        </p>
      </div>

      {/* Filters Section */}
      <div className="bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800 p-6 mb-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-2">
            <Filter className="h-5 w-5 text-gray-600 dark:text-gray-400" />
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100">Filters</h2>
            <Badge variant="secondary" className="ml-2">
              {activeFiltersCount} active
            </Badge>
          </div>
          {activeFiltersCount > 1 && (
            <Button
              variant="ghost"
              size="sm"
              onClick={clearAllFilters}
              className="text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              Clear all
            </Button>
          )}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Platform Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1">
              <Building2 className="h-4 w-4" />
              <span>Platform</span>
            </label>
            <div className="flex flex-wrap gap-2">
              {platforms.map((platform) => (
                <Button
                  key={platform}
                  variant={filters.platform === platform ? "default" : "outline"}
                  size="sm"
                  onClick={() => updateFilter("platform", platform)}
                  className="text-xs"
                >
                  {platform}
                </Button>
              ))}
            </div>
          </div>

          {/* Department Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1">
              <Building2 className="h-4 w-4" />
              <span>Department</span>
            </label>
            <div className="flex items-center space-x-2">
              <Select value={filters.department} onValueChange={(value) => updateFilter("department", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Departments</SelectItem>
                  {filterOptions.departments.map((dept) => (
                    <SelectItem key={dept} value={dept}>
                      {dept}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.department !== "All" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter("department")}
                  className="p-1 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Section Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1">
              <Users className="h-4 w-4" />
              <span>Section</span>
            </label>
            <div className="flex items-center space-x-2">
              <Select value={filters.section} onValueChange={(value) => updateFilter("section", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select section" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Sections</SelectItem>
                  {filterOptions.sections.map((section) => (
                    <SelectItem key={section} value={section}>
                      {section}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.section !== "All" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter("section")}
                  className="p-1 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>

          {/* Year Filter */}
          <div className="space-y-2">
            <label className="text-sm font-medium text-gray-700 dark:text-gray-300 flex items-center space-x-1">
              <Calendar className="h-4 w-4" />
              <span>Year</span>
            </label>
            <div className="flex items-center space-x-2">
              <Select value={filters.year} onValueChange={(value) => updateFilter("year", value)}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select year" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="All">All Years</SelectItem>
                  {filterOptions.years.map((year) => (
                    <SelectItem key={year} value={year}>
                      {year}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {filters.year !== "All" && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => clearFilter("year")}
                  className="p-1 h-8 w-8"
                >
                  <X className="h-4 w-4" />
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Results Summary */}
      <div className="mb-6">
        <div className="flex items-center space-x-4 text-sm text-gray-600 dark:text-gray-400">
          <span>
            Showing{" "}
            <span className="font-semibold text-gray-900 dark:text-gray-100">{filteredContests.length}</span>{" "}
            contests
          </span>
          <span>•</span>
          <span>
            <span className="font-semibold text-gray-900 dark:text-gray-100">
              {filteredContests.reduce((total, contest) => total + contest.allParticipants.length, 0)}
            </span>{" "}
            participants
          </span>
        </div>
      </div>

      {/* Charts */}
      {isLoading ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto mb-4"></div>
            <p className="text-gray-600 dark:text-gray-400">Loading chart data...</p>
          </div>
        </div>
      ) : filteredContests.length === 0 ? (
        <div className="flex items-center justify-center h-64 bg-white dark:bg-gray-900 rounded-xl border border-gray-200 dark:border-gray-800">
          <div className="text-center">
            <Filter className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-600 dark:text-gray-400 font-medium">No contests found</p>
            <p className="text-sm text-gray-500 dark:text-gray-500 mt-1">
              Try adjusting your filters to see more data
            </p>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Line Chart (Left Column) */}
          <div className="pt-20">
            <ContestTrendChart contests={filteredContests} />
          </div>

          {/* Right Column: Contest Filter + Bar Chart */}
          <div className="space-y-4">
            {/* Contest Filter */}
            {filteredContests.length > 1 && (
              <div className="max-w-xs">
                <label className="block text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                  Select Contest for Bar Chart
                </label>
                <Select
                  value={selectedContestId || ""}
                  onValueChange={setSelectedContestId}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select a contest" />
                  </SelectTrigger>
                  <SelectContent>
                    {filteredContests.map((contest) => (
                      <SelectItem key={contest.id} value={contest.id}>
                        {contest.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Bar Chart */}
            {selectedContestId && filteredContests.some((c) => c.id === selectedContestId) && (
              <CountChart
                contest={filteredContests.find((c) => c.id === selectedContestId)!}
                filters={filters}
              />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default function AnalysisPage() {
  return (
    <ContestProvider>
      <AnalysisContent />
    </ContestProvider>
  );
}
