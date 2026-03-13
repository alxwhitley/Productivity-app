import { useState } from "react";
import { DOMAIN_COLORS } from "../constants.js";
import { uid } from "../utils.js";
import useSwipeDown from "../useSwipeDown.js";

function DomainEditSheet({ data, setData, onClose, activeDomain, setActiveDomain }) {
  const swipe = useSwipeDown(onClose);
  const { domains, projects } = data;
  const [localDomains, setLocalDomains] = useState(domains.map(d => ({ ...d })));
  const [pickingColorFor, setPickingColorFor] = useState(null);

  const save = () => {
    setData(d => ({ ...d, domains: localDomains }));
    onClose();
  };

  const updateName = (id, name) => setLocalDomains(ds => ds.map(d => d.id === id ? { ...d, name } : d));
  const updateColor = (id, color) => { setLocalDomains(ds => ds.map(d => d.id === id ? { ...d, color } : d)); setPickingColorFor(null); };
  const deleteDomain = (id) => {
    if (localDomains.length <= 1) return;
    setLocalDomains(ds => ds.filter(d => d.id !== id));
    if (activeDomain === id) setActiveDomain(localDomains.find(d => d.id !== id)?.id);
  };
  const addDomain = () => {
    if (localDomains.length >= 4) return;
    const newD = { id: uid(), name: "New Category", color: DOMAIN_COLORS[localDomains.length % DOMAIN_COLORS.length] };
    setLocalDomains(ds => [...ds, newD]);
  };

  return (
    <>
      <div className="backdrop" onClick={onClose} />
      <div className="sheet" {...swipe} style={swipe.style}>
        <div className="sheet-pull" />
        <div className="sheet-title">Edit Categories</div>
        <div className="sheet-sub">Tap name to rename · Tap dot to change color</div>
        <div className="sheet-scroll">
          <div className="domain-edit-list">
            {localDomains.map(d => (
              <div key={d.id}>
                <div className="domain-edit-row">
                  <div className="domain-color-dot" style={{ background: d.color }} onClick={() => setPickingColorFor(pickingColorFor === d.id ? null : d.id)} />
                  <input className="domain-name-input" value={d.name} onChange={e => updateName(d.id, e.target.value)} />
                  <button className="domain-del-btn" onClick={() => deleteDomain(d.id)} disabled={localDomains.length <= 1}>✕</button>
                </div>
                {pickingColorFor === d.id && (
                  <div className="color-picker-row">
                    {DOMAIN_COLORS.map(c => (
                      <div key={c} className={`color-swatch ${d.color === c ? "sel" : ""}`} style={{ background: c }} onClick={() => updateColor(d.id, c)} />
                    ))}
                  </div>
                )}
              </div>
            ))}
          </div>
          {localDomains.length < 4 && (
            <button className="add-domain-btn" onClick={addDomain}>＋ Add Category (max 4)</button>
          )}
          <button className="form-btn" style={{ marginTop: 16 }} onClick={save}>Save Changes</button>
        </div>
      </div>
    </>
  );
}

export default DomainEditSheet;
