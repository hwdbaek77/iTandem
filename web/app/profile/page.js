"use client";

import { useEffect, useState, useRef } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const GRADE_OPTIONS = [
  { value: "SOPHOMORE", label: "Sophomore" },
  { value: "JUNIOR", label: "Junior" },
  { value: "SENIOR", label: "Senior" },
];

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [schedule, setSchedule] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    phone: "",
    licensePlate: "",
    email: "",
    address: "",
    zipCode: "",
    commuteMethod: "",
  });
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const [canvasStatus, setCanvasStatus] = useState(null);
  const [canvasToken, setCanvasToken] = useState("");
  const [linkingCanvas, setLinkingCanvas] = useState(false);
  const [canvasMsg, setCanvasMsg] = useState("");

  useEffect(() => {
    api.getMySchedule().then(setSchedule).catch(() => {});
    api.getCanvasStatus().then(setCanvasStatus).catch(() => {});
  }, []);

  useEffect(() => {
    if (profile) {
      setFormData({
        name: profile.name || "",
        phone: profile.phoneNumber || "",
        licensePlate: profile.licensePlate || "",
        email: profile.email || "",
        address: profile.address || "",
        zipCode: profile.zipCode || "",
        commuteMethod: profile.commuteMethod || "",
      });
    }
  }, [profile]);

  async function handleUpload(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg("");
    try {
      const result = await api.uploadSchedule(file);
      setUploadMsg(`Parsed ${result.schedule.courseCount} courses for ${result.schedule.name}`);
      const fresh = await api.getMySchedule();
      setSchedule(fresh);
    } catch (err) {
      setUploadMsg(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      await api.updateMe(formData);
      await refreshProfile();
      setEditing(false);
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function handleLinkCanvas() {
    if (!canvasToken.trim()) return;
    setLinkingCanvas(true);
    setCanvasMsg("");
    try {
      const result = await api.linkCanvasToken(canvasToken.trim());
      setCanvasMsg(`Linked! ${result.dataFetched.coursesCount} courses imported.`);
      setCanvasStatus({ canvasLinked: true, canvasUserName: result.canvasProfile.name });
      setCanvasToken("");
    } catch (err) {
      setCanvasMsg(`Error: ${err.message}`);
    } finally {
      setLinkingCanvas(false);
    }
  }

  const gradeLabel = { SOPHOMORE: "Sophomore", JUNIOR: "Junior", SENIOR: "Senior" };

  function Field({ label, field, placeholder, type = "text" }) {
    return (
      <label className="block">
        <span className="text-sm text-muted">{label}</span>
        <input
          type={type}
          value={formData[field]}
          onChange={(e) => setFormData({ ...formData, [field]: e.target.value })}
          placeholder={placeholder}
          className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-background px-3 text-white text-sm outline-none focus:border-accent"
        />
      </label>
    );
  }

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">My Profile</h2>

      {/* Profile info */}
      <section className="mt-6 rounded-3xl bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Account Info</h3>
          {!editing && (
            <button
              onClick={() => setEditing(true)}
              className="text-sm text-accent hover:underline"
            >
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Field label="Full Name" field="name" placeholder="Your full name" />
            <Field label="Email" field="email" placeholder="you@hw.com" type="email" />
            <Field label="Phone" field="phone" placeholder="(555) 123-4567" type="tel" />
            <Field label="License Plate" field="licensePlate" placeholder="ABC 1234" />
            <Field label="Home Address" field="address" placeholder="123 Main St" />
            <Field label="ZIP Code" field="zipCode" placeholder="90210" />
            <label className="block">
              <span className="text-sm text-muted">Commute Preference</span>
              <select
                value={formData.commuteMethod}
                onChange={(e) => setFormData({ ...formData, commuteMethod: e.target.value })}
                className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-background px-3 text-white text-sm outline-none focus:border-accent"
              >
                <option value="">Not set</option>
                <option value="drive_alone">Drive Alone</option>
                <option value="carpool">Carpool</option>
                <option value="parent_drop">Parent Drop-off</option>
                <option value="public_transit">Public Transit</option>
                <option value="bike_walk">Bike / Walk</option>
              </select>
            </label>
            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              <button
                onClick={() => setEditing(false)}
                className="rounded-lg border border-white/15 px-4 py-2 text-sm text-muted"
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted">Name:</span> {profile?.name || "—"}</p>
            <p><span className="text-muted">Email:</span> {profile?.email || "—"}</p>
            <p><span className="text-muted">Grade:</span> {gradeLabel[profile?.userType] || profile?.userType || "—"}</p>
            <p><span className="text-muted">Phone:</span> {profile?.phoneNumber || "Not set"}</p>
            <p><span className="text-muted">License Plate:</span> {profile?.licensePlate || "Not set"}</p>
            <p><span className="text-muted">Address:</span> {profile?.address || "Not set"}</p>
            <p><span className="text-muted">ZIP Code:</span> {profile?.zipCode || "Not set"}</p>
            <p><span className="text-muted">Commute:</span> {
              { drive_alone: "Drive Alone", carpool: "Carpool", parent_drop: "Parent Drop-off", public_transit: "Public Transit", bike_walk: "Bike / Walk" }[profile?.commuteMethod] || "Not set"
            }</p>
          </div>
        )}
      </section>

      {/* Canvas integration */}
      <section className="mt-4 rounded-3xl bg-card p-5">
        <h3 className="text-lg font-semibold mb-3">Canvas LMS</h3>

        {canvasStatus?.canvasLinked ? (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-green-400" />
              <span>Linked as {canvasStatus.canvasUserName}</span>
            </div>
            <p className="text-xs text-muted">Your Canvas data is synced for schedule matching.</p>
          </div>
        ) : (
          <div className="space-y-3">
            <p className="text-sm text-muted">
              Link your Canvas account to import courses and improve matching.
            </p>
            <div className="flex gap-2">
              <input
                type="password"
                value={canvasToken}
                onChange={(e) => setCanvasToken(e.target.value)}
                placeholder="Paste your Canvas access token"
                className="h-10 flex-1 rounded-lg border border-white/15 bg-background px-3 text-white text-sm outline-none focus:border-accent"
              />
              <button
                onClick={handleLinkCanvas}
                disabled={linkingCanvas || !canvasToken.trim()}
                className="shrink-0 rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {linkingCanvas ? "Linking..." : "Link"}
              </button>
            </div>
            {canvasMsg && (
              <p className={`text-xs ${canvasMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
                {canvasMsg}
              </p>
            )}
          </div>
        )}
      </section>

      {/* Schedule upload */}
      <section className="mt-4 rounded-3xl bg-card p-5">
        <h3 className="text-lg font-semibold mb-3">Schedule</h3>

        {schedule ? (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted">Student:</span> {schedule.name}</p>
            <p><span className="text-muted">Grade:</span> {schedule.grade}</p>
            <p><span className="text-muted">Courses:</span> {schedule.courses?.length || 0}</p>
            {schedule.coCurriculars?.length > 0 && (
              <p><span className="text-muted">Co-curriculars:</span> {schedule.coCurriculars.map((c) => c.title).join(", ")}</p>
            )}
            <div className="mt-3 pt-3 border-t border-white/10">
              <p className="text-xs text-muted mb-2">Course list:</p>
              <ul className="space-y-1">
                {schedule.courses?.map((c, i) => (
                  <li key={i} className="text-xs text-white/80">
                    {c.title} <span className="text-muted">({c.room || "No room"} · Block {c.block})</span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        ) : (
          <p className="text-sm text-muted">No schedule uploaded yet.</p>
        )}

        <div className="mt-4">
          <input
            ref={fileRef}
            type="file"
            accept=".pdf"
            onChange={handleUpload}
            className="hidden"
          />
          <button
            onClick={() => fileRef.current?.click()}
            disabled={uploading}
            className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
          >
            {uploading ? "Uploading..." : schedule ? "Re-upload Schedule" : "Upload Schedule PDF"}
          </button>
          {uploadMsg && (
            <p className={`mt-2 text-xs ${uploadMsg.startsWith("Error") ? "text-red-400" : "text-green-400"}`}>
              {uploadMsg}
            </p>
          )}
        </div>
      </section>

      {/* Sign out */}
      <section className="mt-4 pb-4">
        <button
          onClick={signOut}
          className="w-full rounded-xl border border-white/15 px-5 py-3 text-sm font-semibold text-muted transition-colors hover:bg-white/5"
        >
          Sign Out
        </button>
      </section>
    </AppShell>
  );
}
