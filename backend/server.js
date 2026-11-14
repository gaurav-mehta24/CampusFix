
const express = require("express");
const cors = require("cors");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const app = express();
const PORT = 5001;

// ---------- Folders and storage ----------
const DATA_DIR = path.join(__dirname, "data");
const UPLOAD_DIR = path.join(__dirname, "uploads");
const DATA_FILE = path.join(DATA_DIR, "complaints.json");

for (const folder of [DATA_DIR, UPLOAD_DIR]) {
  if (!fs.existsSync(folder)) {
    fs.mkdirSync(folder, { recursive: true });
  }
}

if (!fs.existsSync(DATA_FILE)) {
  fs.writeFileSync(DATA_FILE, "[]");
}

let complaints = JSON.parse(fs.readFileSync(DATA_FILE, "utf8"));

function saveComplaints() {
  fs.writeFileSync(DATA_FILE, JSON.stringify(complaints, null, 2));
}

// ---------- Middleware ----------
app.use(cors());
app.use(express.json());
app.use("/uploads", express.static(UPLOAD_DIR));

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOAD_DIR),
  filename: (req, file, cb) => {
    const extension = path.extname(file.originalname) || ".jpg";
    cb(null, `${Date.now()}-${crypto.randomUUID()}${extension}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith("image/")) {
      cb(null, true);
    } else {
      cb(new Error("Only image files are allowed."));
    }
  }
});

// ---------- Duplicate detection ----------
function tokenize(text = "") {
  return new Set(
    text
      .toLowerCase()
      .replace(/[^a-z0-9\s]/g, " ")
      .split(/\s+/)
      .filter(word => word.length > 2)
  );
}

function similarity(textA, textB) {
  const a = tokenize(textA);
  const b = tokenize(textB);

  if (!a.size || !b.size) return 0;

  const intersection = [...a].filter(word => b.has(word)).length;
  return (2 * intersection) / (a.size + b.size);
}

function findDuplicate(newComplaint) {
  const activeMasters = complaints.filter(
    item =>
      !item.duplicateOf &&
      item.status !== "resolved" &&
      item.status !== "closed"
  );

  let bestMatch = null;
  let bestScore = 0;

  for (const existing of activeMasters) {
    const descriptionScore = similarity(
      newComplaint.description,
      existing.description
    );

    const sameCategory =
      newComplaint.category.toLowerCase() === existing.category.toLowerCase();

    const sameLocation =
      newComplaint.location.toLowerCase() === existing.location.toLowerCase();

    const score =
      descriptionScore * 0.65 +
      (sameCategory ? 0.20 : 0) +
      (sameLocation ? 0.15 : 0);

    if (score > bestScore) {
      bestScore = score;
      bestMatch = existing;
    }
  }

  return bestScore >= 0.42
    ? { complaint: bestMatch, score: Math.round(bestScore * 100) }
    : null;
}

function getMasterComplaint(complaint) {
  if (!complaint) return null;
  if (!complaint.duplicateOf) return complaint;

  return complaints.find(item => item.id === complaint.duplicateOf) || complaint;
}

// ---------- Basic routes ----------
app.get("/", (req, res) => {
  res.json({ message: "Welcome to CampusFix API" });
});

app.get("/api/health", (req, res) => {
  res.json({ status: "OK", project: "CampusFix" });
});

// ---------- Create complaint ----------
app.post(
  "/api/complaints",
  upload.single("beforeImage"),
  (req, res) => {
    try {
      const { title, description, category, location, reporterName } = req.body;

      if (!title || !description || !category || !location || !reporterName) {
        return res.status(400).json({
          message: "Please provide title, description, category, location and reporter name."
        });
      }

      const complaint = {
        id: crypto.randomUUID(),
        title,
        description,
        category,
        location,
        reporterName,
        beforeImage: req.file ? `/uploads/${req.file.filename}` : null,
        status: "reported",
        createdAt: new Date().toISOString(),
        duplicateOf: null,
        affectedStudents: 1,
        linkedReports: [],
        resolution: null,
        verification: null
      };

      const duplicate = findDuplicate(complaint);

      if (duplicate) {
        const master = duplicate.complaint;

        complaint.duplicateOf = master.id;
        master.affectedStudents += 1;
        master.linkedReports.push(complaint.id);
        complaint.status = master.status;
      }

      complaints.push(complaint);
      saveComplaints();

      const master = getMasterComplaint(complaint);

      res.status(201).json({
        message: duplicate
          ? "Similar complaint found and linked to the existing complaint."
          : "Complaint submitted successfully.",
        complaint,
        duplicateDetected: Boolean(duplicate),
        similarityScore: duplicate ? duplicate.score : null,
        masterComplaintId: master.id,
        affectedStudents: master.affectedStudents
      });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  }
);

// ---------- Get all complaints ----------
app.get("/api/complaints", (req, res) => {
  const result = complaints.map(item => {
    const master = getMasterComplaint(item);

    return {
      ...item,
      masterComplaintId: master.id,
      totalAffectedStudents: master.affectedStudents
    };
  });

  res.json(result);
});

// ---------- Get one complaint ----------
app.get("/api/complaints/:id", (req, res) => {
  const complaint = complaints.find(item => item.id === req.params.id);

  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  res.json({
    complaint,
    masterComplaint: getMasterComplaint(complaint)
  });
});

// ---------- Staff submits resolution evidence ----------
app.post(
  "/api/complaints/:id/resolve",
  upload.single("afterImage"),
  (req, res) => {
    const complaint = complaints.find(item => item.id === req.params.id);

    if (!complaint) {
      return res.status(404).json({ message: "Complaint not found." });
    }

    const master = getMasterComplaint(complaint);
    const { resolutionNote, staffName } = req.body;

    if (!resolutionNote || !staffName || !req.file) {
      return res.status(400).json({
        message: "After photo, resolution note and staff name are required."
      });
    }

    master.resolution = {
      afterImage: `/uploads/${req.file.filename}`,
      resolutionNote,
      staffName,
      submittedAt: new Date().toISOString()
    };

    master.status = "pending_verification";
    master.verification = null;

    // Keep linked reports in sync with the master complaint.
    complaints.forEach(item => {
      if (item.id === master.id || item.duplicateOf === master.id) {
        item.status = "pending_verification";
      }
    });

    saveComplaints();

    res.json({
      message: "Resolution evidence submitted. Waiting for student verification.",
      complaint: master
    });
  }
);

// ---------- Student verifies or reopens ----------
app.post("/api/complaints/:id/verify", (req, res) => {
  const complaint = complaints.find(item => item.id === req.params.id);

  if (!complaint) {
    return res.status(404).json({ message: "Complaint not found." });
  }

  const master = getMasterComplaint(complaint);
  const { decision, studentName, feedback } = req.body;

  if (!["confirmed", "reopen"].includes(decision)) {
    return res.status(400).json({
      message: "Decision must be either 'confirmed' or 'reopen'."
    });
  }

  if (!studentName) {
    return res.status(400).json({ message: "Student name is required." });
  }

  if (master.status !== "pending_verification") {
    return res.status(400).json({
      message: "This complaint is not waiting for verification."
    });
  }

  master.verification = {
    decision,
    studentName,
    feedback: feedback || "",
    verifiedAt: new Date().toISOString()
  };

  master.status = decision === "confirmed" ? "resolved" : "reopened";

  complaints.forEach(item => {
    if (item.id === master.id || item.duplicateOf === master.id) {
      item.status = master.status;
      item.verification = master.verification;
    }
  });

  saveComplaints();

  res.json({
    message:
      decision === "confirmed"
        ? "Resolution confirmed by student."
        : "Complaint reopened. The issue needs further attention.",
    complaint: master
  });
});

// ---------- Error handling ----------
app.use((error, req, res, next) => {
  res.status(400).json({ message: error.message || "Something went wrong." });
});

app.listen(PORT, () => {
  console.log(`CampusFix server running on port ${PORT}`);
});
