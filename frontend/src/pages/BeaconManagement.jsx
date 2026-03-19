import React, { useEffect, useState } from 'react';
import { beaconService } from '../services';
import { Battery, PlusCircle, RefreshCw } from 'lucide-react';

const BEACON_VISUAL_SOURCES = [
  'https://upload.wikimedia.org/wikipedia/commons/thumb/c/c9/IBeacon_logo.svg/512px-IBeacon_logo.svg.png',
  'https://upload.wikimedia.org/wikipedia/commons/c/c9/IBeacon_logo.svg',
  'https://www.bluetooth.com/wp-content/uploads/2020/03/logo-bluetooth.svg',
];

const BeaconManagement = () => {
  const [beacons, setBeacons] = useState([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [visualIndex, setVisualIndex] = useState(0);
  const [visualFallback, setVisualFallback] = useState(false);
  const [form, setForm] = useState({
    uuid: '',
    major: '',
    minor: '',
    zone: '',
    locationDescription: '',
    batteryLevel: '',
  });

  const loadBeacons = async () => {
    setLoading(true);
    try {
      const response = await beaconService.listBeacons();
      setBeacons(response.beacons || []);
    } catch (error) {
      console.error('Failed to load beacons:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBeacons();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setSubmitting(true);
    try {
      await beaconService.addBeacon({
        uuid: form.uuid,
        major: Number(form.major),
        minor: Number(form.minor),
        zone: form.zone,
        locationDescription: form.locationDescription || undefined,
        batteryLevel: form.batteryLevel ? Number(form.batteryLevel) : undefined,
      });
      alert('Beacon added successfully');
      setForm({
        uuid: '',
        major: '',
        minor: '',
        zone: '',
        locationDescription: '',
        batteryLevel: '',
      });
      loadBeacons();
    } catch (error) {
      alert(error.response?.data?.message || 'Failed to add beacon');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Beacon Management</h1>
          <p className="text-gray-600">Admin-only BLE beacon setup for indoor navigation</p>
        </div>
        <button onClick={loadBeacons} className="btn btn-secondary" disabled={loading}>
          <RefreshCw size={16} className="mr-2" />
          Refresh
        </button>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-3">Beacon Visual Example (Internet Reference)</h2>
        <div className="grid md:grid-cols-2 gap-4 items-start">
          {visualFallback ? (
            <div className="w-full max-w-xs rounded-lg border border-gray-200 bg-gray-50 p-4">
              <svg viewBox="0 0 300 220" xmlns="http://www.w3.org/2000/svg" className="w-full h-auto">
                <rect x="10" y="10" width="280" height="200" rx="12" fill="#ffffff" stroke="#d1d5db" />
                <circle cx="150" cy="110" r="18" fill="#2563eb" />
                <circle cx="150" cy="110" r="45" fill="none" stroke="#60a5fa" strokeWidth="8" />
                <circle cx="150" cy="110" r="75" fill="none" stroke="#93c5fd" strokeWidth="8" />
                <text x="150" y="40" textAnchor="middle" fill="#1f2937" fontSize="16" fontWeight="700">BLE Beacon Example</text>
                <text x="150" y="190" textAnchor="middle" fill="#4b5563" fontSize="12">Fallback visual (offline/network-blocked)</text>
              </svg>
            </div>
          ) : (
            <img
              src={BEACON_VISUAL_SOURCES[visualIndex]}
              alt="BLE iBeacon visual example"
              className="w-full max-w-xs rounded-lg border border-gray-200"
              referrerPolicy="no-referrer"
              onError={() => {
                if (visualIndex < BEACON_VISUAL_SOURCES.length - 1) {
                  setVisualIndex((current) => current + 1);
                } else {
                  setVisualFallback(true);
                }
              }}
            />
          )}
          <div className="text-sm text-gray-700 space-y-2">
            <p>This is a public internet example of a BLE beacon symbol used for indoor positioning.</p>
            <p>Use UUID + major + minor + zone to map each beacon in your library.</p>
            <a
              href={BEACON_VISUAL_SOURCES[visualIndex]}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 hover:text-blue-700 font-medium"
            >
              Open image source in new tab
            </a>
          </div>
        </div>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Add Beacon</h2>
        <form onSubmit={handleSubmit} className="grid md:grid-cols-2 gap-4">
          <input
            className="input"
            placeholder="Beacon UUID"
            value={form.uuid}
            onChange={(e) => setForm({ ...form, uuid: e.target.value })}
            required
          />
          <input
            className="input"
            type="number"
            placeholder="Major"
            value={form.major}
            onChange={(e) => setForm({ ...form, major: e.target.value })}
            required
          />
          <input
            className="input"
            type="number"
            placeholder="Minor"
            value={form.minor}
            onChange={(e) => setForm({ ...form, minor: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="Zone (e.g., A, B)"
            value={form.zone}
            onChange={(e) => setForm({ ...form, zone: e.target.value })}
            required
          />
          <input
            className="input"
            placeholder="Location Description"
            value={form.locationDescription}
            onChange={(e) => setForm({ ...form, locationDescription: e.target.value })}
          />
          <input
            className="input"
            type="number"
            min="0"
            max="100"
            placeholder="Battery Level %"
            value={form.batteryLevel}
            onChange={(e) => setForm({ ...form, batteryLevel: e.target.value })}
          />
          <button type="submit" className="btn btn-primary md:col-span-2" disabled={submitting}>
            <PlusCircle size={16} className="mr-2" />
            {submitting ? 'Adding Beacon...' : 'Add Beacon'}
          </button>
        </form>
      </div>

      <div className="card">
        <h2 className="text-lg font-semibold mb-4">Registered Beacons</h2>
        {loading ? (
          <p className="text-gray-500">Loading...</p>
        ) : beacons.length === 0 ? (
          <p className="text-gray-500">No beacons available</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left">UUID</th>
                  <th className="px-3 py-2 text-left">Major/Minor</th>
                  <th className="px-3 py-2 text-left">Zone</th>
                  <th className="px-3 py-2 text-left">Location</th>
                  <th className="px-3 py-2 text-left">Battery</th>
                </tr>
              </thead>
              <tbody>
                {beacons.map((beacon) => (
                  <tr key={beacon.id} className="border-t">
                    <td className="px-3 py-2 font-mono text-xs">{beacon.uuid}</td>
                    <td className="px-3 py-2">{beacon.major}/{beacon.minor}</td>
                    <td className="px-3 py-2">{beacon.zone}</td>
                    <td className="px-3 py-2">{beacon.locationDescription || '—'}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1">
                        <Battery size={14} />
                        {beacon.batteryLevel ?? '—'}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default BeaconManagement;
