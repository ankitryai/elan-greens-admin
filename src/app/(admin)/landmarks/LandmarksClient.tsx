'use client'

import { useState } from 'react'
import { toast } from 'sonner'
import type { Landmark } from '@/types'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const CATEGORIES = ['Block', 'Gate', 'Sports', 'Amenity', 'Infrastructure', 'Green Space'] as const
type Category = typeof CATEGORIES[number]

const CATEGORY_ICONS: Record<Category, string> = {
  'Block': '🏢', 'Gate': '🚪', 'Sports': '🏅',
  'Amenity': '🏠', 'Infrastructure': '⚙️', 'Green Space': '🌿',
}

interface FormState {
  name: string; sub_label: string; icon: string
  lat: string; lng: string; category: Category
}

const EMPTY: FormState = { name: '', sub_label: '', icon: '', lat: '', lng: '', category: 'Amenity' }

export default function LandmarksClient({ initialLandmarks }: { initialLandmarks: Landmark[] }) {
  const [landmarks, setLandmarks] = useState<Landmark[]>(initialLandmarks)
  const [form, setForm]           = useState<FormState>(EMPTY)
  const [editId, setEditId]       = useState<string | null>(null)
  const [saving, setSaving]       = useState(false)
  const [deleting, setDeleting]   = useState<string | null>(null)
  const [showForm, setShowForm]   = useState(false)

  const grouped = CATEGORIES.reduce((acc, cat) => {
    acc[cat] = landmarks.filter(l => l.category === cat)
    return acc
  }, {} as Record<Category, Landmark[]>)

  function startAdd() {
    setForm(EMPTY)
    setEditId(null)
    setShowForm(true)
  }

  function startEdit(lm: Landmark) {
    setForm({
      name: lm.name, sub_label: lm.sub_label ?? '', icon: lm.icon ?? '',
      lat: String(lm.lat), lng: String(lm.lng), category: lm.category,
    })
    setEditId(lm.id)
    setShowForm(true)
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  async function handleSave() {
    if (!form.name.trim() || !form.lat || !form.lng) {
      toast.error('Name, lat and lng are required')
      return
    }
    setSaving(true)
    try {
      const payload = {
        name: form.name.trim(),
        sub_label: form.sub_label.trim() || null,
        icon: form.icon.trim() || null,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        category: form.category,
      }
      if (editId) {
        const res = await fetch(`/api/landmarks/${editId}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setLandmarks(prev => prev.map(l => l.id === editId ? data : l))
        toast.success('Landmark updated')
      } else {
        const res = await fetch('/api/landmarks', {
          method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ ...payload, property_id: 'elan' }),
        })
        const data = await res.json()
        if (!res.ok) throw new Error(data.error)
        setLandmarks(prev => [...prev, data])
        toast.success('Landmark added')
      }
      setForm(EMPTY); setEditId(null); setShowForm(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Delete "${name}"? This will remove all plant tags referencing it.`)) return
    setDeleting(id)
    try {
      const res = await fetch(`/api/landmarks/${id}`, { method: 'DELETE' })
      if (!res.ok) { const d = await res.json(); throw new Error(d.error) }
      setLandmarks(prev => prev.filter(l => l.id !== id))
      toast.success('Landmark deleted')
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Delete failed')
    } finally {
      setDeleting(null)
    }
  }

  return (
    <div className="space-y-6">
      {/* Add/Edit form */}
      {showForm ? (
        <div className="bg-white border border-gray-200 rounded-xl p-5 space-y-4">
          <h2 className="font-semibold text-gray-800">{editId ? 'Edit Landmark' : 'Add Landmark'}</h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1">
              <Label>Name *</Label>
              <Input placeholder="e.g. Swimming Pool" value={form.name}
                onChange={e => setForm(f => ({ ...f, name: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Sub-label <span className="text-gray-400 text-xs">(blocks only, e.g. Caldra)</span></Label>
              <Input placeholder="Tower / sub-name" value={form.sub_label}
                onChange={e => setForm(f => ({ ...f, sub_label: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Category *</Label>
              <select
                value={form.category}
                onChange={e => setForm(f => ({ ...f, category: e.target.value as Category }))}
                className="w-full h-9 rounded-md border border-input bg-background px-3 py-1 text-sm"
              >
                {CATEGORIES.map(c => <option key={c}>{c}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <Label>Icon emoji <span className="text-gray-400 text-xs">(shown on map)</span></Label>
              <Input placeholder="e.g. 🏊" value={form.icon}
                onChange={e => setForm(f => ({ ...f, icon: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Latitude *</Label>
              <Input type="number" step="any" placeholder="12.9178…" value={form.lat}
                onChange={e => setForm(f => ({ ...f, lat: e.target.value }))} />
            </div>
            <div className="space-y-1">
              <Label>Longitude *</Label>
              <Input type="number" step="any" placeholder="77.6733…" value={form.lng}
                onChange={e => setForm(f => ({ ...f, lng: e.target.value }))} />
            </div>
          </div>
          <div className="flex gap-2 pt-1">
            <Button onClick={handleSave} disabled={saving}>
              {saving ? 'Saving…' : editId ? 'Update' : 'Add'}
            </Button>
            <Button variant="outline" onClick={() => { setShowForm(false); setEditId(null); setForm(EMPTY) }}>
              Cancel
            </Button>
          </div>
        </div>
      ) : (
        <Button onClick={startAdd}>+ Add Landmark</Button>
      )}

      {/* Landmark list grouped by category */}
      {CATEGORIES.map(cat => {
        const items = grouped[cat]
        if (items.length === 0 && !showForm) return null
        return (
          <div key={cat}>
            <h3 className="text-sm font-semibold text-gray-500 uppercase tracking-wide mb-2">
              {CATEGORY_ICONS[cat]} {cat} ({items.length})
            </h3>
            <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
              {items.length === 0 ? (
                <p className="text-sm text-gray-400 px-4 py-3">No {cat.toLowerCase()} landmarks yet.</p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-gray-100 bg-gray-50 text-gray-500 text-xs">
                      <th className="text-left px-4 py-2 font-medium">Name</th>
                      <th className="text-left px-4 py-2 font-medium hidden sm:table-cell">Sub / Icon</th>
                      <th className="text-left px-4 py-2 font-medium hidden md:table-cell">Lat / Lng</th>
                      <th className="px-4 py-2 text-right font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {items.map((lm, i) => (
                      <tr key={lm.id} className={i < items.length - 1 ? 'border-b border-gray-50' : ''}>
                        <td className="px-4 py-2 font-medium text-gray-800">
                          {lm.name}
                          {!lm.active && <span className="ml-2 text-xs text-gray-400">(inactive)</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-500 hidden sm:table-cell">
                          {lm.sub_label && <span className="mr-2">{lm.sub_label}</span>}
                          {lm.icon && <span>{lm.icon}</span>}
                        </td>
                        <td className="px-4 py-2 text-gray-400 font-mono text-xs hidden md:table-cell">
                          {lm.lat.toFixed(6)}, {lm.lng.toFixed(6)}
                        </td>
                        <td className="px-4 py-2 text-right space-x-2">
                          <button
                            onClick={() => startEdit(lm)}
                            className="text-xs text-blue-600 hover:text-blue-800 font-medium"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(lm.id, lm.name)}
                            disabled={deleting === lm.id}
                            className="text-xs text-red-500 hover:text-red-700 font-medium disabled:opacity-40"
                          >
                            {deleting === lm.id ? '…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
