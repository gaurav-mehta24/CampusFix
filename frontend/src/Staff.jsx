
import { useEffect, useState } from "react";
import "./Portal.css";

const API = "http://localhost:5001";

export default function Staff({ user, token, onLogout }) {
  const [complaints, setComplaints] = useState([]);
  const [notes, setNotes] = useState({});
  const [photos, setPhotos] = useState({});
  const [loading, setLoading] = useState(true);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function loadComplaints() {
    try {
      setError("");
      const response = await fetch(`${API}/api/complaints`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Could not load complaints.");

      setComplaints(Array.isArray(data) ? data : []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadComplaints();
  }, []);

  async function submitResolution(id) {
    if (!notes[id]?.trim()) {
      setError("Please enter a resolution note.");
      return;
    }

    if (!photos[id]) {
      setError("Please select an after-resolution photo.");
      return;
    }

    try {
      setError("");
      setMessage("");

      const body = new FormData();
      body.append("resolutionNote", notes[id]);
      body.append("afterImage", photos[id]);

      const response = await fetch(`${API}/api/complaints/${id}/resolve`, {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
        body
      });

      const data = await response.json();
      if (!response.ok) throw new Error(data.message || "Resolution failed.");

      setMessage(data.message || "Resolution submitted.");
      setNotes(previous => ({ ...previous, [id]: "" }));
      setPhotos(previous => ({ ...previous, [id]: null }));
      await loadComplaints();
    } catch (err) {
      setError(err.message);
    }
  }

  const pending = complaints.filter(item =>
    ["reported", "assigned", "reopened"].includes(item.status)
  );
  const verification = complaints.filter(
    item => item.status === "pending_verification"
  );
  const resolved = complaints.filter(item => item.status === "resolved");

  function imageUrl(path) {
    return path ? `${API}${path}` : "";
  }

  function ComplaintCard({ item }) {
    const masterId = item.masterComplaintId || item.id;

    return (
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
          <span>Reported by: {item.reporterName || "Student"}</span>
          <span>
            Affected students: {item.totalAffectedStudents || item.affectedStudents || 1}
          </span>
        </div>

        {item.beforeImage && (
          <div className="portal-photo">
            <p>Before photo</p>
            <img src={imageUrl(item.beforeImage)} alt="Issue before resolution" />
          </div>
        )}

        {item.status === "pending_verification" && item.resolution && (
          <div className="resolution-info">
            <strong>Resolution submitted</strong>
            <p>{item.resolution.resolutionNote}</p>
            {item.resolution.afterImage && (
              <img
                src={imageUrl(item.resolution.afterImage)}
                alt="After resolution"
              />
            )}
            <p className="portal-muted">
              Waiting for student verification.
            </p>
          </div>
        )}

        {["reported", "assigned", "reopened"].includes(item.status) && (
          <div className="resolution-form">
            <h4>Submit resolution</h4>
            <label>Resolution note</label>
            <textarea
              value={notes[masterId] || ""}
              onChange={event =>
                setNotes(previous => ({
                  ...previous,
                  [masterId]: event.target.value
                }))
              }
              placeholder="Describe the work completed..."
              rows="3"
            />

            <label>After-resolution photo</label>
            <input
              type="file"
              accept="image/*"
              onChange={event =>
                setPhotos(previous => ({
                  ...previous,
                  [masterId]: event.target.files?.[0] || null
                }))
              }
            />

            <button
              className="portal-button"
              onClick={() => submitResolution(masterId)}
            >
              Submit resolution
            </button>
          </div>
        )}
      </article>
    );
  }

  return (
    <main className="portal-page">
      <header className="portal-header">
        <div>
          <h1>CampusFix <span>Staff Portal</span></h1>
          <p>Welcome, {user?.name || "Staff"} · {user?.department || "Campus Staff"}</p>
        </div>
        <button className="portal-logout" onClick={onLogout}>Logout</button>
      </header>

      <section className="portal-stats">
        <div className="portal-stat">
          <span>Open tasks</span>
          <strong>{pending.length}</strong>
        </div>
        <div className="portal-stat">
          <span>Awaiting verification</span>
          <strong>{verification.length}</strong>
        </div>
        <div className="portal-stat">
          <span>Resolved</span>
          <strong>{resolved.length}</strong>
        </div>
      </section>

      {message && <p className="portal-success">{message}</p>}
      {error && <p className="portal-error">{error}</p>}

      <div className="portal-section-heading">
        <div>
          <h2>My assigned complaints</h2>
          <p>Review issues assigned to your account and submit completed work.</p>
        </div>
        <button className="portal-secondary" onClick={loadComplaints}>Refresh</button>
      </div>

      {loading ? (
        <p>Loading complaints...</p>
      ) : complaints.length === 0 ? (
        <div className="portal-empty">No complaints are assigned to you yet.</div>
      ) : (
        <div className="portal-list">
          {complaints.map(item => (
            <ComplaintCard item={item} key={item.id} />
          ))}
        </div>
      )}
    </main>
  );
}
