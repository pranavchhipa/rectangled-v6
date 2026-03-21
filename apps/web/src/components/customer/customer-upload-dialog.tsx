'use client'

import { useState, useCallback } from 'react'
import { Upload, Download, FileSpreadsheet, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'
import * as XLSX from 'xlsx'
import { trpc } from '@/lib/trpc'
import { useAuthStore } from '@/stores/auth-store'
import { useQueryClient } from '@tanstack/react-query'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'

interface ParsedCustomer {
  name: string
  email?: string
  phone?: string
  tags?: string[]
}

interface CustomerUploadDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
}

const MAX_FILE_SIZE = 5 * 1024 * 1024 // 5MB
const MAX_ROWS = 1000

export function CustomerUploadDialog({ open, onOpenChange }: CustomerUploadDialogProps) {
  const { currentWorkspaceId } = useAuthStore()
  const queryClient = useQueryClient()
  const [parsedData, setParsedData] = useState<ParsedCustomer[]>([])
  const [fileName, setFileName] = useState('')

  const bulkCreateMutation = trpc.customer?.bulkCreate?.useMutation?.({
    onSuccess: (result: any) => {
      toast.success(`Imported ${result.created} customers (${result.skipped} skipped)`)
      if (result.errors.length > 0) {
        toast.warning(`${result.errors.length} errors occurred`)
      }
      queryClient.invalidateQueries({ queryKey: [['customer', 'list']] })
      onOpenChange(false)
      setParsedData([])
      setFileName('')
    },
    onError: (err: any) => toast.error(err.message),
  })

  const handleDownloadSample = () => {
    const ws = XLSX.utils.aoa_to_sheet([
      ['Name', 'Email', 'Phone', 'Tags'],
      ['Priya Sharma', 'priya@example.com', '+919876543210', 'vip,regular'],
      ['Amit Patel', 'amit@example.com', '+919876543211', 'new'],
    ])
    const wb = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(wb, ws, 'Customers')
    XLSX.writeFile(wb, 'customer_upload_sample.xlsx')
  }

  const handleFileChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    if (file.size > MAX_FILE_SIZE) {
      toast.error('File too large. Maximum 5MB allowed.')
      return
    }

    setFileName(file.name)

    const reader = new FileReader()
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target?.result as ArrayBuffer)
        const workbook = XLSX.read(data, { type: 'array' })
        const sheet = workbook.Sheets[workbook.SheetNames[0]]
        const json = XLSX.utils.sheet_to_json<Record<string, string>>(sheet)

        if (json.length > MAX_ROWS) {
          toast.error(`Too many rows (${json.length}). Maximum ${MAX_ROWS} allowed.`)
          return
        }

        const parsed: ParsedCustomer[] = json
          .filter((row) => row.Name || row.name)
          .map((row) => ({
            name: (row.Name || row.name || '').trim(),
            email: (row.Email || row.email || '').trim() || undefined,
            phone: (row.Phone || row.phone || '').trim() || undefined,
            tags: (row.Tags || row.tags || '')
              .split(',')
              .map((t: string) => t.trim())
              .filter(Boolean),
          }))

        setParsedData(parsed)
      } catch {
        toast.error('Failed to parse file. Please check the format.')
      }
    }
    reader.readAsArrayBuffer(file)
  }, [])

  const handleImport = () => {
    if (!currentWorkspaceId || parsedData.length === 0) return
    bulkCreateMutation?.mutate?.({
      workspaceId: currentWorkspaceId,
      customers: parsedData,
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Upload Customers</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={handleDownloadSample}>
              <Download className="size-4 mr-1.5" />
              Download Sample XLSX
            </Button>
          </div>

          {parsedData.length === 0 ? (
            <label className="flex flex-col items-center justify-center gap-2 rounded-lg border-2 border-dashed p-8 cursor-pointer hover:bg-muted/50 transition-colors">
              <FileSpreadsheet className="size-8 text-muted-foreground" />
              <p className="text-sm text-muted-foreground">
                Click to upload .csv or .xlsx file
              </p>
              <p className="text-xs text-muted-foreground">
                Max 5MB, up to 1000 rows
              </p>
              <input
                type="file"
                accept=".csv,.xlsx,.xls"
                className="hidden"
                onChange={handleFileChange}
              />
            </label>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-2">
                <p className="text-sm font-medium">
                  {fileName} — {parsedData.length} customers
                </p>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => { setParsedData([]); setFileName('') }}
                >
                  <X className="size-4" />
                </Button>
              </div>
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Phone</TableHead>
                      <TableHead>Tags</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {parsedData.slice(0, 20).map((c, i) => (
                      <TableRow key={i}>
                        <TableCell className="text-sm">{c.name}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.email ?? '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.phone ?? '-'}</TableCell>
                        <TableCell className="text-sm text-muted-foreground">{c.tags?.join(', ') ?? '-'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
                {parsedData.length > 20 && (
                  <p className="text-xs text-muted-foreground p-2 text-center">
                    ...and {parsedData.length - 20} more rows
                  </p>
                )}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button
            onClick={handleImport}
            disabled={parsedData.length === 0 || bulkCreateMutation?.isPending}
          >
            {bulkCreateMutation?.isPending ? (
              <>
                <Loader2 className="size-4 mr-1.5 animate-spin" />
                Importing...
              </>
            ) : (
              <>
                <Upload className="size-4 mr-1.5" />
                Import {parsedData.length} Customers
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
