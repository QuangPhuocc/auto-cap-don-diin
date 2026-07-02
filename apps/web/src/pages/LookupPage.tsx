import { Search, RefreshCw, AlertCircle } from "lucide-react";
import { useState, useRef, useCallback, useEffect } from "react";
import { api } from "../lib/api";
import type { Policy } from "../lib/types";
import { dateTime, money } from "../lib/utils";
import { Badge, Button, Card, CardContent, Input } from "../components/ui";
import { PolicyDetailModal } from "../components/PolicyDetailModal";
import { useAuth } from "../context/AuthContext";
import { useSearchParams } from "react-router-dom";

const statusStyle: Record<string, string> = {
  ISSUED: "bg-emerald-100 text-emerald-700",
  FAILED: "bg-red-100 text-red-700",
  PROCESSING: "bg-blue-100 text-blue-700",
  QUEUED: "bg-amber-100 text-amber-700",
};
const statusText: Record<string, string> = {
  ISSUED: "Đã phát hành",
  FAILED: "Thất bại",
  PROCESSING: "Đang xử lý",
  QUEUED: "Chờ xử lý",
};

function cleanGCN(gcn: string | null | undefined): string {
  if (!gcn) return "—";
  const parts = gcn.split("_");
  if (parts.length > 1) return parts[parts.length - 1].replace(/\.pdf$/i, "");
  return gcn.replace(/\.pdf$/i, "");
}

export function LookupPage() {
  const { user } = useAuth();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialPlate = searchParams.get("plate") ?? "";

  const [query, setQuery] = useState(initialPlate);
  const [results, setResults] = useState<Policy[]>([]);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);
  const [error, setError] = useState("");
  const [selected, setSelected] = useState<Policy | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const search = useCallback(async (plate: string) => {
    const q = plate.trim();
    if (q.length < 2) return;
    setLoading(true);
    setError("");
    setSearched(true);
    try {
      const res = await api<{ items: Policy[] }>(`/policies/lookup?plate=${encodeURIComponent(q)}`);
      setResults(res.items);
      // Nếu chỉ có 1 kết quả đã phát hành → mở modal tự động
      if (res.items.length === 1) {
        setSelected(res.items[0]);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Lỗi tra cứu");
    } finally {
      setLoading(false);
    }
  }, []);

  // Nếu có param plate trên URL → tìm ngay
  useEffect(() => {
    if (initialPlate) search(initialPlate);
    else inputRef.current?.focus();
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (query.trim().length < 2) return;
    setSearchParams({ plate: query.trim() });
    search(query);
  };

  return (
    <div className="mx-auto max-w-2xl space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-stone-900">Tra cứu thẻ bảo hiểm</h2>
        <p className="text-sm text-stone-500 mt-1">Nhập biển số xe để xem thông tin thẻ TNDS đã phát hành</p>
      </div>

      {/* Search bar */}
      <form onSubmit={handleSubmit}>
        <div className="flex gap-2">
          <div className="relative flex-1">
            <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400 pointer-events-none" />
            <Input
              ref={inputRef}
              id="lookup-plate-input"
              value={query}
              onChange={e => setQuery(e.target.value.toUpperCase())}
              placeholder="Ví dụ: 73C11032 hoặc 81M0429..."
              className="pl-9 text-base font-mono tracking-wider"
            />
          </div>
          <Button type="submit" disabled={loading || query.trim().length < 2} className="px-6">
            {loading ? <RefreshCw size={15} className="animate-spin" /> : "Tìm kiếm"}
          </Button>
        </div>
      </form>

      {/* Error */}
      {error && (
        <div className="flex items-center gap-2 rounded-lg bg-red-50 border border-red-100 px-4 py-3 text-sm text-red-700">
          <AlertCircle size={15} className="shrink-0" />
          {error}
        </div>
      )}

      {/* Kết quả */}
      {searched && !loading && (
        <>
          {results.length === 0 ? (
            <Card>
              <CardContent className="py-12 text-center text-stone-400">
                <Search size={32} className="mx-auto mb-3 opacity-30" />
                <div className="font-medium">Không tìm thấy thẻ nào</div>
                <div className="text-xs mt-1">
                  {user?.role === "CTV"
                    ? "Biển số này chưa được phát hành trong tài khoản của bạn"
                    : "Biển số này chưa có trong hệ thống"}
                </div>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-3">
              <div className="text-xs text-stone-500 font-medium">
                Tìm thấy {results.length} kết quả{results.length >= 10 ? " (hiển thị 10 gần nhất)" : ""}
              </div>
              {results.map((policy) => (
                <Card
                  key={policy.id}
                  className="cursor-pointer hover:border-orange-300 hover:shadow-md transition-all duration-150"
                  onClick={() => setSelected(policy)}
                >
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-semibold text-stone-900 truncate">{policy.customerName}</div>
                        <div className="font-mono text-sm text-orange-600 font-bold mt-0.5">{policy.plateNumber}</div>
                        <div className="text-xs text-stone-500 mt-1 font-mono">{cleanGCN(policy.certificateNumber)}</div>
                      </div>
                      <div className="text-right shrink-0 space-y-1.5">
                        <Badge className={`block w-fit ml-auto ${statusStyle[policy.status]}`}>
                          {statusText[policy.status]}
                        </Badge>
                        {policy.premium && (
                          <div className="text-xs font-semibold text-stone-700">{money(policy.premium)}</div>
                        )}
                        <div className="text-xs text-stone-400">{dateTime(policy.createdAt)}</div>
                      </div>
                    </div>

                    {policy.user && user?.role !== "CTV" && (
                      <div className="mt-2 pt-2 border-t text-xs text-stone-400">
                        Phát hành bởi: <span className="text-stone-600 font-medium">{policy.user.fullName}</span>
                      </div>
                    )}

                    {/* Quick actions */}
                    {policy.pdfUrl && (
                      <div className="mt-2 pt-2 border-t">
                        <div
                          className="text-xs text-orange-600 hover:text-orange-700 font-medium truncate"
                          onClick={e => {
                            e.stopPropagation();
                            navigator.clipboard.writeText(policy.pdfUrl!);
                          }}
                          title="Click để copy link PDF"
                        >
                          🔗 {policy.pdfUrl.length > 60 ? policy.pdfUrl.slice(0, 60) + "..." : policy.pdfUrl}
                        </div>
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </>
      )}

      {/* Modal chi tiết */}
      {selected && (
        <PolicyDetailModal
          policy={selected}
          onClose={() => setSelected(null)}
        />
      )}
    </div>
  );
}
