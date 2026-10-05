import { useState, useEffect } from 'react'
import { X, FileText, Download, Copy, Check, RefreshCw, AlertCircle } from 'lucide-react'
import { fetchResearchReport } from '../services/api/phase4Service'

interface Props {
  sessionId?: string
  deviceId?: string
  onClose: () => void
}

export function ResearchReportModal({ sessionId, deviceId, onClose }: Props) {
  const [reportMarkdown, setReportMarkdown] = useState<string>('')
  const [loading, setLoading] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generateReport = async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetchResearchReport(sessionId, deviceId, 'markdown')
      setReportMarkdown(typeof res === 'string' ? res : JSON.stringify(res, null, 2))
    } catch (err: any) {
      setError(err?.message || 'Failed to generate academic research report.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void generateReport()
  }, [sessionId, deviceId])

  const copyToClipboard = () => {
    navigator.clipboard.writeText(reportMarkdown)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const downloadFile = () => {
    const blob = new Blob([reportMarkdown], { type: 'text/markdown;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `StepCharge_Research_Report_${sessionId || 'fleet'}_${new Date().toISOString().split('T')[0]}.md`
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    URL.revokeObjectURL(url)
  }

  return (
    <div className="fixed inset-0 z-50 grid place-items-center bg-black/80 backdrop-blur-sm p-4 overflow-y-auto">
      <div className="w-full max-w-4xl max-h-[90vh] flex flex-col rounded-xl border border-white/10 bg-ink-950 p-6 shadow-2xl">
        <div className="flex items-center justify-between border-b border-white/[0.08] pb-4">
          <div className="flex items-center gap-2.5">
            <FileText className="h-5 w-5 text-indigo-400" />
            <div>
              <h3 className="text-base font-semibold text-white">
                Academic Research & Engineering Report
              </h3>
              <p className="text-xs text-slate-400">
                17-Section peer-review-grade documentation compiling hardware, dataset, ML validation & energy metrics
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="rounded-lg p-1.5 text-slate-400 hover:bg-white/[0.06] hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {error && (
          <div className="my-4 flex items-center gap-2 rounded-lg border border-rose-500/30 bg-rose-500/10 p-3 text-xs text-rose-300">
            <AlertCircle className="h-4 w-4 shrink-0 text-rose-400" />
            <span>{error}</span>
          </div>
        )}

        {/* Content Viewer */}
        <div className="my-4 flex-1 overflow-y-auto rounded-lg border border-white/[0.08] bg-black/40 p-4 font-mono text-xs leading-relaxed text-slate-300 whitespace-pre-wrap select-text">
          {loading ? (
            <div className="py-20 text-center">
              <RefreshCw className="mx-auto h-6 w-6 animate-spin text-cyan-400 mb-2" />
              <p className="text-slate-400">Querying MongoDB collections & compiling academic report...</p>
            </div>
          ) : reportMarkdown ? (
            reportMarkdown
          ) : (
            <div className="py-12 text-center text-slate-500">No report generated.</div>
          )}
        </div>

        {/* Action Footer */}
        <div className="flex items-center justify-between border-t border-white/[0.08] pt-4">
          <span className="text-[11px] text-slate-500">
            Compliant with IEEE / Springer research submission guidelines
          </span>
          <div className="flex items-center gap-2">
            <button
              onClick={copyToClipboard}
              disabled={!reportMarkdown || loading}
              className="flex items-center gap-1.5 rounded-lg border border-slate-700 bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 hover:bg-slate-700 disabled:opacity-50"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Copied' : 'Copy Markdown'}
            </button>
            <button
              onClick={downloadFile}
              disabled={!reportMarkdown || loading}
              className="flex items-center gap-1.5 rounded-lg bg-indigo-600 px-3.5 py-1.5 text-xs font-semibold text-white shadow hover:bg-indigo-500 disabled:opacity-50"
            >
              <Download className="h-3.5 w-3.5" />
              Download Report (.md)
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
