"use client";

import { useEffect, useState, useRef, useCallback } from "react";
import AppShell from "../../components/AppShell";
import { useAuth } from "../../context/AuthContext";
import { api } from "../../lib/api";

const GRADE_LABELS = { SOPHOMORE: "Sophomore", JUNIOR: "Junior", SENIOR: "Senior" };
const COMMUTE_LABELS = {
  drive_alone: "Drive Alone",
  carpool: "Carpool",
  parent_drop: "Parent Drop-off",
  public_transit: "Public Transit",
  bike_walk: "Bike / Walk",
};
const WEEK_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

/**
 * Standalone Field input component — kept OUTSIDE ProfilePage so React never
 * treats it as a new component type on re-render, which would lose focus.
 */
function Field({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <label className="block">
      <span className="text-sm text-muted">{label}</span>
      <input
        type={type}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="mt-1 h-10 w-full rounded-lg border border-white/15 bg-background px-3 text-white text-sm outline-none focus:border-accent"
      />
    </label>
  );
}

/**
 * Day picker for rental availability (Mon–Fri).
 */
function DayPicker({ selected, onChange }) {
  function toggle(day) {
    if (selected.includes(day)) {
      onChange(selected.filter((d) => d !== day));
    } else {
      onChange([...selected, day]);
    }
  }
  return (
    <div className="flex gap-1.5 flex-wrap">
      {WEEK_DAYS.map((d) => (
        <button
          key={d}
          type="button"
          onClick={() => toggle(d)}
          className={`h-8 w-10 rounded-lg border text-xs font-medium transition-colors ${
            selected.includes(d)
              ? "border-accent bg-accent/20 text-accent"
              : "border-white/15 bg-background text-muted hover:border-white/30"
          }`}
        >
          {d}
        </button>
      ))}
      <button
        type="button"
        onClick={() => onChange(selected.length === 5 ? [] : [...WEEK_DAYS])}
        className="h-8 rounded-lg border border-white/15 px-2 text-xs text-muted hover:border-white/30"
      >
        {selected.length === 5 ? "None" : "All"}
      </button>
    </div>
  );
}

