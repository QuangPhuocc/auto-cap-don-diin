import { Download, RefreshCw, Copy, Check, FileSpreadsheet } from "lucide-react";
import { useEffect, useState, useRef, useCallback } from "react";
import { api, download } from "../lib/api";
import type { Policy } from "../lib/types";
import { dateTime, money } from "../lib/utils";
import { Badge, Button, Card, CardContent, Input, Select } from "../components/ui";
import { PolicyDetailModal } from "../components/PolicyDetailModal";
import { useAuth } from "../context/AuthContext";

const statusStyle: Record<string, string> = {
  ISSUED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  QUEUED: "bg-amber-100 text-amber-700",
};
const statusText: Record<string, string> = {
  ISSUED: "Đã phát hành",
  FAILED: "Thất bại",
  PROCESSING: "Đang lấy link GCN...",
  QUEUED: "Đang xếp hàng...",
};

/** Đồng hồ đếm ngược — hiển thị số giây còn lại tối đa để hoàn thành */
function CountdownTimer({ createdAt }: { createdAt: string }) {
  const MAX_WAIT_SECS = 12; // Thời gian chờ tối đa 12s
  const [remaining, setRemaining] = useState(MAX_WAIT_SECS);

  useEffect(() => {
    const start = new Date(createdAt).getTime();
    const tick = () => {
      const elapsedSecs = Math.floor((Date.now() - start) / 1000);
      const rem = Math.max(0, MAX_WAIT_SECS - elapsedSecs);
      setRemaining(rem);
    };
    tick();
    const id = setInterval(tick, 1000);
    return () => clearInterval(id);
  }, [createdAt]);

  const color = remaining <= 5 ? "text-red-500 font-bold" : "text-blue-500";
  return (
    <span className={`text-[10px] font-mono ${color}`}>
      {remaining > 0 ? `Còn lại: ${remaining}s` : "Đang hoàn tất..."}
    </span>
  );
}

function cleanGCN(gcn: string | null | undefined): string {
  if (!gcn) return "—";
  const parts = gcn.split("_");
  if (parts.length > 1) return parts[parts.length - 1].replace(/\.pdf$/i, "");
  return gcn.replace(/\.pdf$/i, "");
}

function cleanPlateForFilename(plate: string): string {
  return plate.toUpperCase().replace(/[^A-Z0-9\s]/g, "").replace(/\s+/g, " ").trim();
}

