
import { useEffect, useState } from "react";
import "./Portal.css";

const API = "http://localhost:5001";

export default function Admin({ user, token, onLogout }) {
  const [complaints, setComplaints] = useState([]);
  const [staff, setStaff] = useState([]);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [department, setDepartment] = useState("");
  const [assignments, setAssignments] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const headers = {
    Authorization: `Bearer ${token}`,
    "Content-Type": "application/json"
  };

  async function loadData() {
    try {
      setError("");

      const [complaintResponse, staffResponse] = await Promise.all([
        fetch(`${API}/api/complaints`, {
          headers: { Authorization: `Bearer ${token}` }
        }),
        fetch(`${API}/api/auth/users`, {
          headers: { Authorization: `Bearer ${token}` }
        })
      ]);

      const complaintData = await complaintResponse.json();
      const staffData = await staffResponse.json();

      if (!complaintResponse.ok) {
        throw new Error(complaintData.message || "Could not load complaints.");
      }

      if (!staffResponse.ok) {
        throw new Error(staffData.message || "Could not load users.");
      }

      setComplaints(Array.isArray(complaintData) ? complaintData : []);

      const users = Array.isArray(staffData)
        ? staffData
        : staffData.users || [];

      setStaff(users.filter(person => person.role === "staff"));
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadData();
  }, []);

  async function createStaff(event) {
    event.preventDefault();
    setError("");
    setMessage("");

    try {
      const response = await fetch(`${API}/api/auth/staff`, {
        method: "POST",
        headers,
        body: JSON.stringify({ name, email, password, department })
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not create staff account.");

      setMessage("Staff account created successfully.");
      setName("");
      setEmail("");
      setPassword("");
      setDepartment("");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  async function assignComplaint(complaintId) {
    const staffId = assignments[complaintId];

    if (!staffId) {
      setError("Select a staff member first.");
      return;
    }

    setError("");
    setMessage("");

    try {
      const response = await fetch(
        `${API}/api/complaints/${complaintId}/assign`,
        {
          method: "POST",
          headers,
          body: JSON.stringify({ staffId })
        }
      );

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Assignment failed.");

      setMessage("Complaint assigned successfully.");
      await loadData();
    } catch (err) {
      setError(err.message);
    }
  }

  const openCount = complaints.filter(item =>
    ["reported", "assigned", "reopened"].includes(item.status) &&
    !item.duplicateOf
  ).length;

  const pendingCount = complaints.filter(
    item => item.status === "pending_verification" && !item.duplicateOf
  ).length;

  const resolvedCount = complaints.filter(
    item => item.status === "resolved" && !item.duplicateOf
  ).length;

  return (
    <main className="portal-page">
      <header className="portal-header">
        <div>
          <h1>CampusFix <span>Admin Portal</span></h1>
          <p>Welcome, {user?.name || "Administrator"}</p>
        </div>
        <button className="portal-logout" onClick={onLogout}>Logout</button>
      </header>

      {message && <p className="portal-success">{message}</p>}
      {error && <p className="portal-error">{error}</p>}

      <section className="portal-stats">
        <div className="portal-stat">
          <span>Total complaints</span>
          <strong>{complaints.filter(item => !item.duplicateOf).length}</strong>
        </div>
        <div className="portal-stat">
          <span>Open complaints</span>
          <strong>{openCount}</strong>
        </div>
        <div className="portal-stat">
          <span>Awaiting verification</span>
          <strong>{pendingCount}</strong>
        </div>
        <div className="portal-stat">
          <span>Resolved</span>
          <strong>{resolvedCount}</strong>
        </div>
        <div className="portal-stat">
          <span>Staff members</span>
          <strong>{staff.length}</strong>
        </div>
      </section>

      <section className="portal-panel">
        <h2>Create staff account</h2>
        <p className="portal-muted">
          Staff accounts are created by administrators, not through public registration.
        </p>

        <form className="staff-form" onSubmit={createStaff}>
          <div>
            <label>Full name</label>
            <input
              value={name}
              onChange={event => setName(event.target.value)}
              placeholder="Staff member name"
              required
            />
          </div>

          <div>
            <label>Email</label>
            <input
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              placeholder="staff@campus.edu"
              required
            />
          </div>

          <div>
            <label>Temporary password</label>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              placeholder="At least 8 characters"
              minLength="8"
              required
            />
          </div>

          <div>
            <label>Department</label>
            <input
              value={department}
              onChange={event => setDepartment(event.target.value)}
              placeholder="e.g. Electrical, Plumbing, Housekeeping"
              required
            />
          </div>

          <button className="portal-button" type="submit">
            Create staff account
          </button>
        </form>
      </section>

      <section className="portal-panel">
        <div className="portal-section-heading">
          <div>
            <h2>Staff directory</h2>
            <p className="portal-muted">Staff members available for assignment.</p>
          </div>
          <button className="portal-secondary" onClick={loadData}>Refresh</button>
        </div>

        {staff.length === 0 ? (
          <p>No staff accounts created yet.</p>
        ) : (
          <div className="staff-directory">
            {staff.map(person => (
              <div className="staff-person" key={person.id}>
                <strong>{person.name}</strong>
                <span>{person.email}</span>
                <small>{person.department || "No department"}</small>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="portal-panel">
        <h2>Complaint management</h2>
        <p className="portal-muted">
          Assign each main complaint to the appropriate staff member.
        </p>

        {loading ? (
          <p>Loading dashboard...</p>
        ) : complaints.length === 0 ? (
          <p>No complaints have been submitted yet.</p>
        ) : (
          <div className="portal-list">
            {complaints.filter(item => !item.duplicateOf).map(item => (
              <article className="portal-card" key={item.id}>
                <div className="portal-card-top">
                  <div>
                    <span className="portal-category">{item.category}</span>
                    <h3>{item.title}</h3>
                    <p className="portal-muted">{item.location}</p>
                  </div>
                  <span className={`status-pill status-${item.status}`}>
                    {(item.status || "").replaceAll("_", " ")}
                  </span>
                </div>

                <p>{item.description}</p>

                <div className="portal-details">
                  <span>Reported by: {item.reporterName}</span>
                  <span>Affected students: {item.affectedStudents || 1}</span>
                </div>

                <div className="assign-row">
                  <div>
                    <label>Assign to staff</label>
                    <select
                      value={assignments[item.id] || item.assignedTo || ""}
                      onChange={event =>
                        setAssignments(previous => ({
                          ...previous,
                          [item.id]: event.target.value
                        }))
                      }
                    >
                      <option value="">Select staff member</option>
                      {staff.map(person => (
                        <option value={person.id} key={person.id}>
                          {person.name} — {person.department || "General"}
                        </option>
                      ))}
                    </select>
                  </div>

                  <button
                    className="portal-button"
                    onClick={() => assignComplaint(item.id)}
                    disabled={staff.length === 0}
                  >
                    Assign complaint
                  </button>
                </div>

                {item.assignedStaffName && (
                  <p className="assigned-label">
                    Currently assigned to: <strong>{item.assignedStaffName}</strong>
                  </p>
                )}
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