export default function ProfilePage() {
  const { profile, signOut, refreshProfile } = useAuth();
  const [isSetupFlow, setIsSetupFlow] = useState(false);
  const [schedule, setSchedule] = useState(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState("");
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const fileRef = useRef(null);

  const [canvasStatus, setCanvasStatus] = useState(null);
  const [canvasToken, setCanvasToken] = useState("");
  const [linkingCanvas, setLinkingCanvas] = useState(false);
  const [canvasMsg, setCanvasMsg] = useState("");

  const [form, setForm] = useState({
    name: "",
    email: "",
    phone: "",
    licensePlate: "",
    address: "",
    zipCode: "",
    commuteMethod: "",
    hasSpot: false,
    spot: "",
    isListedForRent: false,
    rentDays: [],
    doesTandem: false,
    doesCarpool: false,
  });

  // Helper — stable callback that updates a single form field
  const setField = useCallback((field) => (e) => {
    const value = e.target ? e.target.value : e;
    setForm((prev) => ({ ...prev, [field]: value }));
  }, []);

  useEffect(() => {
    api.getMySchedule().then(setSchedule).catch(() => {});
    api.getCanvasStatus().then(setCanvasStatus).catch(() => {});
  }, []);

  useEffect(() => {
    const setupMode = new URLSearchParams(window.location.search).get("setup") === "1";
    setIsSetupFlow(setupMode);
    if (setupMode) setEditing(true);
  }, []);

  useEffect(() => {
    if (profile) {
      setForm({
        name: profile.name || "",
        email: profile.email || "",
        phone: profile.phoneNumber || "",
        licensePlate: profile.licensePlate || "",
        address: profile.address || "",
        zipCode: profile.zipCode || "",
        commuteMethod: profile.commuteMethod || "",
        hasSpot: !!profile.hasSpot,
        spot: profile.parkingSpot || "",
        isListedForRent: !!profile.isListedForRent,
        rentDays: profile.rentDays || [],
        doesTandem: !!profile.doesTandem,
        doesCarpool: !!profile.doesCarpool,
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
      setSchedule(await api.getMySchedule());
    } catch (err) {
      setUploadMsg(`Error: ${err.message}`);
    } finally {
      setUploading(false);
    }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const payload = { ...form };
      if (!payload.hasSpot) {
        payload.spot = "";
        payload.isListedForRent = false;
        payload.rentDays = [];
      }
      if (!payload.isListedForRent) payload.rentDays = [];
      await api.updateMe(payload);
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

  return (
    <AppShell>
      <h2 className="text-4xl font-bold">My Profile</h2>
      {isSetupFlow && (
        <p className="mt-2 text-sm text-muted">
          Finish account setup by reviewing and saving your profile details.
        </p>
      )}

      {/* ── Account info ── */}
      <section className="mt-6 rounded-3xl bg-card p-5">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Account Info</h3>
          {!editing && (
            <button onClick={() => setEditing(true)} className="text-sm text-accent hover:underline">
              Edit
            </button>
          )}
        </div>

        {editing ? (
          <div className="space-y-3">
            <Field label="Full Name" value={form.name} onChange={setField("name")} placeholder="Your full name" />
            <Field label="Email" value={form.email} onChange={setField("email")} placeholder="you@hw.com" type="email" />
            <Field label="Phone" value={form.phone} onChange={setField("phone")} placeholder="(555) 123-4567" type="tel" />
            <Field label="License Plate" value={form.licensePlate} onChange={setField("licensePlate")} placeholder="ABC 1234" />
            <Field label="Home Address" value={form.address} onChange={setField("address")} placeholder="123 Main St" />
            <Field label="ZIP Code" value={form.zipCode} onChange={setField("zipCode")} placeholder="90210" />

            <label className="block">
              <span className="text-sm text-muted">Commute Preference</span>
              <select
                value={form.commuteMethod}
                onChange={setField("commuteMethod")}
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

            {/* Parking spot ownership */}
            <div>
              <span className="text-sm text-muted">Do you have a parking spot?</span>
              <div className="mt-1 flex gap-2">
                {[true, false].map((val) => (
                  <button
                    key={String(val)}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, hasSpot: val, ...(val ? {} : { spot: "", isListedForRent: false, rentDays: [] }) }))}
                    className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                      form.hasSpot === val
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/15 bg-background text-muted hover:border-white/30"
                    }`}
                  >
                    {val ? "Yes" : "No"}
                  </button>
                ))}
              </div>
            </div>

            {form.hasSpot && (
              <>
                <Field
                  label="Spot Number / Location"
                  value={form.spot}
                  onChange={setField("spot")}
                  placeholder="e.g. A-12, Taper S45"
                />

                {/* Rental listing toggle */}
                <div>
                  <span className="text-sm text-muted">List spot for rent?</span>
                  <div className="mt-1 flex gap-2">
                    {[true, false].map((val) => (
                      <button
                        key={String(val)}
                        type="button"
                        onClick={() => setForm((p) => ({ ...p, isListedForRent: val, ...(val ? {} : { rentDays: [] }) }))}
                        className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                          form.isListedForRent === val
                            ? "border-accent bg-accent/15 text-accent"
                            : "border-white/15 bg-background text-muted hover:border-white/30"
                        }`}
                      >
                        {val ? "Yes — put on market" : "No — keep private"}
                      </button>
                    ))}
                  </div>
                </div>

                {form.isListedForRent && (
                  <div>
                    <span className="text-sm text-muted block mb-1.5">Available days for rent</span>
                    <DayPicker
                      selected={form.rentDays}
                      onChange={(days) => setForm((p) => ({ ...p, rentDays: days }))}
                    />
                    {form.rentDays.length === 0 && (
                      <p className="mt-1 text-xs text-amber-400">Select at least one day to list your spot.</p>
                    )}
                  </div>
                )}
              </>
            )}

            {/* Interests */}
            <div>
              <span className="text-sm text-muted">Interests</span>
              <div className="mt-1 flex gap-2">
                {[["doesTandem", "Tandem"], ["doesCarpool", "Carpool"]].map(([field, label]) => (
                  <button
                    key={field}
                    type="button"
                    onClick={() => setForm((p) => ({ ...p, [field]: !p[field] }))}
                    className={`flex-1 h-10 rounded-lg border text-sm font-medium transition-colors ${
                      form[field]
                        ? "border-accent bg-accent/15 text-accent"
                        : "border-white/15 bg-background text-muted hover:border-white/30"
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-3 pt-2">
              <button
                onClick={handleSave}
                disabled={saving || (form.isListedForRent && form.rentDays.length === 0)}
                className="rounded-lg bg-accent px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Changes"}
              </button>
              {!isSetupFlow && (
                <button
                  onClick={() => setEditing(false)}
                  className="rounded-lg border border-white/15 px-4 py-2 text-sm text-muted"
                >
                  Cancel
                </button>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-2 text-sm">
            <p><span className="text-muted">Name:</span> {profile?.name || "—"}</p>
            <p><span className="text-muted">Email:</span> {profile?.email || "—"}</p>
            <p><span className="text-muted">Grade:</span> {GRADE_LABELS[profile?.userType] || profile?.userType || "—"}</p>
            <p><span className="text-muted">Phone:</span> {profile?.phoneNumber || "Not set"}</p>
            <p><span className="text-muted">License Plate:</span> {profile?.licensePlate || "Not set"}</p>
            <p><span className="text-muted">Address:</span> {profile?.address || "Not set"}</p>
            <p><span className="text-muted">ZIP:</span> {profile?.zipCode || "Not set"}</p>
            <p><span className="text-muted">Commute:</span> {COMMUTE_LABELS[profile?.commuteMethod] || "Not set"}</p>
            <div className="pt-1 border-t border-white/5">
              <p>
                <span className="text-muted">Parking Spot:</span>{" "}
                {!profile?.hasSpot ? "No spot" : (profile?.parkingSpot || "Not set")}
              </p>
              {profile?.hasSpot && (
                <p className="mt-0.5">
                  <span className="text-muted">Listed for rent:</span>{" "}
                  {profile?.isListedForRent
                    ? `Yes — ${(profile?.rentDays || []).join(", ") || "no days set"}`
                    : "No"}
                </p>
              )}
            </div>
            <div className="flex gap-2 pt-1">
              {[["doesTandem", "Tandem"], ["doesCarpool", "Carpool"]].map(([field, label]) => (
                <span
                  key={field}
                  className={`inline-flex items-center rounded-full px-3 py-1 text-xs font-medium border ${
                    profile?.[field]
                      ? "bg-accent/15 text-accent border-accent/30"
                      : "bg-white/5 text-muted border-white/10"
                  }`}
                >
                  {profile?.[field] ? label : `No ${label.toLowerCase()}`}
                </span>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* ── Canvas integration ── */}
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

      {/* ── Schedule upload ── */}
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
          <input ref={fileRef} type="file" accept=".pdf" onChange={handleUpload} className="hidden" />
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

      {/* ── Sign out ── */}
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