export function PoliciesPage() {
  const { user } = useAuth();
  const [items, setItems] = useState<Policy[]>([]);
  const [q, setQ] = useState("");
  const [status, setStatus] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedYear, setSelectedYear] = useState("");
  const [selectedPolicy, setSelectedPolicy] = useState<Policy | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const getRecentMonths = () => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 12; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const m = String(d.getMonth() + 1).padStart(2, "0");
      const y = d.getFullYear();
      list.push({ label: `Tháng ${m}/${y}`, month: m, year: String(y) });
    }
    return list;
  };
  const monthsList = getRecentMonths();

  const load = useCallback((qVal = q) => {
    setLoading(true);
    let url = `/policies?q=${encodeURIComponent(qVal)}&status=${status}`;
    if (selectedMonth && selectedYear) url += `&month=${selectedMonth}&year=${selectedYear}`;
    api<{ items: Policy[] }>(url)
      .then(r => setItems(r.items))
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [q, status, selectedMonth, selectedYear]);

  // Debounce search khi gõ (500ms)
  const handleQChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const val = e.target.value;
    setQ(val);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => load(val), 500);
  };

  const copyLink = (id: string, url: string) => {
    navigator.clipboard.writeText(url).then(() => {
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 1500);
    });
  };

  useEffect(() => { load(); }, [status, selectedMonth, selectedYear]);

  // Polling cho đơn đang xử lý
  useEffect(() => {
    const hasPending = items.some(p => p.status === "QUEUED" || p.status === "PROCESSING");
    if (!hasPending) return;
    const timer = setInterval(() => {
      let url = `/policies?q=${encodeURIComponent(q)}&status=${status}`;
      if (selectedMonth && selectedYear) url += `&month=${selectedMonth}&year=${selectedYear}`;
      api<{ items: Policy[] }>(url)
        .then(r => setItems(r.items))
        .catch(e => console.error("Polling error:", e));
    }, 2000);
    return () => clearInterval(timer);
  }, [items, q, status, selectedMonth, selectedYear]);

  const handleMonthChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    if (!val) { setSelectedMonth(""); setSelectedYear(""); }
    else { const [m, y] = val.split("-"); setSelectedMonth(m); setSelectedYear(y); }
  };

  const exportUrl = `/policies/export?month=${selectedMonth}&year=${selectedYear}`;

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-end">
        <div>
          <h2 className="text-2xl font-bold">Danh sách đơn</h2>
          <p className="text-muted-foreground">Danh sách bảo hiểm đã phát hành</p>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Input
            id="policies-search-input"
            placeholder="Biển số, họ tên, GCN…"
            value={q}
            onChange={handleQChange}
            onKeyDown={e => e.key === "Enter" && load()}
            className="col-span-2 sm:w-60"
          />
          <Select value={status} onChange={e => setStatus(e.target.value)}>
            <option value="">Mọi trạng thái</option>
            <option value="QUEUED">Chờ xử lý</option>
            <option value="PROCESSING">Đang xử lý</option>
            <option value="ISSUED">Đã phát hành</option>
            <option value="FAILED">Thất bại</option>
          </Select>
          <Select
            value={selectedMonth ? `${selectedMonth}-${selectedYear}` : ""}
            onChange={handleMonthChange}
          >
            <option value="">Tất cả thời gian</option>
            {monthsList.map(item => (
              <option key={`${item.month}-${item.year}`} value={`${item.month}-${item.year}`}>
                {item.label}
              </option>
            ))}
          </Select>
          <Button
            variant="outline"
            size="sm"
            onClick={() => download(exportUrl, `danh_sach_phat_hanh_${selectedMonth || "all"}.xlsx`)}
            className="flex items-center gap-1.5 border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 h-10 px-3"
          >
            <FileSpreadsheet size={15} />Xuất Excel
          </Button>
          <Button variant="outline" size="icon" onClick={() => load()} className="h-10 w-10">
            <RefreshCw size={17} />
          </Button>
        </div>
      </div>

      {error && <p className="rounded-lg bg-red-50 p-3 text-red-700">{error}</p>}

      <Card className="overflow-hidden">
        <CardContent className="overflow-x-auto p-0">
          <table className="w-full text-sm">
            <thead className="bg-stone-50 text-left">
              <tr>
                <th className="p-3">Khách hàng</th>
                <th className="p-3">Biển số</th>
                <th className="p-3">GCN</th>
                <th className="p-3">Phí</th>
                <th className="p-3">Trạng thái</th>
                <th className="p-3">Ngày tạo</th>
                <th className="p-3"></th>
              </tr>
            </thead>
            <tbody>
              {items.map(p => (
                <tr key={p.id} className="border-t hover:bg-stone-50/50">
                  <td className="p-3">
                    <div className="font-medium">{p.customerName}</div>
                    {user?.role !== "CTV" && p.user && (
                      <div className="text-xs text-muted-foreground">{p.user.fullName}</div>
                    )}
                  </td>
                  <td className="p-3">
                    {/* Biển số clickable → mở modal */}
                    <button
                      id={`plate-${p.id}`}
                      onClick={() => setSelectedPolicy(p)}
                      className="font-mono font-semibold text-orange-600 hover:text-orange-700 hover:underline cursor-pointer transition-colors"
                      title="Nhấn để xem chi tiết"
                    >
                      {p.plateNumber}
                    </button>
                  </td>
                  <td className="p-3 font-mono text-xs">{cleanGCN(p.certificateNumber)}</td>
                  <td className="p-3">{p.premium ? money(p.premium) : "—"}</td>
                  <td className="p-3">
                    <Badge className={`flex items-center gap-1 w-fit ${statusStyle[p.status]}`}>
                      {(p.status === "PROCESSING" || p.status === "QUEUED") && (
                        <RefreshCw size={12} className="animate-spin" />
                      )}
                      {statusText[p.status]}
                    </Badge>
                    {/* Đồng hồ đếm ngược cho đơn đang xử lý */}
                    {(p.status === "PROCESSING" || p.status === "QUEUED") && (
                      <div className="mt-0.5">
                        <CountdownTimer createdAt={p.createdAt} />
                      </div>
                    )}
                    {user?.role !== "CTV" && p.status !== "ISSUED" && p.error && (
                      <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={p.error}>
                        {p.error}
                      </div>
                    )}
                  </td>
                  <td className="p-3 text-muted-foreground">{dateTime(p.createdAt)}</td>
                  <td className="p-3">
                    <div className="flex items-center gap-2">
                      {p.pdfPath && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => download(`/policies/${p.id}/pdf`, `${cleanPlateForFilename(p.plateNumber)}.pdf`)}
                        >
                          <Download size={15} />Tải xuống
                        </Button>
                      )}
                      {p.pdfUrl && (
                        <Button
                          size="sm"
                          variant="outline"
                          onClick={() => copyLink(p.id, p.pdfUrl!)}
                          className="flex items-center gap-1"
                        >
                          {copiedId === p.id ? (
                            <><Check size={13} className="text-emerald-600" />Đã chép</>
                          ) : (
                            <><Copy size={13} />Copy link</>
                          )}
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {!loading && !items.length && (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Chưa có đơn nào</td></tr>
              )}
              {loading && (
                <tr><td colSpan={7} className="p-12 text-center text-muted-foreground">Đang tải…</td></tr>
              )}
            </tbody>
          </table>
        </CardContent>
      </Card>

      {/* Modal chi tiết đơn */}
      {selectedPolicy && (
        <PolicyDetailModal
          policy={selectedPolicy}
          onClose={() => setSelectedPolicy(null)}
        />
      )}
    </div>
  );
}
