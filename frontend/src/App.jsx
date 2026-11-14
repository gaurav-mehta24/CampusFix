
import { useEffect, useState } from "react";
import "./App.css";
import Auth from "./Auth";
import Staff from "./Staff";
import Admin from "./Admin";

const API = "http://localhost:5001";

function App() {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [authLoading, setAuthLoading] = useState(true);

  const [user, setUser] = useState(null);
  const [notice, setNotice] = useState(null);
  const [filter, setFilter] = useState("all");

  const [aiLoading, setAiLoading] = useState(false);
  const [aiSuggestion, setAiSuggestion] = useState(null);

  const [form, setForm] = useState({
    title: "",
    description: "",
    category: "Infrastructure",
    location: "",
    reporterName: "",
    image: null,
  });

  function getToken() {
    return localStorage.getItem("campusfix_token");
  }

  // Load complaints
  async function loadComplaints() {
    try {
      setLoading(true);

      const response = await fetch(`${API}/api/complaints`, {
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
      });

      if (!response.ok) {
        throw new Error("Unable to load complaints");
      }

      const data = await response.json();

      setComplaints(Array.isArray(data) ? data : []);
    } catch (error) {
      console.error(error);

      setNotice({
        type: "error",
        message:
          "Backend connection failed. Make sure your server is running.",
      });
    } finally {
      setLoading(false);
    }
  }

  // Successful login
  function handleAuthSuccess(data) {
    localStorage.setItem("campusfix_token", data.token);

    setUser(data.user);

    setForm((previous) => ({
      ...previous,
      reporterName: data.user.name,
    }));

    loadComplaints();
  }

  // Logout
  function handleLogout() {
    localStorage.removeItem("campusfix_token");

    setUser(null);
    setComplaints([]);
    setNotice(null);
    setFilter("all");
    setAiSuggestion(null);
  }

  // Check saved session
  useEffect(() => {
    async function checkLogin() {
      const token = getToken();

      if (!token) {
        setAuthLoading(false);
        return;
      }

      try {
        const response = await fetch(`${API}/api/auth/me`, {
          headers: {
            Authorization: `Bearer ${token}`,
          },
        });

        if (!response.ok) {
          throw new Error("Session expired");
        }

        const result = await response.json();

        setUser(result.user);

        setForm((previous) => ({
          ...previous,
          reporterName: result.user.name,
        }));

        await loadComplaints();
      } catch (error) {
        console.error("Session verification failed:", error);

        localStorage.removeItem("campusfix_token");
        setUser(null);
      } finally {
        setAuthLoading(false);
      }
    }

    checkLogin();
  }, []);

  // Update form fields
  function updateField(event) {
    const { name, value, files } = event.target;

    setForm((previous) => ({
      ...previous,
      [name]: files ? files[0] : value,
    }));

    if (["title", "description", "location", "category"].includes(name)) {
      setAiSuggestion(null);
    }
  }

  // Gemini AI complaint analysis
  async function analyzeComplaint() {
    if (
      !form.title.trim() ||
      !form.description.trim() ||
      !form.location.trim()
    ) {
      setNotice({
        type: "warning",
        message: "Please enter title, description and location first.",
      });
      return;
    }

    setAiLoading(true);
    setNotice(null);
    setAiSuggestion(null);

    try {
      const response = await fetch(
        `${API}/api/ai/analyze-complaint`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            title: form.title,
            description: form.description,
            location: form.location,
            category: form.category,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.message || "AI analysis failed.");
      }

      if (!result.analysis) {
        throw new Error("Invalid AI response received.");
      }

      setAiSuggestion(result.analysis);

      setNotice({
        type: "success",
        message: "AI analysis completed successfully!",
      });
    } catch (error) {
      console.error("AI analysis error:", error);

alert(
  "GEMINI ERROR:\n" +
  (error.stack || error.message || String(error))
);

setNotice({
  type: "error",
  message: error.message || "Unable to analyze complaint.",
});
    } finally {
      setAiLoading(false);
    }
  }

  // Apply AI suggestions
  function applyAISuggestions() {
    if (!aiSuggestion) return;

    setForm((previous) => ({
      ...previous,
      category: aiSuggestion.category,
    }));

    setNotice({
      type: "success",
      message: "AI suggested category applied successfully!",
    });
  }

  // Submit complaint
  async function submitComplaint(event) {
    event.preventDefault();

    setSubmitting(true);
    setNotice(null);

    try {
      const body = new FormData();

      body.append("title", form.title);
      body.append("description", form.description);
      body.append("category", form.category);
      body.append("location", form.location);
      body.append("reporterName", user.name);

      if (form.image) {
        body.append("beforeImage", form.image);
      }

      const response = await fetch(`${API}/api/complaints`, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${getToken()}`,
        },
        body,
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Complaint submission failed"
        );
      }

      setNotice({
        type: result.duplicateDetected ? "warning" : "success",
        message: result.message,
        score: result.similarityScore,
        masterId: result.masterComplaintId,
      });

      setForm({
        title: "",
        description: "",
        category: "Infrastructure",
        location: "",
        reporterName: user.name,
        image: null,
      });

      setAiSuggestion(null);

      event.target.reset();

      await loadComplaints();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message,
      });
    } finally {
      setSubmitting(false);
    }
  }

  // Verify or reopen complaint
  async function verifyComplaint(complaintId, decision) {
    if (!complaintId) {
      setNotice({
        type: "error",
        message: "Complaint ID is missing.",
      });
      return;
    }

    const feedback =
      decision === "reopen"
        ? window.prompt("Why is this issue still not fixed?")
        : "";

    if (decision === "reopen" && feedback === null) {
      return;
    }

    setNotice(null);

    try {
      const response = await fetch(
        `${API}/api/complaints/${complaintId}/verify`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${getToken()}`,
          },
          body: JSON.stringify({
            decision,
            feedback,
          }),
        }
      );

      const result = await response.json();

      if (!response.ok) {
        throw new Error(
          result.message || "Verification failed."
        );
      }

      setNotice({
        type: "success",
        message: result.message,
      });

      await loadComplaints();
    } catch (error) {
      setNotice({
        type: "error",
        message: error.message,
      });
    }
  }

  // Filter complaints
  const filteredComplaints = complaints.filter((complaint) => {
    if (filter === "all") return true;

    return (complaint.status || "").toLowerCase() === filter;
  });

  // Statistics
  const stats = {
    total: complaints.length,

    active: complaints.filter(
      (c) =>
        !["resolved", "closed"].includes(
          (c.status || "").toLowerCase()
        )
    ).length,

    resolved: complaints.filter(
      (c) => (c.status || "").toLowerCase() === "resolved"
    ).length,

    affected: complaints
      .filter((c) => !c.duplicateOf)
      .reduce(
        (sum, c) => sum + (Number(c.affectedStudents) || 1),
        0
      ),
  };

  // Status CSS class
  function statusClass(status) {
    return (status || "reported")
      .toLowerCase()
      .replace(/\s+/g, "-");
  }

  // Loading screen
  if (authLoading) {
    return (
      <div className="empty-state">
        Checking your session...
      </div>
    );
  }

  // Login screen
  if (!user) {
    return <Auth onAuthSuccess={handleAuthSuccess} />;
  }

  // Admin portal
  if (user.role === "admin") {
    return (
      <Admin
        user={user}
        token={getToken()}
        onLogout={handleLogout}
      />
    );
  }

  // Staff portal
  if (user.role === "staff") {
    return (
      <Staff
        user={user}
        token={getToken()}
        onLogout={handleLogout}
      />
    );
  }

  // Student dashboard
  return (
    <div className="app">

      {/* NAVBAR */}
      <header className="navbar">
        <a className="brand" href="#dashboard">
          <span className="brand-icon">C</span>

          <span>
            Campus
            <span className="brand-highlight">Fix</span>
          </span>
        </a>

        <nav>
          <a href="#dashboard">Dashboard</a>
          <a href="#report">Report Issue</a>
          <a href="#complaints">Complaints</a>
        </nav>

        <div className="nav-user">
          <span>Hi, {user.name}</span>

          <button
            className="nav-button"
            onClick={handleLogout}
            type="button"
          >
            Logout
          </button>
        </div>
      </header>

      <main>

        {/* HERO */}
        <section className="hero" id="dashboard">
          <div className="hero-content">
            <span className="eyebrow">
              SMART CAMPUS MANAGEMENT
            </span>

            <h1>
              Make your campus
              <br />
              <span>better, together.</span>
            </h1>

            <p>
              Report campus issues, track their progress and help create
              a cleaner, safer and smarter campus.
            </p>

            <a className="primary-button" href="#report">
              Report an Issue →
            </a>
          </div>

          <div className="hero-art">
            <div className="hero-circle">🏫</div>

            <div className="floating-card">
              <span className="live-dot"></span>
              Campus improvement starts here
            </div>
          </div>
        </section>

        {/* STATISTICS */}
        <section className="stats-grid">
          <Stat icon="📋" label="Total Reports" value={stats.total} />
          <Stat icon="⚙️" label="Active Issues" value={stats.active} />
          <Stat icon="✅" label="Resolved Issues" value={stats.resolved} />
          <Stat icon="👥" label="Affected Students" value={stats.affected} />
        </section>

        {/* REPORT ISSUE */}
        <section className="section report-section" id="report">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                HAVE SOMETHING TO REPORT?
              </span>

              <h2>Report a campus issue</h2>

              <p>
                Tell us what's wrong. We'll help get it fixed.
              </p>
            </div>

            <span className="heading-icon">📝</span>
          </div>

          <form
            className="report-form"
            onSubmit={submitComplaint}
          >
            <div className="form-grid">
              <label>
                Your name

                <input
                  name="reporterName"
                  value={user.name}
                  readOnly
                />
              </label>

              <label>
                Issue title

                <input
                  name="title"
                  value={form.title}
                  onChange={updateField}
                  placeholder="e.g. Broken classroom fan"
                  required
                />
              </label>

              <label>
                Category

                <select
                  name="category"
                  value={form.category}
                  onChange={updateField}
                >
                  <option>Infrastructure</option>
                  <option>Electrical</option>
                  <option>Water & Sanitation</option>
                  <option>Cleanliness</option>
                  <option>Internet</option>
                  <option>Safety</option>
                  <option>Other</option>
                </select>
              </label>

              <label>
                Location

                <input
                  name="location"
                  value={form.location}
                  onChange={updateField}
                  placeholder="e.g. Library, Block A"
                  required
                />
              </label>
            </div>

            <label>
              Issue description

              <textarea
                name="description"
                value={form.description}
                onChange={updateField}
                placeholder="Describe the issue in detail..."
                rows="4"
                required
              />
            </label>

            {/* GEMINI AI ANALYZER */}
            <div className="ai-analyzer">
              <div className="ai-header">
                <span className="ai-icon">✨</span>

                <div>
                  <h3>CampusFix AI Assistant</h3>
                  <p>
                    Get intelligent suggestions for your complaint.
                  </p>
                </div>
              </div>

              <button
                type="button"
                className="ai-button"
                onClick={analyzeComplaint}
                disabled={aiLoading || submitting}
              >
                {aiLoading
                  ? "Analyzing your complaint..."
                  : "✨ Analyze Complaint with AI"}
              </button>

              {aiSuggestion && (
                <div className="ai-suggestion">
                  <h3>AI Analysis Results</h3>

                  <div className="ai-result-grid">
                    <div className="ai-result-item">
                      <small>Suggested Category</small>
                      <strong>{aiSuggestion.category}</strong>
                    </div>

                    <div className="ai-result-item">
                      <small>Responsible Department</small>
                      <strong>{aiSuggestion.department}</strong>
                    </div>

                    <div className="ai-result-item">
                      <small>Priority Level</small>
                      <strong className={`priority-${String(aiSuggestion.priority).toLowerCase()}`}>
                        {aiSuggestion.priority}
                      </strong>
                    </div>
                  </div>

                  <div className="ai-summary">
                    <strong>AI Summary</strong>
                    <p>{aiSuggestion.summary}</p>
                  </div>

                  <button
                    type="button"
                    className="ai-apply-button"
                    onClick={applyAISuggestions}
                  >
                    Apply Suggested Category
                  </button>

                  <p className="ai-disclaimer">
                    AI recommendations are suggestions only. Review them
                    before submitting your complaint.
                  </p>
                </div>
              )}
            </div>

            {/* IMAGE UPLOAD */}
            <label className="upload-box">
              <span className="upload-icon">📷</span>

              <span>
                <strong>Upload issue photo</strong>

                <small>
                  Choose an image from your device (optional)
                </small>
              </span>

              <input
                type="file"
                name="image"
                accept="image/*"
                onChange={updateField}
              />

              {form.image && (
                <small>{form.image.name}</small>
              )}
            </label>

            {/* NOTIFICATIONS */}
            {notice && (
              <div
                className={`notice ${notice.type}`}
                role="status"
              >
                <strong>
                  {notice.type === "warning"
                    ? "⚠️ Possible duplicate detected"
                    : notice.type === "success"
                    ? "✅ Success"
                    : "❌ Something went wrong"}
                </strong>

                <p>{notice.message}</p>

                {notice.score !== null &&
                  notice.score !== undefined && (
                    <p>
                      Similarity score: {notice.score}%
                    </p>
                  )}

                {notice.masterId && (
                  <p>
                    Original complaint ID: {notice.masterId}
                  </p>
                )}
              </div>
            )}

            <button
              className="primary-button submit-button"
              disabled={submitting}
              type="submit"
            >
              {submitting
                ? "Submitting..."
                : "Submit Complaint →"}
            </button>
          </form>
        </section>

        {/* COMPLAINTS */}
        <section className="section" id="complaints">
          <div className="section-heading">
            <div>
              <span className="eyebrow">
                LIVE CAMPUS UPDATES
              </span>

              <h2>Track complaints</h2>

              <p>
                See the latest reported campus issues.
              </p>
            </div>

            <button
              className="refresh-button"
              onClick={loadComplaints}
              type="button"
            >
              ↻ Refresh
            </button>
          </div>

          {/* FILTERS */}
          <div className="filters">
            {[
              "all",
              "reported",
              "assigned",
              "in progress",
              "pending_verification",
              "reopened",
              "resolved",
            ].map((item) => (
              <button
                key={item}
                type="button"
                className={
                  filter === item ? "filter active" : "filter"
                }
                onClick={() => setFilter(item)}
              >
                {item === "all"
                  ? "All"
                  : item.replace(/_/g, " ").replace(/\b\w/g, (letter) =>
                      letter.toUpperCase()
                    )}
              </button>
            ))}
          </div>

          {/* LOADING */}
          {loading ? (
            <p className="empty-state">
              Loading complaints...
            </p>
          ) : filteredComplaints.length === 0 ? (
            <p className="empty-state">
              No complaints found.
            </p>
          ) : (
            <div className="complaint-grid">
              {filteredComplaints.map((complaint) => {
                const masterId =
                  complaint.masterComplaintId || complaint.id;

                const isReporter = complaints.some(
                  (item) =>
                    (item.masterComplaintId || item.id) === masterId &&
                    item.reporterId === user.id
                );

                return (
                  <article
                    className="complaint-card"
                    key={complaint.id}
                  >
                    {complaint.beforeImage && (
                      <img
                        className="complaint-image"
                        src={`${API}${complaint.beforeImage}`}
                        alt="Reported issue"
                      />
                    )}

                    <div className="card-top">
                      <span className="category-tag">
                        {complaint.category}
                      </span>

                      <span
                        className={`status ${statusClass(
                          complaint.status
                        )}`}
                      >
                        {(complaint.status || "reported").replace(
                          /_/g,
                          " "
                        )}
                      </span>
                    </div>

                    <h3>{complaint.title}</h3>

                    <p className="complaint-description">
                      {complaint.description}
                    </p>

                    <div className="complaint-meta">
                      <span>📍 {complaint.location}</span>
                      <span>👤 {complaint.reporterName}</span>
                    </div>

                    {complaint.duplicateOf && (
                      <div className="duplicate-label">
                        Linked to an existing complaint
                      </div>
                    )}

                    {/* STUDENT VERIFICATION */}
                    {complaint.status === "pending_verification" &&
                      isReporter && (
                        <div className="verification-actions">
                          <h4>Issue Verification</h4>

                          <p>
                            Staff has marked this issue as fixed.
                            Please check the repair and verify it.
                          </p>

                          {complaint.afterImage && (
                            <img
                              className="complaint-image"
                              src={`${API}${complaint.afterImage}`}
                              alt="Completed repair"
                            />
                          )}

                          <button
                            type="button"
                            className="primary-button"
                            onClick={() =>
                              verifyComplaint(masterId, "confirmed")
                            }
                          >
                            ✓ Verify & Close
                          </button>

                          <button
                            type="button"
                            className="secondary-button"
                            onClick={() =>
                              verifyComplaint(masterId, "reopen")
                            }
                          >
                            ↻ Reopen Issue
                          </button>
                        </div>
                      )}

                    <div className="card-footer">
                      <span>
                        👥{" "}
                        {complaint.totalAffectedStudents ||
                          complaint.affectedStudents ||
                          1}{" "}
                        affected
                      </span>

                      <small>
                        {complaint.createdAt
                          ? new Date(
                              complaint.createdAt
                            ).toLocaleDateString()
                          : ""}
                      </small>
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </section>

        {/* BOTTOM BANNER */}
        <section className="bottom-banner">
          <h2>A better campus begins with you.</h2>

          <p>
            Every report matters. Every improvement counts.
          </p>

          <a href="#report" className="primary-button">
            Report an Issue →
          </a>
        </section>

      </main>

      {/* FOOTER */}
      <footer>
        <a className="brand" href="#dashboard">
          <span className="brand-icon">C</span>

          <span>
            Campus
            <span className="brand-highlight">Fix</span>
          </span>
        </a>

        <p>
          Making campuses smarter, one fix at a time.
        </p>

        <small>
          © {new Date().getFullYear()} CampusFix
        </small>
      </footer>
    </div>
  );
}

// STATISTICS CARD
function Stat({ icon, label, value }) {
  return (
    <div className="stat-card">
      <span className="stat-icon">{icon}</span>

      <div>
        <h3>{value}</h3>
        <p>{label}</p>
      </div>
    </div>
  );
}

export default App;
