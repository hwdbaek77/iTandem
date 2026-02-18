const axios = require("axios");

/**
 * Service for interacting with Canvas LMS API
 * https://canvas.instructure.com/doc/api/
 */
class CanvasService {
  constructor(accessToken, baseUrl = "https://canvas.instructure.com/api/v1") {
    this.accessToken = accessToken;
    this.baseUrl = baseUrl;
    this.client = axios.create({
      baseURL: this.baseUrl,
      headers: {
        "Authorization": `Bearer ${this.accessToken}`,
        "Content-Type": "application/json",
      },
    });
  }

  /**
   * Fetch the authenticated user's profile from Canvas
   * @returns {Promise<Object>} User profile data
   */
  async getUserProfile() {
    try {
      const response = await this.client.get("/users/self/profile");
      return response.data;
    } catch (error) {
      console.error("Error fetching Canvas user profile:", error.response?.data || error.message);
      throw new Error("Failed to fetch Canvas user profile");
    }
  }

  /**
   * Fetch the user's courses
   * @returns {Promise<Array>} List of courses
   */
  async getUserCourses() {
    try {
      const response = await this.client.get("/courses", {
        params: {
          enrollment_state: "active",
          include: ["term", "total_scores", "course_image"],
          per_page: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching Canvas courses:", error.response?.data || error.message);
      throw new Error("Failed to fetch Canvas courses");
    }
  }

  /**
   * Fetch the user's schedule/calendar events
   * @param {string} startDate - ISO date string
   * @param {string} endDate - ISO date string
   * @returns {Promise<Array>} List of calendar events
   */
  async getUserCalendar(startDate, endDate) {
    try {
      const response = await this.client.get("/calendar_events", {
        params: {
          type: "event",
          start_date: startDate,
          end_date: endDate,
          context_codes: ["user_self"],
          per_page: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching Canvas calendar:", error.response?.data || error.message);
      throw new Error("Failed to fetch Canvas calendar");
    }
  }

  /**
   * Fetch upcoming assignments for the user
   * @returns {Promise<Array>} List of assignments
   */
  async getUpcomingAssignments() {
    try {
      const response = await this.client.get("/users/self/upcoming_events", {
        params: {
          per_page: 50,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching Canvas assignments:", error.response?.data || error.message);
      throw new Error("Failed to fetch Canvas assignments");
    }
  }

  /**
   * Fetch user's enrollments across all courses
   * @returns {Promise<Array>} List of enrollments
   */
  async getUserEnrollments() {
    try {
      const response = await this.client.get("/users/self/enrollments", {
        params: {
          state: ["active", "invited", "completed"],
          per_page: 100,
        },
      });
      return response.data;
    } catch (error) {
      console.error("Error fetching Canvas enrollments:", error.response?.data || error.message);
      throw new Error("Failed to fetch Canvas enrollments");
    }
  }

  /**
   * Fetch comprehensive user data from Canvas
   * Combines profile, courses, calendar, and enrollments
   * @returns {Promise<Object>} Comprehensive user data
   */
  async getComprehensiveUserData() {
    try {
      // Calculate date range for calendar (next 30 days)
      const startDate = new Date().toISOString();
      const endDate = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();

      // Fetch all data in parallel for efficiency
      const [profile, courses, calendar, assignments, enrollments] = await Promise.all([
        this.getUserProfile(),
        this.getUserCourses(),
        this.getUserCalendar(startDate, endDate),
        this.getUpcomingAssignments(),
        this.getUserEnrollments(),
      ]);

      return {
        profile,
        courses,
        calendar,
        assignments,
        enrollments,
        lastUpdated: new Date().toISOString(),
      };
    } catch (error) {
      console.error("Error fetching comprehensive Canvas data:", error);
      throw error;
    }
  }

  /**
   * Extract schedule information from Canvas data
   * Useful for tandem/carpool compatibility calculations
   * @param {Object} canvasData - Comprehensive Canvas data
   * @returns {Object} Extracted schedule information
   */
  static extractScheduleInfo(canvasData) {
    const schedule = {
      courses: [],
      regularSchedule: {},
      upcomingEvents: [],
    };

    // Extract course schedules
    if (canvasData.courses) {
      schedule.courses = canvasData.courses.map((course) => ({
        id: course.id,
        name: course.name,
        courseCode: course.course_code,
        enrollmentTermId: course.enrollment_term_id,
      }));
    }

    // Extract calendar events to determine regular schedule
    if (canvasData.calendar) {
      schedule.upcomingEvents = canvasData.calendar.map((event) => ({
        title: event.title,
        startAt: event.start_at,
        endAt: event.end_at,
        allDay: event.all_day,
        locationName: event.location_name,
      }));

      // Group events by day of week to find regular patterns
      const eventsByDay = {};
      canvasData.calendar.forEach((event) => {
        if (event.start_at) {
          const date = new Date(event.start_at);
          const dayOfWeek = date.getDay();
          if (!eventsByDay[dayOfWeek]) {
            eventsByDay[dayOfWeek] = [];
          }
          eventsByDay[dayOfWeek].push({
            hour: date.getHours(),
            minute: date.getMinutes(),
            title: event.title,
          });
        }
      });

      schedule.regularSchedule = eventsByDay;
    }

    return schedule;
  }
}

module.exports = CanvasService;
