"use client";
import { useState } from "react";
import { DEFAULT_AVATAR, type Profile } from "@/domain/profile";
import { usePlannerStore } from "@/data/store";
import { DataPortability } from "./composites/DataPortability";
import { Sheet } from "./Sheet";
import { AccountControls } from "./AccountControls";

export function ProfileSettings({ profile, onSave, onClose, onClear }: {
  profile: Profile; onSave: (profile: Profile) => boolean; onClose: () => void; onClear: () => void;
}) {
  const [name, setName] = useState(profile.name);
  const [error, setError] = useState("");
  const tasks = usePlannerStore(s => s.tasks.length);
  function save() {
    if (!name.trim()) { setError("给自己起个名字吧"); return; }
    if (!onSave({ name: name.trim(), avatar: DEFAULT_AVATAR })) { setError("浏览器无法保存，请检查存储空间"); return; }
    onClose();
  }
  return <Sheet title="我的设置" onBack={onClose} onClose={onClose} footer={<button className="btn btn-green" onClick={save}>保存设置</button>}>
    <section className="profile-card">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img className="profile-preview" src={DEFAULT_AVATAR} alt="我的头像" />
      <label className="profile-name">用户名<input aria-label="用户名" value={name} maxLength={24} onChange={e => setName(e.target.value)} /></label>
    </section>
    {error && <p className="form-error" role="alert">{error}</p>}
    <section className="settings-section"><h3>日程数据</h3><DataPortability /><div className="settings-actions"><button className="btn btn-coral" disabled={!tasks} onClick={onClear}>清空任务</button></div></section>
    <AccountControls />
  </Sheet>;
}
